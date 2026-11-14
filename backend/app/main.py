"""Initial FastAPI skeleton for the Trust Gateway."""

from __future__ import annotations

from contextlib import asynccontextmanager
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
        await application.state.valio_data.refresh()
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
    require_auth(request, roles={"agent"})
    return stub_response(request, "Search")


@app.post("/v1/quotes")
async def create_quote(request: Request) -> JSONResponse:
    return stub_response(request, "Quote creation")


@app.get("/v1/quotes/{quote_id}")
async def get_quote(quote_id: str, request: Request) -> JSONResponse:
    return stub_response(request, "Quote retrieval")


@app.post("/v1/quotes/{quote_id}/requote")
async def requote(quote_id: str, request: Request) -> JSONResponse:
    return stub_response(request, "Quote refresh")


@app.post("/v1/orders")
async def create_order(request: Request) -> JSONResponse:
    return stub_response(request, "Order creation")


@app.get("/v1/orders/{order_id}")
async def get_order(order_id: str, request: Request) -> JSONResponse:
    return stub_response(request, "Order retrieval")


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
