"""Download Valio source data and record the exact scenario price/availability calls."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from typing import Any

from backend.app.config import ROOT
from backend.app.valio_client import ValioUpstreamError
from backend.app.valio_data import ValioDataCache
from scripts import valio_probe as probe


SCENARIO_DIRECTORY = ROOT / "backend" / "app" / "scenarios"
FIXTURE_DIRECTORY = ROOT / "backend" / "fixtures" / "valio"


class ProbeBackedClient:
    """Valio client using the shared probe's auth-header negotiation helper."""

    async def download(self, name: str) -> bytes:
        status, _headers, raw = probe.call("GET", f"/api/{name}/download")
        if status != 200:
            raise ValioUpstreamError(f"Valio returned HTTP {status} for /api/{name}/download.")
        return raw

    async def price(self, *, customer: str, requested_date: str, products: list[str]) -> Any:
        return await self._post("price", customer, requested_date, products)

    async def availability(
        self, *, customer: str, requested_date: str, products: list[str]
    ) -> Any:
        return await self._post("availability", customer, requested_date, products)

    @staticmethod
    async def _post(endpoint: str, customer: str, requested_date: str, products: list[str]) -> Any:
        status, _headers, raw = probe.call(
            "POST", f"/api/{endpoint}",
            {"customer": customer, "requestedDate": requested_date, "products": products},
        )
        if status != 200:
            raise ValioUpstreamError(f"Valio returned HTTP {status} for /api/{endpoint}.")
        try:
            return json.loads(raw)
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValioUpstreamError(f"Valio returned invalid JSON for /api/{endpoint}.") from exc


def _write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


async def fetch() -> None:
    if not probe.BASE or not probe.KEY:
        raise RuntimeError("Valio key missing: set VALIO_API_BASE_URL and VALIO_API_KEY in root .env.")

    client = ProbeBackedClient()
    datasets = await ValioDataCache(client, probe.OUT).refresh()
    all_product_ids: set[str] = set()
    scenario_data: dict[str, dict[str, Any]] = {}
    for level in (1, 2, 3):
        scenario = json.loads((SCENARIO_DIRECTORY / f"level{level}.json").read_text(encoding="utf-8"))
        customer = str(scenario["customer"]["customerId"])
        date_to_products: dict[str, set[str]] = {}
        for need in scenario["needs"]:
            date = str(need["deadline"][:10])
            ids = date_to_products.setdefault(date, set())
            ids.update(str(product_id) for product_id in need["candidateProductIds"])
            all_product_ids.update(ids)
        calls: dict[str, Any] = {}
        for date, ids in sorted(date_to_products.items()):
            product_ids = sorted(ids)
            price = await client.price(
                customer=customer, requested_date=date, products=product_ids
            )
            price_rows = {str(row.get("productId")): row for row in price.get("products", [])}
            for product_id in product_ids:
                row = price_rows.get(product_id)
                if row is None or row.get("netPriceFound") is not True or row.get("error") is not False:
                    raise RuntimeError(
                        f"Price gate failed for customer {customer}, date {date}, product {product_id}; "
                        "refusing to create scenario recordings."
                    )
            availability = await client.availability(
                customer=customer, requested_date=date, products=product_ids
            )
            availability_ids = {str(row.get("productId")) for row in availability.get("products", [])}
            missing = sorted(set(product_ids) - availability_ids)
            if missing:
                raise RuntimeError(
                    f"Availability response omitted scenario products for customer {customer}, date {date}: "
                    f"{', '.join(missing)}."
                )
            calls[date] = {"price": price, "availability": availability}
        scenario_data[f"level{level}"] = {"customerId": customer, "calls": calls}

    catalog = {str(row.get("id")): row for row in datasets["products"]}
    missing_catalog = sorted(all_product_ids - catalog.keys())
    if missing_catalog:
        raise RuntimeError(f"Scenario products missing from downloaded catalog: {', '.join(missing_catalog)}.")
    subset = [row for row in datasets["products"] if str(row.get("id")) in all_product_ids]
    _write_json(FIXTURE_DIRECTORY / "catalog" / "products.json", subset)
    for dataset, id_field in (
        ("delivery-reliability", "productId"),
        ("carbon-footprint", "productId"),
    ):
        _write_json(
            FIXTURE_DIRECTORY / "catalog" / f"{dataset}.json",
            [row for row in datasets[dataset] if str(row.get(id_field)) in all_product_ids],
        )
    for level, recording in scenario_data.items():
        _write_json(FIXTURE_DIRECTORY / "recorded" / f"{level}.json", recording)
    header = probe.AUTHS[probe.auth_i][0] or "none"
    print(f"Valio data downloaded and scenario recordings written. Auth header that worked: {header}.")


def main() -> int:
    try:
        asyncio.run(fetch())
    except (OSError, ValueError, ValioUpstreamError, RuntimeError) as exc:
        print(f"Valio fetch failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
