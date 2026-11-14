import anyio
import httpx
import json

from agent.explain import explain_order, llm_settings, decision_record


def test_llm_settings_reads_verda_environment(monkeypatch):
    monkeypatch.setenv("VERDA_API_KEY", "sentinel-not-a-real-key")
    monkeypatch.setenv("VERDA_BASE_URL", "https://example.test/v1/")
    monkeypatch.setenv("VERDA_MODEL", "test-model")
    assert llm_settings() == {
        "api_key": "sentinel-not-a-real-key",
        "base_url": "https://example.test/v1",
        "model": "test-model",
    }
    monkeypatch.delenv("VERDA_BASE_URL")
    monkeypatch.delenv("VERDA_MODEL")
    assert llm_settings() == {
        "api_key": "sentinel-not-a-real-key",
        "base_url": "https://inference.verda.com/v1",
        "model": "deepseek-4-1-flash-1017",
    }


def _kwargs(**overrides):
    return {
        "need": {"description": "milk", "quantity": {"amount": 10, "unit": "l"}},
        "plans": [{"planId": "pln_private", "tier": "best", "summary": "Valio milk", "total": {"cents": 1000}, "onTime": {"amount": 10}, "policy": {"light": "GREEN", "reasons": []}}],
        "recommended_plan_id": "pln_private",
        "approval_reasons": [],
        "per_order_limit": 500,
        "non_valio_brands": [],
        "base_url": "https://verda.test/v1",
        **overrides,
    }


def _transport(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler), timeout=0.1)


def test_record_and_successful_openai_compatible_call():
    record = decision_record(**{k: _kwargs()[k] for k in ("need", "plans", "recommended_plan_id", "approval_reasons", "per_order_limit", "non_valio_brands")})
    assert record["recommendedPlanId"] == "pln_private"

    async def run():
        requests = []

        def handle(request):
            requests.append(request)
            return httpx.Response(200, json={"choices": [{"finish_reason": "stop", "message": {"content": "The Valio milk delivers 10 l on time for €10,00. This fits your €500 limit."}}]})

        async with _transport(handle) as client:
            outcomes = []
            text = await explain_order(**_kwargs(client=client, api_key="test-secret", base_url="https://verda.test/v1", model="deepseek-test", on_outcome=outcomes.append))
        assert "Valio milk" in text
        assert outcomes[0]["source"] == "llm"
        request = requests[0]
        assert str(request.url) == "https://verda.test/v1/chat/completions"
        assert request.headers["authorization"] == "Bearer test-secret"
        body = json.loads(request.content)
        assert body["model"] == "deepseek-test"
        assert body["max_tokens"] == 400
        assert body["messages"][0]["role"] == "system"
        assert body["messages"][1]["role"] == "user"
        assert "temperature" not in body and "top_p" not in body
    anyio.run(run)


def test_think_block_and_reasoning_prefix_are_removed_before_validation():
    async def run():
        async with _transport(lambda request: httpx.Response(200, json={"choices": [{"finish_reason": "stop", "message": {"content": "<think>Use internal plan pln_secret. 999</think>\nReasoning: checking the mandate.\nFinal answer: Valio milk delivers 10 l on time for €10,00."}}]})) as client:
            text = await explain_order(**_kwargs(client=client, api_key="test-secret"))
        assert text.startswith("Valio milk")
        assert "999" not in text and "pln_secret" not in text
    anyio.run(run)


def test_each_fallback_reason_uses_httpx_mock_transport(monkeypatch, caplog):
    import logging

    monkeypatch.delenv("VERDA_API_KEY", raising=False)
    cases = [
        ("no_key", None, None, []),
        ("timeout", "key", lambda request: (_ for _ in ()).throw(httpx.ReadTimeout("timed out", request=request)), []),
        ("api_error", "key", lambda request: httpx.Response(503, json={"error": "unavailable"}), []),
        ("api_error", "key", lambda request: httpx.Response(200, content=b"not-json"), []),
        ("api_error", "key", lambda request: httpx.Response(200, json={"choices": [{"finish_reason": "content_filter", "message": {"content": "blocked"}}]}), []),
        ("max_tokens", "key", lambda request: httpx.Response(200, json={"choices": [{"finish_reason": "length", "message": {"content": "unfinished"}}]}), []),
        ("invalid_number", "key", lambda request: httpx.Response(200, json={"choices": [{"finish_reason": "stop", "message": {"content": "The price is €999,99."}}]}), []),
        ("invalid_number", "key", lambda request: httpx.Response(200, json={"choices": [{"finish_reason": "stop", "message": {"content": "Use planId pln_secret."}}]}), []),
        ("missing_brand", "key", lambda request: httpx.Response(200, json={"choices": [{"finish_reason": "stop", "message": {"content": "A cheaper choice is available."}}]}), ["GelatoLAB"]),
        ("api_error", "key", lambda request: httpx.Response(200, json={"choices": [{"finish_reason": "stop", "message": {}}]}), []),
        ("api_error", "key", lambda request: httpx.Response(200, json={"choices": [{"finish_reason": "stop", "message": {"content": "   "}}]}), []),
    ]

    async def run():
        outcomes = []
        for reason, key, handler, brands in cases:
            client = _transport(handler) if handler else None
            if client:
                async with client:
                    await explain_order(**_kwargs(client=client, api_key=key, non_valio_brands=brands, on_outcome=outcomes.append))
            else:
                await explain_order(**_kwargs(api_key=key, non_valio_brands=brands, on_outcome=outcomes.append))
            assert outcomes[-1]["source"] == "template"
            assert outcomes[-1]["reason"] == reason
    with caplog.at_level(logging.INFO, logger="agent.explain"):
        anyio.run(run)
    assert [record.explain_outcome["reason"] for record in caplog.records] == [case[0] for case in cases]
    assert all(record.explain_outcome["outcome"] == "fallback" for record in caplog.records)
    assert all(isinstance(record.explain_outcome["elapsed_ms"], int) for record in caplog.records)


def test_non_valio_recommendation_requires_plain_brand_disclosure():
    async def run():
        async with _transport(lambda request: httpx.Response(200, json={"choices": [{"finish_reason": "stop", "message": {"content": "The recommended plan is 20 l GelatoLAB pistachio ice cream. It needs approval because substitutions are not allowed."}}]})) as client:
            text = await explain_order(**_kwargs(
                need={"description": "pistachio ice cream", "quantity": {"amount": 20, "unit": "l"}},
                plans=[{"planId": "pln_private", "summary": "20 l GelatoLAB Pistachio ice cream"}],
                approval_reasons=["SUBSTITUTION_NOT_ALLOWED"], non_valio_brands=["GelatoLAB"],
                api_key="test-secret", client=client,
            ))
        assert "non-Valio brand GelatoLAB" in text
    anyio.run(run)


def test_template_explainer_honors_test_delay(monkeypatch):
    from agent.explain import template_explainer
    monkeypatch.setenv("EXPLAIN_DELAY_MS", "1")
    async def run():
        return await template_explainer(need={"description": "milk"}, plans=[], recommended_plan_id=None)
    assert "recommended plan" in anyio.run(run)


def test_numbers_normalize_decimal_and_thousands_separators():
    from agent.explain import _numbers
    assert _numbers("€805.00 and €1 308,00") == ["80500", "130800"]
    assert _numbers("€805,00") == _numbers("€805.00") == _numbers("80500")
