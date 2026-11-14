from fastapi.testclient import TestClient

from backend.app.main import app


client = TestClient(app)


def test_generated_request_id_is_returned_in_header_and_error_body() -> None:
    response = client.get("/v1/log?limit=0")

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


def test_caller_request_id_is_preserved() -> None:
    response = client.get(
        "/v1/log/verify",
        headers={"X-Request-Id": "req_test"},
    )

    assert response.headers["X-Request-Id"] == "req_test"
    assert response.json() == {"valid": True, "events": 0}
