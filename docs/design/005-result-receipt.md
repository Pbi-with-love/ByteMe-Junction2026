# Design Handoff — 005: Result + Receipt (Scores, Stars, Safety Incident, Self-Explaining Receipt, Log Hash Badge)

> **Owner:** Antigravity (Argon) · **Implementer:** Codex (GPT-6 Luna)  
> **Scope:** `docs/design/005-result-receipt.md` only. Reuses shared tokens from `docs/design/002-mandate-screen.md` and `LightBadge` from `docs/design/003-agent-timeline.md` verbatim.

---

## 1. Design Decisions & Rationale

1. **Five-Second Verdict Above the Fold (`1920×1080`):**  
   A hackathon jury watching a projector—and the player who just finished a run—should read the outcome in five seconds without scrolling. At `1920×1080`, a two-column layout places the **Result Board + Hash Badge + Action Buttons** in a fixed-fit left/top focal column (`~52%` width) and the **Printed Till Receipt** in a dedicated right column (`~48%` width, internally scrollable if the audit log is long). The score meters, hearts, stars, hash badge, and primary CTAs always fit cleanly within `1080px` height.
2. **Safety Incident as an Unmistakable Failure State:**  
   When `result.incident` is non-null, the screen shifts from calm Valio-blue/white (`--color-canvas`) to a full-viewport red alert canvas (`--color-light-red-bg` `#FEE2E2`) anchored by a solid `--color-light-red` (`#B91C1C`) hero banner with `"Safety incident"`, `incident.reason`, `incident.productId`, and `0 of 3 stars`. It reads immediately as a **failure**, never a partial score. The printed receipt and hash badge remain visible below/beside it so the jury can trace *why* the unsafe product was ordered.
3. **Printed Till Receipt Aesthetic:**  
   The `"receipt that explains itself"` is styled as a crisp white paper slip (`--color-surface`) with a subtle notched/perforated top edge rule, `receiptText` set as the headline narrative at the top, followed by a chronological `<ol>` of buyer audit log events (`seq` order) with monospace Helsinki timestamps, actor tags, summaries, and `LightBadge` pills (only when `light !== null`).
4. **Trustworthy Cryptographic Proof Without Hash Math in Frontend:**  
   The log hash badge (`role="status"`) renders purely from `verifyLog()` and `result.logHeadHash` equality—never computing hashes in the browser. Every badge state pairs a semantic light token (`GREEN` or `RED`) with a distinct SVG icon and explicit status copy so colour is never the sole signal.

---

## 2. Shared Design Tokens (Reused from 002/003 + Marked Additions)

Reuse the `@theme` block from `docs/design/002-mandate-screen.md` §2 and additions from `docs/design/003-agent-timeline.md` §2 **unchanged**. Add only the following tokens to `frontend/src/index.css` `@theme` for Spec 005:

```css
  /* === Spec 005 Additions (append inside @theme in src/index.css) === */
  --color-meter-track: #DCE5F2;          /* Unfilled score bar track (distinct on #FFFFFF) */
  --color-star-filled: #D97706;          /* Warm amber star fill (3.19:1 on #FFF, graphic >= 3:1) */
  --color-star-empty: #CBD5E1;           /* Unfilled star outline/fill */
  --color-heart-filled: #B91C1C;         /* Remaining heart icon (matches RED token) */
  --color-heart-empty: #CBD5E1;          /* Spent heart icon */
  --color-receipt-edge: #94A3B8;         /* Dashed till-receipt divider rules */
```

