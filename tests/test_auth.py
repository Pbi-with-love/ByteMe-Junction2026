import base64
from datetime import datetime, timedelta, timezone

from nacl.signing import SigningKey

from backend.app.auth import AuthStore, MandateError
from backend.app.signing import DocumentSigner


def signer() -> DocumentSigner:
    return DocumentSigner(
        base64.b64encode(SigningKey.generate().encode()).decode("ascii")
    )


def mandate_data(**overrides: str) -> dict[str, object]:
    data: dict[str, object] = {
        "agentId": "kitchenbuyer",
        "issuedBy": {"name": "Anna", "role": "Kitchen manager"},
        "limits": {"perOrderEur": 500, "perWeekEur": 3000},
        "substitution": "same_category",
        "lateDelivery": "none",
        "hardConstraints": {"excludeAllergens": [], "requireLabels": []},
        "priorities": ["on_time", "price", "sustainability"],
        "validUntil": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
    }
    data.update(overrides)
    return data


def test_tokens_are_opaque_and_customer_scoped(tmp_path) -> None:
    store = AuthStore(tmp_path / "auth.sqlite3", signer())
    try:
        token = store.issue_token(
            role="human",
            customer_id="customer-1",
        )
        principal = store.authenticate(token)
        assert principal is not None
        assert principal.customer_id == "customer-1"
        assert store.authenticate("not-a-token") is None
    finally:
        store.close()


def test_mandate_is_signed_and_revocation_invalidates_it(tmp_path) -> None:
    store = AuthStore(tmp_path / "auth.sqlite3", signer())
    try:
        token = store.issue_token(role="human", customer_id="customer-1")
        principal = store.authenticate(token)
        assert principal is not None
        mandate = store.create_mandate(
            principal=principal,
            request_data=mandate_data(),
        )
        assert "authorises kitchenbuyer" in mandate["summaryText"]
        assert store.require_mandate(mandate["mandateId"], "customer-1")["summaryText"] == mandate["summaryText"]
        assert store.require_mandate(mandate["mandateId"], "customer-1")["status"] == "ACTIVE"
        store.revoke_mandate(mandate["mandateId"], "customer-1")
        try:
            store.require_mandate(mandate["mandateId"], "customer-1")
        except MandateError as exc:
            assert exc.code == "MANDATE_INVALID"
        else:
            raise AssertionError("revoked mandate was accepted")
    finally:
        store.close()


def test_expired_mandate_is_rejected(tmp_path) -> None:
    store = AuthStore(tmp_path / "auth.sqlite3", signer())
    try:
        token = store.issue_token(role="human", customer_id="customer-1")
        principal = store.authenticate(token)
        assert principal is not None
        mandate = store.create_mandate(
            principal=principal,
            request_data=mandate_data(
                validUntil=(datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
            ),
        )
        try:
            store.require_mandate(mandate["mandateId"], "customer-1")
        except MandateError as exc:
            assert exc.code == "MANDATE_EXPIRED"
        else:
            raise AssertionError("expired mandate was accepted")
    finally:
        store.close()
