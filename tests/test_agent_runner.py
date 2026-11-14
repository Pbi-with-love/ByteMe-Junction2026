import anyio
import httpx

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
        raise AssertionError(request.url)
    async def scenario():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://gateway") as client:
            steps = []
            await run_agent(client, agent_token="t", mandate_id="m", needs=[{"description":"milk", "quantity":{"amount":1,"unit":"l"}, "deadline":"2026-11-16T06:00:00+02:00", "candidateProductIds":["1"]}], explain=lambda **kwargs: "why", on_step=steps.append, poll_interval=0.001)
            assert len(steps) == 1
    anyio.run(scenario)
    assert [path for _, path in calls] == ["/v1/search", "/v1/quotes", "/v1/orders"]
