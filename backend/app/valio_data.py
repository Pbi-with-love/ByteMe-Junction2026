"""Download, cache, and parse Valio data files."""

from __future__ import annotations

import csv
import io
import json
from pathlib import Path
from typing import Any

from backend.app.valio_client import ValioClient


DOWNLOADS = ("products", "delivery-reliability", "carbon-footprint")


def parse_rows(raw: bytes) -> list[dict[str, Any]]:
    """Parse JSON or delimited text without assuming upstream field names."""
    try:
        value: Any = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError):
        text = raw.decode("utf-8-sig")
        try:
            dialect = csv.Sniffer().sniff(text[:4096])
        except csv.Error as exc:
            raise ValueError("Unable to determine the downloaded file format.") from exc
        return list(csv.DictReader(io.StringIO(text), dialect=dialect))

    while isinstance(value, dict):
        nested = next(
            (item for item in value.values() if isinstance(item, (list, dict))),
            None,
        )
        if nested is None:
            raise ValueError("JSON download does not contain tabular data.")
        value = nested
    if not isinstance(value, list) or not all(isinstance(row, dict) for row in value):
        raise ValueError("JSON download does not contain object rows.")
    return value


class ValioDataCache:
    def __init__(self, client: ValioClient, directory: Path) -> None:
        self._client = client
        self._directory = directory

    async def refresh(self) -> dict[str, list[dict[str, Any]]]:
        self._directory.mkdir(parents=True, exist_ok=True)
        datasets: dict[str, list[dict[str, Any]]] = {}
        for name in DOWNLOADS:
            raw = await self._client.download(name)
            (self._directory / f"{name}.raw").write_bytes(raw)
            datasets[name] = parse_rows(raw)
            (self._directory / f"{name}.json").write_text(
                json.dumps(datasets[name], ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
        return datasets

    def load(self, name: str) -> list[dict[str, Any]]:
        if name not in DOWNLOADS:
            raise ValueError(f"Unknown Valio dataset: {name}")
        path = self._directory / f"{name}.json"
        if not path.exists():
            raise FileNotFoundError(f"Valio dataset is not cached: {name}")
        value = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(value, list) or not all(isinstance(row, dict) for row in value):
            raise ValueError(f"Cached Valio dataset is invalid: {name}")
        return value
