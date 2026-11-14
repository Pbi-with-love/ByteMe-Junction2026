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
