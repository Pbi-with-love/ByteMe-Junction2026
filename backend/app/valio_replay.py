"""Offline Valio clients backed by committed catalog and upstream recordings."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from backend.app.valio_client import ValioUpstreamError


class ReplayValioClient:
    """Serve the recorded customer/date rows without opening a network client."""

    def __init__(self, catalog_directory: Path, recordings_directory: Path) -> None:
        self._catalog_directory = Path(catalog_directory)
        self._recordings_directory = Path(recordings_directory)
        self._recordings: list[dict[str, Any]] = []
        for path in sorted(self._recordings_directory.glob("*.json")):
            value = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(value, dict) and isinstance(value.get("calls"), dict):
                self._recordings.append(value)

    async def close(self) -> None:
        return None

    async def download(self, name: str) -> bytes:
        if name not in {"products", "delivery-reliability", "carbon-footprint"}:
            raise ValioUpstreamError(f"No recorded Valio dataset: {name}.")
        path = self._catalog_directory / f"{name}.json"
        if not path.is_file():
            raise ValioUpstreamError(f"No recorded Valio dataset: {name}.")
        return path.read_bytes()

    async def price(
        self, *, customer: str, requested_date: str, products: list[str] | tuple[str, ...]
    ) -> Any:
        return self._recorded_call("price", customer, requested_date, products)

    async def availability(
        self, *, customer: str, requested_date: str, products: list[str] | tuple[str, ...]
    ) -> Any:
        return self._recorded_call("availability", customer, requested_date, products)

    def _recorded_call(
        self, call_name: str, customer: str, requested_date: str, products: list[str] | tuple[str, ...]
    ) -> dict[str, Any]:
        product_ids = list(products)
        for recording in self._recordings:
            if recording.get("customerId") != customer:
                continue
            call = recording.get("calls", {}).get(requested_date, {}).get(call_name)
            if not isinstance(call, dict) or not isinstance(call.get("products"), list):
                continue
            rows = {str(row.get("productId")): row for row in call["products"]}
            absent = [product_id for product_id in product_ids if product_id not in rows]
            if absent:
                raise ValioUpstreamError(
                    f"No recorded {call_name} row for customer/date/product: "
                    f"{customer}/{requested_date}/{absent[0]}."
                )
            return {**call, "products": [rows[product_id] for product_id in product_ids]}
        raise ValioUpstreamError(
            f"No recorded {call_name} response for customer/date: {customer}/{requested_date}."
        )


class OverlayValioClient:
    """Patch selected availability fields while passing price responses through."""

    _PATCHABLE = frozenset({"salesBlock", "scheduleLines", "closingTime"})

    def __init__(self, inner: Any, overlay: dict[str, Any] | None) -> None:
        self._inner = inner
        overlay = overlay or {}
        self._overlay = overlay.get("availability", overlay)

    async def close(self) -> None:
        close = getattr(self._inner, "close", None)
        if close is not None:
            await close()

    async def download(self, name: str) -> bytes:
        return await self._inner.download(name)

    async def price(self, **kwargs: Any) -> Any:
        return await self._inner.price(**kwargs)

    async def availability(
        self, *, customer: str, requested_date: str, products: list[str] | tuple[str, ...]
    ) -> dict[str, Any]:
        response = await self._inner.availability(
            customer=customer, requested_date=requested_date, products=products
        )
        patches = self._overlay.get(requested_date, {})
        rows = []
        for row in response.get("products", []):
            patch = patches.get(str(row.get("productId")), {})
            rows.append({**row, **{key: value for key, value in patch.items()
                                   if key in self._PATCHABLE}})
        return {**response, "products": rows}
