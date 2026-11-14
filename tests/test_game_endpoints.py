from fastapi.testclient import TestClient
from backend.app.main import app


def test_presets_returns_unsigned_mandate_templates():
    client = TestClient(app)
    response = client.get('/v1/game/levels/level1/presets')
    assert response.status_code == 200
    body = response.json()
    mandate = body['balanced']
    assert mandate['mandateId'] == 'preset_balanced'
    assert mandate['customerId'] == '123'
    assert mandate['issuedAt'] == '2026-11-14T10:00:00+02:00'
    assert mandate['signature'] == {'alg': 'none', 'keyId': 'preset', 'value': ''}
    assert mandate['summaryText'] == 'Anna Virtanen authorises kitchenbuyer-hotel-aurora to order up to €500 per order and €3000 per week.'


def test_create_app_isolates_database_and_exposes_cors_and_clock(tmp_path):
    from datetime import datetime, timezone
    from backend.app.main import create_app

    fixed = datetime(2026, 11, 14, 8, 0, tzinfo=timezone.utc)
    isolated = create_app(tmp_path / 'fresh.sqlite3', clock=lambda: fixed)
    assert isolated.state.clock() == fixed
    with TestClient(isolated) as client:
        response = client.get('/v1/game/levels/level1/presets', headers={'Origin': 'http://localhost:5173'})
        assert response.status_code == 200
        assert response.headers['access-control-allow-origin'] == 'http://localhost:5173'
        assert 'X-Request-Id' in response.headers['access-control-expose-headers']


def test_create_app_uses_fresh_stores(tmp_path):
    from backend.app.main import create_app

    first = create_app(tmp_path / 'first.sqlite3')
    second = create_app(tmp_path / 'second.sqlite3')
    token = first.state.auth_store.issue_token(role='human', customer_id='123')
    assert first.state.auth_store.authenticate(token) is not None
    assert second.state.auth_store.authenticate(token) is None
