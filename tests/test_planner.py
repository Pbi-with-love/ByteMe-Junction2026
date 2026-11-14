from datetime import datetime, timezone
from decimal import Decimal

from backend.app.planner import build_plans


NOW = datetime(2026, 11, 14, 12, tzinfo=timezone.utc)
DEADLINE = "2026-11-16T06:00:00+02:00"


def product(product_id, *, litres=10, sales_block=False):
    return {
        "id": product_id,
        "name": product_id,
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
    result = build_plans(
        products=[product("cheap", litres=10), product("sub", litres=10)],
        prices=[price("cheap", 2), price("sub", 3)],
        availability=[
            stock("cheap", line(70)),
            stock("sub", line(30)),
        ],
        need_amount=Decimal("1000"),
        unit="l",
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
    result = build_plans(
        products=[product("late", litres=10), product("on-time", litres=10)],
        prices=[price("late", 1), price("on-time", 2)],
        availability=[
            stock("late", line(50), line(50, "2026-11-17")),
            stock("on-time", line(100)),
        ],
        need_amount=Decimal("1000"),
        unit="l",
        deadline=DEADLINE,
        mandate=mandate(),
        now=NOW,
    )

    assert {plan["tier"] for plan in result["plans"]} == {"best", "better"}
    assert result["plans"][0]["score"]["total"] >= result["plans"][1]["score"]["total"]
    assert [plan["tier"] for plan in result["plans"]] == ["best", "better"]
    delayed = next(plan for plan in result["plans"] if plan["lines"][-1]["availableDate"] == "2026-11-17")
    assert delayed["lines"][1]["availableDate"] == "2026-11-17"


def test_red_product_never_enters_a_plan():
    result = build_plans(
        products=[product("blocked", sales_block=True)],
        prices=[price("blocked", 1)],
        availability=[stock("blocked", line(100))],
        need_amount=Decimal("100"),
        unit="l",
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
    on_time = build_plans(
        **kwargs, unit="l", mandate=mandate(priorities=["on_time", "price", "sustainability"])
    )
    price_first = build_plans(
        **kwargs, unit="l", mandate=mandate(priorities=["price", "on_time", "sustainability"])
    )

    assert on_time["plans"][0]["lines"][0]["productId"] == "on-time"
    assert price_first["plans"][0]["lines"][0]["productId"] == "late"


def test_piece_need_rounds_to_whole_sales_units_and_exposes_comparison_price():
    case = product("case")
    case["salesUnit"] = "KI"
    case["units"] = [{"unitId": "ST", "sizeInBaseUnits": 1}, {"unitId": "KI", "sizeInBaseUnits": 6}]
    case["synkkaData"]["unitConversions"] = []
    result = build_plans(
        products=[case],
        prices=[{**price("case", 2), "comparisonPrice": {"valueWithTax": 0.5}, "comparisonUnit": "PCS"}],
        availability=[stock("case", line(10))],
        need_amount=Decimal("13"), unit="pcs", deadline=DEADLINE,
        mandate=mandate(), now=NOW,
    )
    plan = result["plans"][0]
    assert plan["lines"][0]["quantity"] == {"amount": 13, "unit": "pcs"}
    assert plan["lines"][0]["salesQuantity"] == {"amount": 3, "unit": "KI"}
    assert plan["lines"][0]["excess"] == {"amount": 5, "unit": "pcs"}
    assert plan["lines"][0]["comparisonPrice"] == {"cents": 50, "currency": "EUR", "per": "pcs"}
    assert plan["onTime"]["unit"] == "pcs"


def test_price_unavailable_and_unconvertible_are_reported_separately():
    broken = product("broken")
    broken["synkkaData"]["unitConversions"] = []
    result = build_plans(
        products=[product("no-price"), broken, product("error")],
        prices=[{**price("error", 1), "error": True}],
        availability=[stock("no-price", line(10)), stock("broken", line(10)), stock("error", line(10))],
        need_amount=Decimal("10"), unit="l", deadline=DEADLINE,
        mandate=mandate(), now=NOW,
    )
    assert result["plans"] == []
    assert result["excludedProducts"] == []
    assert result["unconvertible"] == ["broken"]
    assert result["priceUnavailable"] == ["broken", "error", "no-price"]


def test_plan_summary_is_deterministic_and_uses_need_unit_and_finnish_money():
    milk = product("milk")
    milk["synkkaData"]["names"] = [{"value": "Milk drink", "language": "en"}]
    result = build_plans(
        products=[milk], prices=[price("milk", 13.08)],
        availability=[stock("milk", line(200))], need_amount=Decimal("1000"),
        unit="l", deadline=DEADLINE, mandate=mandate(), now=NOW,
    )
    plan = result["plans"][0]
    assert plan["summary"] == "1000 l Milk drink (Monday), €1 308,00"
    assert build_plans(
        products=[milk], prices=[price("milk", 13.08)],
        availability=[stock("milk", line(200))], need_amount=Decimal("1000"),
        unit="l", deadline=DEADLINE, mandate=mandate(), now=NOW,
    )["plans"] == result["plans"]


def test_null_reliability_adds_fixed_penalty_and_tiers_follow_sorted_scores():
    uncertain = product("uncertain")
    uncertain["deliveryReliability"] = None
    result = build_plans(
        products=[uncertain],
        prices=[price("uncertain", 1)],
        availability=[stock("uncertain", line(100))],
        need_amount=Decimal("100"), unit="l", deadline=DEADLINE,
        mandate=mandate(), now=NOW,
    )
    assert result["plans"][0]["score"]["reliabilityPenalty"] == 0.05
    assert result["plans"][0]["tier"] == "best"
    assert result["plans"][0]["recommended"] is True
    assert [plan["planId"] for plan in result["plans"]] == ["pln_1"]


def test_equal_score_tie_breaks_by_comparison_price_then_reliability_then_product_id():
    def winner(products, prices):
        result = build_plans(
            products=products,
            prices=prices,
            availability=[stock(str(item["id"]), line(100)) for item in products],
            need_amount=Decimal("100"), unit="l", deadline=DEADLINE,
            mandate=mandate(), now=NOW,
        )
        return result["plans"][0]["lines"][0]["productId"]

    products = [product("price-high-rel-high"), product("price-low-rel-low")]
    products[0]["deliveryReliability"] = products[1]["deliveryReliability"] = 0.9
    prices = [
        {**price("price-high-rel-high", 1), "comparisonPrice": {"valueWithTax": 2}},
        {**price("price-low-rel-low", 1), "comparisonPrice": {"valueWithTax": 1}},
    ]
    assert winner(products, prices) == "price-low-rel-low"

    products = [product("rel-low"), product("rel-high")]
    products[0]["deliveryReliability"] = 0.9
    products[0]["sustainabilityScore"] = 0.55
    products[1]["deliveryReliability"] = 1.0
    products[1]["sustainabilityScore"] = 0.5
    prices = [
        {**price("rel-low", 1), "comparisonPrice": {"valueWithTax": 1}},
        {**price("rel-high", 1), "comparisonPrice": {"valueWithTax": 1}},
    ]
    assert winner(products, prices) == "rel-high"
    products[0]["deliveryReliability"] = products[1]["deliveryReliability"] = 0.9
    products[0]["sustainabilityScore"] = products[1]["sustainabilityScore"] = 0.5
    products[0]["id"] = "z"
    products[1]["id"] = "a"
    prices[0]["productId"] = "z"
    prices[1]["productId"] = "a"
    assert winner(products, prices) == "a"


def test_requested_candidate_is_not_substitute_and_other_products_are():
    requested = product('requested', litres=1)
    alternative = product('alternative', litres=1)
    alternative['category'] = 'different-category'
    result = build_plans(
        products=[alternative, requested],
        prices=[price('requested', 1), price('alternative', 1)],
        availability=[stock('requested', line(5)), stock('alternative', line(10))],
        need_amount=Decimal('10'), unit='l', deadline=DEADLINE,
        mandate=mandate(), now=NOW, requested_product_id='requested',
    )
    alternative_single = next(plan for plan in result['plans'] if len(plan['lines']) == 1 and plan['lines'][0]['productId'] == 'alternative')
    assert alternative_single['lines'][0]['isSubstitute'] is True
    assert 'SUBSTITUTION_NOT_ALLOWED' in alternative_single['policy']['reasons']
    split = next(plan for plan in result['plans'] if {line['productId'] for line in plan['lines']} == {'requested', 'alternative'})
    assert next(line for line in split['lines'] if line['productId'] == 'requested')['isSubstitute'] is False
    assert next(line for line in split['lines'] if line['productId'] == 'alternative')['isSubstitute'] is True
