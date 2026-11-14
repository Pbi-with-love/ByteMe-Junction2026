"""Deterministic scoring and receipt formatting for completed game sessions."""

from __future__ import annotations

from typing import Any


ALLERGEN_NAMES = {"AE": "egg", "AP": "peanut", "AM": "almond", "AW": "walnut", "ML": "milk"}


def score_session(*, orders: list[dict[str, Any]], needs: list[dict[str, Any]], hidden_requirements: dict[str, Any], approvals: list[dict[str, Any]], hearts_left: int, log_head_hash: str | None = None) -> dict[str, Any]:
    counted = [order for order in orders if order.get("status") in {"ORDERED", "CONFIRMED"}]
    need_qty = sum(_amount(need.get("quantity")) for need in needs)
    delivered = 0.0
    timely = 0.0
    total_cents = 0
    incident = None
    unsafe = set(hidden_requirements.get("excludeAllergens", []))
    unreliable_lines = 0
    overspend = 0.0
    for order in counted:
        plan = _final_plan(order)
        total_cents += _cents(plan.get("total")) or sum(_cents(line.get("lineTotal")) for line in plan.get("lines", []))
        delivered += sum(_amount(line.get("quantity")) for line in plan.get("lines", []))
        quote = plan.get("quote") or order.get("quote") or {}
        deadline = plan.get("deadline") or quote.get("deadline")
        for line in plan.get("lines", []):
            quantity = _amount(line.get("quantity"))
            if _on_time(line.get("availableDate"), deadline):
                timely += quantity
            allergens = set(line.get("allergens", [])) | set(line.get("mayContain", line.get("allergensMayContain", [])))
            bad = allergens & unsafe
            if bad and incident is None:
                code = sorted(bad)[0]
                name = ALLERGEN_NAMES.get(code, code.lower())
                incident = {"type": "SAFETY", "productId": str(line.get("productId", "")), "reason": f"Contains {name} ({code})"}
            reliability = line.get("deliveryReliability")
            if reliability is not None and float(reliability) < 0.8:
                unreliable_lines += 1
        baseline = _baseline(quote, plan, unsafe)
        chosen_cents = _cents(plan.get("total"))
        if baseline and chosen_cents is not None:
            overspend = max(overspend, max(0, chosen_cents - baseline) / baseline * 100)
    kitchen = min(100, round(100 * timely / need_qty)) if need_qty else 100
    wallet = max(0, round(100 - 3 * overspend)) if counted else 100
    safety = 0 if incident else max(0, 100 - 20 * unreliable_lines)
    stars = 0 if safety == 0 else 3 if kitchen == 100 and wallet >= 90 and safety == 100 and hearts_left >= 1 else 2 if kitchen >= 90 and safety >= 80 else 1
    result = {"kitchen": kitchen, "wallet": wallet, "safety": safety, "stars": stars,
              "incident": incident, "approvalsAsked": len(approvals), "heartsUsed": 3 - hearts_left,
              "totalCost": {"cents": total_cents, "currency": "EUR"} if counted else None,
              "logHeadHash": log_head_hash}
    result["receiptText"] = receipt_text(approvals, needs, timely, incident)
    return result


def receipt_text(approvals: list[dict[str, Any]], needs: list[dict[str, Any]], timely: float, incident: dict[str, Any] | None) -> str:
    sentences: list[str] = []
    for approval in approvals:
        status = str(approval.get("status", "")).upper()
        product = approval.get("productName") or approval.get("summary") or "order"
        if approval.get("chosenPlanId"):
            sentences.append(f"Chose plan {approval['chosenPlanId']}.")
        elif status in {"APPROVED", "APPROVE"}:
            price = _cents(approval.get("total"))
            suffix = f" for {_money(price)}" if price is not None else ""
            sentences.append(f"Approved {product}{suffix}.")
        elif status in {"REJECTED", "REJECT"}:
            sentences.append(f"Rejected {product}.")
        elif status in {"EXPIRED", "ATTENTION_EXHAUSTED"}:
            sentences.append("Expired unseen: no hearts left." if approval.get("heartsLeft", 0) == 0 or approval.get("reason") == "ATTENTION_EXHAUSTED" else f"Expired {product}.")
        elif approval.get("chosenPlanId"):
            sentences.append(f"Chose plan {approval['chosenPlanId']} for {product}.")
        else:
            sentences.append(f"Approved {product}.")
        explanation = approval.get("agentExplanation")
        if isinstance(explanation, str) and explanation.strip():
            sentences.append(f"Agent explanation: {explanation.strip()}")
    total_need = sum(_amount(need.get("quantity")) for need in needs)
    if timely < total_need:
        unit = next((need.get("quantity", {}).get("unit", "units") for need in needs if need.get("quantity")), "units")
        shortfall = _format_num(total_need - timely)
        sentences.append(f"{shortfall} {unit} did not arrive on time.")
    if incident:
        sentences.append(f"Safety incident: {incident['reason']}.")
    return " ".join(sentences)


def _final_plan(order: dict[str, Any]) -> dict[str, Any]:
    plan = order.get("finalPlan") or order.get("plan") or order.get("order", {}).get("plan") or {}
    if "lines" not in plan and isinstance(order.get("lines"), list):
        return {**plan, "lines": order["lines"], "total": plan.get("total", order.get("total"))}
    return plan


def _baseline(quote: dict[str, Any], chosen: dict[str, Any], unsafe: set[str]) -> int | None:
    plans = quote.get("plans", [])
    def compliant(plan: dict[str, Any]) -> bool:
        return not any((set(line.get("allergens", [])) | set(line.get("mayContain", line.get("allergensMayContain", [])))) & unsafe for line in plan.get("lines", [])) and not any(reason in {"SUBSTITUTION_NOT_ALLOWED", "LATE_DELIVERY", "ALLERGEN_EXCLUDED"} for reason in plan.get("policy", {}).get("reasons", []))
    compliant_plans = [p for p in plans if compliant(p)]
    full = [p for p in compliant_plans if _plan_on_time_qty(p) >= _amount(quote.get("need", {}).get("quantity"))]
    candidate = min(full or compliant_plans, key=lambda p: _cents(p.get("total")) if _cents(p.get("total")) is not None else 10**30, default=None)
    if candidate:
        return _cents(candidate.get("total"))
    return _cents(chosen.get("total"))


def _plan_on_time_qty(plan: dict[str, Any]) -> float:
    return sum(_amount(line.get("quantity")) for line in plan.get("lines", []) if _on_time(line.get("availableDate"), plan.get("deadline")))


def _on_time(date: Any, deadline: Any) -> bool:
    if not isinstance(date, str): return False
    if not deadline: return True
    return date[:10] <= str(deadline)[:10]


def _amount(value: Any) -> float:
    if isinstance(value, dict): value = value.get("amount", 0)
    try: return float(value or 0)
    except (TypeError, ValueError): return 0


def _cents(value: Any) -> int | None:
    if isinstance(value, dict): value = value.get("cents")
    try: return int(value) if value is not None else None
    except (TypeError, ValueError): return None


def _money(cents: int | None) -> str:
    if cents is None: return "€0,00"
    whole, fraction = divmod(cents, 100)
    groups = f"{whole:,}".replace(",", " ")
    return f"€{groups},{fraction:02d}"


def _format_num(value: float) -> str:
    return str(int(value)) if value.is_integer() else str(value).replace(".", ",")
