"""SQLite persistence for idempotent orders and week-spend bookkeeping."""

from __future__ import annotations

import hashlib
import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from backend.app.eventlog import canonical_json


class IdempotencyConflict(ValueError):
    """Raised when a key is reused with a different request body."""


class OrderStore:
    def __init__(self, path: str | Path) -> None:
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._connection = sqlite3.connect(path, check_same_thread=False)
        self._connection.row_factory = sqlite3.Row
        self._connection.execute(
            """
            CREATE TABLE IF NOT EXISTS orders (
                order_id TEXT PRIMARY KEY,
                customer_id TEXT NOT NULL,
                quote_id TEXT NOT NULL,
                plan_id TEXT NOT NULL,
                idempotency_key TEXT NOT NULL,
                request_hash TEXT NOT NULL,
                status TEXT NOT NULL,
                total_cents INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                response_status INTEGER NOT NULL,
                response TEXT NOT NULL,
                UNIQUE (customer_id, idempotency_key)
            )
            """
        )
        self._connection.commit()

    def close(self) -> None:
        self._connection.close()

    def existing(
        self,
        *,
        customer_id: str,
        idempotency_key: str,
        request_body: dict[str, Any],
    ) -> tuple[int, dict[str, Any]] | None:
        row = self._connection.execute(
            """
            SELECT request_hash, response_status, response
            FROM orders
            WHERE customer_id = ? AND idempotency_key = ?
            """,
            (customer_id, idempotency_key),
        ).fetchone()
        if row is None:
            return None
        if row["request_hash"] != _request_hash(request_body):
            raise IdempotencyConflict(
                "Idempotency-Key was already used with a different request body."
            )
        return row["response_status"], json.loads(row["response"])

    def create(
        self,
        *,
        customer_id: str,
        quote_id: str,
        plan_id: str,
        idempotency_key: str,
        request_body: dict[str, Any],
        status: str,
        total_cents: int,
        response_status: int,
        response: dict[str, Any],
        created_at: str | None = None,
    ) -> dict[str, Any]:
        order_id = str(response.get("orderId") or f"ord_{uuid4().hex}")
        value = {**response, "orderId": order_id}
        try:
            self._connection.execute(
                """
                INSERT INTO orders
                    (order_id, customer_id, quote_id, plan_id, idempotency_key,
                     request_hash, status, total_cents, created_at,
                     response_status, response)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    order_id,
                    customer_id,
                    quote_id,
                    plan_id,
                    idempotency_key,
                    _request_hash(request_body),
                    status,
                    total_cents,
                    created_at or datetime.now().astimezone().isoformat(),
                    response_status,
                    json.dumps(value, ensure_ascii=False, sort_keys=True),
                ),
            )
            self._connection.commit()
        except sqlite3.IntegrityError as exc:
            raise IdempotencyConflict(
                "Idempotency-Key was already used."
            ) from exc
        return value

    def get(self, order_id: str, customer_id: str) -> dict[str, Any] | None:
        row = self._connection.execute(
            """
            SELECT response FROM orders
            WHERE order_id = ? AND customer_id = ?
            """,
            (order_id, customer_id),
        ).fetchone()
        return json.loads(row["response"]) if row else None

    def count(self, customer_id: str) -> int:
        row = self._connection.execute(
            "SELECT COUNT(*) AS count FROM orders WHERE customer_id = ?",
            (customer_id,),
        ).fetchone()
        return int(row["count"])

    def week_total_cents(self, customer_id: str, *, now: datetime) -> int:
        week = now.date().isocalendar()
        rows = self._connection.execute(
            """
            SELECT total_cents, created_at FROM orders
            WHERE customer_id = ? AND status IN ('PENDING_APPROVAL', 'ORDERED', 'CONFIRMED')
            """,
            (customer_id,),
        ).fetchall()
        total = 0
        for row in rows:
            created = datetime.fromisoformat(row["created_at"])
            created_week = created.date().isocalendar()
            if (created_week.year, created_week.week) == (week.year, week.week):
                total += row["total_cents"]
        return total


def _request_hash(value: dict[str, Any]) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()
