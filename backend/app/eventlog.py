"""SQLite-backed, hash-chained audit events."""

from __future__ import annotations

import hashlib
import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def event_hash(event: dict[str, Any], previous_hash: str) -> str:
    unsigned = {key: value for key, value in event.items() if key != "hash"}
    digest = hashlib.sha256(
        (canonical_json(unsigned) + previous_hash).encode("utf-8")
    ).hexdigest()
    return f"sha256:{digest}"


class EventLog:
    def __init__(self, path: str | Path) -> None:
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._connection = sqlite3.connect(path, check_same_thread=False)
        self._connection.row_factory = sqlite3.Row
        self._connection.execute(
            """
            CREATE TABLE IF NOT EXISTS events (
                seq INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id TEXT NOT NULL UNIQUE,
                at TEXT NOT NULL,
                actor TEXT NOT NULL,
                type TEXT NOT NULL,
                customer_id TEXT,
                agent_id TEXT,
                request_id TEXT NOT NULL,
                light TEXT,
                reasons TEXT NOT NULL,
                summary TEXT NOT NULL,
                refs TEXT NOT NULL,
                payload TEXT NOT NULL,
                prev_hash TEXT NOT NULL,
                hash TEXT NOT NULL UNIQUE
            )
            """
        )
        self._connection.commit()

    def close(self) -> None:
        self._connection.close()

    def append(
        self,
        *,
        actor: str,
        event_type: str,
        request_id: str,
        summary: str,
        customer_id: str | None = None,
        agent_id: str | None = None,
        light: str | None = None,
        reasons: list[str] | None = None,
        refs: dict[str, str] | None = None,
        payload: dict[str, Any] | None = None,
        at: str | None = None,
    ) -> dict[str, Any]:
        previous = self._connection.execute(
            "SELECT hash FROM events ORDER BY seq DESC LIMIT 1"
        ).fetchone()
        previous_hash = previous["hash"] if previous else ""
        event: dict[str, Any] = {
            "seq": self._next_sequence(),
            "eventId": f"evt_{uuid4().hex}",
            "at": at or datetime.now().astimezone().isoformat(),
            "actor": actor,
            "type": event_type,
            "customerId": customer_id,
            "agentId": agent_id,
            "requestId": request_id,
            "light": light,
            "reasons": reasons or [],
            "summary": summary,
            "refs": refs or {},
            "payload": payload or {},
            "prevHash": previous_hash,
        }
        event["hash"] = event_hash(event, previous_hash)
        self._connection.execute(
            """
            INSERT INTO events (
                seq, event_id, at, actor, type, customer_id, agent_id,
                request_id, light, reasons, summary, refs, payload, prev_hash, hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event["seq"],
                event["eventId"],
                event["at"],
                event["actor"],
                event["type"],
                event["customerId"],
                event["agentId"],
                event["requestId"],
                event["light"],
                canonical_json(event["reasons"]),
                event["summary"],
                canonical_json(event["refs"]),
                canonical_json(event["payload"]),
                event["prevHash"],
                event["hash"],
            ),
        )
        self._connection.commit()
        return event

    def list(self, *, since: int = 0, limit: int = 100) -> list[dict[str, Any]]:
        rows = self._connection.execute(
            "SELECT * FROM events WHERE seq > ? ORDER BY seq LIMIT ?",
            (since, limit),
        ).fetchall()
        return [self._row_to_event(row) for row in rows]

    def list_customer(self, customer_id: str, *, since: int = 0, limit: int = 100) -> list[dict[str, Any]]:
        rows = self._connection.execute(
            "SELECT * FROM events WHERE customer_id = ? AND seq > ? ORDER BY seq LIMIT ?",
            (customer_id, since, limit),
        ).fetchall()
        return [self._row_to_event(row) for row in rows]

    def verify(self) -> dict[str, Any]:
        rows = self._connection.execute("SELECT * FROM events ORDER BY seq").fetchall()
        previous_hash = ""
        for row in rows:
            event = self._row_to_event(row)
            expected = event_hash(event, previous_hash)
            if event["prevHash"] != previous_hash or event["hash"] != expected:
                return {"valid": False, "brokenAtSeq": event["seq"]}
            previous_hash = event["hash"]
        result: dict[str, Any] = {"valid": True, "events": len(rows)}
        if rows:
            result["headHash"] = previous_hash
        return result

    def _next_sequence(self) -> int:
        row = self._connection.execute(
            "SELECT COALESCE(MAX(seq), 0) + 1 AS next_seq FROM events"
        ).fetchone()
        return int(row["next_seq"])

    @staticmethod
    def _row_to_event(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "seq": row["seq"],
            "eventId": row["event_id"],
            "at": row["at"],
            "actor": row["actor"],
            "type": row["type"],
            "customerId": row["customer_id"],
            "agentId": row["agent_id"],
            "requestId": row["request_id"],
            "light": row["light"],
            "reasons": json.loads(row["reasons"]),
            "summary": row["summary"],
            "refs": json.loads(row["refs"]),
            "payload": json.loads(row["payload"]),
            "prevHash": row["prev_hash"],
            "hash": row["hash"],
        }
