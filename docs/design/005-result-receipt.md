# Design Handoff — 005: Result + Receipt (In-Game Pixel Panel, Stars, Incident Variant, Self-Explaining Receipt, Log Hash Badge)

> **Owner:** Antigravity (Argon) · **Implementer:** Codex (GPT-6 Luna)  
> **Scope:** `docs/design/005-result-receipt.md` only. Reuses the pixel art kit, 24-colour palette, `PixelPanel` kit, overlay grid, and `--px` type scale from `docs/design/010-game-world.md` verbatim. Supersedes the prior web-style `005` handoff visually while preserving its copy, states, and accessibility rules.

---

## 1. Design Decisions & Rationale

1. **In-World `PixelPanel` Overlay (Kitchen Stays Visible):**  
   When a run finishes, `010`'s `notice` panel (`"The agent is done."`) offers a primary **`See result`** button before **`Back to levels`**. Activating it opens `ResultPanel` inside the `center` area of `GameWorld`'s overlay grid (`max-width: calc(200 * var(--px))`, `≤ 62.5%` of canvas width), keeping the `hud` strip, `side` Activity Log (`003`), and surrounding pixel kitchen + robot visible.
2. **Five-Second Verdict Above the Scroll (`1920×1080` & `1366×768`):**  
   The panel is a vertical flex container capped to the `center` area height. **Score Board** (3 pixel-segmented RPG/sim gauges, hearts left, 0–3 gold pixel medal stars), **Log Hash Badge**, and **Action Buttons** are `flex-shrink: 0` so they always fit without scrolling at both `1080p` and `768p`. Only the **Printed Till-Slip Receipt** middle zone scrolls internally (`overflow-y: auto`) when the buyer log is long.
3. **Safety Incident as an Unmistakable Failure (`incident` `PixelPanel` Variant):**  
   When `result.incident !== null`, `ResultPanel` switches to the new `incident` `PixelPanel` variant (double-bevel RED `#B91C1C` pixel frame and solid RED header banner, `"Safety incident"`, `incident.reason`, `incident.productId`, `0 of 3 stars`) while `KitchenScreen` simultaneously sets the robot to `RED` (`stop` emote) in the visible kitchen. The receipt stays below so the player and jury can trace *why* the incident happened.
4. **Printed Till-Slip Receipt & Zero Frontend Math:**  
   `receiptText` appears verbatim as the headline narrative on a `#F8FAFC` till-slip block with a serrated CSS pixel-perforated top edge and inner paper shadow, followed by the buyer audit log `<ol>` in `seq` order with `LightBadge` (`003`). Scores, stars, hearts, and hash verification come strictly from gateway responses; every hash badge state pairs a semantic token with a distinct 12×12 pixel icon and explicit copy.

---

## 2. Reused `010` Kit & Marked Additions

Reuse all 24 palette keys (`src/world/palette.ts`), `@theme` tokens (`src/index.css`), `--px` scaling (`6px` at `1920×1080`, `4px` at `1366×768`), `PixelPanel` base frame, and `LightBadge` (`003`) **unchanged**.

### 2.1 Marked CSS Token Additions (`frontend/src/index.css` `@theme`)
All additions map strictly to existing `010` §2 palette hexes so zero off-palette colours are introduced:

```css
  /* === Spec 005 Additions (append inside @theme in src/index.css) === */
  --color-meter-track: #D6E3F0;   /* Palette `g` — unfilled pixel score bar track */
  --color-receipt-paper: #F8FAFC; /* Palette `p` — till-slip paper background */
  --color-receipt-edge: #94A3B8;  /* Palette `m` — perforated edge & dashed divider */
```

