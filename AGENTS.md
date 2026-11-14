# Agent routing (read first)

- **Codex (GPT-6 Luna):** follow `CODEX.md`. You own code, TDD, tests, `playwright-cli`.
- **Antigravity / Gemini (Argon):** follow `GEMINI.md`. Design only; ignore `CODEX.md`.
- **Claude:** follow `CLAUDE.md`.

Shared: `docs/memory/*` (read-only for workers), `docs/specs/*` (read-only unless the spec says otherwise), design handoffs in `docs/design/`.

## Scope rule (all agents)

Work **only inside `frontend/`**. Do not create, edit or delete anything in `backend/`, `gateway/`, `agent/` or the repo root. The gateway is called over HTTP per `docs/design/API.md`; mock it inside `frontend/` if it is not up. Only exception: the docs your role already owns (`docs/specs/*`, `docs/design/*`, `docs/memory/*`).
