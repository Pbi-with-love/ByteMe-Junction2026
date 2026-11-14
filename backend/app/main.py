"""Initial FastAPI skeleton for the Trust Gateway."""

from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime
from decimal import Decimal, InvalidOperation
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from backend.app.config import Settings
from backend.app.valio_client import ValioClient
from backend.app.valio_data import ValioDataCache
from backend.app.eventlog import EventLog
from backend.app.auth import AuthStore, Principal
from backend.app.signing import DocumentSigner
from backend.app.auth import MandateError
from backend.app.search import CatalogSearch, SearchValidationError
from backend.app.planner import build_milk_plans
from backend.app.quote_store import QuoteError, QuoteStore, quote_expiry
from backend.app.valio_data import extract_allergen_data
from backend.app.valio_client import ValioUpstreamError
from backend.app.order_store import IdempotencyConflict, OrderStore
from backend.app.policy import PolicyResult, check_plan


REQUEST_ID_HEADER = "X-Request-Id"


def error_body(
    *,
    code: str,
    message: str,
    request_id: str,
    details: dict[str, object] | None = None,
) -> dict[str, object]:
    """Build the gateway's shared error response shape."""
    return {
        "error": {
            "code": code,
            "message": message,
            "requestId": request_id,
            "details": details or {},
        }
    }


class RequestIdMiddleware:
    """Attach one request ID to the response and make it available to handlers."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = next(
            (
                value.decode("latin-1")
                for key, value in scope.get("headers", [])
                if key.lower() == b"x-request-id"
            ),
            f"req_{uuid4().hex}",
        )
        scope.setdefault("state", {})["request_id"] = request_id

        async def send_with_request_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append((REQUEST_ID_HEADER.lower().encode(), request_id.encode()))
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, send_with_request_id)


def request_id(request: Request) -> str:
    """Return the ID assigned by RequestIdMiddleware."""
    return request.scope["state"]["request_id"]


def stub_response(request: Request, endpoint: str) -> JSONResponse:
    """Return an explicit placeholder until the endpoint's domain step is implemented."""
    request_id_value = request_id(request)
    return JSONResponse(
        status_code=501,
        content=error_body(
            code="NOT_IMPLEMENTED",
            message=f"{endpoint} is not implemented yet.",
            request_id=request_id_value,
        ),
    )


@asynccontextmanager
async def lifespan(application: FastAPI):
    settings = Settings.from_env()
    client = ValioClient(settings)
    try:
        application.state.valio_data = ValioDataCache(
            client,
            settings.valio_cache_directory,
        )
        application.state.valio_client = client
        await application.state.valio_data.refresh()
        application.state.catalog_search = CatalogSearch.from_cache(
            settings.valio_cache_directory
        )
        yield
    finally:
        await client.close()


app = FastAPI(
    title="Valio Aimo Trust Gateway",
    version="0.1.0",
    lifespan=lifespan,
)
app.add_middleware(RequestIdMiddleware)
settings = Settings.from_env()
signer = DocumentSigner(settings.quote_signing_key) if settings.quote_signing_key else None
database_path = settings.valio_cache_directory / "gateway.sqlite3"
app.state.event_log = EventLog(database_path)
app.state.auth_store = AuthStore(database_path, signer)
app.state.quote_store = QuoteStore(database_path, signer) if signer else None
app.state.order_store = OrderStore(database_path)


def require_auth(request: Request, *, roles: set[str] | None = None) -> Principal:
    authorization = request.headers.get("Authorization", "")
    scheme, _, token = authorization.partition(" ")
    principal = (
        request.app.state.auth_store.authenticate(token)
        if scheme.lower() == "bearer"
        else None
    )
    if principal is None:
        raise HTTPException(
            status_code=401,
            detail={
                "code": "UNAUTHENTICATED",
                "message": "A valid bearer token is required.",
            },
        )
    if roles and principal.role not in roles:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "MANDATE_INVALID",
                "message": "This token does not have permission for the operation.",
            },
        )
    return principal


async def request_json(request: Request) -> dict[str, object]:
    try:
        value = await request.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "Request body must be valid JSON.",
            },
        ) from exc
    if not isinstance(value, dict):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "Request body must be a JSON object.",
            },
        )
    return value


