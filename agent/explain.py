"""Structured, number-validated order explanations with deterministic fallback."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
from typing import Any

_LOG = logging.getLogger("agent.explain")
_SYSTEM = """You are explaining an order to a kitchen manager in plain English. Use only facts from the supplied decision record. Write 2-3 short sentences. Never mention internal ids (including planId values), field names such as nonValioBrands, or reason codes. Translate reasons into plain language, such as ‘substitution is not allowed in your mandate’ or ‘over your per-order limit’. Use the supplied mandate setting in one clause to explain what drove the outcome. Format money and quantities as in the kitchen UI: euro amounts with comma decimals and a space for thousands (€1 308,00), and quantities like 700 l. If a non-Valio brand is recommended, name it plainly.

Examples (use only each record's facts):
Record: {"recommended": "Valio milk", "quantity": "700 l", "total": "€805,00", "mandate": "€500 per-order limit", "reason": "OVER_PER_ORDER_LIMIT", "nonValioBrands": []}
Explanation: The order covers 700 l of Valio milk for €805,00. It needs approval because it is over your €500 per-order limit.

Record: {"recommended": "GelatoLAB pistachio ice cream", "quantity": "20 l", "total": "€168,72", "mandate": "substitution: none", "reason": "SUBSTITUTION_NOT_ALLOWED", "nonValioBrands": ["GelatoLAB"]}
Explanation: GelatoLAB is the non-Valio brand in the recommended 20 l pistachio ice cream order, which costs €168,72. It needs approval because your mandate does not allow substitutions."""


def llm_settings() -> dict[str, str | None]:
    return {"api_key": os.getenv("ANTHROPIC_API_KEY") or None, "model": os.getenv("ANTHROPIC_MODEL") or "claude-haiku-5-5"}


def decision_record(*, need: dict[str, Any], plans: list[dict[str, Any]], recommended_plan_id: str | None, approval_reasons: list[str], per_order_limit: Any, non_valio_brands: list[str]) -> dict[str, Any]:
    simplified = []
    for plan in plans:
        simplified.append({"planId": plan.get("planId"), "tier": plan.get("tier"), "summary": plan.get("summary") or plan.get("summaryText"), "total": plan.get("total"), "onTime": plan.get("onTime"), "light": plan.get("policy", {}).get("light"), "reasons": plan.get("policy", {}).get("reasons", [])})
    return {"need": need, "plans": simplified, "recommendedPlanId": recommended_plan_id, "approvalReasons": approval_reasons, "perOrderLimit": per_order_limit, "nonValioBrands": non_valio_brands}


def template_explanation(*, need: dict[str, Any], plans: list[dict[str, Any]], recommended_plan_id: str | None, approval_reasons: list[str] | None = None, per_order_limit: Any = None) -> str:
    plan = next((p for p in plans if p.get("planId") == recommended_plan_id), None)
    need_text = need.get("description", "the requested items")
    summary = (plan or {}).get("summary") or (plan or {}).get("summaryText") or "the recommended plan"
    reasons = ", ".join(approval_reasons or (plan or {}).get("policy", {}).get("reasons", []))
    sentence = f"The recommended order is {summary} for {need_text}."
    if reasons:
        if "OVER_ORDER_LIMIT" in (approval_reasons or []):
            limit = f"your €{per_order_limit},00 per-order limit" if per_order_limit is not None else "your per-order limit"
            sentence += f" It needs approval because it is over {limit}."
        elif "SUBSTITUTION_NOT_ALLOWED" in (approval_reasons or []):
            sentence += " It needs approval because your mandate does not allow substitutions."
        else:
            sentence += " It needs approval because " + _plain_reasons(approval_reasons or (plan or {}).get("policy", {}).get("reasons", [])) + "."
    return sentence


async def explain_order(*, need: dict[str, Any], plans: list[dict[str, Any]], recommended_plan_id: str | None, approval_reasons: list[str], per_order_limit: Any, non_valio_brands: list[str] | None = None, client: Any = None, api_key: str | None = None, model: str | None = None, on_outcome: Any = None) -> str:
    started = time.monotonic()
    settings = llm_settings()
    api_key = settings["api_key"] if api_key is None else api_key
    model = model or str(settings["model"])
    non_valio_brands = non_valio_brands or []
    fallback = _ensure_non_valio_disclosure(
        template_explanation(need=need, plans=plans, recommended_plan_id=recommended_plan_id, approval_reasons=approval_reasons, per_order_limit=per_order_limit),
        non_valio_brands,
    )
    if not api_key:
        return _report(fallback, "template", "no_key", started, on_outcome)
    record = decision_record(need=need, plans=plans, recommended_plan_id=recommended_plan_id, approval_reasons=approval_reasons, per_order_limit=per_order_limit, non_valio_brands=non_valio_brands or [])
    try:
        if client is None:
            from anthropic import AsyncAnthropic
            client = AsyncAnthropic(api_key=api_key, timeout=3.0, max_retries=0)
        response = await asyncio.wait_for(client.messages.create(model=model, max_tokens=300, thinking={"type": "disabled"}, output_config={"effort": "low"}, system=_SYSTEM, messages=[{"role": "user", "content": json.dumps(record, ensure_ascii=False)}]), timeout=3.5)
        stop_reason = _get(response, "stop_reason")
        if stop_reason == "refusal": return _report(fallback, "template", "refusal", started, on_outcome)
        if stop_reason == "max_tokens": return _report(fallback, "template", "max_tokens", started, on_outcome)
        if stop_reason != "end_turn": return _report(fallback, "template", "api_error", started, on_outcome)
        text = "".join(_get(item, "text", "") for item in _get(response, "content", []) if _get(item, "type") == "text").strip()
        allowed_numbers = set(_numbers(json.dumps(record, ensure_ascii=False) + " " + fallback))
        if not text or _leaks_internals(text) or any(number not in allowed_numbers for number in _numbers(text)):
            return _report(fallback, "template", "invalid_number", started, on_outcome)
        if any(brand.casefold() not in text.casefold() or "non-valio" not in text.casefold() for brand in non_valio_brands):
            return _report(fallback, "template", "missing_brand", started, on_outcome)
        return _report(text, "claude", None, started, on_outcome)
    except (asyncio.TimeoutError, TimeoutError):
        return _report(fallback, "template", "timeout", started, on_outcome)
    except Exception:
        return _report(fallback, "template", "api_error", started, on_outcome)


def _report(text: str, source: str, reason: str | None, started: float, on_outcome: Any) -> str:
    outcome = {"source": source, "reason": reason, "elapsedMs": round((time.monotonic() - started) * 1000)}
    _LOG.info(
        "explanation outcome",
        extra={"explain_outcome": {
            "outcome": "used_llm" if source == "claude" else "fallback",
            "reason": reason,
            "elapsed_ms": outcome["elapsedMs"],
        }},
    )
    if on_outcome:
        on_outcome(outcome)
    return text


def _plain_reasons(reasons: list[str]) -> str:
    translations = {
        "OVER_WEEK_LIMIT": "it is over your weekly limit",
        "LATE_DELIVERY": "the delivery would arrive after the date in your mandate",
        "ALLERGEN_EXCLUDED": "the product contains an allergen your mandate excludes",
    }
    return "; ".join(translations.get(reason, reason.replace("_", " ").lower()) for reason in reasons)


def _leaks_internals(text: str) -> bool:
    return bool(re.search(r"\bpln_[A-Za-z0-9_-]+\b|\b(?:nonValioBrands|planId|approvalReasons|perOrderLimit)\b|\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b", text))


def _ensure_non_valio_disclosure(text: str, brands: list[str]) -> str:
    missing = [brand for brand in brands if brand.casefold() not in text.casefold()]
    if not brands or ("non-valio" in text.casefold() and not missing):
        return text
    names = ", ".join(brands)
    return f"{text.rstrip()} The recommended plan uses non-Valio brand {names}."


def _get(value: Any, key: str, default: Any = None) -> Any:
    return value.get(key, default) if isinstance(value, dict) else getattr(value, key, default)


def _numbers(value: str) -> list[str]:
    # Treat locale decimal and thousands marks alike for source matching; record
    # values store money as cents, so €805.00 and 80500 share the same digits.
    return [re.sub(r"[ ,.]+", "", token) for token in re.findall(r"\d+(?:[ ,.]+\d+)*", value)]


async def template_explainer(*, need: dict[str, Any], plans: list[dict[str, Any]], recommended_plan_id: str | None, approval_reasons: list[str] | None = None, per_order_limit: Any = None, non_valio_brands: list[str] | None = None, on_outcome: Any = None) -> str:
    """Template-only path used by the gateway and deterministic tests."""
    started = time.monotonic()
    delay_ms = int(os.getenv("EXPLAIN_DELAY_MS", "0") or "0")
    if delay_ms > 0:
        await asyncio.sleep(delay_ms / 1000)
    return _report(template_explanation(need=need, plans=plans, recommended_plan_id=recommended_plan_id, approval_reasons=approval_reasons, per_order_limit=per_order_limit), "template", None, started, on_outcome)
