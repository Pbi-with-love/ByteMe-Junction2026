import anyio
import httpx
import json

from agent.runner import run_agent


def test_runner_searches_quotes_and_orders_recommended_plan():
    calls = []
    async def handler(request):
        calls.append((request.method, request.url.path))
        if request.url.path == "/v1/search":
            return httpx.Response(200, json={"results": []})
        if request.url.path == "/v1/quotes":
            return httpx.Response(201, json={"quoteId": "q1", "plans": [{"planId": "p1"}], "recommendedPlanId": "p1"})
        if request.url.path == "/v1/orders":
            return httpx.Response(201, json={"orderId": "o1", "status": "ORDERED"})
        if request.url.path == "/v1/orders/o1": return httpx.Response(200, json={"status": "ORDERED"})
        raise AssertionError(request.url)
    async def scenario():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://gateway") as client:
            steps = []
            await run_agent(client, agent_token="t", mandate_id="m", needs=[{"description":"milk", "quantity":{"amount":1,"unit":"l"}, "deadline":"2026-11-16T06:00:00+02:00", "candidateProductIds":["1"]}], explain=lambda **kwargs: "why", on_step=steps.append, poll_interval=0.001)
            assert len(steps) == 1
    anyio.run(scenario)
    assert [path for _, path in calls] == ["/v1/search", "/v1/quotes", "/v1/orders"]


def test_runner_reports_explaining_activity_while_explainer_is_in_flight():
    calls = []
    explanations = []
    explanation_inputs = []
    async def handler(request):
        if request.url.path == "/v1/search": return httpx.Response(200, json={"results": []})
        if request.url.path == "/v1/quotes": return httpx.Response(201, json={"quoteId": "q1", "plans": [{"planId": "p1", "summary": "20 l GelatoLAB-Espoo Pistachio ice cream"}], "recommendedPlanId": "p1"})
        if request.url.path == "/v1/orders": return httpx.Response(202, json={"orderId": "o1", "approvalId": "a1", "status": "PENDING_APPROVAL", "reasons": []})
        if request.url.path.endswith("/explanation"):
            explanations.append(json.loads(request.content))
            return httpx.Response(200, json={})
        if request.url.path == "/v1/orders/o1": return httpx.Response(200, json={"status": "ORDERED"})
        raise AssertionError(request.url)
    async def scenario():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://gateway") as client:
            async def explain(**kwargs):
                calls.append("explaining")
                explanation_inputs.append(kwargs)
                await asyncio.sleep(0)
                assert activity[-1] == "explaining"
                return "why"
            async def set_activity(value): activity.append(value)
            activity = []
            await run_agent(client, agent_token="t", mandate_id="m", needs=[{"description":"milk", "quantity":{"amount":1,"unit":"l"}}], explain=explain, on_step=lambda _: None, poll_interval=0, on_activity=set_activity, per_order_limit=500)
    import asyncio
    anyio.run(scenario)
    assert explanations == [{"text": "why"}]
    assert explanation_inputs[0]["non_valio_brands"] == ["GelatoLAB-Espoo"]
    assert explanation_inputs[0]["per_order_limit"] == 500
