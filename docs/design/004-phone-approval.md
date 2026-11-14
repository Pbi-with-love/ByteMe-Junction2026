# Design Handoff — 004: Phone Approval (In-World Pixel Phone, HUD Hearts, Disclosures, Countdown & Station Ring)

> **Owner:** Antigravity (Argon) · **Implementer:** Codex (GPT-6 Luna)  
> **Scope:** `docs/design/004-phone-approval.md` only. Rewritten for the `010` pixel-art game world (`docs/design/010-game-world.md`) and `011` character/FX art (`docs/design/011-character-art.md`); supersedes the prior web-style `004` handoff visually while preserving its valid copy, state matrix, and accessibility rules.  
> **Reuses:** `010` 24-colour palette, `--px` unit scale (`6px` at `1920×1080`, `4px` at `1366×768`), `Pixelify Sans` / `Press Start 2P`, `PixelPanel` bevel/shadow tokens, `GameWorld` overlay grid (`hud | center | side`), button/focus tokens, `puzzled`/`stop` emotes, `011` `heart_full` / `heart_left` / `heart_right` art (`x` Heart Coral, `r` Espresso), and `003` `LightBadge` (`GREEN` / `BLUE` / `YELLOW` / `RED`).

---

## 1. Design Decisions & Rationale

1. **In-World Pixel Phone Beside the Phone Station (Kitchen & Robot Stay Visible):**  
   When an approval arrives, `Phone` opens inside the overlay `center` area, anchored to its **lower-right** zone (`x: 72..220, y: 36..174` logical px)—directly left of the **Phone Station** (`x: 240..272, y: 18..34`) and the robot waiting `YELLOW` at `phone` access `{15, 2}` (`x: 240..256, y: 34..50`). Because `y ≥ 36` sits strictly below `Order Terminal` (`y: 18..34`) and `x ≥ 72` sits strictly right of `Storage` / `Manager Desk` (`x: 16..64`) while `x ≤ 220` stays left of `side` (`x: 224..320`), **the phone panel intersects zero station hotspots, zero robot sprites, and zero `003` Activity Log rows** at both `1920×1080` and `1366×768`.
2. **Unbranded Pixel Handheld Frame with Pinned Header & Action Footer:**  
   The phone uses a crisp, unbranded `#1E3A5F` / `#0B1B33` pixel chassis with a top speaker grille, status LED, `1 * --px` pixel bevels, and `var(--shadow-pixel)` drop shadow. Inside, the `"Approvals"` status bar + `LightBadge` + countdown stay **pinned at the top**, and **Approve / Choose other / Reject** stay **pinned at the bottom**; only the middle card body (headline, explanation, options, blocked list) scrolls internally (`overflow-y: auto`) when options are long.
3. **Trap Disclosures: Clearly Visible, Calm & Factual (Never Policy-Light Coloured):**  
   Options with `lateLines` or `allergens` display `"Late delivery"` (warm parchment `#F5EFE6` / espresso `#5C3A21`) and `"Allergens"` (soft indigo `#EEF2FF` / `#3730A3`) badges with `8×8` pixel icons and verbatim disclosure lines—both in the option list and inside `"Choose other"` buttons. They stand out clearly under time pressure without using any of the four policy light colours (`GREEN`, `BLUE`, `YELLOW`, `RED`) or alarming the player before they choose.
4. **HUD Hearts Meter & Multi-Signal Ringing:**  
   `HeartsMeter` sits in `hud` beside `003`'s game clock using `011`'s `8×8` `heart_full` sprite (`#F43F5E` Heart Coral—never policy `RED`) and a hollow `heart_empty` outline. On `OPEN` arrival, the Phone Station sprite shakes `±1` logical px (`~10 Hz`), the HTML phone runs a `520 ms` vibrate (`data-vibrate="on"`), and the countdown pairs `tabular-nums` seconds with a draining pixel bar (shifting to `"Hurry · {n} s"` + warning icon at `≤ 5 s`). Under `prefers-reduced-motion: reduce`, all motion stops and is replaced by static `#A16207` highlight borders.

