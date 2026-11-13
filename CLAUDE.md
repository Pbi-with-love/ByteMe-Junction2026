# Junction 2026 — Hackathon

Topic: TBD. Fill `docs/memory/ARCHITECTURE.md` and `docs/memory/STATUS.md` once chosen.

## Roles
- **Claude (Opus 5.5) = spec writer + orchestrator.** Writes specs, dispatches, reviews. Never writes feature code itself.
- **Antigravity = worker.** Design, code, TDD, `playwright-cli`. One worker per task.

## Workflow
0. If the topic/tech is unclear, first delegate to the `researcher` subagent (haiku) for case studies/tech options; it writes `docs/memory/research/*`. (Subagents can't spawn subagents, so the orchestrator calls researcher, then spec-writer.)
1. Delegate to the `spec-writer` subagent to write `docs/specs/NNN-<slug>.md` (from `docs/specs/TEMPLATE.md`). Review it before dispatching. The main session is the orchestrator; never make it a subagent (it must end its turn so Orca can wake it).
2. Dispatch (Orca workers only, never Claude subagents):
   `orca orchestration worker-start --spec-file docs/specs/NNN-<slug>.md --worktree current --agent antigravity`
   - One worker at a time: `--worktree current`.
   - Two or more workers at once: every one gets `--worktree new-child --name <slug>`, even with disjoint files (a shared checkout makes each worker's `git diff` show the others' changes).
   - Before any `new-child` dispatch, commit `docs/specs/` and `docs/memory/`: a new worktree only sees committed files.
   - After a `new-child` worker settles: merge its branch into `main` yourself (resolve conflicts or `send` them back), then `worker-release` it.
   - Start all independent workers, then **end the turn**. Orca wakes you. Never poll.
3. On wake: answer `question`s with `orca orchestration reply`; steer with `orca orchestration send --to dispatch:<id>`.
4. On `worker_done`: check the evidence against the spec (files in scope, test command + counts, screenshots if UI). The Argon Lead already re-ran tests, so re-run them yourself only when evidence is missing or contradictory.
5. Update `docs/memory/STATUS.md` (done / in progress / blockers).

## Multi-task (DAG)
Guide: `orca skills get orchestration` (+ `--reference references/coordinator-loop.md`).
```
orca orchestration run-create --objective "<goal>"
orca orchestration task-create --spec "<work>" --deps '[]'          # deps = JSON array of task ids
orca orchestration task-list --ready --brief
orca orchestration worker-start --task <task_id> --worktree current --agent antigravity
```
- On every wake, start every Task that `task-list --ready` shows, then end the turn.
- When several ready Tasks start together, each gets `--worktree new-child --name <slug>` (same rules as step 2: commit specs first, merge + release after).
- Later `run-create` keeps older Runs; pass `--run <id>` for non-newest ones.
- Antigravity's own internal subagents are its business: Claude only sees the one worker's `worker_done`.
  Specs must say "report one consolidated result" and list per-subtask evidence inside it.
- Stuck/failed worker: `worker-show`, `worker-read`, then `send`; see `--reference references/recovery-and-cleanup.md`. Never mark a failed Task completed.

## Rules
- Specs are self-contained: goal, acceptance criteria, editable files, test command, evidence required.
- TDD: worker writes a failing test first, then code.
- Keep `docs/memory/*` current; read it before writing a new spec.
- Fix requests go back to the worker via `send`, not done by Claude.
