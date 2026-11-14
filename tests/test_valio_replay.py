import json

import httpx
import pytest

from backend.app.config import Settings
from backend.app.valio_client import ValioUpstreamError
from backend.app.valio_replay import OverlayValioClient, ReplayValioClient


@pytest.mark.anyio
async def test_replay_filters_recorded_responses_without_network(tmp_path, monkeypatch):
    catalog = tmp_path / "catalog"
    recorded = tmp_path / "recorded"
    catalog.mkdir()
    recorded.mkdir()
    for name in ("products", "delivery-reliability", "carbon-footprint"):
        (catalog / f"{name}.json").write_text("[]")
    price = {"customerId": "123", "products": [
        {"productId": "p1", "netPriceFound": True},
        {"productId": "p2", "netPriceFound": True},
    ]}
    availability = {"requestedDate": "2026-11-16", "products": [
        {"productId": "p1", "salesBlock": False},
        {"productId": "p2", "salesBlock": True},
    ]}
    (recorded / "level1.json").write_text(json.dumps({"customerId": "123", "calls": {
        "2026-11-16": {"price": price, "availability": availability},
    }}))

    async def no_socket(*args, **kwargs):
        raise AssertionError("replay attempted a network request")

    monkeypatch.setattr(httpx.AsyncClient, "send", no_socket)
    client = ReplayValioClient(catalog, recorded)
    assert await client.price(customer="123", requested_date="2026-11-16", products=["p2"]) == {
        "customerId": "123", "products": [{"productId": "p2", "netPriceFound": True}],
    }
    assert await client.availability(customer="123", requested_date="2026-11-16", products=["p1"]) == {
        "requestedDate": "2026-11-16", "products": [{"productId": "p1", "salesBlock": False}],
    }
    assert await client.download("products") == b"[]"
    with pytest.raises(ValioUpstreamError):
        await client.price(customer="456", requested_date="2026-11-16", products=["p1"])
    with pytest.raises(ValioUpstreamError):
        await client.price(customer="123", requested_date="2026-11-17", products=["p1"])
    with pytest.raises(ValioUpstreamError):
        await client.price(customer="123", requested_date="2026-11-16", products=["unknown"])


@pytest.mark.anyio
async def test_overlay_changes_only_availability_and_preserves_price():
    class Inner:
        price_response = {"products": [{"productId": "p1", "price": "unchanged"}]}

        async def price(self, **kwargs):
            return self.price_response

        async def availability(self, **kwargs):
            return {"products": [{"productId": "p1", "salesBlock": False,
                                  "scheduleLines": [{"availableAmount": 10}],
                                  "closingTime": "before"}]}

    inner = Inner()
    overlay = OverlayValioClient(inner, {"2026-11-16": {"p1": {
        "salesBlock": True, "scheduleLines": [], "closingTime": "after",
    }}})
    original = await inner.price(customer="123", requested_date="2026-11-16", products=["p1"])
    assert await overlay.price(customer="123", requested_date="2026-11-16", products=["p1"]) is original
    assert await overlay.availability(customer="123", requested_date="2026-11-16", products=["p1"]) == {
        "products": [{"productId": "p1", "salesBlock": True, "scheduleLines": [], "closingTime": "after"}],
    }


@pytest.mark.anyio
async def test_replay_mode_wires_scenario_overlay_without_network(tmp_path, monkeypatch):
    from backend.app import main

    async def no_socket(*args, **kwargs):
        raise AssertionError("replay mode attempted a network request")

    monkeypatch.setattr(httpx.AsyncClient, "send", no_socket)
    monkeypatch.setattr(
        main.Settings, "from_env",
        lambda: Settings("https://unused.test", "unused", valio_cache_directory=tmp_path),
    )
    monkeypatch.setenv("VALIO_MODE", "replay")
    monkeypatch.setenv("VALIO_SCENARIO_LEVEL", "level1")
    async with main.lifespan(main.app):
        rows = await main.app.state.valio_client.availability(
            customer="123", requested_date="2026-11-16", products=["464306"]
        )
        assert rows["products"][0]["scheduleLines"] == [
            {"salesBlock": False, "availableAmount": 700, "availableDate": "2026-11-16", "salesUnit": "ST"},
            {"salesBlock": False, "availableAmount": 300, "availableDate": "2026-11-17", "salesUnit": "ST"},
        ]
