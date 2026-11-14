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
        assert forbidden.status_code == 401
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
        assert sum(event["type"] == "APPROVAL_EXPIRED" for event in log.list()) == 1
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


def test_different_yellow_alternative_reasons_are_approved_and_update_order(tmp_path):
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
        alternative["total"]["cents"] = 10000
        alternative["lines"][0]["lineTotal"]["cents"] = 10000
        alternative["lines"][0]["availableDate"] = (datetime.now(timezone.utc) + timedelta(days=3)).date().isoformat()
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
        stored_status = orders._connection.execute(
            "SELECT status FROM orders WHERE order_id = ?", (decision.json()["order"]["orderId"],),
        ).fetchone()["status"]
        assert stored_status == "CONFIRMED"
        original_reasons = set(approvals.get(approval_id, "customer-1")["reasons"])
        decided = [event for event in log.list() if event["type"] == "APPROVAL_DECIDED"][-1]
        assert original_reasons != set(decided["reasons"])
        assert "LATE_DELIVERY" in decided["reasons"]
        assert log.verify()["valid"] is True
    finally:
        _close((auth, quotes, orders, approvals, log))


def test_red_alternative_rejects_order_and_logs_policy_block(tmp_path):
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
        assert approval.json()["status"] == "REJECTED"
        assert orders.get(approval.json()["orderId"], "customer-1")["status"] == "REJECTED"
        blocked = [event for event in log.list() if event["type"] == "POLICY_BLOCKED"]
        assert blocked[-1]["actor"] == "human"
    finally:
        _close((auth, quotes, orders, approvals, log))


def test_three_approvals_are_open_and_fourth_is_attention_exhausted(tmp_path):
    values = _environment(tmp_path)
    agent, mandate, quote, auth, quotes, orders, approvals, log = values

    class Hearts:
        consumed = 0

        def consume(self, customer_id):
            self.consumed += 1
            return max(0, 3 - self.consumed)

    app.state.hearts_provider = Hearts()
    human = auth.issue_token(role="human", customer_id="customer-1")
    statuses, approvals_by_order = [], []
    try:
        for index in range(4):
            next_quote = quote if index == 0 else quotes.create(
                customer_id="customer-1", mandate_id=mandate["mandateId"],
                document={key: value for key, value in quote.items() if key not in {"quoteId", "customerId", "mandateId", "signature"}},
            )
            response = TestClient(app).post(
                "/v1/orders", headers={"Authorization": f"Bearer {agent}", "Idempotency-Key": f"heart-{index}"},
                json={"quoteId": next_quote["quoteId"], "planId": "pln_1"},
            )
            assert response.status_code == 202
            approval = TestClient(app).get(
                f"/v1/approvals/{response.json()['approvalId']}", headers={"Authorization": f"Bearer {human}"},
            ).json()
            statuses.append(approval["status"])
            approvals_by_order.append((response.json(), approval))
        assert statuses == ["OPEN", "OPEN", "OPEN", "EXPIRED"]
        fourth_order, fourth_approval = approvals_by_order[3]
        assert "ATTENTION_EXHAUSTED" in fourth_approval["reasons"]
        assert fourth_order["status"] == "EXPIRED"
        assert orders.get(fourth_order["orderId"], "customer-1")["status"] == "EXPIRED"
    finally:
        del app.state.hearts_provider
        _close((auth, quotes, orders, approvals, log))


def test_approvals_remain_open_without_hearts_provider(tmp_path):
    values = _environment(tmp_path)
    agent, mandate, quote, auth, quotes, orders, approvals, log = values
    human = auth.issue_token(role="human", customer_id="customer-1")
    try:
        assert not hasattr(app.state, "hearts_provider")
        for index in range(3):
            next_quote = quote if index == 0 else quotes.create(
                customer_id="customer-1", mandate_id=mandate["mandateId"],
                document={key: value for key, value in quote.items() if key not in {"quoteId", "customerId", "mandateId", "signature"}},
            )
            response = TestClient(app).post(
                "/v1/orders", headers={"Authorization": f"Bearer {agent}", "Idempotency-Key": f"no-heart-{index}"},
                json={"quoteId": next_quote["quoteId"], "planId": "pln_1"},
            )
            approval = TestClient(app).get(
                f"/v1/approvals/{response.json()['approvalId']}", headers={"Authorization": f"Bearer {human}"},
            ).json()
            assert approval["status"] == "OPEN"
            assert "ATTENTION_EXHAUSTED" not in approval["reasons"]
    finally:
        _close((auth, quotes, orders, approvals, log))


def test_log_contains_only_contract_event_types_and_reason_codes(tmp_path):
    values = _pending(tmp_path)
    _, human, approval_id, auth, quotes, orders, approvals, log = values
    allowed_types = {
        "MANDATE_SIGNED", "MANDATE_REVOKED", "SEARCH", "QUOTE_CREATED", "QUOTE_EXPIRED", "REQUOTE",
        "ORDER_CREATED", "ORDER_PENDING_APPROVAL", "APPROVAL_SHOWN", "APPROVAL_DECIDED",
        "APPROVAL_EXPIRED", "POLICY_BLOCKED", "DATA_BOUNDARY_BLOCKED", "SCENARIO_OVERLAY", "AGENT_NOTE",
    }
    allowed_reasons = {
        "WITHIN_MANDATE", "SPLIT_ORDER", "SUBSTITUTION_ALLOWED", "OVER_ORDER_LIMIT", "OVER_WEEK_LIMIT",
        "SUBSTITUTION_NOT_ALLOWED", "LATE_DELIVERY", "SALES_BLOCKED", "ALLERGEN_EXCLUDED", "LABEL_REQUIRED",
        "MANDATE_INVALID", "MANDATE_EXPIRED", "DATA_BOUNDARY", "POLICY_BLOCKED", "ATTENTION_EXHAUSTED",
    }
    try:
        issued = TestClient(app).post("/v1/auth/tokens", json={"role": "human", "customerId": "customer-1"})
        assert issued.status_code == 201
        approvals._connection.execute(
            "UPDATE approvals SET deadline = ? WHERE approval_id = ?",
            ((datetime.now().astimezone() - timedelta(seconds=1)).isoformat(), approval_id),
        )
        approvals._connection.commit()
        for _ in range(3):
            assert TestClient(app).get(
                f"/v1/approvals/{approval_id}", headers={"Authorization": f"Bearer {human}"},
            ).json()["status"] == "EXPIRED"
        events = log.list()
        assert sum(event["type"] == "APPROVAL_EXPIRED" for event in events) == 1
        assert all(event["type"] in allowed_types for event in events)
        assert all(reason in allowed_reasons for event in events for reason in event["reasons"])
    finally:
        _close((auth, quotes, orders, approvals, log))
