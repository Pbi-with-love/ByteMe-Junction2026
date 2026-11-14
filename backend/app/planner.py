"""Pure quote planning from verified catalog and upstream data."""

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
    amount_per_sale: Decimal
    need_unit: str
    unit_price_cents: int
    comparison_price_cents: int
    reliability: float | None
    sustainability: float | None


def build_plans(
    *,
    products: list[dict[str, Any]],
    prices: list[dict[str, Any]],
    availability: list[dict[str, Any]],
    need_amount: Decimal,
    unit: str,
    deadline: str,
    mandate: dict[str, Any],
    now: datetime,
    requested_product_id: str | None = None,
) -> dict[str, Any]:
    """Build deterministic plans for a need expressed in a supported unit."""
    price_by_id = {str(row.get("productId")): row for row in prices}
    availability_by_id = {str(row.get("productId")): row for row in availability}
    requested_product = next(
        (product for product in products if str(product.get("id", "")) == requested_product_id),
        min(products, key=lambda product: str(product.get("id", ""))) if products else {},
    )
    requested_product_id = str(requested_product.get("id", ""))
    requested_category = requested_product.get("category")
    candidates: list[_Candidate] = []
    excluded: list[dict[str, str]] = []
    unconvertible: list[str] = []
    price_unavailable: list[str] = []

    for product in sorted(products, key=lambda value: (str(value.get("id", "")) != requested_product_id, str(value.get("id", "")))):
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
        conversion = None
        try:
            conversion = convert_need_to_sales_units(
                product, amount=Decimal("1"), unit=unit
            )
        except UnitConversionError:
            unconvertible.append(product_id)
        if price is None or price.get("error") is True or price.get("netPriceFound") is False:
            price_unavailable.append(product_id)
            continue
        if conversion is None:
            continue
        if availability_row is None:
            continue
        try:
            unit_price_cents = _price_cents(price)
            comparison_price_cents = _comparison_price_cents(price)
        except ValueError:
            price_unavailable.append(product_id)
            continue
        candidates.append(
            _Candidate(
                product=product,
                price=price,
                availability=availability_row,
                sales_unit=conversion.sales_unit,
                amount_per_sale=conversion.delivered_amount,
                need_unit=unit,
                unit_price_cents=unit_price_cents,
                comparison_price_cents=comparison_price_cents,
                reliability=_number_or_none(product.get("deliveryReliability")),
                sustainability=_number_or_none(product.get("sustainabilityScore")),
            )
        )

    single_plans = [
        plan
        for candidate in candidates
        if (plan := _single_product_plan(candidate, need_amount, deadline, mandate, now, requested_product_id, requested_category))
        is not None
    ]
    delayed = [plan for plan in single_plans if _has_late_line(plan, deadline)]
    on_time = [plan for plan in single_plans if not _has_late_line(plan, deadline)]
    split_plans = [
        plan
        for index, first in enumerate(candidates)
        for second in candidates[index + 1 :]
        if (plan := _split_product_plan(
            first, second, need_amount, deadline, mandate, now, requested_product_id, requested_category
        ))
        is not None
    ]

    kinds = [
        [plan for plan in on_time if len({line["productId"] for line in plan["lines"]}) == 1],
        [
            plan
            for plan in split_plans
            if len({line["productId"] for line in plan["lines"]}) > 1
            and not _has_late_line(plan, deadline)
        ],
        delayed,
        [plan for plan in split_plans if _has_late_line(plan, deadline)],
    ]
    _score_plans([p for group in kinds for p in group], candidates, need_amount, mandate)
    selected = [
        sorted(group, key=lambda plan: _plan_sort_key(plan, candidates))[0]
        for group in kinds
        if group
    ]
    selected.sort(key=lambda p: _plan_sort_key(p, candidates))
    for index, plan in enumerate(selected[:3]):
        plan["tier"] = ("best", "better", "good")[index]
        plan["recommended"] = index == 0
        plan["planId"] = f"pln_{index + 1}"
    return {
        "plans": selected[:3],
        "excludedProducts": excluded,
        "unconvertible": unconvertible,
        "priceUnavailable": price_unavailable,
    }


def _single_product_plan(
    candidate: _Candidate,
    need_amount: Decimal,
    deadline: str,
    mandate: dict[str, Any],
    now: datetime,
    requested_product_id: str,
    requested_category: Any,
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
            (remaining / candidate.amount_per_sale).to_integral_value(ROUND_CEILING),
        )
        if sales_quantity <= 0:
            continue
        amount = min(remaining, sales_quantity * candidate.amount_per_sale)
        lines.append(_line(candidate, int(sales_quantity), amount, schedule, False))
        remaining -= amount
    if remaining > 0 or not lines:
        return None
    return _finish_plan(lines, candidate.product, deadline, mandate, now, requested_product_id, requested_category)


