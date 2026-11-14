from datetime import datetime, timedelta, timezone
import json

from fastapi.testclient import TestClient

from backend.app.auth import AuthStore
from backend.app.eventlog import EventLog
from backend.app.main import app
from backend.app.order_store import OrderStore
from backend.app.quote_store import QuoteStore
from backend.app.signing import DocumentSigner
from tests.test_quote_store import signer


class _Data:
    def __init__(self, *, sales_block=False):
        self._product = {
            "id": "milk-1",
            "category": "10400",
            "salesUnit": "ST",
            "baseUnit": "ST",
            "salesBlock": sales_block,
            "units": [{"unitId": "ST", "sizeInBaseUnits": 1}],
            "synkkaData": {"unitConversions": [{"volume": {"unit": "LTR", "value": 1}}]},
        }

    def load(self, name):
        if name == "products":
            return [self._product]
        if name == "delivery-reliability":
            return []
        if name == "carbon-footprint":
            return []
        raise AssertionError(name)


class _Client:
    pass


def _environment(
    tmp_path,
    *,
    limit=500,
    week_limit=3000,
    expires_at=None,
    sales_block=False,
):
    document_signer = signer()
    database = tmp_path / "gateway.sqlite3"
    auth = AuthStore(database, document_signer)
    quotes = QuoteStore(database, document_signer)
    orders = OrderStore(database)
    log = EventLog(database)
    human_token = auth.issue_token(role="human", customer_id="customer-1")
    human = auth.authenticate(human_token)
    assert human is not None
    mandate = auth.create_mandate(
        principal=human,
        request_data={
            "agentId": "agent-1",
            "limits": {"perOrderEur": limit, "perWeekEur": week_limit},
            "substitution": "none",
            "lateDelivery": "none",
            "hardConstraints": {"excludeAllergens": [], "requireLabels": []},
            "priorities": ["on_time", "price", "sustainability"],
            "validUntil": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        },
    )
    agent_token = auth.issue_token(
        role="agent", customer_id="customer-1", agent_id="agent-1"
    )
    expires_at = expires_at or (
        datetime.now(timezone.utc) + timedelta(hours=1)
    ).isoformat()
    quote = quotes.create(
        customer_id="customer-1",
        mandate_id=mandate["mandateId"],
        document={
            "status": "QUOTED",
            "expiresAt": expires_at,
            "need": {"quantity": {"amount": 100, "unit": "l"}},
            "plans": [
                {
                    "planId": "pln_1",
                    "tier": "good",
                    "category": "10400",
                    "deadline": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
                    "lines": [
                        {
                            "productId": "milk-1",
                            "quantity": {"amount": 100, "unit": "l"},
                            "lineTotal": {"cents": 60000, "currency": "EUR"},
                            "availableDate": datetime.now(timezone.utc).date().isoformat(),
                            "isSubstitute": False,
                        }
                    ],
                    "total": {"cents": 60000, "currency": "EUR"},
                    "policy": {"light": "GREEN", "reasons": ["WITHIN_MANDATE"]},
                }
            ],
        },
    )
    app.state.auth_store = auth
    app.state.quote_store = quotes
    app.state.order_store = orders
    app.state.event_log = log
    app.state.valio_data = _Data(sales_block=sales_block)
    return agent_token, mandate, quote, auth, quotes, orders, log


def _close(values):
    for value in values:
        value.close()


def test_limit_controls_pending_vs_ordered_and_idempotency(tmp_path):
    agent, _, quote, auth, quotes, orders, log = _environment(tmp_path)
    try:
        request = {
            "quoteId": quote["quoteId"],
            "planId": "pln_1",
        }
        response = TestClient(app).post(
            "/v1/orders",
            headers={"Authorization": f"Bearer {agent}", "Idempotency-Key": "key-1"},
            json=request,
        )
        assert response.status_code == 202
        assert response.json()["status"] == "PENDING_APPROVAL"
        replay = TestClient(app).post(
            "/v1/orders",
            headers={"Authorization": f"Bearer {agent}", "Idempotency-Key": "key-1"},
            json=request,
        )
        assert replay.status_code == 202
        assert replay.json() == response.json()
        assert orders.count("customer-1") == 1
        conflict = TestClient(app).post(
            "/v1/orders",
            headers={"Authorization": f"Bearer {agent}", "Idempotency-Key": "key-1"},
            json={**request, "planId": "different"},
        )
        assert conflict.status_code == 409
    finally:
        _close((auth, quotes, orders, log))


