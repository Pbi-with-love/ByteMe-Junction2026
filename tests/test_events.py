import asyncio
from datetime import datetime, timedelta

from fastapi.testclient import TestClient

from backend.app.auth import AuthStore
from backend.app.approval_store import ApprovalStore
from backend.app.eventlog import EventLog
from backend.app.main import _approval_expiry_loop, app
from backend.app.order_store import OrderStore
from tests.test_quote_store import signer


def test_customer_sse_replays_hash_log_event(tmp_path):
    database = tmp_path / "events.sqlite3"
    auth = AuthStore(database, signer())
    log = EventLog(database)
    token = auth.issue_token(role="agent", customer_id="customer-1", agent_id="agent-1")
    log.append(
        actor="gateway",
        event_type="SEARCH",
        request_id="req_1",
        customer_id="customer-1",
        summary="Search completed.",
    )
    try:
        app.state.auth_store = auth
        app.state.event_log = log
        with TestClient(app).stream(
            "GET",
            "/v1/events?since=0",
            headers={"Authorization": f"Bearer {token}"},
        ) as response:
            assert response.status_code == 200
            assert response.headers["content-type"].startswith("text/event-stream")
            lines = iter(response.iter_lines())
            assert next(lines) == "id: 1"
            assert next(lines) == "event: log"
            assert '"type": "SEARCH"' in next(lines)
    finally:
        auth.close()
        log.close()


def test_customer_sse_emits_approval_event(tmp_path):
    database = tmp_path / "events.sqlite3"
    auth = AuthStore(database, signer())
    log = EventLog(database)
    approvals = ApprovalStore(database)
    token = auth.issue_token(role="human", customer_id="customer-1")
    approval = approvals.create(
        customer_id="customer-1",
        order_id="ord_1",
        quote_id="quo_1",
        reasons=["WEEK_SPEND"],
        options=[],
        created_at=datetime.now().astimezone(),
        deadline=datetime.now().astimezone() + timedelta(seconds=20),
        hearts_left=2,
    )
    log.append(
        actor="gateway",
        event_type="APPROVAL_SHOWN",
        request_id="req_1",
        customer_id="customer-1",
        refs={"approvalId": approval["approvalId"]},
        summary="Approval opened.",
    )
    try:
        app.state.auth_store = auth
        app.state.event_log = log
        app.state.approval_store = approvals
        with TestClient(app).stream(
            "GET",
            "/v1/events?since=0",
            headers={"Authorization": f"Bearer {token}"},
        ) as response:
            lines = iter(response.iter_lines())
            assert next(lines) == "id: 1"
            assert next(lines) == "event: log"
            assert next(lines).startswith("data: ")
            assert next(lines) == ""
            assert next(lines) == "event: approval"
            assert approval["approvalId"] in next(lines)
    finally:
        auth.close()
        log.close()
        approvals.close()


def _read_log_frame(lines):
    next(lines)
    assert next(lines) == "event: log"
    data = next(lines)
    assert data.startswith("data: ")
    assert next(lines) == ""
    return data


def test_sse_reconnects_from_last_event_id(tmp_path):
    database = tmp_path / "events.sqlite3"
    auth = AuthStore(database, signer())
    log = EventLog(database)
    token = auth.issue_token(role="agent", customer_id="customer-1", agent_id="agent-1")
    for index in range(3):
        log.append(
            actor="gateway",
            event_type=f"EVENT_{index}",
            request_id=f"req_{index}",
            customer_id="customer-1",
            summary=f"Event {index}.",
        )
    try:
        app.state.auth_store = auth
        app.state.event_log = log
        with TestClient(app).stream(
            "GET",
            "/v1/events",
            headers={"Authorization": f"Bearer {token}"},
        ) as response:
            lines = iter(response.iter_lines())
            for _ in range(3):
                _read_log_frame(lines)
            last_seq = 3

        for index in range(3, 5):
            log.append(
                actor="gateway",
                event_type=f"EVENT_{index}",
                request_id=f"req_{index}",
                customer_id="customer-1",
                summary=f"Event {index}.",
            )
        with TestClient(app).stream(
            "GET",
            "/v1/events",
            headers={
                "Authorization": f"Bearer {token}",
                "Last-Event-ID": str(last_seq),
            },
        ) as response:
            lines = iter(response.iter_lines())
            assert '"type": "EVENT_3"' in _read_log_frame(lines)
            assert '"type": "EVENT_4"' in _read_log_frame(lines)
    finally:
        auth.close()
        log.close()


def test_sse_isolates_customers_and_rejects_bad_auth(tmp_path):
    database = tmp_path / "events.sqlite3"
    auth = AuthStore(database, signer())
    log = EventLog(database)
    token_a = auth.issue_token(role="agent", customer_id="customer-a", agent_id="agent-a")
    log.append(
        actor="gateway",
        event_type="CUSTOMER_A",
        request_id="req_a",
        customer_id="customer-a",
        summary="A event.",
    )
    log.append(
        actor="gateway",
        event_type="CUSTOMER_B",
        request_id="req_b",
        customer_id="customer-b",
        summary="B event.",
    )
    try:
        app.state.auth_store = auth
        app.state.event_log = log
        with TestClient(app) as client:
            assert client.get("/v1/events").status_code == 401
            assert client.get(
                "/v1/events",
                headers={"Authorization": "Bearer invalid"},
            ).status_code == 401
        with TestClient(app).stream(
            "GET",
            "/v1/events?since=0",
            headers={"Authorization": f"Bearer {token_a}"},
        ) as response:
            lines = iter(response.iter_lines())
            assert '"type": "CUSTOMER_A"' in _read_log_frame(lines)
    finally:
        auth.close()
        log.close()


def test_background_expiry_emits_event_without_approval_read(tmp_path):
    database = tmp_path / "events.sqlite3"
    auth = AuthStore(database, signer())
    log = EventLog(database)
    approvals = ApprovalStore(database)
    orders = OrderStore(database)
    original = {
        "auth_store": app.state.auth_store,
        "event_log": app.state.event_log,
        "approval_store": app.state.approval_store,
        "order_store": app.state.order_store,
    }
    approval = approvals.create(
        customer_id="customer-1",
        order_id="ord_1",
        quote_id="quo_1",
        reasons=["WEEK_SPEND"],
        options=[],
        created_at=datetime.now().astimezone() - timedelta(seconds=2),
        deadline=datetime.now().astimezone() - timedelta(seconds=1),
        hearts_left=2,
    )
    try:
        app.state.auth_store = auth
        app.state.event_log = log
        app.state.approval_store = approvals
        app.state.order_store = orders
        asyncio.run(_run_expiry_once())
        assert approvals.get(approval["approvalId"], "customer-1")["status"] == "EXPIRED"
        assert log.has_event("APPROVAL_EXPIRED", "approvalId", approval["approvalId"])
    finally:
        app.state.auth_store = original["auth_store"]
        app.state.event_log = original["event_log"]
        app.state.approval_store = original["approval_store"]
        app.state.order_store = original["order_store"]
        auth.close()
        log.close()
        approvals.close()
        orders.close()


async def _run_expiry_once():
    task = asyncio.create_task(_approval_expiry_loop(app))
    await asyncio.sleep(0.3)
    task.cancel()
    await asyncio.gather(task, return_exceptions=True)
