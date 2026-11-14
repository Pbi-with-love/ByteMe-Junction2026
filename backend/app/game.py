"""Small in-memory game session state and session-bound attention hearts."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any
from uuid import uuid4


@dataclass
class HeartsProvider:
    session_id: str
    customer_id: str
    remaining: int = 3

    def consume(self, customer_id: str) -> int:
        if customer_id != self.customer_id:
            return self.remaining
        self.remaining = max(0, self.remaining - 1)
        return self.remaining


@dataclass
class GameSession:
    session_id: str
    scenario: dict[str, Any]
    preset: str
    mode: str
    started_at: datetime
    human_token: str
    agent_token: str
    mandate_id_before: set[str] = field(default_factory=set)
    status: str = "READY"
    activity: str = "idle"
    explain_source: str | None = None
    explain_fallback_reason: str | None = None
    explain_elapsed_ms: int | None = None
    steps: list[dict[str, Any]] = field(default_factory=list)
    error: str | None = None
    task: Any = None
    hearts: HeartsProvider | None = None


def new_session_id() -> str:
    return f"ses_{uuid4().hex}"
