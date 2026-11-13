---
name: argon-sub-orchestrator
description: >-
  Use as the Antigravity Argon Worker Lead when executing an Orca spec from
  docs/specs/. Governs reading shared memory, decomposing the spec into
  subtasks for Argon (design) and Hydrogen (implement, TDD, testing,
  playwright-cli) subagents, verifying all outputs personally, and sending one
  consolidated worker_done report to the Claude Orchestrator.
---

# Argon Sub-Orchestrator Workflow

Follow this workflow whenever you receive an Orca task spec from the Claude Orchestrator.

## 1. Load Shared Memory & Spec
1. Read `docs/specs/NNN-<slug>.md`.
2. Read `docs/memory/ARCHITECTURE.md`, `docs/memory/CONVENTIONS.md`, `docs/memory/STATUS.md`, and `docs/memory/GLOSSARY.md` (if present).
3. Extract:
   - `Acceptance criteria`
   - `Scope` (`May edit` and `Must not touch`)
   - `Commands` (`Test`, `Run`)
   - `Playwright` UI flows (if any)
   - `Boundaries` (`Ask first` triggers)

## 2. Decompose & Route by Role/Model
Split the spec into non-overlapping subtasks (disjoint file sets so parallel subagents never conflict):

- **Design Subtask (Argon + `gemini-frontend-design` skill)** — whenever the spec involves UI, layout, styling, or UX:
  - Produces design tokens, layout/component structure, responsive & accessibility states, and clear UI selectors/states for testing.
- **Implementation + TDD + Test Subtask (Hydrogen + `hydrogen-tdd-implement` skill)**:
  - Writes failing tests first (Red), implements minimal code (Green), refactors, and runs unit/integration tests.
- **Playwright Verification Subtask (Hydrogen + `hydrogen-playwright-verify` skill)** — whenever the spec touches UI:
  - Runs `playwright-cli` against the running app, verifies flows & console/network health, and saves screenshots under `artifacts/screenshots/<spec-id>/`.

Every subagent prompt **must** include:
- Exact `May edit` and `Must not touch` file paths.
- Relevant conventions from `docs/memory/CONVENTIONS.md`.
- Which skill to activate (`gemini-frontend-design`, `hydrogen-tdd-implement`, or `hydrogen-playwright-verify`).
- Instruction: *"Do NOT call `orca` orchestration commands or `worker_done`; report your changed files, test output, and screenshot paths back to me."*

## 3. Argon Lead Verification Gate (Mandatory Before `worker_done`)
Once all internal subagents finish:
1. Check `git status` and `git diff --name-only` — confirm **no** files outside `Scope.May edit` were modified and no failing tests were deleted.
2. Re-run the full `Commands.Test` from the spec yourself. Confirm exit code `0` and record exact pass/fail counts.
3. If the spec includes UI work, verify the `playwright-cli` flows and confirm screenshot files exist on disk.
4. If any check fails, fix it (or send back to the responsible subagent) before reporting. Never report `worker_done` with failing tests unless the spec explicitly states failure is the deliverable.

## 4. Report One Consolidated Result
Send a single `worker_done` report to Claude matching `docs/specs/TEMPLATE.md`:
- **Files changed**
- **Per-subtask summary & evidence** (Argon Design / Hydrogen TDD & Tests / Hydrogen Playwright)
- **Test output** (command + pass/fail counts)
- **Playwright screenshots/paths** (if UI)
- **Open issues / assumptions**
