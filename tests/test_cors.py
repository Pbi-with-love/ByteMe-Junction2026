from fastapi.testclient import TestClient

from backend.app.main import app


def test_local_frontend_origin_can_call_api():
    with TestClient(app) as client:
        response = client.options(
            "/v1/events",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "authorization",
            },
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert response.headers["access-control-allow-credentials"] == "true"


def test_unknown_origin_is_not_allowed():
    with TestClient(app) as client:
        response = client.options(
            "/v1/events",
            headers={
                "Origin": "https://not-the-frontend.example",
                "Access-Control-Request-Method": "GET",
            },
        )

    assert "access-control-allow-origin" not in response.headers
