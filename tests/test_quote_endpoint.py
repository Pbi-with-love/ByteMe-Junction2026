import base64
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from nacl.signing import SigningKey

from backend.app.auth import AuthStore
from backend.app.eventlog import EventLog
from backend.app.main import app
from backend.app.quote_store import QuoteStore
from backend.app.signing import DocumentSigner


def _signer() -> DocumentSigner:
    return DocumentSigner(
        base64.b64encode(SigningKey.generate().encode()).decode("ascii")
    )


def _product(product_id: str) -> dict[str, object]:
    return {
        "id": product_id,
        "category": "10400",
        "salesUnit": "ST",
        "baseUnit": "ST",
        "units": [{"unitId": "ST", "sizeInBaseUnits": 1}],
        "synkkaData": {
            "unitConversions": [{"volume": {"unit": "LTR", "value": 10}}],
            "classifications": [],
        },
    }


class _Data:
    def load(self, name: str) -> list[dict[str, object]]:
        if name == "products":
            return [_product("milk-1")]
        if name == "delivery-reliability":
            return [{"productId": "milk-1", "deliveryReliability": "0.98"}]
        if name == "carbon-footprint":
            return [{"productId": "milk-1", "AVG kg CO2-eq/kg": "0.4"}]
        raise AssertionError(name)


class _Valio:
    async def price(self, **_: object) -> dict[str, object]:
        return {
            "products": [
                {
                    "productId": "milk-1",
                    "priceWithTax": {
                        "value": 2.50,
                        "validTo": "2026-12-01T00:00:00+02:00",
                    },
                }
            ]
        }

    async def availability(self, **_: object) -> dict[str, object]:
        return {
            "products": [
                {
                    "productId": "milk-1",
                    "closingTime": "2026-11-15T17:00:00+02:00",
                    "scheduleLines": [
                        {
                            "availableAmount": 100,
                            "availableDate": "2026-11-16",
                            "salesUnit": "ST",
                        }
                    ],
                }
            ]
        }


def _configure(tmp_path):
    document_signer = _signer()
    database = tmp_path / "gateway.sqlite3"
    auth = AuthStore(database, document_signer)
    quotes = QuoteStore(database, document_signer)
    log = EventLog(database)
    human = auth.issue_token(role="human", customer_id="customer-1")
    human_principal = auth.authenticate(human)
    assert human_principal is not None
    mandate = auth.create_mandate(
        principal=human_principal,
        request_data={
            "agentId": "agent-1",
            "limits": {"perOrderEur": 500, "perWeekEur": 3000},
            "substitution": "same_category",
            "lateDelivery": "none",
            "hardConstraints": {"excludeAllergens": [], "requireLabels": []},
            "priorities": ["on_time", "price", "sustainability"],
            "validUntil": (
                datetime.now(timezone.utc) + timedelta(days=1)
            ).isoformat(),
        },
    )
    agent = auth.issue_token(
        role="agent",
        customer_id="customer-1",
        agent_id="agent-1",
    )
    app.state.auth_store = auth
    app.state.quote_store = quotes
    app.state.event_log = log
    app.state.valio_data = _Data()
    app.state.valio_client = _Valio()
    return agent, mandate["mandateId"], quotes, log


def test_quote_endpoint_runs_auth_data_planner_signing_storage_and_log(tmp_path):
    agent, mandate_id, quotes, log = _configure(tmp_path)
    try:
        response = TestClient(app).post(
            "/v1/quotes",
            headers={"Authorization": f"Bearer {agent}"},
            json={
                "mandateId": mandate_id,
                "need": {
                    "description": "milk",
                    "quantity": {"amount": 100, "unit": "l"},
                    "deadline": "2026-11-16T06:00:00+02:00",
                },
                "candidateProductIds": ["milk-1"],
            },
        )

        assert response.status_code == 201
        quote = response.json()
        assert quote["status"] == "QUOTED"
        assert quote["plans"][0]["total"]["cents"] == 2500
        assert quotes.get(quote["quoteId"], "customer-1") is not None
        assert log.list(since=0, limit=100)[-1]["type"] == "QUOTE_CREATED"
    finally:
        quotes.close()
        log.close()
        app.state.auth_store.close()


def test_quote_endpoint_hides_foreign_mandate(tmp_path):
    agent, _, quotes, log = _configure(tmp_path)
    try:
        response = TestClient(app).post(
            "/v1/quotes",
            headers={"Authorization": f"Bearer {agent}"},
            json={
                "mandateId": "mdt_foreign",
                "need": {
                    "description": "milk",
                    "quantity": {"amount": 100, "unit": "l"},
                    "deadline": "2026-11-16T06:00:00+02:00",
                },
                "candidateProductIds": ["milk-1"],
            },
        )

        assert response.status_code == 404
        assert response.json()["error"]["code"] == "NOT_FOUND"
    finally:
        quotes.close()
        log.close()
        app.state.auth_store.close()