### 2.2 Marked `PixelPanel` Variant Addition (`src/components/PixelPanel.tsx`)
Add `'incident'` to the `PixelPanel` variant union (`'clipboard' | 'terminal' | 'notice' | 'alert' | 'incident'`):
- **Role & a11y:** `role="dialog" aria-modal="false"` (identical to `010` AC13; `<h2>` receives focus on open via `tabIndex={-1}`).
- **Outer Frame & Bevel:** `border: calc(1 * var(--px)) solid var(--color-light-red)` (`#B91C1C`), `box-shadow: var(--shadow-pixel)` (`calc(1 * var(--px)) calc(1 * var(--px)) 0 #0B1B33`), `border-radius: 0`, `background: var(--color-surface)` (`#FFFFFF`).
- **Header Bar:** Full-bleed `background: var(--color-light-red)` (`#B91C1C`), `color: #FFFFFF` (`6.47:1` contrast, passes AA & Large AAA), `border-bottom: calc(0.5 * var(--px)) solid var(--color-ink)` (`#0B1B33`), `box-shadow: inset 0 calc(0.5 * var(--px)) 0 rgba(255,255,255,0.25)` (crisp top pixel highlight), `padding: calc(2.5 * var(--px)) calc(3.5 * var(--px))`, containing the 12×12 `badge_mismatch` pixel icon (`aria-hidden="true"`) + `<h2>` `"Safety incident"`.
- **Incident Detail Strip:** Directly below the header, `background: var(--color-light-red-bg)` (`#FEE2E2`), `border-bottom: calc(0.5 * var(--px)) solid var(--color-light-red)` (`#B91C1C`), `padding: calc(2 * var(--px)) calc(3.5 * var(--px))`, displaying `incident.reason` (`var(--color-ink)` `#0B1B33`, `15.2:1`) and `"Product ID"` + `incident.productId` (`--font-mono`, `var(--color-light-red)` `#B91C1C` on `#FFFFFF` pill with `calc(0.5 * var(--px)) solid var(--color-light-red)` border, `5.9:1`).

### 2.3 Contrast Verification Summary
| Pair | Ratio | Standard |
|---|---|---|
| `--color-ink` (`#0B1B33`) on `--color-surface` (`#FFFFFF`) | **17.23:1** | Exceeds AAA (7:1) |
| `--color-ink` (`#0B1B33`) on `--color-receipt-paper` (`#F8FAFC`) | **16.47:1** | Exceeds AAA (7:1) |
| `--color-ink-muted` (`#475569`) on `--color-surface` (`#FFFFFF`) | **7.50:1** | Exceeds AAA (7:1) |
| `#FFFFFF` on `--color-light-red` (`#B91C1C`) (incident header) | **6.47:1** | Passes AA (4.5:1) |
| `--color-light-red` (`#B91C1C`) on `--color-light-red-bg` (`#FEE2E2`) | **5.30:1** | Passes AA (4.5:1) |
| `--color-light-green` (`#15803D`) on `--color-light-green-bg` (`#DCFCE7`) | **4.57:1** | Passes AA (4.5:1) |
| `--color-error-ink` (`#881337`) on `--color-error-surface` (`#FDF2F5`) | **8.74:1** | Exceeds AAA (7:1) |

---

## 3. Marked Pixel Art Additions (`src/world/art.ts` & UI Icons)

All grids follow `010` AC8 grid rules: equal row lengths, `.` = transparent, and characters from `010` §2 palette keys only (`o` `#0B1B33`, `w` `#FFFFFF`, `u` `#D49B6A`, `n` `#9C663B`, `k` `#475569`, `G` `#15803D`, `1` `#DCFCE7`, `R` `#B91C1C`, `4` `#FEE2E2`, `e` `#881337`, `a` `#FDF2F5`). Neither star uses `Y` (`#A16207`), keeping `Y` strictly reserved for policy `YELLOW` outcomes.

### 3.1 Star Sprites (`src/world/art.ts`, 16×16 — AC15)
`star_on` (solid gold medal with `w` specular glint and `n` bevel) and `star_off` (hollow outline in `k`) are shape-distinct.

**`star_on` (16×16)**
```text
.......oo.......
......ouuo......
......owuo......
.....oowuoo.....
.ooooowuuunoooo.
owwwuuuuuuuuunno
.owuuuuuuuuunno.
..owuuuuuuuuno..
...ouuuuuuuno...
...ouuuuuuuno...
..ouuuunonuuuo..
..ouunno.onuuo..
.ouuno.....onuo.
.oono.......ono.
.oo...........oo
................
```

**`star_off` (16×16)**
```text
.......kk.......
......k..k......
......k..k......
.....kk..kk.....
.kkkkk....kkkkk.
k..............k
.k............k.
..k..........k..
...k........k...
...k........k...
..k....kk....k..
..k...k..k...k..
.k..kk....kk..k.
.kkk........kkk.
.kk...........kk
................
```

