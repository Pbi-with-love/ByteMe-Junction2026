---
name: codex-tdd-implement
description: >-
  Codex-only skill for every coding and bug-fix task. Enforces strict
  Red-Green-Refactor TDD, scope boundaries, and clean test verification. Codex
  must read and follow this skill for every implementation and bug-fix task.
---

# Codex TDD Implementation

## Mandatory Rules
- Never write production code for a requirement before a failing test for that requirement exists.
- Never delete, skip (`it.skip`, `test.skip`), or weaken an existing test to make the suite pass.
- Stay strictly inside the spec's assigned `May edit` paths.

## Steps
1. **Read context**: Check the spec's acceptance criteria and `docs/memory/CONVENTIONS.md`. Confirm this skill has been read before editing production code.
2. **Red**: Write minimal failing test(s) covering the acceptance criteria. Run the test command and confirm it fails for the expected reason (missing behavior, not syntax/import error).
3. **Green**: Implement the simplest clean code to make the test(s) pass.
4. **Refactor**: Clean up duplication or naming while keeping all tests green.
5. **Verify**: Run the full relevant test suite (`Commands.Test`) and capture the exact command and pass/fail counts.

## Output
Return:
- List of files created/modified
- Exact test command executed and pass/fail summary
- Any assumptions or edge cases noticed
