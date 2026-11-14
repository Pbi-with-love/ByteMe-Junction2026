import anyio

from agent.explain import explain_order, llm_settings, decision_record


class FakeMessages:
    def __init__(self, response=None, error=None): self.response, self.error, self.kwargs = response, error, None
    async def create(self, **kwargs):
        self.kwargs = kwargs
        if self.error: raise self.error
        return self.response


class FakeClient:
    def __init__(self, response=None, error=None): self.messages = FakeMessages(response, error)


def test_llm_settings_reads_environment(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sentinel-do-not-print")
    monkeypatch.setenv("ANTHROPIC_MODEL", "test-model")
    assert llm_settings() == {"api_key": "sentinel-do-not-print", "model": "test-model"}
    monkeypatch.delenv("ANTHROPIC_MODEL")
    assert llm_settings()["model"] == "claude-haiku-5-5"


def test_record_and_successful_llm_with_contract_parameters():
    plan = {"planId": "p1", "tier": "best", "summary": "Valio milk", "total": {"cents": 1000}, "onTime": {"amount": 10}, "policy": {"light": "GREEN", "reasons": ["WITHIN_MANDATE"]}, "brand": "Valio"}
    record = decision_record(need={"description": "milk", "quantity": {"amount": 10, "unit": "l"}}, plans=[plan], recommended_plan_id="p1", approval_reasons=[], per_order_limit=500, non_valio_brands=[])
    assert record["recommendedPlanId"] == "p1"
    async def run():
        client = FakeClient({"stop_reason": "end_turn", "content": [{"type": "text", "text": "The Valio milk delivers 10 l on time for €10,00. This fits your €500 limit."}]})
        text = await explain_order(need={"description": "milk", "quantity": {"amount": 10, "unit": "l"}}, plans=[plan], recommended_plan_id="p1", approval_reasons=[], per_order_limit=500, client=client, api_key="key", model="claude-haiku-5-5")
        assert "Valio milk" in text
        assert client.messages.kwargs["thinking"] == {"type": "disabled"}
        assert client.messages.kwargs["output_config"] == {"effort": "low"}
        assert "temperature" not in client.messages.kwargs
    anyio.run(run)


def test_refusal_extra_number_timeout_and_missing_key_use_template(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    plan = {"planId": "p1", "summary": "Valio milk", "total": {"cents": 1000}, "policy": {"reasons": ["WITHIN_MANDATE"]}}
    async def run():
        kwargs = dict(need={"description": "milk", "quantity": {"amount": 10, "unit": "l"}}, plans=[plan], recommended_plan_id="p1", approval_reasons=[], per_order_limit=500)
        template = await explain_order(**kwargs, api_key="")
        assert template == await explain_order(**kwargs, api_key="key", client=FakeClient({"stop_reason": "refusal", "content": [{"type": "text", "text": "no"}]}))
        assert template == await explain_order(**kwargs, api_key="key", client=FakeClient({"stop_reason": "end_turn", "content": [{"type": "text", "text": "It costs 99999 euros."}]}))
        assert template == await explain_order(**kwargs, api_key="key", client=FakeClient(error=TimeoutError()))
        assert len([s for s in template.split(". ") if s]) in (1, 2, 3)
    anyio.run(run)


def test_non_valio_recommendation_is_named_plainly_even_if_model_omits_disclosure(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    async def run():
        text = await explain_order(
            need={"description": "pistachio ice cream", "quantity": {"amount": 20, "unit": "l"}},
            plans=[{"planId": "p1", "summary": "20 l GelatoLAB-Espoo Pistachio ice cream"}],
            recommended_plan_id="p1", approval_reasons=["SUBSTITUTION_NOT_ALLOWED"],
            per_order_limit=None, non_valio_brands=["GelatoLAB-Espoo"], api_key="key",
            client=FakeClient({"stop_reason": "end_turn", "content": [{"type": "text", "text": "The recommended plan is 20 l GelatoLAB-Espoo Pistachio ice cream for pistachio ice cream."}]}),
        )
        assert "non-Valio brand GelatoLAB-Espoo" in text
        fallback = await explain_order(
            need={"description": "pistachio ice cream", "quantity": {"amount": 20, "unit": "l"}},
            plans=[{"planId": "p1", "summary": "20 l GelatoLAB-Espoo Pistachio ice cream"}],
            recommended_plan_id="p1", approval_reasons=["SUBSTITUTION_NOT_ALLOWED"],
            per_order_limit=None, non_valio_brands=["GelatoLAB-Espoo"], api_key="",
        )
        assert "non-Valio brand GelatoLAB-Espoo" in fallback
    anyio.run(run)


def test_template_explainer_honors_test_delay(monkeypatch):
    from agent.explain import template_explainer
    monkeypatch.setenv("EXPLAIN_DELAY_MS", "1")
    async def run():
        return await template_explainer(need={"description": "milk"}, plans=[], recommended_plan_id=None)
    result = anyio.run(run)
    assert "recommended plan" in result


def test_numbers_normalize_decimal_and_thousands_separators():
    from agent.explain import _numbers
    assert _numbers("€805.00 and €1 308,00") == ["80500", "130800"]
    assert _numbers("€805,00") == _numbers("€805.00") == _numbers("80500")


def test_explanation_outcome_reports_each_fallback_reason(caplog, monkeypatch):
    import logging
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    plan = {"planId": "pln_1", "summary": "Valio milk", "total": {"cents": 1000}, "policy": {"reasons": []}}
    kwargs = dict(need={"description": "milk"}, plans=[plan], recommended_plan_id="pln_1", approval_reasons=[], per_order_limit=500)
    cases = [
        ("no_key", "", None),
        ("timeout", "key", FakeClient(error=TimeoutError())),
        ("api_error", "key", FakeClient(error=RuntimeError("api"))),
        ("refusal", "key", FakeClient({"stop_reason": "refusal", "content": []})),
        ("max_tokens", "key", FakeClient({"stop_reason": "max_tokens", "content": []})),
        ("invalid_number", "key", FakeClient({"stop_reason": "end_turn", "content": [{"type": "text", "text": "It costs €999.99."}]})),
        ("missing_brand", "key", FakeClient({"stop_reason": "end_turn", "content": [{"type": "text", "text": "A cheaper choice is available."}]})),
    ]
    async def run():
        for reason, key, client in cases:
            outcomes = []
            await explain_order(**kwargs, api_key=key, client=client, non_valio_brands=["GelatoLAB"] if reason == "missing_brand" else [], on_outcome=outcomes.append)
            assert outcomes[-1]["source"] == "template"
            assert outcomes[-1]["reason"] == reason
    with caplog.at_level(logging.INFO, logger="agent.explain"):
        anyio.run(run)
    assert {record.msg for record in caplog.records} == {"explanation outcome"}
    assert [record.explain_outcome["reason"] for record in caplog.records] == [case[0] for case in cases]
    assert all(record.explain_outcome["outcome"] == "fallback" for record in caplog.records)
    assert all(isinstance(record.explain_outcome["elapsed_ms"], int) for record in caplog.records)

def test_explanation_prompt_and_successful_outcome_are_manager_friendly():
    from agent.explain import _SYSTEM
    assert "kitchen manager" in _SYSTEM.lower()
    assert "Never mention internal ids" in _SYSTEM
    async def run():
        outcomes = []
        client = FakeClient({"stop_reason": "end_turn", "content": [{"type": "text", "text": "The order is over your per-order limit, so it needs approval. Your mandate does not allow substitutions."}]})
        await explain_order(need={"description": "milk"}, plans=[{"planId": "pln_1", "summary": "Valio milk", "total": {"cents": 10}}], recommended_plan_id="pln_1", approval_reasons=[], per_order_limit=500, api_key="key", client=client, on_outcome=outcomes.append)
        assert outcomes[-1]["source"] == "claude"
        assert outcomes[-1]["reason"] is None
        assert outcomes[-1]["elapsedMs"] >= 0
    anyio.run(run)