---

## 2. Palette, Tokens & Pixel Art (`010` / `011` Reuse + Marked Additions)

### 2.1 Reused Tokens (`010` §2, `010` §7, `011` §2)
Reuse all `24` `010` `@theme` tokens (`--px`, `--color-canvas` `#EEF4FA`, `--color-surface` `#FFFFFF`, `--color-surface-subtle` `#D6E3F0`, `--color-ink` `#0B1B33`, `--color-ink-muted` `#475569`, `--color-brand` `#0052B4`, `--color-brand-hover` `#003E8A`, `--color-brand-subtle` `#E0F2FE`, `--color-sky` `#60A5FA`, `--color-terminal-bg` `#1E3A5F`, `--color-wood` `#D49B6A`, `--color-wood-dark` `#9C663B`, `--color-border` `#94A3B8`, `--color-border-strong` `#0B1B33`, `--color-error-surface` `#FDF2F5`, `--color-error-ink` `#881337`, `--color-light-{green,blue,yellow,red}` + `-bg`, `--shadow-pixel`, `--shadow-focus`, `--font-sans`, `--font-display`, `--font-mono`) and `011` palette keys `x` (`#F43F5E` Heart Coral) and `r` (`#5C3A21` Espresso) **unchanged**.

### 2.2 Marked Additions for Spec 004 (`frontend/src/index.css` `@theme` & `src/world/palette.ts`)

```css
  /* === Spec 004 Marked Additions (append inside @theme in src/index.css) === */
  --color-heart-coral: #F43F5E;        /* Palette `x` (011) — filled HUD heart (never policy RED) */
  --color-heart-shadow: #5C3A21;       /* Palette `r` (011) — heart specular/notch */
  --color-disclosure-late-bg: #F5EFE6; /* Palette `L` — Late delivery badge fill */
  --color-disclosure-late-ink: #5C3A21;/* Palette `r` — Late delivery badge text & icon (9.1:1 on #F5EFE6) */
  --color-disclosure-late-bd: #9C663B; /* Palette `n` — Late delivery badge border */
  --color-disclosure-alg-bg: #EEF2FF;  /* Palette `P` — Allergens badge fill */
  --color-disclosure-alg-ink: #3730A3; /* Palette `D` — Allergens badge text & icon (8.7:1 on #EEF2FF) */
  --color-disclosure-alg-bd: #818CF8;  /* Allergens badge border */
```

