"""Small HTTP client for the Valio mock API."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

import httpx

from backend.app.config import Settings


class ValioUpstreamError(RuntimeError):
    """Raised when the Valio mock API returns an unsuccessful response."""


class ValioClient:
    def __init__(
        self,
        settings: Settings,
        *,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        settings.require_valio_credentials()
        self._settings = settings
        self._client = client or httpx.AsyncClient(timeout=5.0)
        self._owns_client = client is None

    async def close(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def ping(self) -> Any:
        return await self._get_json("/api/ping")

    async def download(self, name: str) -> bytes:
        response = await self._request("GET", f"/api/{name}/download")
        return response.content

    async def price(
        self,
        *,
        customer: str,
        requested_date: str,
        products: Sequence[str],
    ) -> Any:
        return await self._post_json(
            "/api/price",
            {
                "customer": customer,
                "requestedDate": requested_date,
                "products": list(products),
            },
        )

    async def availability(
        self,
        *,
        customer: str,
        requested_date: str,
        products: Sequence[str],
    ) -> Any:
        return await self._post_json(
            "/api/availability",
            {
                "customer": customer,
                "requestedDate": requested_date,
                "products": list(products),
            },
        )

    async def _get_json(self, path: str) -> Any:
        response = await self._request("GET", path)
        return response.json()

    async def _post_json(self, path: str, body: Mapping[str, object]) -> Any:
        response = await self._request("POST", path, json=body)
        return response.json()

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json: Mapping[str, object] | None = None,
    ) -> httpx.Response:
        try:
            response = await self._client.request(
                method,
                f"{self._settings.valio_api_base_url}{path}",
                headers={"Accept": "*/*", "X-API-Key": self._settings.valio_api_key},
                json=json,
                follow_redirects=True,
            )
        except httpx.HTTPError as exc:
            raise ValioUpstreamError("Valio request failed.") from exc
        if response.is_error:
            raise ValioUpstreamError(
                f"Valio returned HTTP {response.status_code} for {path}."
            )
        return response
