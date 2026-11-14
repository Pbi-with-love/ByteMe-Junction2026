"""Capture the Level 1 Balanced gateway bodies used by frontend contract tests."""
from __future__ import annotations

import json
import os
from pathlib import Path
import time
import tempfile

from fastapi.testclient import TestClient

from backend.app.main import create_app


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "tests" / "fixtures" / "live" / "level1-balanced.json"


def main() -> None:
    previous = os.environ.get("VALIO_MODE")
    os.environ["VALIO_MODE"] = "replay"
    path = Path(tempfile.mktemp(suffix=".sqlite3"))
    application = create_app(path)
    try:
        with TestClient(application) as client:
            presets = client.get("/v1/game/levels/level1/presets").json()
            start = client.post("/v1/game/levels/level1/start", json={"preset": "balanced", "mode": "replay"}).json()
            human = {"Authorization": f"Bearer {start['tokens']['human']}"}
            agent = {"Authorization": f"Bearer {start['tokens']['agent']}"}
            signed = client.post("/v1/mandates", headers=human, json={key: value for key, value in presets["balanced"].items() if key in {"agentId", "issuedBy", "limits", "substitution", "lateDelivery", "hardConstraints", "priorities", "validUntil"}})
            if signed.status_code != 201:
                raise RuntimeError("Could not sign the Level 1 Balanced mandate.")
            client.post(f"/v1/game/sessions/{start['sessionId']}/run")
            approval_get = approval_decision = None
            deadline = time.monotonic() + 8
            while time.monotonic() < deadline:
                session = client.get(f"/v1/game/sessions/{start['sessionId']}").json()
                for step in session.get("steps", []):
                    approval = step.get("approval")
                    if approval and approval_get is None:
                        approval_get = client.get(f"/v1/approvals/{approval['approvalId']}", headers=human).json()
                        approval_decision = client.post(f"/v1/approvals/{approval['approvalId']}", headers=human, json={"decision": "approved"}).json()
                if session["status"] in {"FINISHED", "FAILED"}:
                    break
                time.sleep(0.01)
            if session["status"] != "FINISHED":
                raise RuntimeError(f"Fixture run did not finish: {session.get('error')}")
            result = client.get(f"/v1/game/sessions/{start['sessionId']}/result").json()
            compare = client.get("/v1/game/levels/level1/compare").json()
            buyer_log = client.get("/v1/log", headers=agent).json()
            operator_token = client.post("/v1/auth/tokens", json={"role": "operator"}).json()["token"]
            valio_log = client.get("/v1/log", headers={"Authorization": f"Bearer {operator_token}"}).json()
            verify = client.get("/v1/log/verify").json()
            OUTPUT.parent.mkdir(parents=True, exist_ok=True)
            OUTPUT.write_text(json.dumps({"presets": presets, "start": start, "session": session, "approvalGet": approval_get, "approvalDecision": approval_decision, "result": result, "compare": compare, "buyerLog": buyer_log, "valioLog": valio_log, "verify": verify}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    finally:
        for name in ("event_log", "auth_store", "quote_store", "order_store", "approval_store"):
            store = getattr(application.state, name, None)
            if store is not None:
                store.close()
        path.unlink(missing_ok=True)
        if previous is None:
            os.environ.pop("VALIO_MODE", None)
        else:
            os.environ["VALIO_MODE"] = previous


if __name__ == "__main__":
    main()