def _response_rows(value: object) -> list[dict[str, object]]:
    if isinstance(value, list):
        return [row for row in value if isinstance(row, dict)]
    if isinstance(value, dict):
        rows = value.get("products")
        if isinstance(rows, list):
            return [row for row in rows if isinstance(row, dict)]
    raise QuoteError("Valio response does not contain product rows.")


def _is_number(value: object) -> bool:
    try:
        float(value)
    except (TypeError, ValueError):
        return False
    return True


def _carbon_score(
    value: float | None,
    minimum: float | None,
    maximum: float | None,
) -> float | None:
    if value is None or minimum is None or maximum is None:
        return None
    if maximum == minimum:
        return 1.0
    return 1.0 - ((value - minimum) / (maximum - minimum))


def _planner_product(
    product: dict[str, object],
    availability_rows: list[dict[str, object]],
    reliability: float | None = None,
    sustainability: float | None = None,
) -> dict[str, object]:
    product_id = str(product.get("id"))
    availability = next(
        (
            row
            for row in availability_rows
            if str(row.get("productId")) == product_id
        ),
        {},
    )
    classifications = product.get("synkkaData", {})
    labels = []
    if isinstance(classifications, dict):
        values = classifications.get("classifications", [])
        if isinstance(values, list):
            for classification in values:
                if (
                    isinstance(classification, dict)
                    and classification.get("name") == "packagingMarkedLabel"
                ):
                    raw_values = classification.get("values", [])
                    if isinstance(raw_values, list):
                        labels = [
                            value["id"]
                            for value in raw_values
                            if isinstance(value, dict)
                            and isinstance(value.get("id"), str)
                        ]
    schedule_lines = availability.get("scheduleLines", [])
    if not isinstance(schedule_lines, list):
        schedule_lines = []
    normalized = {
        **product,
        **extract_allergen_data(product),
        "labels": labels,
        "labelDataVerified": isinstance(classifications, dict),
        "deliveryReliability": reliability,
        "sustainabilityScore": sustainability,
        "salesBlock": product.get("salesBlock") is True
        or availability.get("salesBlock") is True
        or any(
            isinstance(line, dict) and line.get("salesBlock") is True
            for line in schedule_lines
        ),
    }
    return normalized


def _log_order_outcome(
    request: Request,
    principal: Principal,
    quote_id: str,
    plan_id: str,
    result: PolicyResult,
) -> None:
    request.app.state.event_log.append(
        actor="agent",
        event_type="ORDER_EVALUATED",
        request_id=request_id(request),
        customer_id=principal.customer_id,
        agent_id=principal.agent_id,
        light=result.light,
        reasons=list(result.reasons),
        summary=f"Order plan {plan_id} evaluated as {result.light}.",
        refs={"quoteId": quote_id, "planId": plan_id},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Translate framework HTTP errors to the gateway error contract."""
    details = exc.detail if isinstance(exc.detail, dict) else {}
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(
            code=details.get("code", "HTTP_ERROR"),
            message=details.get("message", str(exc.detail)),
            request_id=request_id(request),
            details=details.get("details"),
        ),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Keep unexpected failures explicit and in the gateway error shape."""
    return JSONResponse(
        status_code=500,
        content=error_body(
            code="INTERNAL_ERROR",
            message="The gateway could not complete the request.",
            request_id=request_id(request),
        ),
    )


@app.get("/.well-known/agent-commerce.json")
async def discovery(request: Request) -> JSONResponse:
    return stub_response(request, "Discovery")


@app.post("/v1/auth/tokens")
async def create_token(request: Request) -> JSONResponse:
    body = await request_json(request)
    role = body.get("role")
    customer_id = body.get("customerId")
    agent_id = body.get("agentId")
    if role not in {"human", "agent", "operator"}:
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": "role is invalid."},
        )
    if role != "operator" and not isinstance(customer_id, str):
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": "customerId is required."},
        )
    if role == "agent" and not isinstance(agent_id, str):
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": "agentId is required."},
        )
    token = request.app.state.auth_store.issue_token(
        role=role,
        customer_id=customer_id if isinstance(customer_id, str) else None,
        agent_id=agent_id if isinstance(agent_id, str) else None,
    )
    request.app.state.event_log.append(
        actor="gateway",
        event_type="TOKEN_ISSUED",
        request_id=request_id(request),
        customer_id=customer_id if isinstance(customer_id, str) else None,
        agent_id=agent_id if isinstance(agent_id, str) else None,
        summary=f"{role} token issued.",
    )
    return JSONResponse(status_code=201, content={"token": token})


