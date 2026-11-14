"""Initial FastAPI skeleton for the Trust Gateway."""

from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
import json
import os
from pathlib import Path
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
from backend.app.planner import build_plans
from backend.app.quote_store import QuoteError, QuoteStore, quote_expiry
from backend.app.valio_data import extract_allergen_data
from backend.app.valio_client import ValioUpstreamError
from backend.app.valio_replay import OverlayValioClient, ReplayValioClient
from backend.app.order_store import IdempotencyConflict, OrderStore
from backend.app.approval_store import ApprovalStore
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
    fixture_root = Path(__file__).resolve().parents[1] / "fixtures" / "valio"
    catalog_directory = fixture_root / "catalog"
    if os.getenv("VALIO_MODE", "live").lower() == "replay":
        client = ReplayValioClient(catalog_directory, fixture_root / "recorded")
        scenario_level = os.getenv("VALIO_SCENARIO_LEVEL", "")
        if scenario_level in {"level1", "level2", "level3"}:
            scenario_path = Path(__file__).resolve().parent / "scenarios" / f"{scenario_level}.json"
            scenario = json.loads(scenario_path.read_text(encoding="utf-8"))
            client = OverlayValioClient(client, scenario.get("overlay"))
    else:
        client = ValioClient(settings)
    try:
        application.state.valio_data = ValioDataCache(
            client,
            settings.valio_cache_directory,
            fallback_directory=catalog_directory,
        )
        application.state.valio_client = client
        products = application.state.valio_data.load("products")
        reliability_rows = application.state.valio_data.load("delivery-reliability")
        carbon_rows = application.state.valio_data.load("carbon-footprint")
        application.state.catalog_search = CatalogSearch(
            products,
            {
                str(row["productId"]): float(row["deliveryReliability"])
                for row in reliability_rows
                if row.get("productId") is not None
                and _is_number(row.get("deliveryReliability"))
            },
            {
                str(row["productId"]): float(row["AVG kg CO2-eq/kg"])
                for row in carbon_rows
                if row.get("productId") is not None
                and _is_number(row.get("AVG kg CO2-eq/kg"))
            },
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
app.state.approval_store = ApprovalStore(database_path)
app.state.approval_timeout_seconds = settings.approval_timeout_seconds


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
            status_code=401,
            detail={
                "code": "UNAUTHENTICATED",
                "message": "This token does not have permission for the operation.",
            },
        )
    return principal


def enforce_customer_boundary(request: Request, principal: Principal, body: dict[str, object]) -> None:
    supplied = body.get("customerId")
    if "customerId" in body and supplied != principal.customer_id:
        request.app.state.event_log.append(
            actor="gateway", event_type="DATA_BOUNDARY_BLOCKED", request_id=request_id(request),
            customer_id=principal.customer_id, agent_id=principal.agent_id,
            light="RED", reasons=["DATA_BOUNDARY"], summary="Request rejected for customer boundary.",
        )
        raise HTTPException(status_code=403, detail={"code": "DATA_BOUNDARY", "message": "customerId does not match the authenticated customer."})


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


def _policy_plan(
    request: Request,
    plan: dict[str, object],
) -> dict[str, object]:
    catalog = request.app.state.valio_data.load("products")
    products = {str(product.get("id")): product for product in catalog}
    lines = []
    for line in plan.get("lines", []):
        if not isinstance(line, dict) or line.get("productId") not in products:
            continue
        lines.append(
            {
                **line,
                "product": {
                    **_planner_product(products[line["productId"]], []),
                    "salesBlock": _planner_product(products[line["productId"]], []).get("salesBlock") is True or line.get("salesBlock") is True,
                },
            }
        )
    return {**plan, "lines": lines}


def _recheck_order_plan(
    request: Request,
    plan: dict[str, object],
    mandate: dict[str, object],
    *,
    now: datetime,
    exclude_order_id: str | None = None,
) -> PolicyResult:
    policy_plan = _policy_plan(request, plan)
    return check_plan(
        policy_plan,
        mandate,
        committed_week_total_cents=request.app.state.order_store.week_total_cents(
            str(mandate.get("customerId") or ""),
            now=now,
            exclude_order_id=exclude_order_id,
        ),
        now=now,
    )


