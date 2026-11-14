"""Environment-backed configuration for the gateway."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")


@dataclass(frozen=True)
class Settings:
    valio_api_base_url: str
    valio_api_key: str
    valio_customer_id: str = ""
    quote_signing_key: str = ""
    approval_timeout_seconds: int = 20
    valio_cache_directory: Path = ROOT / "data" / "valio"

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            valio_api_base_url=os.getenv("VALIO_API_BASE_URL", "").rstrip("/"),
            valio_api_key=os.getenv("VALIO_API_KEY", ""),
            valio_customer_id=os.getenv("VALIO_CUSTOMER_ID", ""),
            quote_signing_key=os.getenv("QUOTE_SIGNING_KEY", ""),
            approval_timeout_seconds=int(os.getenv("APPROVAL_TIMEOUT_SECONDS", "20")),
        )

    def require_valio_credentials(self) -> None:
        missing = [
            name
            for name, value in (
                ("VALIO_API_BASE_URL", self.valio_api_base_url),
                ("VALIO_API_KEY", self.valio_api_key),
            )
            if not value
        ]
        if missing:
            joined = ", ".join(missing)
            raise RuntimeError(f"Missing Valio configuration: {joined}")