Add the `3` new sprite-palette keys to `PALETTE` in `src/world/palette.ts` (alongside `011`'s `x` and `r`):
- `L`: `#F5EFE6` (Warm Parchment — `clock_late_8x8` fill)
- `P`: `#EEF2FF` (Soft Indigo — `allergen_8x8` fill)
- `D`: `#3730A3` (Indigo Info Ink — `allergen_8x8` glyph)

#### Contrast Verification Summary (Spec 004 Pairs)
| Pair | Ratio | Standard |
|---|---|---|
| `--color-ink` (`#0B1B33`) on `--color-surface` (`#FFFFFF`) | **17.23:1** | Exceeds AAA (7:1) |
| `--color-ink-muted` (`#475569`) on `--color-surface` (`#FFFFFF`) | **7.50:1** | Exceeds AAA (7:1) |
| `#FFFFFF` on `--color-terminal-bg` (`#1E3A5F`, phone bezel) | **11.40:1** | Exceeds AAA (7:1) |
| `#FFFFFF` on `--color-brand` (`#0052B4`, Approve CTA) | **7.33:1** | Exceeds AAA (7:1) |
| `--color-light-yellow` (`#A16207`) on `--color-light-yellow-bg` (`#FEF9C3`) | **4.58:1** | Passes AA (4.5:1) |
| `--color-light-red` (`#B91C1C`) on `--color-light-red-bg` (`#FEE2E2`) | **5.30:1** | Passes AA (4.5:1) |
| `--color-light-green` (`#15803D`) on `--color-light-green-bg` (`#DCFCE7`) | **4.57:1** | Passes AA (4.5:1) |
| `--color-disclosure-late-ink` (`#5C3A21`) on `--color-disclosure-late-bg` (`#F5EFE6`) | **9.10:1** | Exceeds AAA (7:1) |
| `--color-disclosure-alg-ink` (`#3730A3`) on `--color-disclosure-alg-bg` (`#EEF2FF`) | **8.70:1** | Exceeds AAA (7:1) |
| `--color-error-ink` (`#881337`) on `--color-error-surface` (`#FDF2F5`) | **8.74:1** | Exceeds AAA (7:1) |

> **YELLOW Contrast Rule:** Never place `--color-light-yellow` (`#A16207`) text directly on `#FFFFFF`; always pair it with `--color-light-yellow-bg` (`#FEF9C3`), and use `--color-ink` (`#0B1B33`) for card body copy.

---

## 3. Pixel Sprites & Icons (`8×8` & `4×8` Palette-Indexed Grids)

Every row has exact equal length; `.` = transparent. Render HTML UI sprites via `PixelSprite` (`image-rendering: pixelated`, `aria-hidden="true"`) at `calc(3 * var(--px))` (`18×18px` at 1080p, `12×12px` at 768p) or `calc(4 * var(--px))` (`24×24px` at 1080p, `16×16px` at 768p) for crisp integer scaling.

### 3.1 Hearts Meter & Heart-Break Sprites (Reused from `011-character-art.md` §8.1 + Empty State)

**`heart_full` (`8×8` — filled heart in `HeartsMeter`; uses `o`, `x` `#F43F5E`, `r` `#5C3A21`):**
```text
.oo..oo.
oxxroxxo
oxxxxxxo
oxxxxxxo
.oxxxxo.
..oxxo..
...oo...
........
```

**`heart_empty` (`8×8` — spent heart outline; uses `k` `#475569`, `g` `#D6E3F0`):**
```text
.kk..kk.
kggkkggk
kg....gk
kg....gk
.kggggk.
..kggk..
...kk...
........
```

**`heart_left` & `heart_right` (`4×8` — optional `particle_heart_break` split in `pixiWorld` when a `YELLOW` approval spends 1 heart, `650 ms`):**
```text
// heart_left    // heart_right
.oo.             .oo.
oxxr             oxxo
oxxx             xxxo
oxxx             xxxo
.oxx             xxo.
..ox             xo..
...o             o...
....             ....
```

### 3.2 Phone & Disclosure UI Icons (`8×8`, Marked Additions)

**`phone_handset_8x8` (`8×8` — phone status bar icon; uses `w`, `s` `#60A5FA`):**
```text
.ssssss.
sswwwwss
sw....ws
..s..s..
..s..s..
sw....ws
sswwwwss
.ssssss.
```

**`clock_late_8x8` (`8×8` — `"Late delivery"` disclosure badge icon; uses `o`, `L` `#F5EFE6`, `r` `#5C3A21`, `n` `#9C663B`):**
```text
..oooo..
.oLLLLo.
oLLrrLLo
oLLrrLLo
oLLrrnLo
oLLLLLLo
.oLLLLo.
..oooo..
```

**`allergen_8x8` (`8×8` — `"Allergens"` disclosure badge icon; uses `o`, `P` `#EEF2FF`, `D` `#3730A3`):**
```text
...oo...
..oPPo..
.oPDDPo.
oPPDDPPo
oPPDDPPo
oPPooPPo
oPPPPPPo
.oooooo.
```

**`timer_8x8` (`8×8` — countdown pill icon; uses `o`, `w`, `b` `#0052B4`):**
```text
..oooo..
...bb...
.oooooo.
owwbbwwo
owwbbwwo
owwwwwwo
.oooooo.
........
```

**`urgent_8x8` (`8×8` — urgent `≤ 5 s` & error banner icon; uses `o`, `R` `#B91C1C`, `w`):**
```text
...oo...
..oRRo..
..oRwo..
.oRRwo..
.oRRwo..
oRRRRRRo
oRRwRRRo
oooooooo
```
*(Note: For network/upstream/404 `role="alert"` banners, swap `R` for `e` `#881337` so system errors never use policy `RED`.)*

---

## 4. Layout & Exact Sizing (`1920×1080` and `1366×768`)

### 4.1 `hud` Strip Placement (`HeartsMeter` Beside `003` Clock & `010` Items)
Inside `GameWorld`'s top `hud` row (`height: calc(14 * var(--px))` = `84px` at 1080p, `56px` at 768p):
- **Left:** `<h1>{level.title}</h1>` + customer pill.
- **Centre:** Hint line (`role="status"`).
- **Right cluster (`display: flex; align-items: center; gap: calc(3 * var(--px))`):**
  1. `003` Game Clock chip (`HH:MM`).
  2. `<HeartsMeter hearts={hearts} max={maxHearts} />` — crisp `#FFFFFF` pixel pill (`border: calc(0.5 * var(--px)) solid #0B1B33`, `padding: calc(1 * var(--px)) calc(2.5 * var(--px))`, `box-shadow: calc(0.5 * var(--px)) calc(0.5 * var(--px)) 0 #0B1B33`), containing `3` `heart_full`/`heart_empty` sprites (`calc(4 * var(--px))` = `24×24px` at 1080p, `16×16px` at 768p, `gap: calc(1 * var(--px))`) + `"{hearts} of {max}"` (`calc(4 * var(--px))` `Pixelify Sans`, `font-weight: 700`, `tabular-nums`, `#0B1B33`).
  3. `"Back to levels"` ghost button.

### 4.2 Phone Panel Placement in `center` (Zero Station Overlap)
`Phone` renders inside `center` (`x: 0..224, y: 14..180` logical px) with `pointer-events: auto`:

| Property | Logical Px | `1920×1080` (`--px: 6px`) | `1366×768` (`--px: 4px`) |
|---|---|---|---|
| **Alignment in `center`** | `justify-self: end; align-self: start` | Top-right of `center` | Top-right of `center` |
| **Top / Right margin** | `top: 22`, `right: 4` | `margin-top: 132px; margin-right: 24px` | `margin-top: 88px; margin-right: 16px` |
| **Outer frame width** | `148` (`46.25%` of `320` ≤ `65%`) | `888px` | `592px` |
| **Outer frame max-height** | `138` | `828px` | `552px` |
| **Canvas footprint `[x, y]`** | `x: 72..220`, `y: 36..174` | `x: 432..1320`, `y: 216..1044` | `x: 288..880`, `y: 144..696` |
| **Station clearance** | `storage`/`desk` `x≤64`; `terminal` `y≤34`; `phone` `x≥240` | **0 px overlap** | **0 px overlap** |

```text
+-----------------------------------------------------------------------+
| HUD (14 * --px): [Title][Customer] [Hint]  [10:03] [♥♥♡ 2 of 3] [Back]|
+--------------------------------------------------+--------------------+
| [Storage]     [Terminal]              [Phone*~~] | SIDE (96 * --px)   |
|  16..64       128..176                 240..272  | 003 Activity Log   |
|  y:18..50     y:18..34                 y:18..34  |                    |
|               +-----------------------+ [RobotY] | 10:01 Search [G]   |
|               | [===]  • Approvals    | 240,34   | 10:02 Quote  [Y]   |
|               |-----------------------|          | 10:03 Order  [Y]   |
|               | [Yellow]     [ 18 s ] |          |                    |
|               | [============-------] |          |                    |
|               | Over per-order limit  |          |                    |
|               | • Best [Recommended]  |          |                    |
|               |   [Allergens] ...     |          |                    |
|               | • Better [Late deliv.]|          |                    |
| [Desk]        | [Approve]             | [Deliv.] |                    |
|  16..64       | [Choose other][Reject]| 304,82   |                    |
|  y:130..162   +-----------------------+          |                    |
+--------------------------------------------------+--------------------+
```

### 4.3 Type Scale Inside the Phone (`≥ 4 * --px` Everywhere)
| Role | Token | `1920×1080` (`--px: 6px`) | `1366×768` (`--px: 4px`) | Font |
|---|---|---|---|---|
| Card Headline (`reasonText`, `<h2>`) | `calc(5 * var(--px))` | `30px` (LH `1.25`) | `20px` (LH `1.25`) | `Press Start 2P` |
| Agent Explanation, Options, Disclosures, Buttons | `calc(4 * var(--px))` | `24px` (LH `1.35`) | `16px` (LH `1.35`) | `Pixelify Sans` |
| Status Bar Title, Countdown (`20 s`), Badges | `calc(4 * var(--px))` | `24px` (LH `1.2`) | `16px` (LH `1.2`) | `Pixelify Sans` (`tabular-nums`) |

---

## 5. Pixel Phone Frame, Components & Interactive States

### 5.1 Pixel Phone Chassis (`Phone.tsx`)
- **Outer bezel:** `border: calc(1 * var(--px)) solid #0B1B33`, `background: #1E3A5F`, `padding: calc(2 * var(--px))`, `border-radius: 0`, `box-shadow: var(--shadow-pixel)`.
  - **Top hardware bar (`aria-hidden="true"`):** `height: calc(5 * var(--px))`, centred `calc(16 * var(--px)) × calc(1.5 * var(--px))` speaker slot (`#0B1B33` with `0.5 * --px` `#60A5FA` bottom bevel) + right-aligned `calc(2 * var(--px))` status LED (`#A16207` when `OPEN`, `#60A5FA` when settled).
- **Inner screen:** `background: #FFFFFF`, `border: calc(0.5 * var(--px)) solid #0B1B33`, `box-shadow: inset calc(0.5 * var(--px)) calc(0.5 * var(--px)) 0 #CBD5E1`, `display: flex; flex-direction: column`, `max-height: calc(126 * var(--px))`.
  - **Pinned Phone Status Bar:** `background: #1E3A5F`, `color: #FFFFFF`, `padding: calc(2 * var(--px)) calc(3 * var(--px))`, `border-bottom: calc(1 * var(--px)) solid #0B1B33`, `display: flex; justify-content: space-between; align-items: center`:
    - Left: `phone_handset_8x8` + `"Approvals"` (`font-weight: 700`).
    - Right: `<button type="button" className="button button-ghost" aria-label="Hide phone">Hide</button>` (compact `min-height: calc(7 * var(--px))`, `padding: 0 calc(2.5 * var(--px))`, `font-size: calc(4 * var(--px))`).

### 5.2 Approval Card (`ApprovalCard.tsx`, `role="alertdialog" aria-modal="false"`)
1. **Pinned Card Header (Light + Countdown):**
   - Row 1 (`display: flex; justify-content: space-between; align-items: center; gap: calc(2 * var(--px))`):
     - Left: `<LightBadge light="YELLOW" />` (switches to `light="RED"` if `403 POLICY_BLOCKED` occurs).
     - Right: Countdown pill (`timer_8x8` + `"{secondsLeft} s"`, `tabular-nums`, `font-weight: 700`, `border: calc(0.5 * var(--px)) solid #0B1B33`, `background: #EEF4FA`, `padding: calc(0.75 * var(--px)) calc(2 * var(--px))`).
   - Row 2 (**Draining Pixel Bar**): Full-width `calc(2.5 * var(--px))` track (`background: #D6E3F0`, `border: calc(0.5 * var(--px)) solid #0B1B33`), inner fill width `(secondsLeft / initialSeconds) * 100%`, `background: #0052B4` (`transition: width 1000ms linear` under `motion-safe`, instant step under `motion-reduce`).
   - **Urgent (`secondsLeft <= 5`):** Pill switches to `background: #FEE2E2`, `color: #B91C1C`, `border-color: #B91C1C`, icon `urgent_8x8`, text `"Hurry · {secondsLeft} s"`; bar fill switches to `#B91C1C`. Subtle `animate-pulse` under `motion-safe`; static under `motion-reduce`.
   - **At `0 s`:** Displays `"Checking with gateway…"` beside `0 s`; calls `getApproval(id)` every `1 s` (max `10`) while still `OPEN`; buttons remain enabled.
2. **Scrollable Card Body (`flex: 1; min-height: 0; overflow-y: auto; padding: calc(3 * var(--px))`):**
   - **Headline (`<h2 id="approval-reason-heading" tabIndex={-1}>`):** `approval.reasonText` verbatim (`Press Start 2P`, `calc(5 * var(--px))`, `#0B1B33`). Programmatically focused on arrival/reopen.
   - **Agent Explanation (`<p id="approval-explanation">`):** `approval.agentExplanation` verbatim (`Pixelify Sans`, `calc(4 * var(--px))`, `#475569`).
   - **Options List (`approval.options` in gateway order):**
     - **Recommended (`option.recommended === true`):** `border: calc(0.75 * var(--px)) solid #0052B4`, `background: #E0F2FE`, `box-shadow: calc(0.5 * var(--px)) calc(0.5 * var(--px)) 0 #0B1B33`. Header shows Tier (`Best` / `Better` / `Good`) + `"Recommended"` pixel tag (`background: #0052B4`, `color: #FFFFFF`, `padding: calc(0.5 * var(--px)) calc(1.5 * var(--px))`).
     - **Non-recommended:** `border: calc(0.5 * var(--px)) solid #94A3B8`, `background: #FFFFFF`. Header shows Tier (`Best` / `Better` / `Good`).
     - **Summary:** `option.summary` verbatim (`#0B1B33`, `font-weight: 600`).
     - **Option Disclosures (`optionDisclosure(option.planId, step)`):**
       - If `lateLines.length > 0`: render `"Late delivery"` badge (`clock_late_8x8` + `"Late delivery"`, `background: #F5EFE6`, `color: #5C3A21`, `border: calc(0.5 * var(--px)) solid #9C663B`) + one line per `lateLines` entry:
         `{formatQuantity(line.quantity)} arrives {formatDate(line.availableDate)}, after the deadline {formatDateTime(need.deadline)}.`
       - If `allergens.length > 0`: render `"Allergens"` badge (`allergen_8x8` + `"Allergens"`, `background: #EEF2FF`, `color: #3730A3`, `border: calc(0.5 * var(--px)) solid #818CF8`) + line:
         `Contains: {allergens.map(formatAllergen).join(", ")}.`
       - **Both badges and lines also appear inside each `"Choose other"` option button** so the player never chooses blindly.
   - **"Blocked by the gateway" List (`step.quote.excludedProducts` non-empty):**
     - Heading: `"Blocked by the gateway"` (`font-weight: 700`, `#0B1B33`).
     - Container: `background: #F8FAFC`, `border: calc(0.5 * var(--px)) solid #94A3B8`, `padding: calc(2 * var(--px))`.
     - Each row: `<LightBadge light="RED" />` + product `name` (from `step.search.results`, fallback `productId`) + `REASON_TEXT[reason]`. **No buttons or interactive elements inside this list.**
3. **Pinned Action Footer (`padding: calc(2.5 * var(--px)) calc(3 * var(--px))`, `border-top: calc(0.5 * var(--px)) solid #94A3B8`, `background: #EEF4FA`):**
   - **Primary:** `"Approve"` (`button-primary`, full width, `min-height: calc(10 * var(--px))`).
   - **Secondary Row (`grid-cols-2 gap: calc(2 * var(--px))`):**
     - `"Choose other"` (`button-ghost`, `aria-expanded={showAlternatives}`; toggles to `"Hide options"` when open). Reveals non-recommended options (excluding any `planId` removed by `403 POLICY_BLOCKED`) as full-width selectable `<button type="button">` cards with their tier, `summary`, and disclosure badges/lines.
     - `"Reject"` (outline `#881337` text & border on `#FFFFFF`; hover `#FDF2F5`).
   - **Control States (All Buttons):**
     - **Hover:** `Approve` → `#003E8A`; `Choose other` → `#E0F2FE`; `Reject` → `#FDF2F5`.
     - **Pressed (`:active`):** `transform: translate(calc(0.5 * var(--px)), calc(0.5 * var(--px)))`, shadow reduced to `0`.
     - **Focus (`:focus-visible`):** `outline: none; box-shadow: var(--shadow-focus)`.
     - **Disabled / In-Flight (`Deciding`):** `opacity: 0.6; cursor: wait; box-shadow: none`; clicked button shows `"Sending…"`.

### 5.3 Complete State Matrix
| State | Trigger | Card Content & Buttons | Vibrate / Ring |
|---|---|---|---|
| **Hidden** | `Escape` or `"Hide"` | Panel `hidden`, countdown & request keep running; Phone Station hotspot reopens it | `off` (station still rings) |
| **Open** | `status === "OPEN"` | `LightBadge` YELLOW, countdown, `reasonText`, `agentExplanation`, options + disclosures, blocked list, **Approve / Choose other / Reject** | `vibrate="on"` (`≤600ms`); station rings |
| **Deciding** | Any decision button clicked | All action buttons disabled, clicked button shows `"Sending…"`, `aria-busy="true"`, **no success text** | `on` (`off` if reduced) |
| **Decided** | `200` `ApprovalDecision` | Status banner (`#DCFCE7`/`#15803D` for `CONFIRMED`/`ORDERED`; `#D6E3F0`/`#0B1B33` for `REJECTED`): `"{Status} · order {orderStatus}"` + `decision` if `alternative:<planId>`, **no buttons** | `off`; station stops |
| **Expired** | Gateway returns `EXPIRED` | Neutral/amber banner: `"Expired: no answer in time"`, **no buttons** | `off`; station stops |
| **Late Tap (409)** | `INVALID_STATE` (`409`) | `role="alert"`: `"This request was already closed by the gateway"`, calls `getApproval(id)` once and renders closed state | `off` |
| **Blocked (403 RED)** | `POLICY_BLOCKED` (`403`) | `<LightBadge light="RED" />` + `error.message` in `role="alert"`, permanently removes that `planId` button, calls `getApproval(id)` once | `on` if still `OPEN` |
| **Not Found (404)** | `NOT_FOUND` (`404`) | `role="alert"`: `"Request not found"`, **no buttons** | `off` |
| **Network / Upstream** | `NETWORK_ERROR` / `UPSTREAM_ERROR` / `HTTP_ERROR` | `role="alert"` (`#FDF2F5` / `#881337` + `urgent_8x8`): `"Error: {gatewayMessage}"`, remaining buttons re-enabled for retry | `on` if `OPEN` |
| **Arrived Closed** | `status !== "OPEN"` on arrival | No buttons, no countdown, no client call. If `ATTENTION_EXHAUSTED` in `reasons`: `"Manager too busy: out of attention"` + `reasonText` | `off` |

---

## 6. World Ringing, Motion & Reduced-Motion Fallbacks

1. **Phone Station Ringing (`pixiWorld.ring(on: boolean)` & `GameWorld`):**
   - `GameWorld` mirrors `data-phone-ringing="true|false"` on `section[aria-label="Kitchen"]`.
   - **Full motion:** While `ring(true)` is active, the Phone Station sprite (`{240, 18}`) shifts `±1` logical px horizontally at `~10 Hz` (`100 ms` toggle); robot plays `wait` (`2 fps`) with `puzzled` (`YELLOW` `?`) emote; Manager (`011`) plays `manager.phone` (`4 fps`).
   - **Reduced motion (`prefers-reduced-motion: reduce`):** Zero sprite shake; draw a static `1` logical px `#A16207` (`YELLOW`) highlight outline around `STATIONS.phone` instead.
2. **HTML Phone Arrival Vibrate (`≤ 600 ms`):**
   - `data-vibrate={isOpen && !shouldReduce ? "on" : "off"}` for `520 ms` (`x: [0, -4, 4, -3, 3, 0]` px) on new `OPEN` arrival.
   - **Reduced motion:** `data-vibrate="off"`, static `calc(1 * var(--px)) solid #A16207` outer highlight ring on the phone while `OPEN`.
3. **Post-Decision Robot (`directDecision`):**
   - `ORDERED` / `CONFIRMED` → carries `box` to `Delivery Entrance`, `say("Order {orderStatus}")`, `burst("delivered")`.
   - `REJECTED` / `EXPIRED` → `idle`, `say("Approval {status}")` (never walks to `delivery`).

---

## 7. Accessibility & Keyboard Navigation

1. **Focus Management:** Opening or un-hiding the phone panel immediately focuses `<h2>` (`tabIndex={-1}`). Pressing `Escape` or `"Hide"` hides the panel (preserving state, countdown, and in-flight requests) and returns focus to the **Phone Station** hotspot.
2. **Tab Order:** `Tab` reaches `"Hide"`, every revealed option button, `"Approve"`, `"Choose other"`, and `"Reject"`. All buttons are native `<button type="button">` operable with `Enter` and `Space`.
3. **Screen Readers:** `role="alertdialog"` (`aria-modal="false"`) announces the card on focus; countdown milestones (`10 seconds left`, `5 seconds left`, `Time expired, checking with gateway`) use a polite live region (`aria-live="polite"`); errors render in `role="alert"`; `HeartsMeter` uses `aria-label="Attention: {hearts} of {max} hearts left"`.

---

## 8. Exact UI Copy (English, Typographic Quotes/Apostrophes)

| Element | Exact Copy |
|---|---|
| Phone status bar title / hide | `Approvals` · `Hide` |
| Phone Station disabled reason | `No approval request right now.` |
| Hearts meter accessible label / text | `Attention: {n} of {m} hearts left` · `{n} of {m}` |
| Option tier labels & recommended | `Best` · `Better` · `Good` · `Recommended` |
| Disclosure badge: Late delivery | `Late delivery` · `{formatQuantity(line.quantity)} arrives {formatDate(line.availableDate)}, after the deadline {formatDateTime(need.deadline)}.` |
| Disclosure badge: Allergens | `Allergens` · `Contains: {allergens.map(formatAllergen).join(", ")}.` |
| Blocked by the gateway heading | `Blocked by the gateway` |
| Countdown normal / urgent / polling | `{n} s` · `Hurry · {n} s` · `Checking with gateway…` |
| Action buttons & in-flight | `Approve` · `Choose other` (`Hide options`) · `Reject` · `Sending…` |
| Decided state | `Approved · order {orderStatus}` / `Alternative chosen ({planId}) · order {orderStatus}` / `Rejected · order {orderStatus}` |
| Expired / Late tap / Closed / 404 / Error | `Expired: no answer in time` / `This request was already closed by the gateway` / `Manager too busy: out of attention` / `Request not found` / `Error: {gatewayMessage}` |
