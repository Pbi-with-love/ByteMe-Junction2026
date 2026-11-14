from datetime import datetime, timedelta, timezone

from backend.app.policy import check_plan, check_product


NOW = datetime(2026, 11, 14, 12, tzinfo=timezone.utc)


def mandate(**overrides):
    value = {
        "status": "ACTIVE",
        "validUntil": (NOW + timedelta(days=1)).isoformat(),
        "limits": {"perOrderEur": 500, "perWeekEur": 3000},
        "substitution": "none",
        "lateDelivery": "none",
        "hardConstraints": {"excludeAllergens": [], "requireLabels": []},
    }
    value.update(overrides)
    return value


def plan(total_cents=1000, **overrides):
    value = {
        "total": {"cents": total_cents, "currency": "EUR"},
        "lines": [
            {
                "productId": "p1",
                "lineTotal": {"cents": total_cents, "currency": "EUR"},
                "availableDate": "2026-11-14",
                "product": {
                    "category": "10400",
                    "salesBlock": False,
                    "allergens": [],
                    "allergenDataVerified": True,
                    "labels": [],
                    "labelDataVerified": True,
                },
            }
        ],
        "deadline": "2026-11-14T18:00:00+00:00",
    }
    value.update(overrides)
    return value


def test_exact_order_limit_is_green() -> None:
    result = check_plan(plan(50000), mandate(), now=NOW)

    assert result.light == "GREEN"
    assert result.reasons == ("WITHIN_MANDATE",)


def test_over_order_limit_is_yellow() -> None:
    result = check_plan(plan(50001), mandate(), now=NOW)

    assert result.light == "YELLOW"
    assert "OVER_ORDER_LIMIT" in result.reasons


def test_red_product_is_final() -> None:
    value = plan()
    value["lines"][0]["product"]["salesBlock"] = True

    result = check_plan(value, mandate(), now=NOW)

    assert result.light == "RED"
    assert "SALES_BLOCKED" in result.reasons


def test_blue_and_yellow_reasons_produce_yellow() -> None:
    value = plan(50001)
    value["lines"].append(
        {
            "productId": "p2",
            "isSubstitute": True,
            "availableDate": "2026-11-14",
            "lineTotal": {"cents": 1},
            "product": {
                "category": "10400",
                "salesBlock": False,
                "allergens": [],
                "allergenDataVerified": True,
                "labels": [],
                "labelDataVerified": True,
            },
        }
    )
    value["category"] = "10400"
    value["total"] = {"cents": 50001}

    result = check_plan(
        value,
        mandate(limits={"perOrderEur": 500, "perWeekEur": 3000}, substitution="same_category"),
        now=NOW,
    )

    assert result.light == "YELLOW"
    assert "SUBSTITUTION_ALLOWED" in result.reasons
    assert "OVER_ORDER_LIMIT" in result.reasons


def test_unknown_allergen_data_is_red_when_exclusions_exist() -> None:
    product = {"salesBlock": False, "allergens": [], "allergenDataVerified": False}

    result = check_product(
        product,
        mandate(hardConstraints={"excludeAllergens": ["peanut"], "requireLabels": []}),
    )

    assert result.light == "RED"
    assert result.reasons == ("ALLERGEN_EXCLUDED",)


def test_verified_peanut_code_is_red_for_peanut_mandate() -> None:
    product = {
        "salesBlock": False,
        "allergens": ["AP"],
        "allergenDataVerified": True,
    }

    result = check_product(
        product,
        mandate(hardConstraints={"excludeAllergens": ["peanut"], "requireLabels": []}),
    )

    assert result.light == "RED"
    assert result.reasons == ("ALLERGEN_EXCLUDED",)


def test_unknown_allergen_name_is_red() -> None:
    result = check_product(
        {"allergens": [], "allergenDataVerified": True},
        mandate(
            hardConstraints={"excludeAllergens": ["unverified-allergen"], "requireLabels": []}
        ),
    )

    assert result.light == "RED"
    assert result.reasons == ("ALLERGEN_EXCLUDED",)


def test_catalog_allergen_code_is_used_as_is() -> None:
    result = check_product(
        {"allergens": ["AE"], "allergenDataVerified": True},
        mandate(hardConstraints={"excludeAllergens": ["AE"], "requireLabels": []}),
    )
    assert result.reasons == ("ALLERGEN_EXCLUDED",)


def test_catalog_allergen_code_does_not_exclude_other_allergens() -> None:
    result = check_product(
        {"allergens": ["AP"], "allergenDataVerified": True},
        mandate(hardConstraints={"excludeAllergens": ["AE"], "requireLabels": []}),
    )
    assert result.light == "GREEN"


def test_mandate_problems_are_checked_first() -> None:
    result = check_plan(plan(), {"status": "REVOKED"}, now=NOW)

    assert result.light == "RED"
    assert result.reasons == ("MANDATE_INVALID",)


def test_expired_mandate_is_red() -> None:
    result = check_plan(
        plan(),
        mandate(validUntil=(NOW - timedelta(seconds=1)).isoformat()),
        now=NOW,
    )

    assert result.light == "RED"
    assert result.reasons == ("MANDATE_EXPIRED",)


def test_pending_spending_is_reserved_against_week_limit() -> None:
    result = check_plan(
        plan(10000),
        mandate(limits={"perOrderEur": 500, "perWeekEur": 100}),
        committed_week_total_cents=9000,
        now=NOW,
    )

    assert result.light == "YELLOW"
    assert "OVER_WEEK_LIMIT" in result.reasons


def test_same_category_substitution_is_blue() -> None:
    value = plan()
    value["category"] = "10400"
    value["lines"][0]["isSubstitute"] = True

    result = check_plan(
        value,
        mandate(substitution="same_category"),
        now=NOW,
    )

    assert result.light == "BLUE"
    assert result.reasons == ("SUBSTITUTION_ALLOWED",)


def test_substitution_outside_category_is_yellow() -> None:
    value = plan()
    value["category"] = "10400"
    value["lines"][0]["isSubstitute"] = True
    value["lines"][0]["product"]["category"] = "99999"

    result = check_plan(
        value,
        mandate(substitution="same_category"),
        now=NOW,
    )

    assert result.light == "YELLOW"
    assert "SUBSTITUTION_NOT_ALLOWED" in result.reasons


def test_late_delivery_beyond_tolerance_is_yellow() -> None:
    value = plan()
    value["lines"][0]["availableDate"] = "2026-11-16"

    result = check_plan(value, mandate(lateDelivery="one_day"), now=NOW)

    assert result.light == "YELLOW"
    assert "LATE_DELIVERY" in result.reasons