@app.post("/v1/mandates")
async def create_mandate(request: Request) -> JSONResponse:
    principal = require_auth(request, roles={"human"})
    body = await request_json(request)
    try:
        mandate = request.app.state.auth_store.create_mandate(
            principal=principal,
            request_data=body,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": str(exc)},
        ) from exc
    request.app.state.event_log.append(
        actor="human",
        event_type="MANDATE_SIGNED",
        request_id=request_id(request),
        customer_id=principal.customer_id,
        agent_id=body.get("agentId") if isinstance(body.get("agentId"), str) else None,
        summary=f"Mandate {mandate['mandateId']} signed.",
        refs={"mandateId": mandate["mandateId"]},
    )
    return JSONResponse(status_code=201, content=mandate)


@app.get("/v1/mandates/{mandate_id}")
async def get_mandate(mandate_id: str, request: Request) -> JSONResponse:
    principal = require_auth(request)
    if principal.customer_id is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Mandate not found."},
        )
    mandate = request.app.state.auth_store.get_mandate(mandate_id, principal.customer_id)
    if mandate is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Mandate not found."},
        )
    return mandate


@app.post("/v1/mandates/{mandate_id}/revoke")
async def revoke_mandate(mandate_id: str, request: Request) -> JSONResponse:
    principal = require_auth(request, roles={"human"})
    if principal.customer_id is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Mandate not found."},
        )
    mandate = request.app.state.auth_store.revoke_mandate(
        mandate_id,
        principal.customer_id,
    )
    if mandate is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Mandate not found."},
        )
    request.app.state.event_log.append(
        actor="human",
        event_type="MANDATE_REVOKED",
        request_id=request_id(request),
        customer_id=principal.customer_id,
        summary=f"Mandate {mandate_id} revoked.",
        refs={"mandateId": mandate_id},
    )
    return mandate


@app.post("/v1/search")
async def search(request: Request) -> JSONResponse:
    principal = require_auth(request, roles={"agent"})
    body = await request_json(request)
    mandate_id = body.get("mandateId")
    if not isinstance(mandate_id, str) or principal.customer_id is None:
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": "mandateId is required."},
        )
    try:
        mandate = request.app.state.auth_store.require_mandate(
            mandate_id,
            principal.customer_id,
        )
    except MandateError as exc:
        status = 404 if exc.code == "NOT_FOUND" else 403
        raise HTTPException(
            status_code=status,
            detail={"code": exc.code, "message": str(exc)},
        ) from exc
    try:
        service = getattr(request.app.state, "catalog_search", None)
        if service is None:
            service = CatalogSearch.from_cache(settings.valio_cache_directory)
        result = service.search(
            query=body.get("query", ""),
            filters=body.get("filters", {}),
            limit=body.get("limit", 20),
            mandate=mandate,
        )
    except SearchValidationError as exc:
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": str(exc)},
        ) from exc
    request.app.state.event_log.append(
        actor="agent",
        event_type="SEARCH",
        request_id=request_id(request),
        customer_id=principal.customer_id,
        agent_id=principal.agent_id,
        summary=f"Search returned {result['total']} matching products.",
        refs={"mandateId": mandate_id},
        payload={
            "query": body.get("query"),
            "filters": body.get("filters", {}),
            "resultCount": result["total"],
            "excludedCount": sum(
                item["excluded"] is not None for item in result["results"]
            ),
        },
    )
    return result