### Contrast Verification Summary
| Pair | Ratio | Standard |
|---|---|---|
| `--color-ink` (`#0B1B33`) on `--color-surface` (`#FFFFFF`) | **16.9:1** | Exceeds AAA (7:1) |
| `--color-ink-muted` (`#3B4E6B`) on `--color-surface` (`#FFFFFF`) | **8.2:1** | Exceeds AAA (7:1) |
| `#FFFFFF` on `--color-light-red` (`#B91C1C`) (Safety incident hero) | **6.47:1** | Passes AA (4.5:1) & Large AAA |
| `--color-light-red` (`#B91C1C`) on `--color-light-red-bg` (`#FEE2E2`) | **5.30:1** | Passes AA (4.5:1) |
| `--color-light-green` (`#15803D`) on `--color-light-green-bg` (`#DCFCE7`) | **4.57:1** | Passes AA (4.5:1) |
| `--color-star-filled` (`#D97706`) on `--color-surface` (`#FFFFFF`) | **3.19:1** | Passes UI/Graphics (3:1) |
| `--color-brand` (`#0052B4`) on `--color-surface` (`#FFFFFF`) | **7.6:1** | Exceeds AAA (7:1) |

---

## 3. Type Scale & Spacing (Reused from 002 + Result Roles)

| Role | `1920×1080` (`xl:` / `>= 1440px`) | `1366×768` (`< 1440px`) | Weight / Tracking |
|---|---|---|---|
| Screen Heading (`<h1>`, `"Level result"` / `"Safety incident"`) | `36px` (`2.25rem`), LH `1.15` | `28px` (`1.75rem`), LH `1.2` | `700`, `-0.02em` |
| Stars Summary & Score Numbers (`100`, `97`) | `28px` (`1.75rem`), LH `1.15` | `22px` (`1.375rem`), LH `1.2` | `700`, `tabular-nums` |
| Meter Labels (`Kitchen`, `Wallet`, `Safety`) & Narrative `receiptText` | `22px` (`1.375rem`), LH `1.5` | `18px` (`1.125rem`), LH `1.5` | `600` (labels), `400` (narrative) |
| Receipt Log Summaries & Action Buttons | `18px` (`1.125rem`), LH `1.45` | `16px` (`1rem`), LH `1.45` | `600` (buttons), `400` (summaries) |
| Hash Badge, Timestamps, `actor`, `productId` | `16px` (`1rem`), LH `1.4` | `14px` (`0.875rem`), LH `1.4` | `500`, `tabular-nums`, `--font-mono` |

- **Outer container:** `max-width: 1680px` centred, horizontal padding `32px` (`2rem`) at `1080p`, `24px` (`1.5rem`) at `768p`. Vertical padding `28px` (`1.75rem`) at `1080p`, `20px` (`1.25rem`) at `768p`. Column gap `28px` at `1080p`, `20px` at `768p`.

---

## 4. Layout Specification

### 4.1 Normal Result State — `1920×1080` (Projector, No Outer Scroll)

Two-column asymmetric grid (`grid-cols-1 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] items-start gap-7`):

```text
+------------------------------------------+--------------------------------------+
| LEFT: RESULT BOARD + BADGE + ACTIONS     | RIGHT: PRINTED TILL RECEIPT          |
|                                          |  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  |
|  Level result                            |  RECEIPT                             |
|  ★ ★ ★   3 of 3 stars                   |  "Your agent bought 700 l of Valio    |
|  ♥ ♥ ♡   2 of 3 hearts left             |   lactose-free milk and 300 l…"      |
|                                          |  - - - - - - - - - - - - - - - - - - |
|  Kitchen   [███████████████████]  100    |  Audit log (6 events)                |
|  Wallet    [██████████████████ ]   97    |  1. 10:01  gateway  [Green]          |
|  Safety    [███████████████████]  100    |     Mandate mdt_01 signed…           |
|                                          |  2. 10:02  agent                     |
|  +------------------------------------+  |     Searched catalog: 4 products…    |
|  | [✓] Log verified                   |  |  3. 10:03  gateway  [Yellow]         |
|  | sha256:802ec1cd4a618ec6 · 6 events |  |     Quote qt_8f2 requires approval…  |
|  +------------------------------------+  |  ... (scrolls internally if needed)  |
|                                          |                                      |
|  [Play again]                            |                                      |
|  [See it from Valio Aimo’s side]         |                                      |
|  [Compare presets]                       |                                      |
+------------------------------------------+--------------------------------------+
```

