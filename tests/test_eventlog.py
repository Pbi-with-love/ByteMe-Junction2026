from backend.app.eventlog import EventLog


def test_events_are_hash_chained(tmp_path) -> None:
    log = EventLog(tmp_path / "events.sqlite3")
    try:
        first = log.append(
            actor="gateway",
            event_type="SEARCH",
            request_id="req_1",
            summary="Search completed.",
        )
        second = log.append(
            actor="gateway",
            event_type="QUOTE_CREATED",
            request_id="req_2",
            summary="Quote created.",
        )

        assert first["prevHash"] == ""
        assert second["prevHash"] == first["hash"]
        assert log.verify() == {
            "valid": True,
            "events": 2,
            "headHash": second["hash"],
        }
    finally:
        log.close()


def test_verification_detects_tampering(tmp_path) -> None:
    log = EventLog(tmp_path / "events.sqlite3")
    try:
        log.append(
            actor="gateway",
            event_type="SEARCH",
            request_id="req_1",
            summary="Search completed.",
        )
        log._connection.execute("UPDATE events SET summary = 'tampered' WHERE seq = 1")
        log._connection.commit()

        assert log.verify() == {"valid": False, "brokenAtSeq": 1}
    finally:
        log.close()
