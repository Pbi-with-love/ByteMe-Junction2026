"""Pure milk quote planning from verified catalog and upstream data."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, ROUND_CEILING, ROUND_HALF_UP
from typing import Any

from backend.app.policy import check_plan, check_product
from backend.app.units import UnitConversionError, convert_need_to_sales_units


@dataclass(frozen=True)
class _Candidate:
    product: dict[str, Any]
    price: dict[str, Any]
    availability: dict[str, Any]
    sales_unit: str
    litres_per_sale: Decimal
    unit_price_cents: int
    reliability: float | None
    sustainability: float | None


def build_milk_plans(
    *,
    products: list[dict[str, Any]],
    prices: list[dict[str, Any]],
    availability: list[dict[str, Any]],
    need_amount: Decimal,
    deadline: str,
    mandate: dict[str, Any],
    now: datetime,
) -> dict[str, Any]:
    """Build deterministic best, better, and good plans for a litre need.

    Products with a RED product policy result or an unambiguous unit conversion
    are excluded before any plan is assembled.
    """
    price_by_id = {str(row.get("productId")): row for row in prices}
    availability_by_id = {str(row.get("productId")): row for row in availability}
    candidates: list[_Candidate] = []
    excluded: list[dict[str, str]] = []

    for product in sorted(products, key=lambda value: str(value.get("id", ""))):
        product_id = str(product.get("id", ""))
        policy = check_product(product, mandate)
        if policy.light == "RED":
            excluded.append(
                {
                    "productId": product_id,
                    "light": "RED",
                    "reason": policy.reasons[0],
                }
            )
            continue
        price = price_by_id.get(product_id)
        availability_row = availability_by_id.get(product_id)
        if price is None or availability_row is None:
            excluded.append(
                {"productId": product_id, "light": "RED", "reason": "DATA_BOUNDARY"}
            )
            continue
        try:
            conversion = convert_need_to_sales_units(
                product, amount=Decimal("1"), unit="l"
            )
            unit_price_cents = _price_cents(price)
        except (UnitConversionError, ValueError):
            excluded.append(
                {
                    "productId": product_id,
                    "light": "RED",
                    "reason": "UNIT_UNCONVERTIBLE",
                }
            )
            continue
        candidates.append(
            _Candidate(
                product=product,
                price=price,
                availability=availability_row,
                sales_unit=conversion.sales_unit,
                litres_per_sale=conversion.delivered_amount,
                unit_price_cents=unit_price_cents,
                reliability=_number_or_none(product.get("deliveryReliability")),
                sustainability=_number_or_none(product.get("sustainabilityScore")),
            )
        )

    single_plans = [
        plan
        for candidate in candidates
        if (plan := _single_product_plan(candidate, need_amount, deadline, mandate, now))
        is not None
    ]
    delayed = [plan for plan in single_plans if _has_late_line(plan, deadline)]
    on_time = [plan for plan in single_plans if not _has_late_line(plan, deadline)]
    split_plans = [
        plan
        for index, first in enumerate(candidates)
        for second in candidates[index + 1 :]
        if (plan := _split_product_plan(
            first, second, need_amount, deadline, mandate, now
        ))
        is not None
    ]

    selected: list[dict[str, Any]] = []
    if split_plans:
        selected.append(_ranked(split_plans, "best", recommended=True)[0])
    if delayed:
        selected.append(_ranked(delayed, "better")[0])
    if on_time:
        selected.append(_ranked(on_time, "good")[0])
    _score_plans(selected, candidates, need_amount, mandate)
    selected.sort(
        key=lambda plan: (
            -plan["score"]["total"],
            tuple(line["productId"] for line in plan["lines"]),
        )
    )
    if selected:
        selected[0]["recommended"] = True
    for index, plan in enumerate(selected):
        plan["planId"] = f"pln_{index + 1}"
    return {"plans": selected[:3], "excludedProducts": excluded}


def _single_product_plan(
    candidate: _Candidate,
    need_amount: Decimal,
    deadline: str,
    mandate: dict[str, Any],
    now: datetime,
) -> dict[str, Any] | None:
    remaining = need_amount
    lines: list[dict[str, Any]] = []
    for schedule in _schedules(candidate):
        if remaining <= 0:
            break
        available = Decimal(str(schedule.get("availableAmount", 0)))
        if available <= 0:
            continue
        sales_quantity = min(
            available,
            (remaining / candidate.litres_per_sale).to_integral_value(ROUND_CEILING),
        )
        if sales_quantity <= 0:
            continue
        delivered = sales_quantity * candidate.litres_per_sale
        lines.append(_line(candidate, int(sales_quantity), delivered, schedule, False))
        remaining -= delivered
    if remaining > 0 or not lines:
        return None
    return _finish_plan(lines, candidate.product, deadline, mandate, now)


def _split_product_plan(
    first: _Candidate,
    second: _Candidate,
    need_amount: Decimal,
    deadline: str,
    mandate: dict[str, Any],
    now: datetime,
) -> dict[str, Any] | None:
    first_capacity = sum(
        Decimal(str(schedule.get("availableAmount", 0))) * first.litres_per_sale
        for schedule in _schedules(first)
    )
    first_amount = min(first_capacity, need_amount)
    if first_amount <= 0:
        return None
    first_lines = _lines_for_amount(first, first_amount, False)
    second_lines = _lines_for_amount(second, need_amount - first_amount, True)
    if not second_lines:
        return None
    lines = first_lines + second_lines
    return _finish_plan(lines, first.product, deadline, mandate, now)


def _lines_for_amount(
    candidate: _Candidate, amount: Decimal, substitute: bool
) -> list[dict[str, Any]]:
    remaining = amount
    lines: list[dict[str, Any]] = []
    for schedule in _schedules(candidate):
        if remaining <= 0:
            break
        available = Decimal(str(schedule.get("availableAmount", 0)))
        quantity = min(
            available,
            (remaining / candidate.litres_per_sale).to_integral_value(ROUND_CEILING),
        )
        if quantity <= 0:
            continue
        delivered = quantity * candidate.litres_per_sale
        lines.append(_line(candidate, int(quantity), delivered, schedule, substitute))
        remaining -= delivered
    return lines if remaining <= 0 else []


def _line(
    candidate: _Candidate,
    sales_quantity: int,
    delivered: Decimal,
    schedule: dict[str, Any],
    substitute: bool,
) -> dict[str, Any]:
    return {
        "productId": str(candidate.product.get("id")),
        "quantity": {"amount": _number(delivered), "unit": "l"},
        "salesQuantity": {"amount": sales_quantity, "unit": candidate.sales_unit},
        "unitPrice": {"cents": candidate.unit_price_cents, "currency": "EUR"},
        "lineTotal": {
            "cents": sales_quantity * candidate.unit_price_cents,
            "currency": "EUR",
        },
        "availableDate": schedule.get("availableDate"),
        "isSubstitute": substitute,
    }


def _finish_plan(
    lines: list[dict[str, Any]],
    product: dict[str, Any],
    deadline: str,
    mandate: dict[str, Any],
    now: datetime,
) -> dict[str, Any]:
    total_cents = sum(line["lineTotal"]["cents"] for line in lines)
    plan = {
        "lines": lines,
        "total": {"cents": total_cents, "currency": "EUR"},
        "onTime": {
            "amount": _number(
                sum(
                    Decimal(str(line["quantity"]["amount"]))
                    for line in lines
                    if not _after_deadline(line.get("availableDate"), deadline)
                )
            ),
            "unit": "l",
        },
        "deadline": deadline,
        "category": product.get("category"),
    }
    result = check_plan(plan, mandate, now=now)
    plan["policy"] = {"light": result.light, "reasons": list(result.reasons)}
    return plan


def _schedules(candidate: _Candidate) -> list[dict[str, Any]]:
    values = candidate.availability.get("scheduleLines", [])
    return sorted(
        (value for value in values if isinstance(value, dict)),
        key=lambda value: (str(value.get("availableDate", "")), str(value.get("salesUnit", ""))),
    )


def _price_cents(price: dict[str, Any]) -> int:
    value = price.get("priceWithTax", {}).get("value")
    if value is None:
        raise ValueError("Price is missing.")
    return int((Decimal(str(value)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _has_late_line(plan: dict[str, Any], deadline: str) -> bool:
    return any(_after_deadline(line.get("availableDate"), deadline) for line in plan["lines"])


def _after_deadline(value: Any, deadline: str) -> bool:
    return isinstance(value, str) and isinstance(deadline, str) and value > deadline[:10]


def _ranked(
    plans: list[dict[str, Any]], tier: str, recommended: bool = False
) -> list[dict[str, Any]]:
    ranked = sorted(
        plans,
        key=lambda plan: (
            plan["total"]["cents"],
            tuple(line["productId"] for line in plan["lines"]),
        ),
    )
    for plan in ranked:
        plan["tier"] = tier
        plan["recommended"] = False
    return ranked


def _score_plans(
    plans: list[dict[str, Any]],
    candidates: list[_Candidate],
    need_amount: Decimal,
    mandate: dict[str, Any],
) -> None:
    if not plans:
        return
    by_id = {str(candidate.product.get("id")): candidate for candidate in candidates}
    cheapest = min(plan["total"]["cents"] for plan in plans)
    priorities = mandate.get("priorities", ["on_time", "price", "sustainability"])
    weights = dict(zip(priorities, (0.5, 0.3, 0.2)))
    for plan in plans:
        on_time_amount = Decimal(str(plan["onTime"]["amount"]))
        on_time = min(Decimal("1"), on_time_amount / need_amount)
        price = Decimal(cheapest) / Decimal(plan["total"]["cents"])
        metrics = [
            by_id[line["productId"]]
            for line in plan["lines"]
            if line["productId"] in by_id
        ]
        known_sustainability = [
            value.sustainability
            for value in metrics
            if value.sustainability is not None
        ]
        sustainability = (
            Decimal(str(sum(known_sustainability) / len(known_sustainability)))
            if known_sustainability
            else Decimal("0")
        )
        known_reliability = [
            value.reliability for value in metrics if value.reliability is not None
        ]
        reliability_penalty = (
            sum(Decimal(str(1 - value)) for value in known_reliability)
            / len(known_reliability)
            if known_reliability
            else Decimal("0")
        )
        values = {
            "on_time": on_time,
            "price": price,
            "sustainability": sustainability,
        }
        total = sum(
            values[name] * Decimal(str(weight))
            for name, weight in weights.items()
            if name in values
        ) - reliability_penalty * Decimal("0.1")
        plan["score"] = {
            "total": round(float(total), 6),
            "onTime": round(float(on_time), 6),
            "price": round(float(price), 6),
            "sustainability": round(float(sustainability), 6),
            "reliabilityPenalty": round(float(reliability_penalty), 6),
        }


def _number_or_none(value: Any) -> float | None:
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def _tier_order(tier: str) -> int:
    return {"best": 0, "better": 1, "good": 2}.get(tier, 3)


def _number(value: Decimal) -> int | float:
    return int(value) if value == value.to_integral_value() else float(value)