### 3.2 Hash Badge & Incident Pixel Icons (`ResultPanel` UI, 12×12)
Rendered via `PixelSprite` (`viewBox="0 0 12 12"`, `shape-rendering="crispEdges"`, `aria-hidden="true"`) at `calc(3.5 * var(--px))` (`21px` at `1080p`, `14px` at `768p`) so every badge state has a distinct pixel silhouette:

**`badge_verified` (12×12 — green seal + check)**
```text
...oooooo...
..oGGGGGGoo.
.oG111111Go.
oG111111w1Go
oG11111ww1Go
oG1w11ww11Go
oG1wwwww11Go
oG11www111Go
.oG11w111Go.
.oG111111Go.
..oGGGGGGoo.
...oooooo...
```

**`badge_tampered` (12×12 — red seal + X)**
```text
...oooooo...
..oRRRRRRoo.
.oR444444Ro.
oR4ww44ww4Ro
oR4www4ww4Ro
oR44wwww44Ro
oR44wwww44Ro
oR4ww4www4Ro
oR4ww44ww4Ro
.oR444444Ro.
..oRRRRRRoo.
...oooooo...
```

**`badge_mismatch` (12×12 — red octagon + `!`)**
```text
...oooooo...
..oRRRRRRo..
.oR44ww44Ro.
oR444ww444Ro
oR444ww444Ro
oR444ww444Ro
oR444ww444Ro
oR44444444Ro
oR444ww444Ro
.oR44ww44Ro.
..oRRRRRRo..
...oooooo...
```

**`badge_error` (12×12 — alert-rose triangle + `!`)**
```text
.....oo.....
....oeeo....
....oeeo....
...oewweo...
...oewweo...
..oeewweeo..
..oeeaeeeo..
.oeeewweeeo.
.oeeeeeeeeo.
oeeeeeeeeeeo
oooooooooooo
............
```

### 3.3 DOM Rendering (`src/components/PixelSprite.tsx` & `Stars`)
- Reuse `004`'s DOM pixel-grid SVG renderer if already present; otherwise render via `PixelSprite` (`<svg shape-rendering="crispEdges" aria-hidden="true">` with `1×1` `<rect>`s).
- Stars display size: `calc(5 * var(--px))` (`30px` at `1080p`, `20px` at `768p`).
- Hearts: reuse `004`'s heart sprite/icon at `calc(4 * var(--px))` (`24px` at `1080p`, `16px` at `768p`), `aria-hidden="true"`.

---

## 4. Typography (`--px` Scale from `010` §7)

No visible text may be smaller than `calc(4 * var(--px))` (`24px` at `1080p`, `16px` at `768p`).

| Role | Token / Size | At `1920×1080` (`--px: 6px`) | At `1366×768` (`--px: 4px`) | Font |
|---|---|---|---|---|
| Panel Heading (`<h2>`: `"Result"` / `"Safety incident"`) | `calc(5 * var(--px))` | `30px` | `20px` | `Press Start 2P` |
| Score Numbers (`100`, `97`), Stars/Hearts text, `receiptText`, Meter Labels, Log Rows, Badge, Buttons | `calc(4 * var(--px))` | `24px` | `16px` | `Pixelify Sans` (`tabular-nums` for numbers & timestamps) |

---

## 5. Layout Specification (`center` Overlay Area)

`ResultPanel` sits inside `GameWorld`'s `center` grid area (`max-width: calc(200 * var(--px))` = `1200px` at `1080p`, `800px` at `768p`; `max-height: calc(100% - 4 * var(--px))`; `display: flex; flex-direction: column`).

### 5.1 Normal State (`notice` variant) — `1920×1080` & `1366×768`
```text
+================================================================+
| Result                              [★][★][★]  3 of 3 stars    |
|                                     [♥][♥][♡]  2 of 3 hearts   |
+----------------------------------------------------------------+
| Kitchen  [████|████|████|████|████]  100                       |  <- flex-shrink: 0
| Wallet   [████|████|████|████|███ ]   97                       |     (never scrolls)
| Safety   [████|████|████|████|████]  100                       |
+----------------------------------------------------------------+
| [✓] Log verified · sha256:802ec1cd4a618ec6 · 6 events          |  <- flex-shrink: 0
+----------------------------------------------------------------+
| ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ |  <- CSS pixel perforation
| RECEIPT                                                        |
| "Your agent bought 700 l of Valio lactose-free milk and…"      |  <- flex: 1 1 auto
| - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  |     overflow-y: auto
| Audit log                                                      |     (scrolls internally)
| 1. 10:01  gateway  [Green]  Mandate mdt_01 signed…             |
| 2. 10:02  agent             Searched catalog: 4 products…      |
+----------------------------------------------------------------+
| [Play again]  [See it from Valio Aimo’s side]  [Compare presets]| <- flex-shrink: 0
+================================================================+
```

