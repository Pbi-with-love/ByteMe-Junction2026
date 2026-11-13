---
name: codex-playwright-verify
description: >-
  Use whenever a subtask touches UI, frontend routes, or user flows. Runs
  Codex-only UI verification skill. Runs playwright-cli against the running
  app, verifies interactive flows and console health, and captures screenshots.
  Codex must read and follow this skill for every UI or user-flow change.
---

# Codex Playwright Verification (`playwright-cli`)

## Mandatory Use
Use for every task that changes UI, frontend routes, or user flows, even if the spec does not explicitly list Playwright flows. Read this skill before running verification.

## Steps
1. **Ensure app is running**: Use the spec's `Commands.Run` (or check if the dev server is already listening on the expected port).
2. **Prepare screenshot directory**: Save screenshots under `artifacts/screenshots/<spec-id>/` (e.g., `artifacts/screenshots/001-login/`).
3. **Execute flows with `playwright-cli`**:
   - Navigate to the target URL(s).
   - Verify key elements, interactions, and state transitions listed in the spec.
   - Check for uncaught page errors or failed network requests.
   - Capture screenshots at key states (initial render, after interaction, error/empty state if specified).
4. **Clean up**: Stop any background dev server you started if it is not meant to stay running.

## Output
Return:
- Exact `playwright-cli` commands / test script run and pass/fail result
- Exact file paths to all captured screenshots
- Any visual, console, or network issues observed