def _expire_approval_order(
    request: Request,
    approval: dict[str, object],
    customer_id: str,
) -> dict[str, object] | None:
    if approval["status"] != "EXPIRED":
        return request.app.state.order_store.get(
            str(approval["orderId"]),
            customer_id,
        )
    order = request.app.state.order_store.get(str(approval["orderId"]), customer_id)
    if order and order.get("status") == "PENDING_APPROVAL":
        request.app.state.order_store.update(
            str(approval["orderId"]),
            customer_id,
            status="EXPIRED",
            response_updates={"status": "EXPIRED"},
        )
    return request.app.state.order_store.get(str(approval["orderId"]), customer_id)


def _log_approval_expired(request: Request, approval: dict[str, object], customer_id: str) -> None:
    if request.app.state.approval_store.claim_expired_log(str(approval["approvalId"]), customer_id):
        request.app.state.event_log.append(
            actor="gateway", event_type="APPROVAL_EXPIRED", request_id=request_id(request),
            customer_id=customer_id, summary=f"Approval {approval['approvalId']} expired.",
            refs={"approvalId": str(approval["approvalId"]), "orderId": str(approval["orderId"])},
        )


def _reject_approval(
    request: Request,
    approval: dict[str, object],
    customer_id: str,
    reason: str,
) -> None:
    request.app.state.approval_store.decide(
        str(approval["approvalId"]),
        customer_id,
        status="REJECTED",
    )
    request.app.state.order_store.update(
        str(approval["orderId"]),
        customer_id,
        status="REJECTED",
        response_updates={"status": "REJECTED", "reasons": [reason]},
    )


def _plan_summary(plan: dict[str, object]) -> str:
    return str(plan.get("summary", ""))


def _consume_approval_heart(request: Request, customer_id: str) -> int | None:
    """Return the session heart after decrementing it when the game layer exists."""
    provider = getattr(request.app.state, "hearts_provider", None)
    if provider is None:
        return None
    return provider.consume(customer_id)