- **Header + Stars/Hearts (`flex-shrink: 0`):**
  - Left: `<h2>` (`tabIndex={-1}`): `"Result"`.
  - Right: Stars group (`aria-label="{stars} of 3 stars"` with 3 `star_on`/`star_off` `PixelSprite`s) and Hearts group (heart sprites + `"{heartsLeft} of {startHearts} hearts left"`).
- **Pixel-Segmented Score Meters (`flex-shrink: 0`, `gap: calc(1.5 * var(--px))`):**
  - 3 rows (`Kitchen`, `Wallet`, `Safety`), CSS grid `grid-template-columns: calc(18 * var(--px)) 1fr calc(8 * var(--px))`, `align-items: center`.
  - Track: `<div role="meter" aria-label={name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>` with `height: calc(4 * var(--px))`, `background: var(--color-meter-track)` (`#D6E3F0`), `border: calc(0.5 * var(--px)) solid var(--color-border-strong)` (`#0B1B33`), `box-shadow: inset 0 calc(0.5 * var(--px)) 0 rgba(11,27,51,0.12)`, `border-radius: 0`.
  - Fill: `background: var(--color-brand)` (`#0052B4`) with a crisp top highlight (`box-shadow: inset 0 calc(0.5 * var(--px)) 0 var(--color-sky)`) and `1px`-stepped segment ticks (`background-image: repeating-linear-gradient(90deg, transparent 0 calc(3.5 * var(--px)), rgba(11,27,51,0.18) calc(3.5 * var(--px)) calc(4 * var(--px)))`).
  - Numeric value: `{value}` (`tabular-nums`, `font-weight: 700`, right-aligned).
- **Log Hash Badge (`role="status"`, `flex-shrink: 0`):** Full width, `padding: calc(1.5 * var(--px)) calc(2.5 * var(--px))`, `border: calc(0.5 * var(--px)) solid ...`, `box-shadow: calc(0.5 * var(--px)) calc(0.5 * var(--px)) 0 rgba(11,27,51,0.15)`.
- **Printed Till-Slip Receipt (`<section aria-label="Receipt" tabIndex={0}>`, `flex: 1 1 auto; min-height: calc(28 * var(--px)); overflow-y: auto`):**
  - `background: var(--color-receipt-paper)` (`#F8FAFC`), `border: calc(0.5 * var(--px)) solid var(--color-receipt-edge)` (`#94A3B8`), `box-shadow: inset 0 calc(1 * var(--px)) 0 #D6E3F0`, `padding: calc(2.5 * var(--px)) calc(3 * var(--px))`.
  - Perforated pixel teeth along the top edge: `calc(1 * var(--px))` tall strip using `repeating-linear-gradient(90deg, var(--color-receipt-edge) 0 calc(1 * var(--px)), transparent calc(1 * var(--px)) calc(2 * var(--px)))`.
  - `"Receipt"` overline (`uppercase`, `color: var(--color-ink-muted)`), `result.receiptText` verbatim, dashed divider (`border-top: calc(0.5 * var(--px)) dashed var(--color-receipt-edge)`), `"Audit log"` subheading, and `<ol>` in `seq` order (`formatTime(event.at)`, `event.actor`, `<LightBadge light={event.light} />` only when `light !== null`, `event.summary`).
- **Action Buttons (`flex-shrink: 0`, `flex-wrap: wrap`, `gap: calc(2 * var(--px))`):**
  - `"Play again"` (`primary` button, always rendered).
  - `"See it from Valio Aimo’s side"` (`ghost` button, rendered only when `onValioView` is passed).
  - `"Compare presets"` (`ghost` button, rendered only when `onCompare` is passed).