@app.post("/v1/quotes")
async def create_quote(request: Request) -> JSONResponse:
    principal = require_auth(request, roles={"agent"})
    if principal.customer_id is None:
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": "customerId is required."},
        )
    quote_store = request.app.state.quote_store
    if quote_store is None:
        raise HTTPException(
            status_code=500,
            detail={
                "code": "INTERNAL_ERROR",
                "message": "Quote signing is not configured.",
            },
        )
    body = await request_json(request)
    mandate_id = body.get("mandateId")
    need = body.get("need")
    if not isinstance(mandate_id, str) or not isinstance(need, dict):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "mandateId and need are required.",
            },
        )
    try:
        mandate = request.app.state.auth_store.require_mandate(
            mandate_id,
            principal.customer_id,
        )
    except MandateError as exc:
        status = 404 if exc.code == "NOT_FOUND" else 403
        raise HTTPException(
            status_code=status,
            detail={"code": exc.code, "message": str(exc)},
        ) from exc

    quantity = need.get("quantity")
    deadline = need.get("deadline")
    if (
        not isinstance(quantity, dict)
        or not isinstance(quantity.get("amount"), (int, float, str))
        or isinstance(quantity.get("amount"), bool)
        or not isinstance(quantity.get("unit"), str)
        or not isinstance(deadline, str)
    ):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "need.quantity and need.deadline are invalid.",
            },
        )
    try:
        amount = Decimal(str(quantity["amount"]))
        requested_date = datetime.fromisoformat(deadline).date().isoformat()
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "need quantity or deadline is invalid.",
            },
        ) from exc
    candidate_ids = body.get("candidateProductIds")
    if candidate_ids is not None and (
        not isinstance(candidate_ids, list)
        or not all(isinstance(value, str) for value in candidate_ids)
    ):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "candidateProductIds must be a list of strings.",
            },
        )
    try:
        catalog = request.app.state.valio_data.load("products")
        reliability_rows = request.app.state.valio_data.load("delivery-reliability")
        carbon_rows = request.app.state.valio_data.load("carbon-footprint")
        reliability = {
            str(row.get("productId")): float(row["deliveryReliability"])
            for row in reliability_rows
            if row.get("productId") is not None
            and _is_number(row.get("deliveryReliability"))
        }
        carbon = {
            str(row.get("productId")): float(row["AVG kg CO2-eq/kg"])
            for row in carbon_rows
            if row.get("productId") is not None
            and _is_number(row.get("AVG kg CO2-eq/kg"))
        }
        if not candidate_ids:
            search_result = request.app.state.catalog_search.search(
                query=need.get("description", ""),
                filters={},
                limit=5,
                mandate=mandate,
            )
            candidate_ids = [item["productId"] for item in search_result["results"]]
        selected = [
            product
            for product in catalog
            if str(product.get("id")) in set(candidate_ids or [])
        ]
        price_response = await request.app.state.valio_client.price(
            customer=principal.customer_id,
            requested_date=requested_date,
            products=candidate_ids or [],
        )
        availability_response = await request.app.state.valio_client.availability(
            customer=principal.customer_id,
            requested_date=requested_date,
            products=candidate_ids or [],
        )
    except (ValioUpstreamError, FileNotFoundError) as exc:
        raise HTTPException(
            status_code=502,
            detail={"code": "UPSTREAM_ERROR", "message": str(exc)},
        ) from exc
    price_rows = _response_rows(price_response)
    availability_rows = _response_rows(availability_response)
    carbon_values = [carbon[str(product.get("id"))] for product in selected if str(product.get("id")) in carbon]
    carbon_min = min(carbon_values) if carbon_values else None
    carbon_max = max(carbon_values) if carbon_values else None
    normalized_products = [
        _planner_product(
            product,
            availability_rows,
            reliability.get(str(product.get("id"))),
            _carbon_score(carbon.get(str(product.get("id"))), carbon_min, carbon_max),
        )
        for product in selected
    ]
    prices = {str(row.get("productId")): row for row in price_rows}
    availability = {str(row.get("productId")): row for row in availability_rows}
    try:
        planned = build_milk_plans(
            products=normalized_products,
            prices=price_rows,
            availability=availability_rows,
            need_amount=amount,
            deadline=deadline,
            mandate=mandate,
            now=datetime.now().astimezone(),
        )
        all_lines = [
            line
            for plan in planned["plans"]
            for line in plan["lines"]
        ]
        expires_at = quote_expiry(
            lines=all_lines,
            prices=prices,
            availability=availability,
        )
    except (QuoteError, ValueError) as exc:
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": str(exc)},
        ) from exc
    document = {
        "status": "QUOTED",
        "createdAt": datetime.now().astimezone().isoformat(),
        "expiresAt": expires_at,
        "need": need,
        "plans": planned["plans"],
        "excludedProducts": planned["excludedProducts"],
        "evidence": [],
        "scenarioOverlay": False,
    }
    quote = quote_store.create(
        customer_id=principal.customer_id,
        mandate_id=mandate_id,
        document=document,
    )
    request.app.state.event_log.append(
        actor="agent",
        event_type="QUOTE_CREATED",
        request_id=request_id(request),
        customer_id=principal.customer_id,
        agent_id=principal.agent_id,
        summary=f"Quote {quote['quoteId']} created.",
        refs={"quoteId": quote["quoteId"], "mandateId": mandate_id},
        payload={"planCount": len(quote["plans"])},
    )
    return JSONResponse(status_code=201, content=quote)


