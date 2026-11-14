"""Structured, number-validated order explanations with deterministic fallback."""

from __future__ import annotations

import asyncio
import json
import os
import re
from typing import Any

_SYSTEM = "Use only facts and numbers from the supplied decision record. If the recommended plan uses a non-Valio brand, say so plainly. Write 2-3 short sentences."


def llm_settings() -> dict[str, str | None]:
    return {"api_key": os.getenv("ANTHROPIC_API_KEY") or None, "model": os.getenv("ANTHROPIC_MODEL") or "claude-haiku-5-5"}


def decision_record(*, need: dict[str, Any], plans: list[dict[str, Any]], recommended_plan_id: str | None, approval_reasons: list[str], per_order_limit: Any, non_valio_brands: list[str]) -> dict[str, Any]:
    simplified = []
    for plan in plans:
        simplified.append({"planId": plan.get("planId"), "tier": plan.get("tier"), "summary": plan.get("summary") or plan.get("summaryText"), "total": plan.get("total"), "onTime": plan.get("onTime"), "light": plan.get("policy", {}).get("light"), "reasons": plan.get("policy", {}).get("reasons", [])})
    return {"need": need, "plans": simplified, "recommendedPlanId": recommended_plan_id, "approvalReasons": approval_reasons, "perOrderLimit": per_order_limit, "nonValioBrands": non_valio_brands}


def template_explanation(*, need: dict[str, Any], plans: list[dict[str, Any]], recommended_plan_id: str | None, approval_reasons: list[str] | None = None) -> str:
    plan = next((p for p in plans if p.get("planId") == recommended_plan_id), None)
    need_text = need.get("description", "the requested items")
    summary = (plan or {}).get("summary") or (plan or {}).get("summaryText") or "the recommended plan"
    reasons = ", ".join(approval_reasons or (plan or {}).get("policy", {}).get("reasons", []))
    sentence = f"The recommended plan is {summary} for {need_text}."
    if reasons:
        sentence += f" Approval is needed because {reasons.replace('_', ' ').lower()}."
    return sentence


async def explain_order(*, need: dict[str, Any], plans: list[dict[str, Any]], recommended_plan_id: str | None, approval_reasons: list[str], per_order_limit: Any, non_valio_brands: list[str] | None = None, client: Any = None, api_key: str | None = None, model: str | None = None) -> str:
    settings = llm_settings()
    api_key = settings["api_key"] if api_key is None else api_key
    model = model or str(settings["model"])
    fallback = template_explanation(need=need, plans=plans, recommended_plan_id=recommended_plan_id, approval_reasons=approval_reasons)
    if not api_key:
        return fallback
    record = decision_record(need=need, plans=plans, recommended_plan_id=recommended_plan_id, approval_reasons=approval_reasons, per_order_limit=per_order_limit, non_valio_brands=non_valio_brands or [])
    try:
        if client is None:
            from anthropic import AsyncAnthropic
            client = AsyncAnthropic(api_key=api_key, timeout=3.0, max_retries=0)
        response = await asyncio.wait_for(client.messages.create(model=model, max_tokens=300, thinking={"type": "disabled"}, output_config={"effort": "low"}, system=_SYSTEM, messages=[{"role": "user", "content": json.dumps(record, ensure_ascii=False)}]), timeout=3.5)
        if _get(response, "stop_reason") != "end_turn": return fallback
        text = "".join(_get(item, "text", "") for item in _get(response, "content", []) if _get(item, "type") == "text").strip()
        allowed_numbers = set(_numbers(json.dumps(record, ensure_ascii=False) + " " + fallback))
        if not text or any(number not in allowed_numbers for number in _numbers(text)):
            return fallback
        return text
    except Exception:
        return fallback


def _get(value: Any, key: str, default: Any = None) -> Any:
    return value.get(key, default) if isinstance(value, dict) else getattr(value, key, default)


def _numbers(value: str) -> list[str]:
    return [re.sub(r"[ ,.]+", "", token) for token in re.findall(r"\d+(?:[ ,.]+\d+)*", value)]


async def template_explainer(*, need: dict[str, Any], plans: list[dict[str, Any]], recommended_plan_id: str | None, approval_reasons: list[str] | None = None, per_order_limit: Any = None, non_valio_brands: list[str] | None = None) -> str:
    """Template-only path used by the gateway and deterministic tests."""
    delay_ms = int(os.getenv("EXPLAIN_DELAY_MS", "0") or "0")
    if delay_ms > 0:
        await asyncio.sleep(delay_ms / 1000)
    return template_explanation(need=need, plans=plans, recommended_plan_id=recommended_plan_id, approval_reasons=approval_reasons)
