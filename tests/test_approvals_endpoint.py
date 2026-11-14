import time
import copy
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from backend.app.main import app
from tests.test_orders_endpoint import _close, _environment


def _pending(tmp_path, *, timeout=20):
    values = _environment(tmp_path)
    agent, mandate, quote, auth, quotes, orders, approvals, log = values
    app.state.approval_timeout_seconds = timeout
    response = TestClient(app).post(
        "/v1/orders",
        headers={"Authorization": f"Bearer {agent}", "Idempotency-Key": "approval-key"},
        json={"quoteId": quote["quoteId"], "planId": "pln_1"},
    )
    assert response.status_code == 202
    approval_id = response.json()["approvalId"]
    human = auth.issue_token(role="human", customer_id="customer-1")
    return (
        agent,
        human,
        approval_id,
        auth,
        quotes,
        orders,
        approvals,
        log,
    )


def test_agent_explanation_and_human_approval_release_pending_spend(tmp_path):
    values = _pending(tmp_path)
    agent, human, approval_id, auth, quotes, orders, approvals, log = values
    try:
        explanation = TestClient(app).post(
            f"/v1/approvals/{approval_id}/explanation",
            headers={"Authorization": f"Bearer {agent}"},
            json={"text": "The order exceeds the per-order limit."},
        )
        assert explanation.status_code == 200
        assert explanation.json()["agentExplanation"] == "The order exceeds the per-order limit."
        decision = TestClient(app).post(
            f"/v1/approvals/{approval_id}",
            headers={"Authorization": f"Bearer {human}"},
            json={"decision": "approved"},
        )
        assert decision.status_code == 200
        assert decision.json()["approval"]["status"] == "APPROVED"
        assert decision.json()["order"]["status"] == "ORDERED"
        assert orders.week_total_cents("customer-1", now=datetime.now().astimezone()) == 60000
    finally:
        _close((auth, quotes, orders, approvals, log))


def test_agent_cannot_decide_and_double_decision_is_closed(tmp_path):
    values = _pending(tmp_path)
    agent, human, approval_id, auth, quotes, orders, approvals, log = values
    try:
        forbidden = TestClient(app).post(
            f"/v1/approvals/{approval_id}",
            headers={"Authorization": f"Bearer {agent}"},
            json={"decision": "approved"},
        )
        assert forbidden.status_code == 403
        first = TestClient(app).post(
            f"/v1/approvals/{approval_id}",
            headers={"Authorization": f"Bearer {human}"},
            json={"decision": "rejected"},
        )
        assert first.status_code == 200
        assert first.json()["order"]["status"] == "REJECTED"
        assert orders.week_total_cents("customer-1", now=datetime.now().astimezone()) == 0
        second = TestClient(app).post(
            f"/v1/approvals/{approval_id}",
            headers={"Authorization": f"Bearer {human}"},
            json={"decision": "approved"},
        )
        assert second.status_code == 409
        foreign = auth.issue_token(role="human", customer_id="customer-2")
        hidden = TestClient(app).get(
            f"/v1/approvals/{approval_id}",
            headers={"Authorization": f"Bearer {foreign}"},
        )
        assert hidden.status_code == 404
    finally:
        _close((auth, quotes, orders, approvals, log))


def test_approval_deadline_expires_order_lazily(tmp_path):
    values = _pending(tmp_path, timeout=1)
    agent, human, approval_id, auth, quotes, orders, approvals, log = values
    try:
        time.sleep(1.1)
        approval = TestClient(app).get(
            f"/v1/approvals/{approval_id}",
            headers={"Authorization": f"Bearer {human}"},
        )
        assert approval.status_code == 200
        assert approval.json()["status"] == "EXPIRED"
        order_id = approval.json()["order"]["orderId"]
        order = TestClient(app).get(
            f"/v1/orders/{order_id}",
            headers={"Authorization": f"Bearer {agent}"},
        )
        assert order.status_code == 200
        assert order.json()["status"] == "EXPIRED"
        decision = TestClient(app).post(
            f"/v1/approvals/{approval_id}",
            headers={"Authorization": f"Bearer {human}"},
            json={"decision": "approved"},
        )
        assert decision.status_code == 409
    finally:
        _close((auth, quotes, orders, approvals, log))


def test_revoked_mandate_blocks_approval(tmp_path):
    values = _pending(tmp_path)
    agent, human, approval_id, auth, quotes, orders, approvals, log = values
    try:
        auth.revoke_mandate(
            quotes.get(
                approvals.get(approval_id, "customer-1")["quoteId"],
                "customer-1",
            )["mandateId"],
            "customer-1",
        )
        response = TestClient(app).post(
            f"/v1/approvals/{approval_id}",
            headers={"Authorization": f"Bearer {human}"},
            json={"decision": "approved"},
        )
        assert response.status_code == 403
        assert orders.get(
            approvals.get(approval_id, "customer-1")["orderId"],
            "customer-1",
        )["status"] == "REJECTED"
    finally:
        _close((auth, quotes, orders, approvals, log))


def test_same_reason_alternative_is_approved_and_updates_order(tmp_path):
    values = _pending(tmp_path)
    agent, human, _, auth, quotes, orders, approvals, log = values
    try:
        approval_rows = approvals._connection.execute(
            "SELECT quote_id FROM approvals WHERE customer_id = ?",
            ("customer-1",),
        ).fetchone()
        quote = quotes.get(approval_rows["quote_id"], "customer-1")
        alternative = copy.deepcopy(quote["plans"][0])
        alternative["planId"] = "pln_2"
        second_quote = quotes.create(
            customer_id="customer-1",
            mandate_id=quote["mandateId"],
            document={
                "status": "QUOTED",
                "expiresAt": quote["expiresAt"],
                "plans": [quote["plans"][0], alternative],
            },
        )
        response = TestClient(app).post(
            "/v1/orders",
            headers={"Authorization": f"Bearer {agent}", "Idempotency-Key": "alternative-key"},
            json={"quoteId": second_quote["quoteId"], "planId": "pln_1"},
        )
        approval_id = response.json()["approvalId"]
        decision = TestClient(app).post(
            f"/v1/approvals/{approval_id}",
            headers={"Authorization": f"Bearer {human}"},
            json={"decision": "alternative", "planId": "pln_2"},
        )
        assert decision.status_code == 200
        assert decision.json()["order"]["status"] == "ORDERED"
        assert decision.json()["order"]["planId"] == "pln_2"
        assert log.verify()["valid"] is True
    finally:
        _close((auth, quotes, orders, approvals, log))


def test_red_alternative_is_refused_and_approval_stays_open(tmp_path):
    values = _pending(tmp_path)
    agent, human, approval_id, auth, quotes, orders, approvals, log = values
    try:
        app.state.valio_data._product["salesBlock"] = True
        response = TestClient(app).post(
            f"/v1/approvals/{approval_id}",
            headers={"Authorization": f"Bearer {human}"},
            json={"decision": "alternative", "planId": "pln_1"},
        )
        assert response.status_code == 403
        approval = TestClient(app).get(
            f"/v1/approvals/{approval_id}",
            headers={"Authorization": f"Bearer {human}"},
        )
        assert approval.json()["status"] == "OPEN"
    finally:
        _close((auth, quotes, orders, approvals, log))
