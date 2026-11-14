"""Pure, fail-closed mandate policy evaluation."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any


LIGHT_ORDER = {"GREEN": 0, "BLUE": 1, "YELLOW": 2, "RED": 3}
VERIFIED_ALLERGEN_CODES = {"peanut": "AP"}
VERIFIED_SOURCE_ALLERGEN_CODES = frozenset({"AP"})


@dataclass(frozen=True)
class PolicyResult:
    light: str
    reasons: tuple[str, ...]


def check_product(product: dict[str, Any], mandate: dict[str, Any]) -> PolicyResult:
    reasons: list[str] = []
    if product.get("salesBlock") is True:
        reasons.append("SALES_BLOCKED")

    excluded_values = set(
        mandate.get("hardConstraints", {}).get("excludeAllergens", [])
    )
    excluded_allergens = {
        VERIFIED_ALLERGEN_CODES.get(value, value)
        for value in excluded_values
        if isinstance(value, str)
    }
    if excluded_allergens:
        allergen_data = product.get("allergens")
        verified = product.get("allergenDataVerified") is True
        unknown_mapping = any(
            value not in VERIFIED_ALLERGEN_CODES
            and value not in VERIFIED_SOURCE_ALLERGEN_CODES
            for value in excluded_values
            if isinstance(value, str)
        )
        if unknown_mapping or not verified or not isinstance(allergen_data, list):
            reasons.append("ALLERGEN_EXCLUDED")
        elif excluded_allergens.intersection(allergen_data):
            reasons.append("ALLERGEN_EXCLUDED")

    required_labels = set(mandate.get("hardConstraints", {}).get("requireLabels", []))
    if required_labels:
        labels = product.get("labels")
        if not product.get("labelDataVerified") is True or not isinstance(labels, list):
            reasons.append("LABEL_REQUIRED")
        elif not required_labels.issubset(labels):
            reasons.append("LABEL_REQUIRED")

    return _result_for_reasons(reasons)


def check_plan(
    plan: dict[str, Any] | None,
    mandate: dict[str, Any] | None,
    *,
    committed_week_total_cents: int = 0,
    now: datetime,
) -> PolicyResult:
    if mandate is None or mandate.get("status") != "ACTIVE":
        return PolicyResult("RED", ("MANDATE_INVALID",))
    if _is_expired(mandate.get("validUntil"), now):
        return PolicyResult("RED", ("MANDATE_EXPIRED",))
    if plan is None:
        return PolicyResult("RED", ("POLICY_BLOCKED",))

    reasons: list[str] = []
    lines = plan.get("lines")
    if not isinstance(lines, list) or not lines:
        return PolicyResult("RED", ("POLICY_BLOCKED",))

    for line in lines:
        product = line.get("product", line)
        if isinstance(product, dict):
            product_result = check_product(product, mandate)
            reasons.extend(product_result.reasons)

    total_cents = _plan_total_cents(plan)
    limits = mandate.get("limits", {})
    per_order = _euros_to_cents(limits.get("perOrderEur"))
    per_week = _euros_to_cents(limits.get("perWeekEur"))
    if per_order is not None and total_cents > per_order:
        reasons.append("OVER_ORDER_LIMIT")
    if (
        per_week is not None
        and committed_week_total_cents + total_cents > per_week
    ):
        reasons.append("OVER_WEEK_LIMIT")

    substitution = mandate.get("substitution", "none")
    has_substitution = any(line.get("isSubstitute") is True for line in lines)
    if has_substitution:
        if substitution == "none":
            reasons.append("SUBSTITUTION_NOT_ALLOWED")
        elif substitution == "same_category":
            requested_category = plan.get("category")
            if requested_category is None or any(
                line.get("product", line).get("category") != requested_category
                for line in lines
                if line.get("isSubstitute") is True
            ):
                reasons.append("SUBSTITUTION_NOT_ALLOWED")
            else:
                reasons.append("SUBSTITUTION_ALLOWED")
        else:
            reasons.append("SUBSTITUTION_ALLOWED")

    if _is_split(lines):
        reasons.append("SPLIT_ORDER")

    deadline = _parse_date(plan.get("deadline"))
    late_delivery = _latest_delivery_date(lines)
    if deadline and late_delivery and late_delivery > deadline:
        tolerance = timedelta(days=1) if mandate.get("lateDelivery") == "one_day" else timedelta(0)
        if late_delivery > deadline + tolerance:
            reasons.append("LATE_DELIVERY")

    if not reasons:
        reasons.append("WITHIN_MANDATE")
    return _result_for_reasons(reasons)


def _result_for_reasons(reasons: list[str]) -> PolicyResult:
    unique_reasons = tuple(dict.fromkeys(reasons))
    if any(reason in {"SALES_BLOCKED", "ALLERGEN_EXCLUDED", "LABEL_REQUIRED",
                      "MANDATE_INVALID", "MANDATE_EXPIRED", "DATA_BOUNDARY",
                      "POLICY_BLOCKED"} for reason in unique_reasons):
        light = "RED"
    elif any(reason in {"OVER_ORDER_LIMIT", "OVER_WEEK_LIMIT",
                        "SUBSTITUTION_NOT_ALLOWED", "LATE_DELIVERY"} for reason in unique_reasons):
        light = "YELLOW"
    elif any(reason in {"SPLIT_ORDER", "SUBSTITUTION_ALLOWED"} for reason in unique_reasons):
        light = "BLUE"
    else:
        light = "GREEN"
    return PolicyResult(light, unique_reasons)


def _is_expired(value: Any, now: datetime) -> bool:
    if not isinstance(value, str):
        return True
    try:
        return now > datetime.fromisoformat(value)
    except ValueError:
        return True


def _euros_to_cents(value: Any) -> int | None:
    if value is None:
        return None
    try:
        cents = Decimal(str(value)) * 100
    except (InvalidOperation, ValueError):
        return None
    return int(cents)


def _plan_total_cents(plan: dict[str, Any]) -> int:
    total = plan.get("total", {})
    if isinstance(total, dict) and isinstance(total.get("cents"), int):
        return total["cents"]
    return sum(
        line.get("lineTotal", {}).get("cents", 0)
        for line in plan.get("lines", [])
        if isinstance(line, dict)
    )


def _is_split(lines: list[dict[str, Any]]) -> bool:
    products = {line.get("productId") for line in lines}
    dates = {line.get("availableDate") for line in lines}
    return len(products) > 1 or len(dates) > 1


def _parse_date(value: Any) -> date | None:
    if not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value).date()
    except ValueError:
        return None


def _latest_delivery_date(lines: list[dict[str, Any]]) -> date | None:
    dates = [_parse_date(line.get("availableDate")) for line in lines]
    valid_dates = [value for value in dates if value is not None]
    return max(valid_dates) if valid_dates else None
