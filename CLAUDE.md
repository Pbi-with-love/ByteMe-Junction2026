# Junction 2026 — Hackathon

Topic: TBD. Fill `docs/memory/ARCHITECTURE.md` and `docs/memory/STATUS.md` once chosen.

## Roles
- **Claude (Opus 5.5) main session = orchestrator.** Dispatches, reviews, merges, updates STATUS. Never writes feature code; never becomes a subagent (it must end its turn so Orca can wake it).
- **`spec-writer` / `researcher` = Claude subagents** (Opus / Haiku). Spec-writer writes `docs/specs/*`; researcher writes `docs/memory/research/*`.
- **Antigravity (Argon) = design only** (`--agent antigravity`, rules in `GEMINI.md`). Writes a design handoff file; no code, no tests.
- **Codex (GPT-6 Luna) = everything else** (`--agent codex`, rules in `CODEX.md`): code, TDD, tests, `playwright-cli`, integration.

## Workflow (sequential, one worker at a time)
0. Topic/tech unclear -> orchestrator calls `researcher` first. (Subagents can't spawn subagents, so the orchestrator calls researcher, then spec-writer.)
1. Delegate to `spec-writer` -> `docs/specs/NNN-<slug>.md` (from `docs/specs/TEMPLATE.md`). Review it, commit it.
2. **UI spec only — design step.** Dispatch Argon, wait for `worker_done`, check `docs/design/NNN-<slug>.md` exists and answers the spec's `## Design` brief:
   `orca orchestration worker-start --spec "Read GEMINI.md, then docs/specs/NNN-<slug>.md. Design only. Write the handoff to docs/design/NNN-<slug>.md." --worktree current --agent antigravity`
   Non-UI spec: skip this step.
3. **Implementation step.** Dispatch Codex, then **end the turn**:
   `orca orchestration worker-start --spec "Read CODEX.md, then docs/specs/NNN-<slug>.md (and docs/design/NNN-<slug>.md if it exists). Implement it." --worktree current --agent codex`
   Always begin the spec text with "Read GEMINI.md" / "Read CODEX.md": Codex auto-reads `AGENTS.md`, Antigravity does not auto-read `CODEX.md`.
4. On wake: answer `question`s with `orca orchestration reply`; steer with `orca orchestration send --to dispatch:<id>`. Never poll.
5. On `worker_done`: check the evidence against the spec (files in scope, test command + counts, screenshots if UI). Re-run tests yourself only when evidence is missing or contradictory. Fixes go back to the worker via `send`.
6. Commit the result, update `docs/memory/STATUS.md` (one line per spec: id | state | evidence).

## Parallel / multi-task (only when you choose it)
Guide: `orca skills get orchestration` (+ `--reference references/coordinator-loop.md`).
- Two or more workers at once: each gets `--worktree new-child --name <slug>`. Commit `docs/specs/`, `docs/design/`, `docs/memory/` first (a new worktree only sees committed files). After a worker settles: merge its branch into `main` yourself, then `worker-release`.
- DAG: `run-create --objective ...`, `task-create --spec ... --deps '[]'`, `task-list --ready --brief`, `worker-start --task <id> --worktree current --agent <antigravity|codex>`. Make the Codex task depend on its Argon design task. On every wake start every ready Task, then end the turn.
- Later `run-create` keeps older Runs; pass `--run <id>` for non-newest ones.
- Workers' internal subagents are their business: Claude sees one `worker_done` per Task.
- Stuck/failed worker: `worker-show`, `worker-read`, then `send`; see `--reference references/recovery-and-cleanup.md`. Never mark a failed Task completed.

## Rules
- Specs are self-contained: goal, acceptance criteria, editable files, test command, evidence required, and (UI) a design brief.
- TDD: Codex writes a failing test first, then code.
- Keep `docs/memory/*` current; read it before writing a new spec.
