import json

import httpx
import pytest

from backend.app.config import Settings
from backend.app.valio_client import ValioClient, ValioUpstreamError


@pytest.mark.anyio
async def test_price_uses_contract_request_shape() -> None:
    requests: list[httpx.Request] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"prices": []})

    client = ValioClient(
        Settings("https://valio.test", "secret"),
        client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )
    try:
        assert await client.price(
            customer="123",
            requested_date="2026-11-16",
            products=["460013"],
        ) == {"prices": []}
    finally:
        await client.close()

    assert str(requests[0].url) == "https://valio.test/api/price"
    assert requests[0].headers["X-API-Key"] == "secret"
    assert json.loads(requests[0].content) == {
        "customer": "123",
        "requestedDate": "2026-11-16",
        "products": ["460013"],
    }


@pytest.mark.anyio
async def test_upstream_http_failure_is_explicit() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503)

    client = ValioClient(
        Settings("https://valio.test", "secret"),
        client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )
    try:
        with pytest.raises(ValioUpstreamError, match="HTTP 503"):
            await client.ping()
    finally:
        await client.close()


@pytest.mark.anyio
async def test_default_upstream_timeout_is_five_seconds() -> None:
    client = ValioClient(Settings("https://valio.test", "secret"))
    try:
        assert client._client.timeout.read == 5.0
    finally:
        await client.close()
