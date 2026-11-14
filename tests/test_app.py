from fastapi.testclient import TestClient
import pytest

from backend.app.auth import AuthStore
from backend.app.eventlog import EventLog
from backend.app.main import app


client = TestClient(app)


@pytest.fixture
def isolated_gateway_state(tmp_path):
    names = ("auth_store", "event_log")
    previous = {name: getattr(app.state, name) for name in names}
    auth = AuthStore(tmp_path / "auth.sqlite3")
    log = EventLog(tmp_path / "events.sqlite3")
    app.state.auth_store = auth
    app.state.event_log = log
    try:
        yield
    finally:
        auth.close()
        log.close()
        for name, value in previous.items():
            setattr(app.state, name, value)


def test_generated_request_id_is_returned_in_header_and_error_body(isolated_gateway_state) -> None:
    token = app.state.auth_store.issue_token(role="human", customer_id="customer-1")
    response = client.get("/v1/log?view=buyer&limit=0", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 400
    request_id = response.headers["X-Request-Id"]
    assert request_id.startswith("req_")
    assert response.json() == {
        "error": {
            "code": "VALIDATION_ERROR",
            "message": "since must be non-negative and limit must be between 1 and 1000.",
            "requestId": request_id,
            "details": {},
        }
    }


def test_caller_request_id_is_preserved(isolated_gateway_state) -> None:
    response = client.get(
        "/v1/log/verify",
        headers={"X-Request-Id": "req_test"},
    )

    assert response.headers["X-Request-Id"] == "req_test"
    assert response.json()["valid"] is True


def test_search_requires_authentication(isolated_gateway_state) -> None:
    response = client.post("/v1/search")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHENTICATED"


def test_log_requires_authentication_and_discovery_is_public(isolated_gateway_state) -> None:
    assert client.get("/.well-known/agent-commerce.json").status_code == 200
    response = client.get("/v1/log?view=buyer")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHENTICATED"


def test_unhandled_500_keeps_cors_headers(tmp_path) -> None:
    from backend.app.main import create_app

    isolated = create_app(tmp_path / "cors.sqlite3")

    @isolated.get("/forced-error")
    async def forced_error():
        raise RuntimeError("forced test failure")

    with TestClient(isolated, raise_server_exceptions=False) as test_client:
        response = test_client.get(
            "/forced-error", headers={"Origin": "http://localhost:5173"}
        )

    assert response.status_code == 500
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_log_views_scope_buyers_and_add_operator_disclosure(isolated_gateway_state) -> None:
    log = app.state.event_log
    log.append(actor="gateway", event_type="SEARCH", request_id="req_a", customer_id="buyer-a", summary="a")
    log.append(actor="gateway", event_type="SEARCH", request_id="req_b", customer_id="buyer-b", summary="b")
    buyer = app.state.auth_store.issue_token(role="human", customer_id="buyer-a")
    operator = app.state.auth_store.issue_token(role="operator", customer_id=None)
    buyer_events = client.get("/v1/log?view=buyer", headers={"Authorization": f"Bearer {buyer}"}).json()["events"]
    assert {event["customerId"] for event in buyer_events} == {"buyer-a"}
    valio_events = client.get("/v1/log?view=valio", headers={"Authorization": f"Bearer {operator}"}).json()["events"]
    assert {event["customerId"] for event in valio_events if event["customerId"]} >= {"buyer-a", "buyer-b"}
    assert all("disclosure" in event for event in valio_events)
    denied_operator_view = client.get("/v1/log?view=valio", headers={"Authorization": f"Bearer {buyer}"})
    denied_buyer_view = client.get("/v1/log?view=buyer", headers={"Authorization": f"Bearer {operator}"})
    assert denied_operator_view.status_code == 401
    assert denied_buyer_view.status_code == 401
