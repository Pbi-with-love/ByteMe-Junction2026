"""Deterministic buyer agent that communicates only through gateway HTTP."""
from __future__ import annotations

import asyncio
from typing import Any, Awaitable, Callable
from uuid import uuid4


async def run_agent(http: Any, *, agent_token: str, mandate_id: str,
                    needs: list[dict[str, Any]], explain: Callable[..., Any],
                    on_step: Callable[[dict[str, Any]], Any], poll_interval: float) -> None:
    headers = {"Authorization": f"Bearer {agent_token}"}

    async def request(method: str, path: str, **kwargs: Any) -> Any:
        response = await http.request(method, path, headers={**headers, **kwargs.pop("headers", {})}, **kwargs)
        return response

    for need in needs:
        search_response = await request("POST", "/v1/search", json={"query": need.get("description", ""), "filters": {}, "limit": 20, "mandateId": mandate_id})
        search = search_response.json()
        quote_response = await request("POST", "/v1/quotes", json={"mandateId": mandate_id, "need": need})
        quote = quote_response.json()
        plans = quote.get("plans", [])
        if not plans:
            continue
        selected = next((plan for plan in plans if plan.get("planId") == quote.get("recommendedPlanId")), plans[0])
        plan_id = selected.get("planId")
        if not plan_id:
            continue
        body = {"quoteId": quote["quoteId"], "planId": plan_id}
        order_response = await request("POST", "/v1/orders", json=body, headers={"Idempotency-Key": str(uuid4())})
        if order_response.status_code == 409 and _error_code(order_response) == "QUOTE_EXPIRED":
            requote_response = await request("POST", f"/v1/quotes/{quote['quoteId']}/requote", json={})
            refreshed = requote_response.json().get("quote", {})
            refreshed_plans = refreshed.get("plans", [])
            if not refreshed_plans:
                continue
            refreshed_plan = next((p for p in refreshed_plans if p.get("planId") == refreshed.get("recommendedPlanId")), refreshed_plans[0])
            body = {"quoteId": refreshed["quoteId"], "planId": refreshed_plan["planId"]}
            order_response = await request("POST", "/v1/orders", json=body, headers={"Idempotency-Key": str(uuid4())})
            quote = refreshed
        if order_response.status_code == 403:
            continue
        if order_response.status_code not in {201, 202}:
            continue
        order = order_response.json()
        step = {"search": search, "quote": quote, "order": {"httpStatus": order_response.status_code, "body": order}}
        approval_id = order.get("approvalId")
        if order_response.status_code == 202 and approval_id:
            explanation = explain(need=need, plans=quote.get("plans", []), recommended_plan_id=plan_id,
                                  approval_reasons=order.get("reasons", []), per_order_limit=None,
                                  non_valio_brands=[])
            if hasattr(explanation, "__await__"):
                explanation = await explanation
            await request("POST", f"/v1/approvals/{approval_id}/explanation", json={"explanation": explanation})
        result = on_step(step)
        if hasattr(result, "__await__"):
            await result
        if order_response.status_code == 202 and order.get("status") == "PENDING_APPROVAL":
            while True:
                await asyncio.sleep(poll_interval)
                status_response = await request("GET", f"/v1/orders/{order['orderId']}")
                if status_response.status_code != 200 or status_response.json().get("status") != "PENDING_APPROVAL":
                    break


def _error_code(response: Any) -> str | None:
    try:
        return response.json().get("error", {}).get("code")
    except (ValueError, AttributeError):
        return None