def _split_product_plan(
    first: _Candidate,
    second: _Candidate,
    need_amount: Decimal,
    deadline: str,
    mandate: dict[str, Any],
    now: datetime,
    requested_product_id: str,
    requested_category: Any,
) -> dict[str, Any] | None:
    first_capacity = sum(
        Decimal(str(schedule.get("availableAmount", 0))) * first.amount_per_sale
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
    return _finish_plan(lines, first.product, deadline, mandate, now, requested_product_id, requested_category)


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
            (remaining / candidate.amount_per_sale).to_integral_value(ROUND_CEILING),
        )
        if quantity <= 0:
            continue
        requested = min(remaining, quantity * candidate.amount_per_sale)
        lines.append(_line(candidate, int(quantity), requested, schedule, substitute))
        remaining -= requested
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
        "quantity": {"amount": _number(delivered), "unit": candidate.need_unit},
        "salesQuantity": {"amount": sales_quantity, "unit": candidate.sales_unit},
        "unitPrice": {"cents": candidate.unit_price_cents, "currency": "EUR"},
        "lineTotal": {
            "cents": sales_quantity * candidate.unit_price_cents,
            "currency": "EUR",
        },
        "excess": {
            "amount": _number(Decimal(sales_quantity) * candidate.amount_per_sale - delivered),
            "unit": candidate.need_unit,
        },
        "comparisonPrice": {
            "cents": candidate.comparison_price_cents,
            "currency": "EUR",
            "per": str(candidate.price.get("comparisonUnit", candidate.need_unit)).lower(),
        },
        "availableDate": schedule.get("availableDate"),
        "isSubstitute": substitute,
        "_product": candidate.product,
    }


def _finish_plan(
    lines: list[dict[str, Any]],
    product: dict[str, Any],
    deadline: str,
    mandate: dict[str, Any],
    now: datetime,
    requested_product_id: str | None = None,
    requested_category: Any = None,
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
            "unit": lines[0]["quantity"]["unit"],
        },
        "deadline": deadline,
        "category": requested_category if requested_category is not None else product.get("category"),
    }
    for line in lines:
        line["isSubstitute"] = str(line.get("productId")) != str(requested_product_id or product.get("id", ""))
    policy_plan = {
        **plan,
        "lines": [
            {**line, "product": line.get("_product", product)}
            for line in lines
        ],
    }
    result = check_plan(policy_plan, mandate, now=now)
    plan["policy"] = {"light": result.light, "reasons": list(result.reasons)}
    plan["summary"] = _plan_summary(lines, total_cents)
    for line in lines:
        line.pop("_product", None)
    return plan


def _schedules(candidate: _Candidate) -> list[dict[str, Any]]:
    values = candidate.availability.get("scheduleLines", [])
    return sorted(
        (value for value in values if isinstance(value, dict)),
        key=lambda value: (str(value.get("availableDate", "")), str(value.get("salesUnit", ""))),
    )


def _price_cents(price: dict[str, Any]) -> int:
    price_with_tax = price.get("priceWithTax")
    value = price_with_tax.get("value") if isinstance(price_with_tax, dict) else None
    if value is None:
        raise ValueError("Price is missing.")
    return int((Decimal(str(value)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _comparison_price_cents(price: dict[str, Any]) -> int:
    comparison = price.get("comparisonPrice")
    value = comparison.get("valueWithTax") if isinstance(comparison, dict) else None
    if value is None and isinstance(comparison, dict):
        value = comparison.get("value")
    if value is None:
        tax_price = price.get("priceWithTax")
        value = tax_price.get("value") if isinstance(tax_price, dict) else None
    if value is None:
        raise ValueError("Comparison price is missing.")
    return int((Decimal(str(value)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _plan_summary(lines: list[dict[str, Any]], cents: int) -> str:
    parts = []
    for line in lines:
        product = line["_product"]
        names = product.get("synkkaData", {}).get("names", [])
        name = next(
            (
                item.get("name")
                or item.get("value")
                for item in names
                if isinstance(item, dict)
                and item.get("language") == "en"
                and (item.get("name") or item.get("value"))
            ),
            product.get("name", product.get("id", "product")),
        )
        day = datetime.fromisoformat(str(line["availableDate"])).strftime("%A")
        parts.append(f"{line['quantity']['amount']} {line['quantity']['unit']} {name} ({day})")
    euros, remainder = divmod(cents, 100)
    formatted_euros = f"{euros:,}".replace(",", " ")
    return f"{' + '.join(parts)}, €{formatted_euros},{remainder:02d}"


def _has_late_line(plan: dict[str, Any], deadline: str) -> bool:
    return any(_after_deadline(line.get("availableDate"), deadline) for line in plan["lines"])


def _after_deadline(value: Any, deadline: str) -> bool:
    return isinstance(value, str) and isinstance(deadline, str) and value > deadline[:10]


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
        if any(value.reliability is None for value in metrics):
            reliability_penalty += Decimal("0.05")
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


def _plan_sort_key(plan: dict[str, Any], candidates: list[_Candidate]) -> tuple[Any, ...]:
    by_id = {str(candidate.product.get("id")): candidate for candidate in candidates}
    total_quantity = sum(
        Decimal(str(line["quantity"]["amount"])) for line in plan["lines"]
    )
    weighted_price = sum(
        Decimal(str(line["quantity"]["amount"]))
        * by_id[line["productId"]].comparison_price_cents
        for line in plan["lines"]
    ) / total_quantity
    reliability = [by_id[line["productId"]].reliability for line in plan["lines"]]
    minimum_reliability = min(value if value is not None else -1 for value in reliability)
    return (-plan["score"]["total"], weighted_price, -minimum_reliability, tuple(line["productId"] for line in plan["lines"]))


def _number(value: Decimal) -> int | float:
    return int(value) if value == value.to_integral_value() else float(value)
