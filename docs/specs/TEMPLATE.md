# Spec NNN: <title>

## Goal
<one or two sentences>

## Acceptance criteria
- [ ] ...

## Assumptions
- ...

## Scope
- May edit: <paths>
- Must not touch: <paths>

## Boundaries
- Always: run tests before reporting, follow docs/memory/CONVENTIONS.md
- Ask first (via `orca orchestration ask`): new dependencies, schema changes, edits outside scope
- Never: commit secrets, delete failing tests

## Open questions
- ...

## Approach (TDD)
1. Write failing test(s) for the criteria above.
2. Implement until green.
3. UI work: verify with `playwright-cli` (list the flows to check).

## Commands
- Test: `<cmd>`
- Run: `<cmd>`

## Playwright
UI flows to verify with `playwright-cli` (omit if no UI). Screenshots go to `artifacts/screenshots/<spec-id>/`.
1. <url> -> <action> -> <expected>

## Evidence required in worker_done
- Files changed
- Test output (pass/fail counts)
- Playwright screenshots/paths (if UI)
- Open issues / assumptions

## Failure semantics
Non-zero test exit = Task failed (not a deliverable).