- **Left Column (`~52%`):**
  1. **Result Card (`--color-surface`, `--radius-card`, `border: 1px solid --color-border`, `padding: 32px`):**
     - `<h1>` (`tabIndex={-1}`): `"Level result"`
     - **Stars + Hearts Row:** Flex row (`flex-wrap: wrap; items-center; justify-content: space-between; gap: 16px`).
       - **Stars (`0–3`):** Three `32px × 32px` star SVGs (`aria-hidden="true"`) + visible text `"{stars} of 3 stars"` (or `aria-label="{stars} of 3 stars"` on the stars group container so screen readers announce `"{stars} of 3 stars"` cleanly).
       - **Hearts (`0–startHearts`):** Row of `startHearts` heart SVGs (`24px × 24px`, `aria-hidden="true"`) + visible text `"{heartsLeft} of {startHearts} hearts left"`.
     - **Score Meters Stack (`gap: 20px`):** Three rows (`Kitchen`, `Wallet`, `Safety`), each containing:
       - Label (`Kitchen` / `Wallet` / `Safety`) + numeric score (`{value}`, `tabular-nums`, bold) on top or left.
       - `<div role="meter" aria-label={name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>` track (`height: 16px`, `border-radius: 9999px`, `--color-meter-track`) with animated inner fill bar (`--color-brand` `#0052B4`).
  2. **Log Hash Badge (`role="status"`):** Full width of left column, directly below the Result Card (`margin-top: 16px`).
  3. **Action Buttons Row:** Flex-wrap row (`gap: 12px`, `margin-top: 20px`) in exact reading order:
     - `"Play again"` (primary `--color-brand`)
     - `"See it from Valio Aimo’s side"` (secondary outline, only if `onValioView` is passed)
     - `"Compare presets"` (secondary outline, only if `onCompare` is passed)
- **Right Column (`~48%`) — Printed Till Receipt:**
  - `<section aria-label="Receipt">` styled as a paper receipt (`--color-surface`, `border: 1px solid --color-border`, `border-top: 6px solid --color-ink`, `--radius-doc`, `padding: 28px 32px`).
  - At `1080p` (`xl:`): `max-height: calc(100vh - 56px); overflow-y: auto;` so the receipt scrolls internally if the log is long while the left column never scrolls.
  - **Headline Narrative:** Overline `"Receipt"` (`uppercase`, `tracking-wider`, `--color-ink-muted`) + `result.receiptText` verbatim in `22px` (`1.375rem`), `--color-ink`.
  - **Dashed Receipt Divider:** `border-top: 2px dashed --color-receipt-edge; margin: 20px 0;`.
  - **Buyer Log Timeline (`<ol>`):** Ordered by `seq` ascending. Each `<li>` displays:
    - Left/top metadata line: `formatTime(event.at)` (`--font-mono`, `tabular-nums`), `event.actor` pill (`--color-surface-subtle`, `--color-ink-muted`, `--font-mono`), and `<LightBadge light={event.light} />` **only when `event.light !== null`**.
    - Summary line: `event.summary` (`--color-ink`).

### 4.2 Normal Result State — `1366×768` (Laptop)
- Below `1440px` (`xl:`), type steps down per §3.
- At `1024px–1366px` (`lg:` to `< xl:`): stacks into a single column (`max-width: 920px`, centred) OR keeps 2 columns if comfortable—single column (`grid-cols-1`) with `max-width: 920px` is recommended below `1280px` so the receipt log lines never wrap awkwardly and zero horizontal overflow occurs. On `1366×768` (`xl:` is `1280px` in Tailwind v4 default, so use `min-[1440px]:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]` to trigger 2-column at `1440px+` and single-column at `1366×768`).

