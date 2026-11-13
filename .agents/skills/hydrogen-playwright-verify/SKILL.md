---
name: hydrogen-playwright-verify
description: >-
  Use whenever a subtask touches UI, frontend routes, or user flows. Runs
  playwright-cli against the running app, verifies interactive flows and console
  health, and captures screenshot evidence for the Hydrogen Lead and Claude
  Orchestrator.
---

# Hydrogen Playwright Verification (`playwright-cli`)

## When to Use
Any time the spec includes UI changes or lists `playwright-cli` flows.

## Steps
1. **Ensure app is running**: Use the spec's `Commands.Run` (or check if the dev server is already listening on the expected port).
2. **Prepare screenshot directory**: Save screenshots under `artifacts/screenshots/<spec-id>/` (e.g., `artifacts/screenshots/001-login/`).
3. **Execute flows with `playwright-cli`**:
   - Navigate to the target URL(s).
   - Verify key elements, interactions, and state transitions listed in the spec.
   - Check for uncaught page errors or failed network requests.
   - Capture screenshots at key states (initial render, after interaction, error/empty state if specified).
4. **Clean up**: Stop any background dev server you started if it is not meant to stay running.

## Output to Hydrogen Lead
Return:
- Exact `playwright-cli` commands / test script run and pass/fail result
- Exact file paths to all captured screenshots
- Any visual, console, or network issues observed
