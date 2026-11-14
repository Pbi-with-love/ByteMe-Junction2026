import pytest

from backend.app.search import CatalogSearch, SearchValidationError


def product(
    product_id: str,
    name: str,
    *,
    claims: list[str] | None = None,
    allergen_values: list[dict[str, str]] | None = None,
    non_allergen_values: list[dict[str, str]] | None = None,
) -> dict:
    return {
        "id": product_id,
        "deleted": False,
        "salesUnit": "ST",
        "category": "10400",
        "vendorName": "Valio",
        "synkkaData": {
            "names": [{"language": "en", "value": name}],
            "classifications": [
                {"name": "nutritionalClaim", "values": [{"id": value} for value in claims or []]},
                {
                    "name": "packagingMarkedLabel",
                    "values": [{"id": "GOODS_FROM_FINLAND_BLUE_SWAN"}],
                },
                {"name": "allergen", "values": allergen_values or []},
                {"name": "nonAllergen", "values": non_allergen_values or []},
            ],
        },
    }


def mandate(exclude: list[str] | None = None) -> dict:
    return {
        "status": "ACTIVE",
        "validUntil": "2099-01-01T00:00:00+00:00",
        "hardConstraints": {
            "excludeAllergens": exclude or [],
            "requireLabels": [],
        },
    }


def search(products: list[dict]) -> CatalogSearch:
    return CatalogSearch(
        products,
        {"p1": 0.97},
        {"p1": 1.44},
    )


def test_search_returns_public_fields_only() -> None:
    result = search([product("p1", "Lactose-free milk", claims=["FREE_FROM_LACTOSE"])]).search(
        query="milk",
        filters={"attributes": ["lactose_free"]},
        limit=20,
        mandate=mandate(),
    )

    assert result["total"] == 1
    item = result["results"][0]
    forbidden = {"catalogPrice", "priceWithTax", "listPrice", "availability", "margin"}
    assert not forbidden.intersection(_recursive_keys(item))
    assert item["category"] == "10400"
    assert item["carbonCategory"] == {
        "category": "10400",
        "kgCo2ePerKg": {"min": 1.44, "max": 1.44},
    }
    assert item["deliveryReliability"] == 0.97


def test_peanut_risk_and_missing_data_are_excluded() -> None:
    result = search(
        [
            product(
                "p1",
                "Milk peanut snack",
                allergen_values=[{"id": "AP", "unit": "CONTAINS"}],
            ),
            product(
                "p2",
                "Milk",
                non_allergen_values=[{"id": "AP", "unit": "FREE_FROM"}],
            ),
            product("p3", "Milk cheese"),
        ]
    ).search(
        query="milk",
        filters={},
        limit=20,
        mandate=mandate(["peanut"]),
    )

    assert [item["productId"] for item in result["results"]] == ["p2", "p1", "p3"]
    assert result["results"][0]["excluded"] is None
    assert result["results"][1]["excluded"] == {
        "light": "RED",
        "reason": "ALLERGEN_EXCLUDED",
    }
    assert result["results"][2]["excluded"] == {
        "light": "RED",
        "reason": "ALLERGEN_EXCLUDED",
    }


def test_low_lactose_does_not_match_lactose_free() -> None:
    service = search([product("p1", "Milk", claims=["LOW_LACTOSE"])])

    assert service.search(
        query="milk",
        filters={"attributes": ["lactose_free"]},
        limit=20,
        mandate=mandate(),
    )["total"] == 0


def test_unsupported_filter_is_rejected() -> None:
    with pytest.raises(SearchValidationError, match="Unsupported attribute filter"):
        search([product("p1", "Milk")]).search(
            query="milk",
            filters={"attributes": ["organic"]},
            limit=20,
            mandate=mandate(),
        )


def test_limit_and_order_are_deterministic() -> None:
    service = search([product("p2", "Milk"), product("p1", "Milk")])
    request = {
        "query": "milk",
        "filters": {},
        "limit": 1,
        "mandate": mandate(),
    }

    first = service.search(**request)
    second = service.search(**request)

    assert first == second
    assert first["results"][0]["productId"] == "p1"
    assert len(first["results"]) == 1


def _recursive_keys(value):
    if isinstance(value, dict):
        return set(value).union(*(set(_recursive_keys(item)) for item in value.values()))
    if isinstance(value, list):
        return set().union(*(_recursive_keys(item) for item in value))
    return set()