def test_higher_limit_orders_and_get_is_customer_scoped(tmp_path):
    agent, _, quote, auth, quotes, orders, log = _environment(tmp_path, limit=1000)
    try:
        response = TestClient(app).post(
            "/v1/orders",
            headers={"Authorization": f"Bearer {agent}", "Idempotency-Key": "key-2"},
            json={"quoteId": quote["quoteId"], "planId": "pln_1"},
        )
        assert response.status_code == 201
        assert response.json()["status"] == "ORDERED"
        order_id = response.json()["orderId"]
        fetched = TestClient(app).get(
            f"/v1/orders/{order_id}",
            headers={"Authorization": f"Bearer {agent}"},
        )
        assert fetched.status_code == 200
        assert fetched.json()["orderId"] == order_id
    finally:
        _close((auth, quotes, orders, log))


def test_red_plan_creates_no_order(tmp_path):
    agent, _, quote, auth, quotes, orders, log = _environment(
        tmp_path, limit=1000, sales_block=True
    )
    try:
        response = TestClient(app).post(
            "/v1/orders",
            headers={"Authorization": f"Bearer {agent}", "Idempotency-Key": "key-3"},
            json={"quoteId": quote["quoteId"], "planId": "pln_1"},
        )
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "POLICY_BLOCKED"
        assert orders.count("customer-1") == 0
    finally:
        _close((auth, quotes, orders, log))


def test_expired_quote_and_revoked_mandate_are_refused(tmp_path):
    expired, mandate, quote, auth, quotes, orders, log = _environment(
        tmp_path,
        expires_at=(datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat(),
    )
    try:
        response = TestClient(app).post(
            "/v1/orders",
            headers={"Authorization": f"Bearer {expired}", "Idempotency-Key": "key-4"},
            json={"quoteId": quote["quoteId"], "planId": "pln_1"},
        )
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "QUOTE_EXPIRED"
    finally:
        _close((auth, quotes, orders, log))


def test_pending_spend_is_counted_against_week_limit(tmp_path):
    agent, mandate, quote, auth, quotes, orders, log = _environment(
        tmp_path, week_limit=1000
    )
    try:
        first = TestClient(app).post(
            "/v1/orders",
            headers={"Authorization": f"Bearer {agent}", "Idempotency-Key": "key-6"},
            json={"quoteId": quote["quoteId"], "planId": "pln_1"},
        )
        assert first.status_code == 202
        second_quote = quotes.create(
            customer_id="customer-1",
            mandate_id=mandate["mandateId"],
            document={
                "status": "QUOTED",
                "expiresAt": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
                "plans": [
                    {
                        "planId": "pln_1",
                        "category": "10400",
                        "deadline": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
                        "lines": [
                            {
                                "productId": "milk-1",
                                "quantity": {"amount": 100, "unit": "l"},
                                "lineTotal": {"cents": 60000, "currency": "EUR"},
                                "availableDate": datetime.now(timezone.utc).date().isoformat(),
                                "isSubstitute": False,
                            }
                        ],
                        "total": {"cents": 60000, "currency": "EUR"},
                    }
                ],
            },
        )
        second = TestClient(app).post(
            "/v1/orders",
            headers={"Authorization": f"Bearer {agent}", "Idempotency-Key": "key-7"},
            json={"quoteId": second_quote["quoteId"], "planId": "pln_1"},
        )
        assert second.status_code == 202
        assert "OVER_WEEK_LIMIT" in second.json()["reasons"]
    finally:
        _close((auth, quotes, orders, log))


def test_tampered_quote_is_rejected(tmp_path):
    agent, _, quote, auth, quotes, orders, log = _environment(tmp_path, limit=1000)
    try:
        row = quotes._connection.execute(
            "SELECT document FROM quotes WHERE quote_id = ?",
            (quote["quoteId"],),
        ).fetchone()
        document = json.loads(row["document"])
        document["plans"][0]["total"]["cents"] = 1
        quotes._connection.execute(
            "UPDATE quotes SET document = ? WHERE quote_id = ?",
            (json.dumps(document), quote["quoteId"]),
        )
        quotes._connection.commit()
        response = TestClient(app).post(
            "/v1/orders",
            headers={"Authorization": f"Bearer {agent}", "Idempotency-Key": "key-8"},
            json={"quoteId": quote["quoteId"], "planId": "pln_1"},
        )
        assert response.status_code == 403
        assert orders.count("customer-1") == 0
    finally:
        _close((auth, quotes, orders, log))

    agent, mandate, quote, auth, quotes, orders, log = _environment(tmp_path / "revoked")
    try:
        auth.revoke_mandate(mandate["mandateId"], "customer-1")
        response = TestClient(app).post(
            "/v1/orders",
            headers={"Authorization": f"Bearer {agent}", "Idempotency-Key": "key-5"},
            json={"quoteId": quote["quoteId"], "planId": "pln_1"},
        )
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "MANDATE_INVALID"
    finally:
        _close((auth, quotes, orders, log))