### 4.3 Red "Safety Incident" Variant (`result.incident !== null`)
- **Full-Screen Red Treatment:**
  - Outer `<main>` / screen wrapper switches from `--color-canvas` (`#F3F6FA`) to `--color-light-red-bg` (`#FEE2E2`).
  - **Incident Hero Banner (`--color-light-red` `#B91C1C` fill, `#FFFFFF` text, `--radius-card`, `padding: 28px 32px`):**
    - Alert icon (octagon/triangle SVG, `aria-hidden="true"`) + `<h1>` (`tabIndex={-1}`): **`Safety incident`**
    - `incident.reason` prominently displayed (`24px` at `1080p`, `20px` at `768p`, `font-weight: 600`).
    - Product identifier pill: `"Product ID"` + `incident.productId` (`--font-mono`, `#FFFFFF` on `rgba(0,0,0,0.22)`).
    - Stars display: **`0 of 3 stars`** (three empty stars + explicit text `"0 of 3 stars"`).
  - **Meters & Hearts Card:** Still renders `Kitchen`, `Wallet`, `Safety` (`role="meter"`) and hearts left on `--color-surface` (`#FFFFFF`) with `2px solid --color-light-red-border` (`#FCA5A5`), using `--color-light-red` (`#B91C1C`) for any `0` / incident meter accent.
  - **Receipt & Hash Badge:** Still render in full so the user can inspect the exact `ORDER_CREATED` / `SEARCH` events that led to the incident.

---

## 5. Component States

### 5.1 Loading & Error States (AC7 & AC10)
- **Loading (`getResult` pending):** Centred in `<main>` on `--color-canvas`: `"Loading result…"` (`24px`, `--color-ink-muted`).
- **`getResult` rejects:** Render **only** a `role="alert"` banner (`--color-error-surface`, `--color-error-ink`, `border-left: 5px solid --color-error-ink`, identical to `002` §5.4) with the error message and `"Play again"` button. **Do not** render meters, stars, hearts, or fake success.
- **`getLog("buyer")` rejects (scores succeeded):** Score board, stars, hearts, hash badge, and buttons still render. Inside the receipt section, render `receiptText` (if present) and a `role="alert"` banner showing the log fetch error message instead of the `<ol>` list.

### 5.2 Log Hash Badge (`role="status"`) — 4 States
Container: `<div role="status" className="...">` (`--radius-control`, `padding: 14px 18px`, `border: 1.5px solid ...`, `display: flex; align-items: flex-start; gap: 12px`). Always includes a `20px × 20px` SVG icon (`aria-hidden="true"`).

| State | Condition | Background | Text & Icon | Border | Exact Copy |
|---|---|---|---|---|---|
| **Verified** | `verify.valid === true` AND `verify.headHash === result.logHeadHash` | `--color-light-green-bg` (`#DCFCE7`) | `--color-light-green` (`#15803D`) | `--color-light-green-border` (`#86EFAC`) | **`Log verified`** · `{verify.headHash}` (`--font-mono`) · `"{verify.events} events"` |
| **Tampered** | `verify.valid === false` | `--color-light-red-bg` (`#FEE2E2`) | `--color-light-red` (`#B91C1C`) | `--color-light-red-border` (`#FCA5A5`) | **`Log tampered: chain broken at event #{verify.brokenAtSeq}`** |
| **Mismatch** | `verify.valid === true` AND `verify.headHash !== result.logHeadHash` | `--color-light-red-bg` (`#FEE2E2`) | `--color-light-red` (`#B91C1C`) | `--color-light-red-border` (`#FCA5A5`) | **`Log does not match this result`** |
| **Verify error** | `verifyLog()` rejects | `--color-light-red-bg` (`#FEE2E2`) | `--color-light-red` (`#B91C1C`) | `--color-light-red-border` (`#FCA5A5`) | **`Could not verify log`** |

### 5.3 Action Buttons (`<button type="button">`)
- **Primary (`"Play again"`):** Fill `--color-brand`, text `#FFFFFF`, `min-height: 48px`, `padding: 0 24px`, `border-radius: --radius-control`, `font-weight: 600`. Hover: `--color-brand-hover`.
- **Secondary (`"See it from Valio Aimo’s side"`, `"Compare presets"`):** Fill `--color-surface`, border `1.5px solid --color-border-strong`, text `--color-ink`, `min-height: 48px`, `padding: 0 22px`, `border-radius: --radius-control`, `font-weight: 600`. Hover: fill `--color-surface-subtle`, border `--color-brand`.
- **Focus-visible (all buttons):** `box-shadow: var(--shadow-focus); outline: none`.

---

