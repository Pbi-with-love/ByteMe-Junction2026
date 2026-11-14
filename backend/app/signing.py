"""Ed25519 signing for mandate and quote documents."""

from __future__ import annotations

import base64
import json
from typing import Any

from nacl.exceptions import BadSignatureError
from nacl.signing import SigningKey, VerifyKey


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


class DocumentSigner:
    def __init__(self, encoded_private_key: str) -> None:
        if not encoded_private_key:
            raise RuntimeError("QUOTE_SIGNING_KEY is not configured.")
        try:
            seed = base64.b64decode(encoded_private_key, validate=True)
            self._key = SigningKey(seed)
        except Exception as exc:
            raise RuntimeError(
                "QUOTE_SIGNING_KEY must be a base64-encoded Ed25519 seed."
            ) from exc

    @property
    def key_id(self) -> str:
        return "valio-aimo-2026-11"

    def sign(self, document: dict[str, Any]) -> dict[str, str]:
        value = base64.b64encode(self._key.sign(canonical_bytes(document)).signature)
        return {"alg": "Ed25519", "keyId": self.key_id, "value": value.decode("ascii")}

    def verify(self, document: dict[str, Any], signature: dict[str, str]) -> bool:
        if signature.get("alg") != "Ed25519" or signature.get("keyId") != self.key_id:
            return False
        try:
            VerifyKey(self._key.verify_key.encode()).verify(
                canonical_bytes(document),
                base64.b64decode(signature["value"], validate=True),
            )
        except (BadSignatureError, KeyError, ValueError):
            return False
        return True
