"""Opaque token authentication and mandate persistence."""

from __future__ import annotations

import hashlib
import json
import secrets
import sqlite3
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from backend.app.signing import DocumentSigner


@dataclass(frozen=True)
class Principal:
    role: str
    customer_id: str | None
    agent_id: str | None


class MandateError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


class AuthStore:
    def __init__(self, path: str | Path, signer: DocumentSigner | None = None) -> None:
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._connection = sqlite3.connect(path, check_same_thread=False)
        self._connection.row_factory = sqlite3.Row
        self._signer = signer
        self._connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS tokens (
                token_hash TEXT PRIMARY KEY,
                role TEXT NOT NULL,
                customer_id TEXT,
                agent_id TEXT,
                created_at TEXT NOT NULL,
                revoked INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS mandates (
                mandate_id TEXT PRIMARY KEY,
                customer_id TEXT NOT NULL,
                status TEXT NOT NULL,
                valid_until TEXT NOT NULL,
                document TEXT NOT NULL,
                signature TEXT NOT NULL
            );
            """
        )
        self._connection.commit()

    def close(self) -> None:
        self._connection.close()

    def issue_token(
        self,
        *,
        role: str,
        customer_id: str | None,
        agent_id: str | None = None,
    ) -> str:
        token = secrets.token_urlsafe(32)
        self._connection.execute(
            """
            INSERT INTO tokens (token_hash, role, customer_id, agent_id, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                self._hash_token(token),
                role,
                customer_id,
                agent_id,
                datetime.now().astimezone().isoformat(),
            ),
        )
        self._connection.commit()
        return token

    def authenticate(self, token: str | None) -> Principal | None:
        if not token:
            return None
        row = self._connection.execute(
            """
            SELECT role, customer_id, agent_id FROM tokens
            WHERE token_hash = ? AND revoked = 0
            """,
            (self._hash_token(token),),
        ).fetchone()
        return (
            Principal(row["role"], row["customer_id"], row["agent_id"])
            if row
            else None
        )

    def create_mandate(
        self,
        *,
        principal: Principal,
        request_data: dict[str, Any],
    ) -> dict[str, Any]:
        if self._signer is None:
            raise RuntimeError("Mandate signing is not configured.")
        valid_until = request_data.get("validUntil")
        if not isinstance(valid_until, str):
            raise ValueError("validUntil is required.")
        mandate_id = f"mdt_{uuid4().hex}"
        document = {
            **request_data,
            "mandateId": mandate_id,
            "customerId": principal.customer_id,
            "issuedAt": datetime.now().astimezone().isoformat(),
            "status": "ACTIVE",
        }
        signature = self._signer.sign(document)
        self._connection.execute(
            """
            INSERT INTO mandates
                (mandate_id, customer_id, status, valid_until, document, signature)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                mandate_id,
                principal.customer_id,
                "ACTIVE",
                valid_until,
                json.dumps(document, ensure_ascii=False, sort_keys=True),
                json.dumps(signature, ensure_ascii=False, sort_keys=True),
            ),
        )
        self._connection.commit()
        return {**document, "signature": signature}

    def get_mandate(self, mandate_id: str, customer_id: str) -> dict[str, Any] | None:
        row = self._connection.execute(
            """
            SELECT document, signature FROM mandates
            WHERE mandate_id = ? AND customer_id = ?
            """,
            (mandate_id, customer_id),
        ).fetchone()
        if not row:
            return None
        return {
            **json.loads(row["document"]),
            "signature": json.loads(row["signature"]),
        }

    def revoke_mandate(self, mandate_id: str, customer_id: str) -> dict[str, Any] | None:
        row = self._connection.execute(
            """
            SELECT document, signature FROM mandates
            WHERE mandate_id = ? AND customer_id = ?
            """,
            (mandate_id, customer_id),
        ).fetchone()
        if not row:
            return None
        document = json.loads(row["document"])
        document["status"] = "REVOKED"
        self._connection.execute(
            "UPDATE mandates SET status = ?, document = ? WHERE mandate_id = ?",
            ("REVOKED", json.dumps(document, sort_keys=True), mandate_id),
        )
        self._connection.commit()
        return {**document, "signature": json.loads(row["signature"])}

    def require_mandate(self, mandate_id: str, customer_id: str) -> dict[str, Any]:
        mandate = self.get_mandate(mandate_id, customer_id)
        if mandate is None:
            raise MandateError("NOT_FOUND", "Mandate not found.")
        if mandate["status"] != "ACTIVE":
            raise MandateError("MANDATE_INVALID", "Mandate is not active.")
        try:
            expires_at = datetime.fromisoformat(mandate["validUntil"])
        except (KeyError, TypeError, ValueError) as exc:
            raise MandateError("MANDATE_INVALID", "Mandate has an invalid expiry.") from exc
        if datetime.now(expires_at.tzinfo) > expires_at:
            raise MandateError("MANDATE_EXPIRED", "Mandate has expired.")
        if self._signer is None:
            raise MandateError("MANDATE_INVALID", "Mandate signing is not configured.")
        document = {key: value for key, value in mandate.items() if key != "signature"}
        if not self._signer.verify(document, mandate["signature"]):
            raise MandateError("MANDATE_INVALID", "Mandate signature is invalid.")
        return mandate

    @staticmethod
    def _hash_token(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()
