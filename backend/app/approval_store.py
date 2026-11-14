"""SQLite persistence and lazy lifecycle transitions for approvals."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4


class ApprovalStore:
    def __init__(self, path: str | Path) -> None:
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._connection = sqlite3.connect(path, check_same_thread=False)
        self._connection.row_factory = sqlite3.Row
        self._connection.execute(
            """
            CREATE TABLE IF NOT EXISTS approvals (
                approval_id TEXT PRIMARY KEY,
                customer_id TEXT NOT NULL,
                order_id TEXT NOT NULL UNIQUE,
                quote_id TEXT NOT NULL,
                status TEXT NOT NULL,
                reasons TEXT NOT NULL,
                options TEXT NOT NULL,
                agent_explanation TEXT,
                created_at TEXT NOT NULL,
                deadline TEXT NOT NULL,
                hearts_left INTEGER
            )
            """
        )
        self._connection.commit()
        columns = {row["name"] for row in self._connection.execute("PRAGMA table_info(approvals)")}
        if "expired_logged" not in columns:
            self._connection.execute("ALTER TABLE approvals ADD COLUMN expired_logged INTEGER NOT NULL DEFAULT 0")
            self._connection.commit()

    def close(self) -> None:
        self._connection.close()

    def reset(self) -> None:
        self._connection.execute("DELETE FROM approvals")
        self._connection.commit()

    def create(
        self,
        *,
        customer_id: str,
        order_id: str,
        quote_id: str,
        reasons: list[str],
        options: list[dict[str, Any]],
        created_at: datetime,
        deadline: datetime,
        hearts_left: int | None = None,
        status: str = "OPEN",
    ) -> dict[str, Any]:
        approval_id = f"apr_{uuid4().hex}"
        self._connection.execute(
            """
            INSERT INTO approvals
                (approval_id, customer_id, order_id, quote_id, status, reasons,
                 options, agent_explanation, created_at, deadline, hearts_left)
            VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
            """,
            (
                approval_id,
                customer_id,
                order_id,
                quote_id,
                status,
                json.dumps(reasons, sort_keys=True),
                json.dumps(options, ensure_ascii=False, sort_keys=True),
                created_at.isoformat(),
                deadline.isoformat(),
                hearts_left,
            ),
        )
        self._connection.commit()
        approval = self.get(approval_id, customer_id)
        if approval is None:
            raise RuntimeError("Approval was not persisted.")
        return approval

    def get(
        self,
        approval_id: str,
        customer_id: str,
        *,
        now: datetime | None = None,
    ) -> dict[str, Any] | None:
        row = self._connection.execute(
            """
            SELECT * FROM approvals
            WHERE approval_id = ? AND customer_id = ?
            """,
            (approval_id, customer_id),
        ).fetchone()
        if row is None:
            return None
        if (
            now is not None
            and row["status"] == "OPEN"
            and datetime.fromisoformat(row["deadline"]) <= now
        ):
            self._connection.execute(
                "UPDATE approvals SET status = 'EXPIRED' WHERE approval_id = ?",
                (approval_id,),
            )
            self._connection.commit()
            row = self._connection.execute(
                "SELECT * FROM approvals WHERE approval_id = ?",
                (approval_id,),
            ).fetchone()
        return _approval(row)

    def decide(
        self,
        approval_id: str,
        customer_id: str,
        *,
        status: str,
        agent_explanation: str | None = None,
    ) -> dict[str, Any] | None:
        self._connection.execute(
            """
            UPDATE approvals
            SET status = ?, agent_explanation = COALESCE(?, agent_explanation)
            WHERE approval_id = ? AND customer_id = ? AND status = 'OPEN'
            """,
            (status, agent_explanation, approval_id, customer_id),
        )
        self._connection.commit()
        return self.get(approval_id, customer_id)

    def add_explanation(
        self,
        approval_id: str,
        customer_id: str,
        text: str,
    ) -> dict[str, Any] | None:
        self._connection.execute(
            """
            UPDATE approvals SET agent_explanation = ?
            WHERE approval_id = ? AND customer_id = ? AND status = 'OPEN'
            """,
            (text, approval_id, customer_id),
        )
        self._connection.commit()
        return self.get(approval_id, customer_id)

    def expire_for_order(
        self,
        order_id: str,
        customer_id: str,
        *,
        now: datetime,
    ) -> dict[str, Any] | None:
        row = self._connection.execute(
            """
            SELECT approval_id FROM approvals
            WHERE order_id = ? AND customer_id = ? AND status = 'OPEN'
            """,
            (order_id, customer_id),
        ).fetchone()
        if row is None:
            return None
        return self.get(row["approval_id"], customer_id, now=now)

    def claim_expired_log(self, approval_id: str, customer_id: str) -> bool:
        cursor = self._connection.execute(
            "UPDATE approvals SET expired_logged = 1 WHERE approval_id = ? AND customer_id = ? AND status = 'EXPIRED' AND expired_logged = 0",
            (approval_id, customer_id),
        )
        self._connection.commit()
        return cursor.rowcount == 1

    def count(self, customer_id: str) -> int:
        row = self._connection.execute("SELECT COUNT(*) AS count FROM approvals WHERE customer_id = ?", (customer_id,)).fetchone()
        return int(row["count"])


def _approval(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "approvalId": row["approval_id"],
        "orderId": row["order_id"],
        "quoteId": row["quote_id"],
        "status": row["status"],
        "reasons": json.loads(row["reasons"]),
        "options": json.loads(row["options"]),
        "agentExplanation": row["agent_explanation"],
        "deadline": row["deadline"],
        "createdAt": row["created_at"],
        "heartsLeft": row["hearts_left"],
    }