### 5.2 Incident State (`incident` variant, `result.incident !== null`)
- Uses `PixelPanel` `variant="incident"` (RED `#B91C1C` double-bevel frame and solid RED header banner).
- `<h2>` (`tabIndex={-1}`): **`Safety incident`**.
- Incident strip directly below header: `incident.reason` + `"Product ID"` + `incident.productId`.
- Stars display: **`0 of 3 stars`** (three `star_off` sprites) alongside hearts left.
- Score meters (`Kitchen`, `Wallet`, `Safety`) still render with `role="meter"`; any non-zero meter in an incident uses `var(--color-light-red)` (`#B91C1C`) fill with `#FEE2E2` top highlight, and `0` shows the empty `#D6E3F0` track.
- Receipt and Hash Badge render below in full; robot in the visible kitchen shows `RED` (`stop` emote) via `controller.setRobotState('RED')`.

---

## 6. Interactive, Loading, Error & Badge States

### 6.1 Run-Finished Notice → ResultPanel Transition (AC17)
- `010`'s run-finished `notice` panel (`"The agent is done."`) renders `"See result"` (`primary` button) **before** `"Back to levels"` (`ghost` button).
- Activating `"See result"` closes the `notice` and mounts `ResultPanel` in `center`; `ResultPanel`'s `<h2>` receives focus.
- Run-error `alert` panel never offers `"See result"`.

### 6.2 Control States (`010` §8.2)
- **Buttons (`primary`, `ghost`):** `min-height: calc(10 * var(--px))`, `border: calc(0.5 * var(--px)) solid #0B1B33`, `box-shadow: calc(0.75 * var(--px)) calc(0.75 * var(--px)) 0 #0B1B33`.
  - `default`: `primary` (`#0052B4` bg, `#FFFFFF` text); `ghost` (`#FFFFFF` bg, `#0052B4` text).
  - `hover`: `primary` → `#003E8A`; `ghost` → `#E0F2FE`.
  - `active` (pressed): `transform: translate(calc(0.5 * var(--px)), calc(0.5 * var(--px)))`, `box-shadow: calc(0.25 * var(--px)) calc(0.25 * var(--px)) 0 #0B1B33`.
  - `focus-visible`: `outline: none; box-shadow: var(--shadow-focus)`.
  - `disabled`: `opacity: 0.65; cursor: not-allowed`.
- **Scrollable Receipt Container:** `focus-visible` shows `box-shadow: var(--shadow-focus)`. Empty log (`events.length === 0`) renders `"No audit events recorded."`.

### 6.3 Loading & Error States
- **`getResult` pending:** Inside `PixelPanel` (`notice`), `"Loading result…"` (`--color-ink-muted`).
- **`getResult` rejects:** `role="alert"` banner (`--color-error-surface` `#FDF2F5`, `--color-error-ink` `#881337`, `border-left: calc(1.5 * var(--px)) solid --color-error-ink`) with `badge_error` icon, the error message, and `"Play again"` button. **No** meters, stars, or hearts.
- **`getLog("buyer")` rejects (scores succeeded):** Score board, stars, hearts, hash badge, and buttons still render; receipt area shows `receiptText` (if present) and a `role="alert"` banner with the error message instead of `<ol>`.

### 6.4 Log Hash Badge (`role="status"`) — 4 States

| State | Condition | Background | Text, Border & Icon | Exact Copy |
|---|---|---|---|---|
| **Verified** | `verify.valid === true` AND `verify.headHash === result.logHeadHash` | `--color-light-green-bg` (`#DCFCE7`) | `--color-light-green` (`#15803D`) + `badge_verified` | **`Log verified`** · `{headHash}` · `{events} events` |
| **Tampered** | `verify.valid === false` | `--color-light-red-bg` (`#FEE2E2`) | `--color-light-red` (`#B91C1C`) + `badge_tampered` | **`Log tampered: chain broken at event #{brokenAtSeq}`** |
| **Mismatch** | `verify.valid === true` AND `verify.headHash !== result.logHeadHash` | `--color-light-red-bg` (`#FEE2E2`) | `--color-light-red` (`#B91C1C`) + `badge_mismatch` | **`Log does not match this result`** |
| **Verify error** | `verifyLog()` rejects (network/system error, not policy RED) | `--color-error-surface` (`#FDF2F5`) | `--color-error-ink` (`#881337`) + `badge_error` | **`Could not verify log`** |

---

## 7. Micro-Animations & Reduced Motion (`motion/react`)

Wrap with `MotionConfig reducedMotion="user"` (`002`/`010`) and check `useReducedMotion()`:
1. **Panel Entrance:**
   - **Full Motion:** `initial={{ opacity: 0, y: 12 }}`, `animate={{ opacity: 1, y: 0 }}`, `transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}`.
   - **Reduced Motion:** `initial={false}`, `animate={{ opacity: 1, y: 0 }}`, `transition={{ duration: 0 }}`.
