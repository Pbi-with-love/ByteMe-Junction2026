from datetime import datetime, timezone

import pytest
from nacl.signing import SigningKey

from backend.app.quote_store import QuoteError, QuoteStore, quote_expiry
from backend.app.signing import DocumentSigner


def signer() -> DocumentSigner:
    import base64

    return DocumentSigner(base64.b64encode(SigningKey.generate().encode()).decode())


def test_quote_expiry_uses_earliest_price_or_closing_time() -> None:
    assert quote_expiry(
        lines=[{"productId": "p1"}, {"productId": "p2"}],
        prices={
            "p1": {"priceWithTax": {"validTo": "2026-11-20T12:00:00+02:00"}},
            "p2": {"priceWithTax": {"validTo": "2026-11-21T12:00:00+02:00"}},
        },
        availability={
            "p1": {"closingTime": "2026-11-19T12:00:00+02:00"},
            "p2": {"closingTime": "2026-11-18T12:00:00+02:00"},
        },
    ) == "2026-11-18T12:00:00+02:00"


def test_missing_price_is_not_silently_expired() -> None:
    with pytest.raises(QuoteError, match="Price is missing"):
        quote_expiry(lines=[{"productId": "p1"}], prices={}, availability={})


def test_quote_is_signed_persisted_and_expires(tmp_path) -> None:
    store = QuoteStore(tmp_path / "quotes.sqlite3", signer())
    quote = store.create(
        customer_id="customer-1",
        mandate_id="mdt_1",
        document={
            "status": "QUOTED",
            "expiresAt": "2026-11-14T14:00:00+00:00",
            "plans": [],
        },
    )

    assert store.verify(quote)
    changed = {**quote, "plans": [{"planId": "tampered"}]}
    assert not store.verify(changed)
    loaded = store.get(
        quote["quoteId"],
        "customer-1",
        now=datetime(2026, 11, 14, 15, tzinfo=timezone.utc),
    )
    assert loaded["status"] == "EXPIRED"
    assert store.verify(loaded)
    assert store.get(quote["quoteId"], "other-customer") is None
    store.close()
