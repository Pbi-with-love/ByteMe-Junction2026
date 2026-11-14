from fastapi.testclient import TestClient

from backend.app.main import app


client = TestClient(app)


def test_generated_request_id_is_returned_in_header_and_error_body() -> None:
    response = client.post("/v1/search")

    assert response.status_code == 501
    request_id = response.headers["X-Request-Id"]
    assert request_id.startswith("req_")
    assert response.json() == {
        "error": {
            "code": "NOT_IMPLEMENTED",
            "message": "Search is not implemented yet.",
            "requestId": request_id,
            "details": {},
        }
    }


def test_caller_request_id_is_preserved() -> None:
    response = client.get(
        "/v1/log/verify",
        headers={"X-Request-Id": "req_test"},
    )

    assert response.headers["X-Request-Id"] == "req_test"
    assert response.json()["error"]["requestId"] == "req_test"
