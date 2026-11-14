import json
from pathlib import Path


FIXTURE = Path(__file__).parent / "fixtures" / "live" / "level1-balanced.json"


def test_level1_balanced_live_logs_and_verify_are_valid() -> None:
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))

    buyer_events = fixture["buyerLog"]["events"]
    valio_events = fixture["valioLog"]["events"]
    assert buyer_events
    assert valio_events
    assert all("seq" in event and "hash" in event for event in buyer_events)
    assert all("seq" in event and "hash" in event for event in valio_events)
    assert all("disclosure" in event for event in valio_events)
    assert fixture["verify"]["valid"] is True
    assert fixture["verify"]["headHash"] in {
        buyer_events[-1]["hash"], fixture["result"]["logHeadHash"]
    }