## 6. Reveal Animation & Reduced Motion (`motion/react`)

Wrap with `MotionConfig reducedMotion="user"` (from `002`) and check `useReducedMotion()` for explicit fallbacks:

1. **Score Bar Fill (Kitchen / Wallet / Safety):**
   - **Full Motion:** `initial={{ width: "0%" }}`, `animate={{ width: `${value}%` }}`, `transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: index * 0.08 }}` (`0ms`, `80ms`, `160ms` stagger).
   - **Reduced Motion (`prefers-reduced-motion: reduce`):** `initial={{ width: `${value}%` }}`, `animate={{ width: `${value}%` }}`, `transition={{ duration: 0 }}` (no width sweep).
2. **Star Reveal (`0–3` filled stars):**
   - **Full Motion:** Filled stars animate `initial={{ opacity: 0, scale: 0.5 }}`, `animate={{ opacity: 1, scale: 1 }}`, `transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1], delay: 0.18 + index * 0.1 }}`.
   - **Reduced Motion:** `initial={{ opacity: 0 }}`, `animate={{ opacity: 1 }}`, `transition={{ duration: 0.12, ease: "linear" }}` (opacity only, no scale).

---

## 7. Accessibility & Keyboard Navigation

1. **Heading & Landmarks:**
   - `<main aria-label="Level result">`
   - `<h1>` (`"Level result"` or `"Safety incident"`), `tabIndex={-1}`, programmatically focused when result data finishes loading.
   - `<section aria-label="Receipt">` with `<h2>` `"Receipt"` and `<ol>` for buyer log events in `seq` order.
2. **Meters, Hearts & Stars Semantics:**
   - Each score bar uses `role="meter"`, `aria-label` (`"Kitchen"`, `"Wallet"`, `"Safety"`), `aria-valuemin={0}`, `aria-valuemax={100}`, `aria-valuenow={value}`, plus visible numeric text.
   - Hearts container exposes exact accessible text `"{heartsLeft} of {startHearts} hearts left"`.
   - Stars container exposes exact accessible name `"{stars} of 3 stars"`.
3. **Live Regions & Errors:**
   - Hash badge uses `role="status"`.
   - `getResult` and `getLog` failures use `role="alert"`.
4. **Keyboard Order:**
   - Scrollable receipt container (when overflowing at `1080p`) has `tabIndex={0}` and `aria-label="Receipt"` or `role="region"` so keyboard users can scroll it.
   - Buttons follow DOM reading order: `"Play again"` → `"See it from Valio Aimo’s side"` (if present) → `"Compare presets"` (if present).

---

## 8. Final UI Copy (English, Typographic Quotes/Apostrophes)

| Element | Exact Copy |
|---|---|
| Loading state | `Loading result…` |
| Normal screen heading (`<h1>`) | `Level result` |
| Incident screen heading (`<h1>`) | `Safety incident` |
| Incident product label | `Product ID` |
| Score meter labels | `Kitchen` · `Wallet` · `Safety` |
| Stars text | `{stars} of 3 stars` |
| Hearts text | `{heartsLeft} of {startHearts} hearts left` |
| Receipt heading | `Receipt` |
| Audit log subheading | `Audit log` |
| Hash badge — verified | `Log verified` · `{headHash}` · `{events} events` |
| Hash badge — tampered | `Log tampered: chain broken at event #{brokenAtSeq}` |
| Hash badge — mismatch | `Log does not match this result` |
| Hash badge — verify error | `Could not verify log` |
| Primary CTA | `Play again` |
| Optional Valio CTA | `See it from Valio Aimo’s side` |
| Optional Compare CTA | `Compare presets` |

---

## 9. Assumptions & Notes for Implementation

- `LightBadge` is imported from `src/components/LightBadge.tsx` (Spec 003) and never re-declared or re-coloured locally.
- Format all log event timestamps via `formatTime(event.at)` from `src/lib/format.ts` (Europe/Helsinki).
- No local calculation of scores, stars, hearts, or hashes; all values come verbatim from `getResult()`, `getLog("buyer")`, and `verifyLog()`.
