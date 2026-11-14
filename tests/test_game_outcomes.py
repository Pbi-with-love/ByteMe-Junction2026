import json
import os
import re
from pathlib import Path
import time
from fastapi.testclient import TestClient
from backend.app.main import create_app

SCENARIOS = Path(__file__).resolve().parents[1] / 'backend' / 'app' / 'scenarios'


def test_compare_matches_all_scenario_outcomes(tmp_path):
    for path in sorted(SCENARIOS.glob('level*.json')):
        scenario = json.loads(path.read_text())
        endpoint = f"/v1/game/levels/{scenario['levelId']}/compare"
        response = TestClient(create_app(tmp_path / f"{scenario['levelId']}-first.sqlite3")).get(endpoint)
        repeated = TestClient(create_app(tmp_path / f"{scenario['levelId']}-second.sqlite3")).get(endpoint)
        assert response.status_code == 200
        assert repeated.status_code == 200
        for preset, result in response.json()['presets'].items():
            rerun = repeated.json()['presets'][preset]
            assert {key: value for key, value in result.items() if key != 'logHeadHash'} == {
                key: value for key, value in rerun.items() if key != 'logHeadHash'
            }
            assert result['logHeadHash'] != rerun['logHeadHash']
        for preset, expected in scenario['expected'].items():
            actual = response.json()['presets'][preset]
            compared = {key: (bool(actual[key]) if key == 'incident' else actual[key]) for key in expected}
            assert compared == expected


def test_compare_ignores_live_explanation_delay(tmp_path, monkeypatch):
    monkeypatch.setenv('EXPLAIN_DELAY_MS', '2000')
    app = create_app(tmp_path / 'delayed.sqlite3')
    with TestClient(app) as client:
        started = client.post('/v1/game/levels/level1/start', json={'preset': 'balanced', 'mode': 'replay'})
        assert started.status_code == 200
        before = time.monotonic()
        response = client.get('/v1/game/levels/level1/compare')
        elapsed = time.monotonic() - before

    assert response.status_code == 200
    assert elapsed < 10


def test_level1_balanced_asgi_run_finishes_with_verified_log(tmp_path, monkeypatch):
    monkeypatch.setenv('VALIO_MODE', 'replay')
    app = create_app(tmp_path / 'integration.sqlite3')
    with TestClient(app) as client:
        presets = client.get('/v1/game/levels/level1/presets').json()
        start = client.post('/v1/game/levels/level1/start', json={'preset': 'balanced', 'mode': 'replay'}).json()
        human = {'Authorization': f"Bearer {start['tokens']['human']}"}
        signed = client.post('/v1/mandates', headers=human, json={k: v for k, v in presets['balanced'].items() if k in {'agentId', 'issuedBy', 'limits', 'substitution', 'lateDelivery', 'hardConstraints', 'priorities', 'validUntil'}})
        assert signed.status_code == 201
        assert client.post(f"/v1/game/sessions/{start['sessionId']}/run").status_code == 202
        deadline = time.monotonic() + 5
        handled = set()
        while time.monotonic() < deadline:
            session = client.get(f"/v1/game/sessions/{start['sessionId']}").json()
            for step in session['steps']:
                approval = step.get('approval')
                if approval and approval['status'] == 'OPEN' and approval['approvalId'] not in handled:
                    handled.add(approval['approvalId'])
                    client.post(f"/v1/approvals/{approval['approvalId']}", headers=human, json={'decision': 'approved'})
            if session['status'] in {'FINISHED', 'FAILED'}:
                break
            time.sleep(.01)
        assert session['status'] == 'FINISHED', session.get('error')
        datetimes = re.findall(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)', json.dumps(session))
        assert datetimes
        result = client.get(f"/v1/game/sessions/{start['sessionId']}/result").json()
        assert result['stars'] == 3
        verified = client.get('/v1/log/verify').json()
        assert verified['valid'] is True
        assert verified['headHash'] == result['logHeadHash']
        event_types = {event['type'] for event in app.state.event_log.list()}
        assert event_types <= {'MANDATE_SIGNED', 'SEARCH', 'QUOTE_CREATED', 'ORDER_PENDING_APPROVAL', 'ORDER_CREATED', 'APPROVAL_SHOWN', 'APPROVAL_DECIDED', 'SCENARIO_OVERLAY'}
