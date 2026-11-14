import json
from pathlib import Path

from backend.app.valio_data import extract_allergen_data

ROOT = Path(__file__).resolve().parents[1]


def test_scenarios_use_real_catalog_products_and_have_required_schema():
    catalog_dir = ROOT / "backend/fixtures/valio/catalog"
    catalog = {
        row["id"]: row
        for row in json.loads((catalog_dir / "products.json").read_text())
    }
    for name in ("delivery-reliability", "carbon-footprint"):
        assert (catalog_dir / f"{name}.json").is_file()
    required = {
        "levelId", "title", "customer", "agentId", "issuedBy", "brief", "now",
        "closingTime", "clock", "needs", "hiddenRequirements", "presets",
        "humanDecisions", "overlay", "expected",
    }
    for level in (1, 2, 3):
        path = ROOT / f"backend/app/scenarios/level{level}.json"
        scenario = json.loads(path.read_text())
        assert required <= scenario.keys()
        assert scenario["levelId"] == f"level{level}"
        expected_presets = {
            1: {"strict", "balanced", "loose"},
            2: {"strict", "balanced"},
            3: {"allergen_on", "allergen_off"},
        }[level]
        assert set(scenario["presets"]) == expected_presets
        assert set(scenario["expected"]) == expected_presets
        for need in scenario["needs"]:
            assert need["primaryProductId"] in need["candidateProductIds"]
            assert need["primaryProductId"] == need["candidateProductIds"][0]
            assert set(need["candidateProductIds"]) <= catalog.keys()
        for needs in scenario.get("needsByPreset", {}).values():
            for need in needs:
                assert need["primaryProductId"] == need["candidateProductIds"][0]
                assert set(need["candidateProductIds"]) <= catalog.keys()
        recording = json.loads((ROOT / f"backend/fixtures/valio/recorded/level{level}.json").read_text())
        assert recording["customerId"] == scenario["customer"]["customerId"]
        for date, calls in recording["calls"].items():
            assert date in {need["deadline"][:10] for need in scenario["needs"]}
            assert calls["price"]["products"] and calls["availability"]["products"]
            for call in calls.values():
                assert {row["productId"] for row in call["products"]} >= set().union(
                    *(set(need["candidateProductIds"]) for need in scenario["needs"]
                      if need["deadline"][:10] == date)
                )
                assert all(row.get("netPriceFound") is True and row.get("error") is False
                           for row in calls["price"]["products"])


def test_real_scenario_twists_use_recorded_prices_and_catalog_facts():
    catalog_path = ROOT / "backend/fixtures/valio/catalog/products.json"
    products = {row["id"]: row for row in json.loads(catalog_path.read_text())}
    l1 = json.loads((ROOT / "backend/app/scenarios/level1.json").read_text())
    l1_recording = json.loads((ROOT / "backend/fixtures/valio/recorded/level1.json").read_text())
    l1_prices = {row["productId"]: row for row in l1_recording["calls"]["2026-11-16"]["price"]["products"]}
    primary = l1["needs"][0]["primaryProductId"]
    candidate_ids = set(l1["needs"][0]["candidateProductIds"])
    candidate_ids.update(
        product_id
        for needs in l1.get("needsByPreset", {}).values()
        for need in needs
        for product_id in need["candidateProductIds"]
    )
    substitutes = [product_id for product_id in candidate_ids if product_id != primary]
    assert len(substitutes) >= 2
    assert all(products[item]["category"] == products[primary]["category"] for item in substitutes)
    assert all("FREE_FROM_LACTOSE" in _claims(products[item]) for item in [primary, *substitutes])
    assert len([item for item in substitutes if _on_time_capacity(
        l1_recording["calls"]["2026-11-16"]["availability"], item, "2026-11-16") >= 300]) >= 2
    cheapest_substitute = min(substitutes, key=lambda item: l1_prices[item]["priceWithTax"]["value"])
    assert 1000 * l1_prices[primary]["priceWithTax"]["value"] < (
        700 * l1_prices[primary]["priceWithTax"]["value"]
        + 300 * l1_prices[cheapest_substitute]["priceWithTax"]["value"]
    )

    l2 = json.loads((ROOT / "backend/app/scenarios/level2.json").read_text())
    for need in l2["needs"]:
        date = need["deadline"][:10]
        overlay = l2["overlay"]["availability"][date]
        assert overlay[need["primaryProductId"]]["salesBlock"] is True
        substitute = next(item for item in need["candidateProductIds"] if item != need["primaryProductId"])
        assert any(line["availableDate"] == date and line["availableAmount"] > 0
                   for line in overlay[substitute]["scheduleLines"])

    l3 = json.loads((ROOT / "backend/app/scenarios/level3.json").read_text())
    need = l3["needs"][0]
    recorded = json.loads((ROOT / "backend/fixtures/valio/recorded/level3.json").read_text())
    rows = {row["productId"]: row for row in recorded["calls"][need["deadline"][:10]]["price"]["products"]}
    trap = min(need["candidateProductIds"], key=lambda item: rows[item]["comparisonPrice"]["valueWithTax"])
    assert "AE" in extract_allergen_data(products[trap])["allergens"]
    safe = [item for item in need["candidateProductIds"] if item != trap and
            extract_allergen_data(products[item])["allergenDataVerified"] and
            "AE" not in extract_allergen_data(products[item])["allergens"]]
    assert safe
    safe_option = next(item for item in safe if item != need["primaryProductId"])
    assert products[safe_option]["category"] == products[need["primaryProductId"]]["category"]
    assert _claims(products[safe_option]) == _claims(products[need["primaryProductId"]])
    assert l3["overlay"]["availability"][need["deadline"][:10]][need["primaryProductId"]]["salesBlock"]


def _claims(product):
    return {
        value.get("id")
        for classification in product.get("synkkaData", {}).get("classifications", [])
        if classification.get("name") == "nutritionalClaim"
        for value in classification.get("values", [])
    }


def _on_time_capacity(response, product_id, deadline):
    row = next(item for item in response["products"] if item["productId"] == product_id)
    return sum(line["availableAmount"] for line in row.get("scheduleLines", [])
               if line.get("availableDate", "") <= deadline and not line.get("salesBlock", False))
