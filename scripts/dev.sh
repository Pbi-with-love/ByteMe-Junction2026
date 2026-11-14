#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

check_port_number() {
  local name="$1"
  local port="$2"
  if [[ ! "$port" =~ ^[0-9]+$ ]] || ((port < 1 || port > 65535)); then
    fail "$name must be a TCP port from 1 to 65535 (got '$port')."
  fi
}

check_port_number BACKEND_PORT "$BACKEND_PORT"
check_port_number FRONTEND_PORT "$FRONTEND_PORT"

if [[ ! -x "$ROOT_DIR/.venv/bin/uvicorn" ]]; then
  fail "Backend environment is missing .venv/bin/uvicorn. Create it with: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
fi

if [[ ! -d "$ROOT_DIR/frontend/node_modules" ]]; then
  printf 'frontend/node_modules is missing. Run npm ci in frontend? [y/N] '
  if [[ -t 0 ]]; then
    read -r answer
  else
    answer="n"
  fi
  case "$answer" in
    y|Y|yes|YES)
      (cd "$ROOT_DIR/frontend" && npm ci)
      ;;
    *)
      fail "Install frontend dependencies with: cd frontend && npm ci"
      ;;
  esac
fi

if [[ ! -f "$ROOT_DIR/.env" ]]; then
  fail "Root .env is missing. Copy .env.example to .env and fill the required keys."
fi

port_processes() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
  fi
}

check_port_free() {
  local name="$1"
  local port="$2"
  local processes
  processes="$(port_processes "$port")"
  if [[ -n "$processes" ]]; then
    printf '%s\n' "$processes" >&2
    fail "$name port $port is already listening. Stop the process above or choose another port with $name."
  fi

  if ! command -v lsof >/dev/null 2>&1; then
    if ! command -v nc >/dev/null 2>&1; then
      fail "Cannot check whether port $port is free: install lsof or nc."
    fi
    if nc -z -w 1 127.0.0.1 "$port" >/dev/null 2>&1 || nc -z -w 1 ::1 "$port" >/dev/null 2>&1; then
      fail "$name port $port is already accepting connections (process unavailable; install lsof to identify it). Choose another port with $name."
    fi
  fi
}

check_port_free BACKEND_PORT "$BACKEND_PORT"
check_port_free FRONTEND_PORT "$FRONTEND_PORT"

TEMP_BASE="${TMPDIR:-/tmp}"
LOG_DIR="$(mktemp -d "$TEMP_BASE/agent-kitchen-dev.XXXXXX")" || fail "Could not create a temporary log directory under $TEMP_BASE."
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"
BACKEND_PID=""
FRONTEND_PID=""

stop_children() {
  local exit_code=$?
  trap - INT TERM EXIT
  if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill -TERM "$FRONTEND_PID" 2>/dev/null || true
  fi
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill -TERM "$BACKEND_PID" 2>/dev/null || true
  fi
  if [[ -n "$FRONTEND_PID" ]]; then wait "$FRONTEND_PID" 2>/dev/null || true; fi
  if [[ -n "$BACKEND_PID" ]]; then wait "$BACKEND_PID" 2>/dev/null || true; fi
  exit "$exit_code"
}
trap stop_children INT TERM EXIT

printf 'Logs: %s\n' "$LOG_DIR"
(cd "$ROOT_DIR" && "$ROOT_DIR/.venv/bin/uvicorn" backend.app.main:app --host 127.0.0.1 --port "$BACKEND_PORT") >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
(cd "$ROOT_DIR/frontend" && VITE_GATEWAY_URL="http://127.0.0.1:$BACKEND_PORT" ./node_modules/.bin/vite --host 127.0.0.1 --port "$FRONTEND_PORT" --strictPort) >"$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!

DISCOVERY_URL="http://127.0.0.1:$BACKEND_PORT/.well-known/agent-commerce.json"
deadline=$((SECONDS + 30))
until [[ "$(curl -sS -o /dev/null -w '%{http_code}' "$DISCOVERY_URL" 2>/dev/null || true)" == "200" ]]; do
  if ((SECONDS >= deadline)) || ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    printf 'Backend did not answer discovery with HTTP 200 within 30 seconds. Recent backend log:\n' >&2
    tail -n 40 "$BACKEND_LOG" >&2 || true
    exit 1
  fi
  sleep 0.5
done

printf '\nBackend:  http://127.0.0.1:%s\n' "$BACKEND_PORT"
printf 'Frontend: http://127.0.0.1:%s\n' "$FRONTEND_PORT"
printf 'Open the frontend URL; the bottom-left badge must show “Live gateway”.\n'
printf 'Press Ctrl+C to stop both services.\n'
wait "$BACKEND_PID" "$FRONTEND_PID"