def _log_order_outcome(
    request: Request,
    principal: Principal,
    quote_id: str,
    plan_id: str,
    result: PolicyResult,
) -> None:
    request.app.state.event_log.append(
        actor="agent",
        event_type=(
            "POLICY_BLOCKED"
            if result.light == "RED"
            else "ORDER_PENDING_APPROVAL"
            if result.light == "YELLOW"
            else "ORDER_CREATED"
        ),
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
    return {"provider": "Valio Aimo (mock)", "protocolVersion": "1.0-draft", "baseUrl": str(request.base_url).rstrip("/") + "/v1",
            "capabilities": ["search", "quote", "order", "mandate", "approval", "audit_log"],
            "mandate": {"schemaUrl": str(request.base_url).rstrip("/") + "/v1/schemas/mandate.json", "substitutionLevels": ["none", "same_category", "any"], "lateDeliveryLevels": ["none", "one_day"]},
            "signing": {"alg": "Ed25519", "keys": [{"keyId": "valio-aimo-2026-11", "publicKey": signer.public_key if signer else ""}], "canonicalization": "JSON, sorted keys, no whitespace"},
            "policy": {"lights": ["GREEN", "BLUE", "YELLOW", "RED"], "reasonCodesUrl": str(request.base_url).rstrip("/") + "/v1/schemas/reason-codes.json"},
            "dataDisclosure": {"public": ["catalog", "labels", "certificates", "categoryCarbon"], "customerScoped": ["netPrices", "quotes", "orders", "auditLog"], "neverExposed": ["purchasePrices", "margins", "otherCustomers", "supplierContracts"]}}


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
    return JSONResponse(status_code=201, content={"token": token})


@app.post("/v1/mandates")
async def create_mandate(request: Request) -> JSONResponse:
    principal = require_auth(request, roles={"human"})
    body = await request_json(request)
    enforce_customer_boundary(request, principal, body)
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
    principal = require_auth(request, roles={"human", "agent"})
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
    enforce_customer_boundary(request, principal, body)
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
    enforce_customer_boundary(request, principal, body)
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
    candidate_ids = need.get("candidateProductIds", body.get("candidateProductIds"))
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
        planned = build_plans(
            products=normalized_products,
            prices=price_rows,
            availability=availability_rows,
            need_amount=amount,
            unit=quantity["unit"],
            deadline=deadline,
            mandate=mandate,
            now=datetime.now().astimezone(),
        )
        all_lines = [
            line
            for plan in planned["plans"]
            for line in plan["lines"]
        ]
        expires_at = (
            quote_expiry(
                lines=all_lines,
                prices=prices,
                availability=availability,
            )
            if all_lines
            else datetime.now().astimezone().isoformat()
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
        "evidence": [
            {"source": "valio:/api/price", "requestId": request_id(request), "at": datetime.now().astimezone().isoformat()},
            {"source": "valio:/api/availability", "requestId": request_id(request), "at": datetime.now().astimezone().isoformat()},
        ],
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
        reasons=["PRICE_UNAVAILABLE"] if planned["priceUnavailable"] else [],
        payload={"planCount": len(quote["plans"]), "unconvertible": planned["unconvertible"], "priceUnavailable": planned["priceUnavailable"]},
    )
    return JSONResponse(status_code=201, content=quote)


@app.get("/v1/quotes/{quote_id}")
async def get_quote(quote_id: str, request: Request) -> JSONResponse:
    principal = require_auth(request, roles={"agent"})
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
    enforce_customer_boundary(request, principal, body)
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

    if request.app.state.order_store.for_quote(quote_id, principal.customer_id or ""):
        raise HTTPException(status_code=409, detail={"code": "INVALID_STATE", "message": "Quote already has an order."})

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
        request.app.state.event_log.append(
            actor="gateway", event_type="QUOTE_EXPIRED", request_id=request_id(request),
            customer_id=principal.customer_id, agent_id=principal.agent_id,
            summary=f"Quote {quote_id} expired.", refs={"quoteId": quote_id},
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
        reason = exc.code if exc.code in {"MANDATE_INVALID", "MANDATE_EXPIRED"} else "MANDATE_INVALID"
        _log_order_outcome(
            request,
            principal,
            quote_id,
            plan_id,
            PolicyResult("RED", (reason,)),
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
    if response_status == 202:
        quote_expires = datetime.fromisoformat(str(quote["expiresAt"]))
        approval_deadline = min(
            now + timedelta(
                seconds=request.app.state.approval_timeout_seconds
            ),
            quote_expires,
        )
        hearts_left = _consume_approval_heart(request, principal.customer_id)
        approval_reasons = list(policy_result.reasons)
        approval_status = "OPEN"
        if hearts_left is not None and request.app.state.approval_store.count(principal.customer_id) >= 3:
            approval_status = "EXPIRED"
            approval_reasons.append("ATTENTION_EXHAUSTED")
        approval = request.app.state.approval_store.create(
            customer_id=principal.customer_id,
            order_id=stored["orderId"],
            quote_id=quote_id,
            reasons=approval_reasons,
            options=[
                {
                    "planId": option.get("planId"),
                    "tier": option.get("tier"),
                    "recommended": option.get("recommended", False),
                    "summary": _plan_summary(option),
                }
                for option in quote.get("plans", [])
                if isinstance(option, dict)
            ],
            created_at=now,
            deadline=approval_deadline,
            hearts_left=hearts_left,
            status=approval_status,
        )
        if approval_status == "EXPIRED":
            stored = request.app.state.order_store.update(
                stored["orderId"],
                principal.customer_id,
                status="EXPIRED",
                response_updates={
                    "status": "EXPIRED",
                    "approvalId": approval["approvalId"],
                    "reasons": approval_reasons,
                },
            )
        else:
            stored = request.app.state.order_store.update(
                stored["orderId"],
                principal.customer_id,
                status="PENDING_APPROVAL",
                response_updates={"approvalId": approval["approvalId"]},
            )
        request.app.state.event_log.append(
            actor="gateway",
            event_type="APPROVAL_SHOWN",
            request_id=request_id(request),
            customer_id=principal.customer_id,
            agent_id=principal.agent_id,
            light="YELLOW",
            reasons=approval_reasons,
            summary=f"Approval {approval['approvalId']} opened.",
            refs={
                "approvalId": approval["approvalId"],
                "orderId": stored["orderId"],
                "quoteId": quote_id,
            },
        )
    _log_order_outcome(request, principal, quote_id, plan_id, policy_result)
    return JSONResponse(status_code=response_status, content=stored)


@app.get("/v1/orders/{order_id}")
async def get_order(order_id: str, request: Request) -> JSONResponse:
    principal = require_auth(request, roles={"agent"})
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
    if order.get("status") == "PENDING_APPROVAL":
        approval = request.app.state.approval_store.expire_for_order(
            order_id,
            principal.customer_id,
            now=datetime.now().astimezone(),
        )
        if approval and approval["status"] == "EXPIRED":
            _log_approval_expired(request, approval, principal.customer_id)
            request.app.state.order_store.update(
                order_id,
                principal.customer_id,
                status="EXPIRED",
                response_updates={"status": "EXPIRED"},
            )
            order = request.app.state.order_store.get(order_id, principal.customer_id)
    return order


@app.get("/v1/approvals/{approval_id}")
async def get_approval(approval_id: str, request: Request) -> JSONResponse:
    principal = require_auth(request, roles={"human"})
    if principal.customer_id is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Approval not found."},
        )
    approval = request.app.state.approval_store.get(
        approval_id,
        principal.customer_id,
        now=datetime.now().astimezone(),
    )
    if approval is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Approval not found."},
        )
    order = _expire_approval_order(request, approval, principal.customer_id)
    if approval["status"] == "EXPIRED":
        _log_approval_expired(request, approval, principal.customer_id)
    return {**approval, "order": order}


@app.post("/v1/approvals/{approval_id}")
async def decide_approval(approval_id: str, request: Request) -> JSONResponse:
    principal = require_auth(request, roles={"human"})
    if principal.customer_id is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Approval not found."},
        )
    body = await request_json(request)
    decision = body.get("decision")
    if decision not in {"approved", "rejected", "alternative"}:
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": "decision is invalid."},
        )
    approval = request.app.state.approval_store.get(
        approval_id,
        principal.customer_id,
        now=datetime.now().astimezone(),
    )
    if approval is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Approval not found."},
        )
    if approval["status"] != "OPEN":
        _expire_approval_order(request, approval, principal.customer_id)
        raise HTTPException(
            status_code=409,
            detail={"code": "INVALID_STATE", "message": "Approval is closed."},
        )
    order = request.app.state.order_store.get(
        str(approval["orderId"]),
        principal.customer_id,
    )
    quote = request.app.state.quote_store.get(
        str(approval["quoteId"]),
        principal.customer_id,
        now=datetime.now().astimezone(),
    )
    if order is None or quote is None or quote.get("status") == "EXPIRED":
        raise HTTPException(
            status_code=409,
            detail={"code": "QUOTE_EXPIRED", "message": "Quote has expired."},
        )
    plan_id = str(order.get("planId"))
    if decision == "alternative":
        alternative_id = body.get("planId")
        if not isinstance(alternative_id, str):
            raise HTTPException(
                status_code=400,
                detail={"code": "VALIDATION_ERROR", "message": "planId is required."},
            )
        plan_id = alternative_id
    plan = next(
        (
            value
            for value in quote.get("plans", [])
            if isinstance(value, dict) and value.get("planId") == plan_id
        ),
        None,
    )
    if plan is None:
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": "Plan is not in the quote."},
        )
    try:
        mandate = request.app.state.auth_store.require_mandate(
            str(quote.get("mandateId")),
            principal.customer_id,
        )
    except MandateError as exc:
        _reject_approval(request, approval, principal.customer_id, "MANDATE_INVALID")
        raise HTTPException(
            status_code=403,
            detail={"code": exc.code, "message": str(exc)},
        ) from exc
    now = datetime.now().astimezone()
    valio = getattr(request.app.state, "valio_client", None)
    price_call = getattr(valio, "price", None)
    availability_call = getattr(valio, "availability", None)
    if decision != "rejected" and (not callable(price_call) or not callable(availability_call)):
        raise HTTPException(status_code=502, detail={"code": "UPSTREAM_ERROR", "message": "Approval recheck client is unavailable."})
    if decision != "rejected" and callable(price_call) and callable(availability_call):
        product_ids = [str(line.get("productId")) for line in plan.get("lines", [])]
        requested_date = datetime.fromisoformat(str(plan.get("deadline"))).date().isoformat()
        try:
            fresh_prices = _response_rows(await price_call(customer=principal.customer_id, requested_date=requested_date, products=product_ids))
            fresh_availability = _response_rows(await availability_call(customer=principal.customer_id, requested_date=requested_date, products=product_ids))
        except (ValioUpstreamError, QuoteError, ValueError) as exc:
            raise HTTPException(status_code=502, detail={"code": "UPSTREAM_ERROR", "message": str(exc)}) from exc
        price_by_id = {str(row.get("productId")): row for row in fresh_prices}
        availability_by_id = {str(row.get("productId")): row for row in fresh_availability}
        fresh_lines = []
        for line in plan.get("lines", []):
            product_id = str(line.get("productId"))
            price_row = price_by_id.get(product_id, {})
            availability_row = availability_by_id.get(product_id, {})
            if price_row.get("error") is True or price_row.get("netPriceFound") is False or not price_row:
                raise HTTPException(status_code=502, detail={"code": "UPSTREAM_ERROR", "message": "Price unavailable during approval recheck."})
            schedule = availability_row.get("scheduleLines", [])
            schedule = schedule if isinstance(schedule, list) else []
            sales_quantity_data = line.get("salesQuantity")
            sales_quantity = sales_quantity_data.get("amount", 0) if isinstance(sales_quantity_data, dict) else None
            usable = [row for row in schedule if isinstance(row, dict) and row.get("salesBlock") is not True]
            selected_schedule = next((row for row in usable if sales_quantity is None or row.get("availableAmount", 0) >= sales_quantity), None)
            blocked = availability_row.get("salesBlock") is True or selected_schedule is None
            refreshed_line = {**line, "salesBlock": blocked}
            if selected_schedule and isinstance(selected_schedule.get("availableDate"), str):
                refreshed_line["availableDate"] = selected_schedule["availableDate"]
            pricing = price_row.get("priceWithTax")
            price_value = pricing.get("value") if isinstance(pricing, dict) else None
            if sales_quantity is not None and isinstance(price_value, (int, float)) and not isinstance(price_value, bool):
                unit_cents = int(Decimal(str(price_value)) * 100)
                refreshed_line["unitPrice"] = {"cents": unit_cents, "currency": "EUR"}
                refreshed_line["lineTotal"] = {"cents": unit_cents * int(sales_quantity), "currency": "EUR"}
            fresh_lines.append(refreshed_line)
        refreshed_total = sum(line.get("lineTotal", {}).get("cents", 0) for line in fresh_lines)
        plan = {**plan, "lines": fresh_lines, "total": {"cents": refreshed_total, "currency": "EUR"}}
    result = _recheck_order_plan(
        request,
        plan,
        mandate,
        now=now,
        exclude_order_id=str(order["orderId"]),
    )
    if decision != "rejected" and result.light == "RED":
        _reject_approval(request, approval, principal.customer_id, "POLICY_BLOCKED")
        request.app.state.event_log.append(actor="human", event_type="POLICY_BLOCKED", request_id=request_id(request), customer_id=principal.customer_id, light="RED", reasons=list(result.reasons), summary=f"Approval {approval_id} blocked by current policy.", refs={"approvalId": approval_id, "orderId": str(order["orderId"])})
        raise HTTPException(
            status_code=403,
            detail={
                "code": "POLICY_BLOCKED",
                "message": "The selected decision is blocked by current policy.",
                "details": {"reasons": list(result.reasons)},
            },
        )
    if decision == "rejected":
        approval = request.app.state.approval_store.decide(
            approval_id,
            principal.customer_id,
            status="REJECTED",
        )
        order = request.app.state.order_store.update(
            str(order["orderId"]),
            principal.customer_id,
            status="REJECTED",
            response_updates={"status": "REJECTED", "reasons": list(result.reasons)},
        )
    else:
        approval = request.app.state.approval_store.decide(
            approval_id,
            principal.customer_id,
            status="APPROVED",
        )
        order = request.app.state.order_store.update(
            str(order["orderId"]),
            principal.customer_id,
            status="CONFIRMED",
            total_cents=int(plan["total"]["cents"]),
            response_updates={
                "status": "ORDERED",
                "planId": plan_id,
                "lines": plan.get("lines", []),
                "total": plan.get("total", {}),
                "reasons": list(result.reasons),
            },
        )
    request.app.state.event_log.append(
        actor="human",
        event_type="APPROVAL_DECIDED",
        request_id=request_id(request),
        customer_id=principal.customer_id,
        light=result.light,
        reasons=list(result.reasons),
        summary=f"Approval {approval_id} decision: {decision}.",
        refs={"approvalId": approval_id, "orderId": str(order["orderId"])},
    )
    return {"approval": approval, "order": order}


