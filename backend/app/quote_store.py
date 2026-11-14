"""Quote expiry calculation, signing, and SQLite persistence."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from backend.app.signing import DocumentSigner


class QuoteError(ValueError):
    """Raised when a quote cannot be safely created or read."""


def quote_expiry(
    *,
    lines: list[dict[str, Any]],
    prices: dict[str, dict[str, Any]],
    availability: dict[str, dict[str, Any]],
) -> str:
    """Return the earliest verified price validity or availability closing time."""
    dates: list[datetime] = []
    for line in lines:
        product_id = str(line.get("productId", ""))
        price = prices.get(product_id)
        if not price:
            raise QuoteError(f"Price is missing for product {product_id}.")
        valid_to = price.get("priceWithTax", {}).get("validTo")
        dates.append(_parse_datetime(valid_to, "price validTo", product_id))
        closing_time = availability.get(product_id, {}).get("closingTime")
        if closing_time is not None:
            dates.append(_parse_datetime(closing_time, "closingTime", product_id))
    if not dates:
        raise QuoteError("A quote must contain at least one priced line.")
    return min(dates).isoformat()


class QuoteStore:
    def __init__(self, path: str | Path, signer: DocumentSigner) -> None:
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._connection = sqlite3.connect(path, check_same_thread=False)
        self._connection.row_factory = sqlite3.Row
        self._signer = signer
        self._connection.execute(
            """
            CREATE TABLE IF NOT EXISTS quotes (
                quote_id TEXT PRIMARY KEY,
                customer_id TEXT NOT NULL,
                mandate_id TEXT NOT NULL,
                status TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                document TEXT NOT NULL,
                signature TEXT NOT NULL
            )
            """
        )
        self._connection.commit()

    def close(self) -> None:
        self._connection.close()

    def reset(self) -> None:
        self._connection.execute("DELETE FROM quotes")
        self._connection.commit()

    def create(
        self,
        *,
        customer_id: str,
        mandate_id: str,
        document: dict[str, Any],
    ) -> dict[str, Any]:
        quote_id = str(document.get("quoteId") or f"qt_{uuid4().hex}")
        expires_at = document.get("expiresAt")
        if not isinstance(expires_at, str):
            raise QuoteError("Quote expiresAt is required.")
        _parse_datetime(expires_at, "expiresAt", quote_id)
        unsigned = {
            **document,
            "quoteId": quote_id,
            "customerId": customer_id,
            "mandateId": mandate_id,
            "status": document.get("status", "QUOTED"),
        }
        signature = self._signer.sign(unsigned)
        self._connection.execute(
            """
            INSERT INTO quotes
                (quote_id, customer_id, mandate_id, status, expires_at, document, signature)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                quote_id,
                customer_id,
                mandate_id,
                unsigned["status"],
                expires_at,
                json.dumps(unsigned, ensure_ascii=False, sort_keys=True),
                json.dumps(signature, ensure_ascii=False, sort_keys=True),
            ),
        )
        self._connection.commit()
        return {**unsigned, "signature": signature}

    def get(
        self,
        quote_id: str,
        customer_id: str,
        *,
        now: datetime | None = None,
    ) -> dict[str, Any] | None:
        row = self._connection.execute(
            """
            SELECT document, signature, status, expires_at
            FROM quotes
            WHERE quote_id = ? AND customer_id = ?
            """,
            (quote_id, customer_id),
        ).fetchone()
        if row is None:
            return None
        document = json.loads(row["document"])
        signature = json.loads(row["signature"])
        if now is not None and _parse_datetime(row["expires_at"], "expiresAt", quote_id) <= now:
            if row["status"] == "QUOTED":
                document["status"] = "EXPIRED"
                signature = self._signer.sign(document)
                self._connection.execute(
                    """
                    UPDATE quotes
                    SET status = ?, document = ?, signature = ?
                    WHERE quote_id = ?
                    """,
                    (
                        "EXPIRED",
                        json.dumps(document, ensure_ascii=False, sort_keys=True),
                        json.dumps(signature, ensure_ascii=False, sort_keys=True),
                        quote_id,
                    ),
                )
                self._connection.commit()
        else:
            document["status"] = row["status"]
        return {**document, "signature": signature}

    def verify(self, quote: dict[str, Any]) -> bool:
        signature = quote.get("signature")
        if not isinstance(signature, dict):
            return False
        document = {key: value for key, value in quote.items() if key != "signature"}
        return self._signer.verify(document, signature)


def _parse_datetime(value: Any, field: str, identifier: str) -> datetime:
    if not isinstance(value, str):
        raise QuoteError(f"{field} is missing for {identifier}.")
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError as exc:
        raise QuoteError(f"{field} is invalid for {identifier}.") from exc
    if parsed.tzinfo is None:
        raise QuoteError(f"{field} must include a timezone for {identifier}.")
    return parsed
