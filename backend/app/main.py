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
    return stub_response(request, "Token creation")


@app.post("/v1/mandates")
async def create_mandate(request: Request) -> JSONResponse:
    return stub_response(request, "Mandate creation")


@app.get("/v1/mandates/{mandate_id}")
async def get_mandate(mandate_id: str, request: Request) -> JSONResponse:
    return stub_response(request, "Mandate retrieval")


@app.post("/v1/mandates/{mandate_id}/revoke")
async def revoke_mandate(mandate_id: str, request: Request) -> JSONResponse:
    return stub_response(request, "Mandate revocation")


@app.post("/v1/search")
async def search(request: Request) -> JSONResponse:
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
async def get_log(request: Request) -> JSONResponse:
    return stub_response(request, "Audit log")


@app.get("/v1/log/verify")
async def verify_log(request: Request) -> JSONResponse:
    return stub_response(request, "Audit log verification")


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