@app.get("/v1/quotes/{quote_id}")
async def get_quote(quote_id: str, request: Request) -> JSONResponse:
    principal = require_auth(request)
    if principal.customer_id is None or request.app.state.quote_store is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Quote not found."},
        )
    quote = request.app.state.quote_store.get(
        quote_id,
        principal.customer_id,
        now=datetime.now().astimezone(),
    )
    if quote is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Quote not found."},
        )
    return quote


@app.post("/v1/quotes/{quote_id}/requote")
async def requote(quote_id: str, request: Request) -> JSONResponse:
    return stub_response(request, "Quote refresh")


@app.post("/v1/orders")
async def create_order(request: Request) -> JSONResponse:
    principal = require_auth(request, roles={"agent"})
    idempotency_key = request.headers.get("Idempotency-Key")
    if not idempotency_key:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "Idempotency-Key is required.",
            },
        )
    body = await request_json(request)
    quote_id = body.get("quoteId")
    plan_id = body.get("planId")
    if not isinstance(quote_id, str) or not isinstance(plan_id, str):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "quoteId and planId are required.",
            },
        )
    try:
        existing = request.app.state.order_store.existing(
            customer_id=principal.customer_id or "",
            idempotency_key=idempotency_key,
            request_body=body,
        )
    except IdempotencyConflict as exc:
        raise HTTPException(
            status_code=409,
            detail={"code": "INVALID_STATE", "message": str(exc)},
        ) from exc
    if existing is not None:
        response_status, response = existing
        return JSONResponse(status_code=response_status, content=response)

    quote_store = request.app.state.quote_store
    if quote_store is None or principal.customer_id is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Quote not found."},
        )
    quote = quote_store.get(
        quote_id,
        principal.customer_id,
        now=datetime.now().astimezone(),
    )
    if quote is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Quote not found."},
        )
    if not quote_store.verify(quote):
        _log_order_outcome(
            request,
            principal,
            quote_id,
            plan_id,
            PolicyResult("RED", ("POLICY_BLOCKED",)),
        )
        raise HTTPException(
            status_code=403,
            detail={"code": "POLICY_BLOCKED", "message": "Quote signature is invalid."},
        )
    if quote.get("status") == "EXPIRED":
        _log_order_outcome(
            request,
            principal,
            quote_id,
            plan_id,
            PolicyResult("RED", ("QUOTE_EXPIRED",)),
        )
        raise HTTPException(
            status_code=409,
            detail={"code": "QUOTE_EXPIRED", "message": "Quote has expired."},
        )
    try:
        mandate = request.app.state.auth_store.require_mandate(
            str(quote.get("mandateId")),
            principal.customer_id,
        )
    except MandateError as exc:
        _log_order_outcome(
            request,
            principal,
            quote_id,
            plan_id,
            PolicyResult("RED", (exc.code,)),
        )
        status = 404 if exc.code == "NOT_FOUND" else 403
        raise HTTPException(
            status_code=status,
            detail={"code": exc.code, "message": str(exc)},
        ) from exc
    plans = quote.get("plans", [])
    plan = next(
        (value for value in plans if isinstance(value, dict) and value.get("planId") == plan_id),
        None,
    )
    if plan is None:
        _log_order_outcome(
            request,
            principal,
            quote_id,
            plan_id,
            PolicyResult("RED", ("POLICY_BLOCKED",)),
        )
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": "Plan is not in the quote."},
        )
    try:
        catalog = request.app.state.valio_data.load("products")
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=502,
            detail={"code": "UPSTREAM_ERROR", "message": str(exc)},
        ) from exc
    products = {str(product.get("id")): product for product in catalog}
    policy_plan = {
        **plan,
        "lines": [
            {
                **line,
                "product": _planner_product(
                    products[line["productId"]],
                    [],
                ),
            }
            for line in plan.get("lines", [])
            if isinstance(line, dict) and line.get("productId") in products
        ],
    }
    now = datetime.now().astimezone()
    policy_result = check_plan(
        policy_plan,
        mandate,
        committed_week_total_cents=request.app.state.order_store.week_total_cents(
            principal.customer_id,
            now=now,
        ),
        now=now,
    )
    if policy_result.light == "RED":
        _log_order_outcome(request, principal, quote_id, plan_id, policy_result)
        raise HTTPException(
            status_code=403,
            detail={
                "code": "POLICY_BLOCKED",
                "message": "The selected plan is blocked by policy.",
                "details": {"reasons": list(policy_result.reasons)},
            },
        )
    if policy_result.light == "YELLOW":
        response_status = 202
        status = "PENDING_APPROVAL"
    else:
        response_status = 201
        status = "ORDERED"
    response = {
        "quoteId": quote_id,
        "planId": plan_id,
        "status": status,
        "lines": plan.get("lines", []),
        "total": plan.get("total", {}),
        "createdAt": now.isoformat(),
        "reasons": list(policy_result.reasons),
    }
    try:
        stored = request.app.state.order_store.create(
            customer_id=principal.customer_id,
            quote_id=quote_id,
            plan_id=plan_id,
            idempotency_key=idempotency_key,
            request_body=body,
            status="PENDING_APPROVAL" if response_status == 202 else "CONFIRMED",
            total_cents=plan.get("total", {}).get("cents", 0),
            response_status=response_status,
            response=response,
            created_at=now.isoformat(),
        )
    except IdempotencyConflict as exc:
        raise HTTPException(
            status_code=409,
            detail={"code": "INVALID_STATE", "message": str(exc)},
        ) from exc
    _log_order_outcome(request, principal, quote_id, plan_id, policy_result)
    return JSONResponse(status_code=response_status, content=stored)


