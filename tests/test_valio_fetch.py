import pytest

from backend.app.valio_client import ValioUpstreamError
from scripts import valio_fetch


@pytest.mark.anyio
async def test_probe_backed_client_uses_shared_probe_and_reports_http_errors(monkeypatch):
    calls = []

    def fake_call(method, path, body=None):
        calls.append((method, path, body))
        if path.endswith("/download"):
            return 503, {}, b"unavailable"
        return 200, {}, b'{"products": []}'

    monkeypatch.setattr(valio_fetch.probe, "call", fake_call)
    client = valio_fetch.ProbeBackedClient()
    assert await client.price(customer="123", requested_date="2026-11-16", products=["p1"]) == {
        "products": []
    }
    with pytest.raises(ValioUpstreamError, match="HTTP 503"):
        await client.download("products")
    assert calls[0] == (
        "POST", "/api/price", {"customer": "123", "requestedDate": "2026-11-16", "products": ["p1"]}
    )


@pytest.mark.anyio
async def test_fetch_records_scenario_calls_through_adapter_instance(tmp_path, monkeypatch):
    scenarios = tmp_path / "scenarios"
    scenarios.mkdir()
    for level in (1, 2, 3):
        (scenarios / f"level{level}.json").write_text(
            '{"customer":{"customerId":"123"},"needs":[{"deadline":"2026-11-16T06:00:00+02:00",'
            '"candidateProductIds":["p1"]}]}'
        )
    monkeypatch.setattr(valio_fetch, "SCENARIO_DIRECTORY", scenarios)
    monkeypatch.setattr(valio_fetch, "FIXTURE_DIRECTORY", tmp_path / "fixtures")
    monkeypatch.setattr(valio_fetch.probe, "BASE", "https://example.test")
    monkeypatch.setattr(valio_fetch.probe, "KEY", "set-but-not-printed")

    async def fake_refresh(self):
        return {
            "products": [{"id": "p1"}],
            "delivery-reliability": [],
            "carbon-footprint": [],
        }

    monkeypatch.setattr(valio_fetch.ValioDataCache, "refresh", fake_refresh)

    def fake_call(method, path, body=None):
        if path.endswith("/price"):
            return 200, {}, b'{"customerId":"123","products":[{"productId":"p1","netPriceFound":true,"error":false}]}'
        return 200, {}, b'{"products":[{"productId":"p1"}]}'

    monkeypatch.setattr(valio_fetch.probe, "call", fake_call)
    await valio_fetch.fetch()
    recording = valio_fetch.json.loads(
        (tmp_path / "fixtures/recorded/level1.json").read_text()
    )
    assert recording["calls"]["2026-11-16"]["price"]["products"][0]["netPriceFound"] is True
