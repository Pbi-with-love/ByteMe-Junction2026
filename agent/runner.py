"""Deterministic buyer agent that communicates only through gateway HTTP."""
from __future__ import annotations

import asyncio
import copy
from typing import Any, Awaitable, Callable
from uuid import uuid4


async def run_agent(http: Any, *, agent_token: str, mandate_id: str,
                    needs: list[dict[str, Any]], explain: Callable[..., Any],
                    on_step: Callable[[dict[str, Any]], Any], poll_interval: float,
                    on_activity: Callable[[str], Any] | None = None) -> None:
    headers = {"Authorization": f"Bearer {agent_token}"}

    async def request(method: str, path: str, **kwargs: Any) -> Any:
        label = "searching" if path == "/v1/search" else "quoting" if path == "/v1/quotes" or "/requote" in path else "ordering"
        if on_activity:
            changed = on_activity(label)
            if hasattr(changed, "__await__"): await changed
        response = await http.request(method, path, headers={**headers, **kwargs.pop("headers", {})}, **kwargs)
        if on_activity:
            changed = on_activity("idle")
            if hasattr(changed, "__await__"): await changed
        return response

    for need in needs:
        search_response = await request("POST", "/v1/search", json={"query": need.get("description", ""), "filters": {}, "limit": 20, "mandateId": mandate_id})
        search = search_response.json()
        quantity = float(need.get("quantity", {}).get("amount", 0))
        primary = need.get("primaryProductId")
        original_candidates = list(need.get("candidateProductIds", []))
        quote = await _quote(request, mandate_id, need)
        if not quote.get("plans"):
            continue
        selected = _recommended(quote)
        selected_reasons = set(selected.get("policy", {}).get("reasons", []))
        all_reasons = selected_reasons | {reason for plan in quote["plans"] for reason in plan.get("policy", {}).get("reasons", [])}
        split_qty = 0.0
        if {"SUBSTITUTION_NOT_ALLOWED", "LATE_DELIVERY"} & all_reasons and primary:
            on_time_primary = [line for plan in quote["plans"] for line in plan.get("lines", [])
                               if str(line.get("productId")) == str(primary)
                               and _on_time(line.get("availableDate"), need.get("deadline"))]
            split_qty = max((_amount(line.get("quantity")) for line in on_time_primary), default=0)
        if 0 < split_qty < quantity:
            subneed = copy.deepcopy(need)
            subneed["quantity"]["amount"] = split_qty
            subneed["candidateProductIds"] = [str(primary)]
            await _place(request, search, subneed, _quote(request, mandate_id, subneed), explain, on_step, on_activity, poll_interval)
            remainder = copy.deepcopy(need)
            remainder["quantity"]["amount"] = quantity - split_qty
            await _top_up(request, search, mandate_id, remainder, original_candidates, explain, on_step, on_activity, poll_interval)
        else:
            await _place(request, search, need, _resolved(quote), explain, on_step, on_activity, poll_interval)


def _error_code(response: Any) -> str | None:
    try:
        return response.json().get("error", {}).get("code")
    except (ValueError, AttributeError):
        return None


async def _resolved(value: Any) -> Any:
    return value


def _amount(value: Any) -> float:
    if isinstance(value, dict): value = value.get("amount", 0)
    try: return float(value or 0)
    except (TypeError, ValueError): return 0


def _on_time(date: Any, deadline: Any) -> bool:
    return isinstance(date, str) and (not deadline or date[:10] <= str(deadline)[:10])


def _recommended(quote: dict[str, Any]) -> dict[str, Any]:
    plans = quote.get("plans", [])
    return next((p for p in plans if p.get("planId") == quote.get("recommendedPlanId")), plans[0])


async def _quote(request: Any, mandate_id: str, need: dict[str, Any]) -> dict[str, Any]:
    response = await request("POST", "/v1/quotes", json={"mandateId": mandate_id, "need": need})
    return response.json()


async def _place(request: Any, search: dict[str, Any], need: dict[str, Any], quote_awaitable: Any,
                 explain: Callable[..., Any], on_step: Callable[[dict[str, Any]], Any],
                 on_activity: Callable[[str], Any] | None, poll_interval: float) -> str | None:
    quote = await quote_awaitable
    if not quote.get("plans"): return None
    plan_id = _recommended(quote).get("planId")
    if not plan_id: return None
    response = await request("POST", "/v1/orders", json={"quoteId": quote["quoteId"], "planId": plan_id}, headers={"Idempotency-Key": str(uuid4())})
    if response.status_code == 409 and _error_code(response) == "QUOTE_EXPIRED":
        refreshed = (await request("POST", f"/v1/quotes/{quote['quoteId']}/requote", json={})).json().get("quote", {})
        if not refreshed.get("plans"): return None
        quote = refreshed
        plan_id = _recommended(quote).get("planId")
        response = await request("POST", "/v1/orders", json={"quoteId": quote["quoteId"], "planId": plan_id}, headers={"Idempotency-Key": str(uuid4())})
    if response.status_code == 403 or response.status_code not in {201, 202}: return None
    order = response.json()
    if response.status_code == 202 and order.get("approvalId"):
        if on_activity:
            result = on_activity("explaining")
            if hasattr(result, "__await__"): await result
        explanation = explain(need=need, plans=quote.get("plans", []), recommended_plan_id=plan_id, approval_reasons=order.get("reasons", []), per_order_limit=None, non_valio_brands=[])
        if hasattr(explanation, "__await__"): explanation = await explanation
        if on_activity:
            result = on_activity("idle")
            if hasattr(result, "__await__"): await result
        await request("POST", f"/v1/approvals/{order['approvalId']}/explanation", json={"explanation": explanation})
    reported = on_step({"search": search, "quote": quote, "order": {"httpStatus": response.status_code, "body": order}})
    if hasattr(reported, "__await__"): await reported
    final_status = order.get("status")
    if response.status_code == 202 and final_status == "PENDING_APPROVAL":
        while True:
            await asyncio.sleep(poll_interval)
            status = await request("GET", f"/v1/orders/{order['orderId']}")
            if status.status_code != 200: break
            final_status = status.json().get("status")
            if final_status != "PENDING_APPROVAL": break
    return final_status


async def _top_up(request: Any, search: dict[str, Any], mandate_id: str, need: dict[str, Any],
                  candidates: list[str], explain: Callable[..., Any], on_step: Callable[[dict[str, Any]], Any],
                  on_activity: Callable[[str], Any] | None, poll_interval: float) -> None:
    remaining = list(candidates)
    while remaining:
        top_need = copy.deepcopy(need)
        top_need["candidateProductIds"] = remaining
        quote = await _quote(request, mandate_id, top_need)
        if not quote.get("plans"): return
        plan = _recommended(quote)
        status = await _place(request, search, top_need, _resolved(quote), explain, on_step, on_activity, poll_interval)
        if status != "REJECTED": return
        substituted = {str(line.get("productId")) for line in plan.get("lines", []) if str(line.get("productId")) != str(need.get("primaryProductId"))}
        rejected_products = substituted or {str(line.get("productId")) for line in plan.get("lines", [])}
        if not rejected_products: return
        remaining = [candidate for candidate in remaining if candidate not in rejected_products]