@app.get("/v1/orders/{order_id}")
async def get_order(order_id: str, request: Request) -> JSONResponse:
    principal = require_auth(request)
    if principal.customer_id is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Order not found."},
        )
    order = request.app.state.order_store.get(order_id, principal.customer_id)
    if order is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Order not found."},
        )
    return order


@app.get("/v1/approvals/{approval_id}")
async def get_approval(approval_id: str, request: Request) -> JSONResponse:
    return stub_response(request, "Approval retrieval")


@app.post("/v1/approvals/{approval_id}")
async def decide_approval(approval_id: str, request: Request) -> JSONResponse:
    return stub_response(request, "Approval decision")


@app.post("/v1/approvals/{approval_id}/explanation")
async def add_approval_explanation(approval_id: str, request: Request) -> JSONResponse:
    return stub_response(request, "Approval explanation")


@app.get("/v1/log")
async def get_log(
    request: Request,
    since: int = 0,
    limit: int = 100,
) -> dict[str, object]:
    if since < 0 or limit < 1 or limit > 1000:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "since must be non-negative and limit must be between 1 and 1000.",
            },
        )
    return {"events": request.app.state.event_log.list(since=since, limit=limit)}


@app.get("/v1/log/verify")
async def verify_log(request: Request) -> dict[str, object]:
    return request.app.state.event_log.verify()


@app.get("/v1/events")
async def events(request: Request) -> JSONResponse:
    return stub_response(request, "Live events")


@app.post("/v1/game/levels/{level_id}/start")
async def start_level(level_id: str, request: Request) -> JSONResponse:
    return stub_response(request, "Game level start")


@app.post("/v1/game/sessions/{session_id}/run")
async def run_session(session_id: str, request: Request) -> JSONResponse:
    return stub_response(request, "Game session run")


@app.get("/v1/game/sessions/{session_id}")
async def get_session(session_id: str, request: Request) -> JSONResponse:
    return stub_response(request, "Game session retrieval")