2. **Score Bar Fill (`Kitchen`, `Wallet`, `Safety`):**
   - **Full Motion:** `initial={{ width: "0%" }}`, `animate={{ width: `${value}%` }}`, `transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: index * 0.08 }}`.
   - **Reduced Motion:** `initial={{ width: `${value}%` }}`, `animate={{ width: `${value}%` }}`, `transition={{ duration: 0 }}`.
3. **Star Medal Pop (`star_on` sprites):**
   - **Full Motion:** `initial={{ opacity: 0, scale: 0.5 }}`, `animate={{ opacity: 1, scale: 1 }}`, `transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1], delay: 0.16 + index * 0.1 }}`.
   - **Reduced Motion:** `initial={{ opacity: 0 }}`, `animate={{ opacity: 1 }}`, `transition={{ duration: 0.12, ease: "linear" }}` (opacity only, no scale).
4. **Hash Badge Settle:**
   - **Full Motion:** `initial={{ opacity: 0 }}`, `animate={{ opacity: 1 }}`, `transition={{ duration: 0.18, delay: 0.24 }}`.
   - **Reduced Motion:** `initial={false}`, `transition={{ duration: 0 }}`.

---

## 8. Accessibility & Keyboard Order

1. **Focus on Open:** Opening `ResultPanel` from `"See result"` moves focus to `<h2>` (`"Result"` or `"Safety incident"`, `tabIndex={-1}`).
2. **Semantics:**
   - Meters: `role="meter"`, `aria-label` (`"Kitchen"`, `"Wallet"`, `"Safety"`), `aria-valuemin={0}`, `aria-valuemax={100}`, `aria-valuenow={value}`, plus visible numeric text.
   - Stars: container `aria-label="{stars} of 3 stars"`; `PixelSprite`s have `aria-hidden="true"`.
   - Hearts: accessible text `"{heartsLeft} of {startHearts} hearts left"`.
   - Hash badge: `role="status"`. Errors: `role="alert"`.
3. **Keyboard Tab Order:**
   - Scrollable receipt `<section aria-label="Receipt" tabIndex={0}>` → `"Play again"` → `"See it from Valio Aimo’s side"` (if present) → `"Compare presets"` (if present). All controls use `010` §8.2 `--shadow-focus` ring.

---

## 9. Final UI Copy (English, Typographic Apostrophes)

| Element | Exact Copy |
|---|---|
| Run-finished notice CTA | `See result` |
| Loading state | `Loading result…` |
| Normal panel heading (`<h2>`) | `Result` |
| Incident panel heading (`<h2>`) | `Safety incident` |
| Incident product label | `Product ID` |
| Score meter labels | `Kitchen` · `Wallet` · `Safety` |
| Stars text | `{stars} of 3 stars` |
| Hearts text | `{heartsLeft} of {startHearts} hearts left` |
| Receipt heading | `Receipt` |
| Audit log subheading | `Audit log` |
| Empty audit log fallback | `No audit events recorded.` |
| Hash badge — verified | `Log verified` · `{headHash}` · `{events} events` |
| Hash badge — tampered | `Log tampered: chain broken at event #{brokenAtSeq}` |
| Hash badge — mismatch | `Log does not match this result` |
| Hash badge — verify error | `Could not verify log` |
| Primary CTA | `Play again` |
| Optional Valio CTA | `See it from Valio Aimo’s side` |
| Optional Compare CTA | `Compare presets` |

---

## 10. Assumptions & Implementation Notes

- `LightBadge` is imported from `src/components/LightBadge.tsx` (`003`); `formatTime(event.at)` from `src/lib/format.ts` (Europe/Helsinki).
- No local calculation of scores, stars, hearts, or hashes; `ResultPanel` renders gateway values verbatim and never branches on trap paths or preset names.
- `frontend/ASSETS.md` entry: `star_on`, `star_off` (`src/world/art.ts`) and 12×12 badge icons (`badge_verified`, `badge_tampered`, `badge_mismatch`, `badge_error`) — Own pixel art, designed in `docs/design/005-result-receipt.md`, Author: Antigravity (Argon) / Agent Kitchen team, Licence: CC0 / Own.
