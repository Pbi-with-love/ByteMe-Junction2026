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
