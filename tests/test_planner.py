from datetime import datetime, timezone
from decimal import Decimal

from backend.app.planner import build_milk_plans


NOW = datetime(2026, 11, 14, 12, tzinfo=timezone.utc)
DEADLINE = "2026-11-16T06:00:00+02:00"


def product(product_id, *, litres=10, sales_block=False):
    return {
        "id": product_id,
        "category": "10400",
        "salesUnit": "ST",
        "baseUnit": "ST",
        "salesBlock": sales_block,
        "units": [{"unitId": "ST", "sizeInBaseUnits": 1}],
        "synkkaData": {"unitConversions": [{"volume": {"unit": "LTR", "value": litres}}]},
        "allergens": [],
        "allergenDataVerified": True,
        "labels": [],
        "labelDataVerified": True,
        "deliveryReliability": 1.0,
        "sustainabilityScore": 0.5,
    }


def price(product_id, euros):
    return {
        "productId": product_id,
        "priceWithTax": {"value": euros, "validTo": "2026-12-01T00:00:00+02:00"},
    }


def stock(product_id, *lines):
    return {"productId": product_id, "scheduleLines": list(lines)}


def line(amount, day="2026-11-16"):
    return {"availableAmount": amount, "availableDate": day, "salesUnit": "ST"}


def mandate(*, priorities=None):
    return {
        "status": "ACTIVE",
        "validUntil": "2026-12-31T23:59:59+02:00",
        "limits": {"perOrderEur": 500, "perWeekEur": 3000},
        "substitution": "same_category",
        "lateDelivery": "none",
        "hardConstraints": {"excludeAllergens": [], "requireLabels": []},
        "priorities": priorities or ["on_time", "price", "sustainability"],
    }


def test_split_plan_is_best_and_totals_are_integer_cents():
    result = build_milk_plans(
        products=[product("cheap", litres=10), product("sub", litres=10)],
        prices=[price("cheap", 2), price("sub", 3)],
        availability=[
            stock("cheap", line(70)),
            stock("sub", line(30)),
        ],
        need_amount=Decimal("1000"),
        deadline=DEADLINE,
        mandate=mandate(),
        now=NOW,
    )

    plan = result["plans"][0]
    assert plan["tier"] == "best"
    assert plan["total"]["cents"] == 23000
    assert sum(item["quantity"]["amount"] for item in plan["lines"]) == 1000
    assert plan["lines"][1]["isSubstitute"] is True
    assert set(plan["score"]) == {
        "total",
        "onTime",
        "price",
        "sustainability",
        "reliabilityPenalty",
    }


def test_late_delivery_produces_better_plan_and_good_is_on_time():
    result = build_milk_plans(
        products=[product("late", litres=10), product("on-time", litres=10)],
        prices=[price("late", 1), price("on-time", 2)],
        availability=[
            stock("late", line(50), line(50, "2026-11-17")),
            stock("on-time", line(100)),
        ],
        need_amount=Decimal("1000"),
        deadline=DEADLINE,
        mandate=mandate(),
        now=NOW,
    )

    assert {plan["tier"] for plan in result["plans"]} == {"better", "good"}
    assert result["plans"][0]["score"]["total"] >= result["plans"][1]["score"]["total"]
    delayed = next(plan for plan in result["plans"] if plan["tier"] == "better")
    assert delayed["lines"][1]["availableDate"] == "2026-11-17"


def test_red_product_never_enters_a_plan():
    result = build_milk_plans(
        products=[product("blocked", sales_block=True)],
        prices=[price("blocked", 1)],
        availability=[stock("blocked", line(100))],
        need_amount=Decimal("100"),
        deadline=DEADLINE,
        mandate=mandate(),
        now=NOW,
    )

    assert result["plans"] == []
    assert result["excludedProducts"][0]["reason"] == "SALES_BLOCKED"


def test_mandate_priorities_change_recommendation():
    kwargs = {
        "products": [product("late", litres=10), product("on-time", litres=10)],
        "prices": [price("late", 1), price("on-time", 3)],
        "availability": [
            stock("late", line(50, "2026-11-17")),
            stock("on-time", line(100)),
        ],
        "need_amount": Decimal("1000"),
        "deadline": DEADLINE,
        "now": NOW,
    }
    on_time = build_milk_plans(
        **kwargs, mandate=mandate(priorities=["on_time", "price", "sustainability"])
    )
    price_first = build_milk_plans(
        **kwargs, mandate=mandate(priorities=["price", "on_time", "sustainability"])
    )

    assert on_time["plans"][0]["tier"] == "good"
    assert price_first["plans"][0]["tier"] == "best"