@app.post("/v1/approvals/{approval_id}/explanation")
async def add_approval_explanation(approval_id: str, request: Request) -> JSONResponse:
    principal = require_auth(request, roles={"agent"})
    if principal.customer_id is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Approval not found."},
        )
    body = await request_json(request)
    text = body.get("text")
    if not isinstance(text, str) or not text.strip():
        raise HTTPException(
            status_code=400,
            detail={"code": "VALIDATION_ERROR", "message": "text is required."},
        )
    approval = request.app.state.approval_store.get(
        approval_id,
        principal.customer_id,
        now=datetime.now().astimezone(),
    )
    if approval is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Approval not found."},
        )
    if approval["status"] != "OPEN":
        raise HTTPException(
            status_code=409,
            detail={"code": "INVALID_STATE", "message": "Approval is closed."},
        )
    updated = request.app.state.approval_store.add_explanation(
        approval_id,
        principal.customer_id,
        text.strip(),
    )
    request.app.state.event_log.append(
        actor="agent",
        event_type="AGENT_NOTE",
        request_id=request_id(request),
        customer_id=principal.customer_id,
        agent_id=principal.agent_id,
        summary=f"Agent explanation added to approval {approval_id}.",
        refs={"approvalId": approval_id},
    )
    return updated


@app.get("/v1/log")
async def get_log(
    request: Request,
    view: str | None = None,
    since: int = 0,
    limit: int = 100,
) -> dict[str, object]:
    principal = require_auth(request)
    if view not in {"buyer", "valio"}:
        raise HTTPException(status_code=400, detail={"code": "VALIDATION_ERROR", "message": "view must be buyer or valio."})
    if (view == "buyer" and principal.role not in {"human", "agent"}) or (view == "valio" and principal.role != "operator"):
        raise HTTPException(status_code=401, detail={"code": "UNAUTHENTICATED", "message": "Token role is not allowed for this log view."})
    if since < 0 or limit < 1 or limit > 1000:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "since must be non-negative and limit must be between 1 and 1000.",
            },
        )
    if view == "buyer":
        events = request.app.state.event_log.list_customer(principal.customer_id or "", since=since, limit=limit)
    else:
        events = request.app.state.event_log.list(since=since, limit=limit)
        for event in events:
            event["disclosure"] = {"returnedToAgent": ["catalog", "labels", "certificates", "categoryCarbon", "netPrice", "availability", "closingTime"], "withheld": ["purchasePrice", "margin", "otherCustomers", "supplierContracts"]}
    return {"events": events}


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
