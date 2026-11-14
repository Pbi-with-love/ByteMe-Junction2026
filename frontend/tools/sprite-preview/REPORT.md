# Sprite Preview Worker Report

## Files created

- `frontend/tools/sprite-preview/parser.mjs`
- `frontend/tools/sprite-preview/parser.test.mjs`
- `frontend/tools/sprite-preview/build.mjs`
- `frontend/tools/sprite-preview/index.js` (directory test-runner entry point)
- `frontend/tools/sprite-preview/REPORT.md`
- `frontend/artifacts/sprite-preview/index.html` (generated, gitignored)

## TDD and tests

- Red: `node --test frontend/tools/sprite-preview/parser.test.mjs` failed on the missing `parser.mjs` import before implementation.
- Green: `node --test frontend/tools/sprite-preview/` — 3 tests passed, 0 failed.
- Build: `node frontend/tools/sprite-preview/build.mjs` — generated 109 grids and 33 palette entries.

## Grids rendered by source

- `docs/design/010-game-world.md`: 25
- `docs/design/011-character-art.md`: 66
- `docs/design/005-result-receipt.md`: 6
- `docs/design/006-valio-view.md`: 6
- `docs/design/007-replay-comparison.md`: 6

## Problems found (preserved from source)

- `heart` — `docs/design/007-replay-comparison.md` — unknown palette key `O` at row 2, column 5.

No unequal row lengths or stated-size mismatches were found.

## Playwright verification

`playwright-cli open file:///Users/camlynh/Documents/Anh_Tai/temp/Junction-2026/frontend/artifacts/sprite-preview/index.html` was blocked by the CLI's file-protocol policy. Served the standalone artifact with `python3 -m http.server 5179 --directory frontend/artifacts/sprite-preview` and opened `http://127.0.0.1:5179/index.html` in a fresh named session. Checked scale sizes at 4×/8×/12×, light/dark/kitchen-floor backgrounds, play/pause, reduced-motion static behavior, 1920×1080 viewport, no console errors, and no external requests. The local server was stopped after verification.

Screenshots (all 1920×1080):

- `frontend/artifacts/screenshots/sprite-preview/overview.png`
- `frontend/artifacts/screenshots/sprite-preview/robot-8x.png`
- `frontend/artifacts/screenshots/sprite-preview/characters-manager-courier.png`
- `frontend/artifacts/screenshots/sprite-preview/stations-decor.png`
- `frontend/artifacts/screenshots/sprite-preview/particles-stars-comparison.png`
- `frontend/artifacts/screenshots/sprite-preview/palette.png`
- `frontend/artifacts/screenshots/sprite-preview/problems.png`

No files were committed.
