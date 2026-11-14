import json

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.app.config import Settings
from backend.app.valio_client import ValioClient
from backend.app.valio_data import ValioDataCache, extract_allergen_data, parse_rows


def test_parse_rows_supports_wrapped_json() -> None:
    raw = json.dumps({"items": [{"productId": "p1"}]}).encode()

    assert parse_rows(raw) == [{"productId": "p1"}]


def test_parse_rows_supports_csv() -> None:
    assert parse_rows(b"productId,name\np1,Milk\n") == [
        {"productId": "p1", "name": "Milk"}
    ]


def test_extract_allergen_data_treats_may_contain_as_risky() -> None:
    product = {
        "synkkaData": {
            "classifications": [
                {
                    "name": "allergen",
                    "values": [
                        {"id": "AP", "unit": "MAY_CONTAIN"},
                        {"id": "AM", "unit": "CONTAINS"},
                    ],
                },
                {
                    "name": "nonAllergen",
                    "values": [{"id": "AF", "unit": "FREE_FROM"}],
                },
            ]
        }
    }

    assert extract_allergen_data(product) == {
        "allergens": ["AP", "AM"],
        "nonAllergens": ["AF"],
        "allergenDataVerified": True,
    }


def test_extract_allergen_data_marks_empty_classifications_unverified() -> None:
    product = {
        "synkkaData": {
            "classifications": [
                {"name": "allergen", "values": []},
                {"name": "nonAllergen", "values": []},
            ]
        }
    }

    assert extract_allergen_data(product)["allergenDataVerified"] is False


@pytest.mark.anyio
async def test_refresh_writes_raw_and_normalized_cache(tmp_path) -> None:
    payloads = {
        "/api/products/download": b'{"items":[{"productId":"p1"}]}',
        "/api/delivery-reliability/download": b"productId,reliability\np1,0.97\n",
        "/api/carbon-footprint/download": b'[{"category":"milk","min":0.2,"max":0.5}]',
    }

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=payloads[str(request.url.path)])

    upstream = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    client = ValioClient(Settings("https://valio.test", "secret"), client=upstream)
    try:
        cache = ValioDataCache(client, tmp_path)
        data = await cache.refresh()
    finally:
        await upstream.aclose()

    assert data["products"] == [{"productId": "p1"}]
    assert (tmp_path / "products.raw").read_bytes() == payloads[
        "/api/products/download"
    ]
    assert cache.load("delivery-reliability") == [
        {"productId": "p1", "reliability": "0.97"}
    ]


def test_app_startup_uses_committed_catalog_without_downloading(monkeypatch, tmp_path) -> None:
    from backend.app import main

    async def unexpected_download(self, name):
        raise AssertionError("startup attempted a Valio download")

    monkeypatch.setattr(ValioClient, "download", unexpected_download)
    monkeypatch.setattr(
        main.Settings,
        "from_env",
        lambda: Settings("https://valio.test", "test-key", valio_cache_directory=tmp_path),
    )
    with TestClient(main.app):
        result = main.app.state.catalog_search.search(
            query="Valio Eila semi skimmed lactose free",
            filters={},
            limit=10,
            mandate={
                "status": "ACTIVE",
                "validUntil": "2099-01-01T00:00:00+00:00",
                "hardConstraints": {"excludeAllergens": [], "requireLabels": []},
            },
        )
    assert result["total"] > 0
