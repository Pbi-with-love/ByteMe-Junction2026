from fastapi.testclient import TestClient
from backend.app.main import create_app


def test_start_replay_resets_state_and_issues_session_tokens(tmp_path):
    app = create_app(tmp_path / 'game.sqlite3')
    client = TestClient(app)
    response = client.post('/v1/game/levels/level1/start', json={'preset': 'balanced', 'mode': 'replay'})
    assert response.status_code == 200
    body = response.json()
    assert body['level']['levelId'] == 'level1'
    assert body['hearts'] == 3
    assert body['tokens']['human'] and body['tokens']['agent']
    assert client.get('/v1/log').status_code == 401
    assert len(app.state.event_log.list()) == 1
