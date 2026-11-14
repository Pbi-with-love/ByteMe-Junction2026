# Design Handoff — 003: Agent Timeline + Game Clock (Run Screen)

> **Owner:** Antigravity (Argon) · **Implementer:** Codex (GPT-6 Luna)  
> **Scope:** `docs/design/003-agent-timeline.md` only. Reuses shared tokens from `docs/design/002-mandate-screen.md` verbatim.

---

## 1. Design Decisions & Rationale

1. **Two-Column Split Anchored by the Game Clock:**  
   During a run, the player and projector audience need two things simultaneously: **context + time pressure** on the left (who the customer is, what the manager asked for, deadline/cut-off, and the ticking `HH:MM` game clock) and **live agent activity** on the right (`Agent timeline`). A fixed `35% / 65%` desktop split keeps the brief and clock anchored without scrolling while the timeline grows downward.
2. **The Lights Carry the Drama:**  
   The interface stays calm, flat, and Valio-inspired (`--color-canvas` `#F3F6FA` desk, `--color-surface` `#FFFFFF` cards, `--color-ink` `#0B1B33` text). Policy outcomes (`GREEN`, `BLUE`, `YELLOW`, `RED`) are communicated through `LightBadge` (colour + distinct icon/shape + word) and a `4px` left accent border on timeline entries—never colour alone.
3. **Explicit Non-Approvals on the Run Screen:**  
   `RunScreen` is an observation and hand-off screen, never an approval UI. `YELLOW` orders show a calm-urgent `"Waiting for your approval"` state (and hand off to Spec 004 via `onApprovalNeeded`); `RED` orders show `"Order blocked"` with reasons and visibly **zero** approve/override controls.
4. **Projector-First Legibility (`1920×1080`) & Laptop Fit (`1366×768`):**  
   At `≥ 1440px` (`xl:`), base body copy is `24px` (`1.5rem`), plan totals and the game clock scale cleanly (`56px` clock), and 3-column plan cards fit side-by-side without horizontal overflow. Below `1440px` (`1366×768`), typography steps down to `16px–18px` with comfortable padding and zero horizontal scroll.

---

## 2. Shared Design Tokens (Reused from 002 + Marked Additions)

Reuse the `@theme` block from `docs/design/002-mandate-screen.md` §2 **unchanged**. Add only the following tokens to `frontend/src/index.css` `@theme` for Spec 003:

```css
  /* === Spec 003 Additions (append inside @theme in src/index.css) === */
  --color-light-green-border: #86EFAC;   /* Subtle card/badge border for GREEN */
  --color-light-blue-border: #7DD3FC;    /* Subtle card/badge border for BLUE */
  --color-light-yellow-border: #FDE047;  /* Subtle card/badge border for YELLOW */
  --color-light-red-border: #FCA5A5;     /* Subtle card/badge border for RED */

  --color-code-bg: #0B1B33;              /* Raw gateway JSON <pre> background */
  --color-code-ink: #E2E8F0;             /* Raw gateway JSON text (13.98:1 on #0B1B33) */

  --color-tag-overlay-bg: #EEF2FF;       /* "Scenario adjustment" neutral badge fill */
  --color-tag-overlay-ink: #3730A3;      /* "Scenario adjustment" text */
```

### Contrast Verification Summary
| Pair | Ratio | Standard |
|---|---|---|
| `--color-light-green` (`#15803D`) on `--color-light-green-bg` (`#DCFCE7`) | **4.57:1** | Passes AA (4.5:1) |
| `--color-light-blue` (`#0369A1`) on `--color-light-blue-bg` (`#E0F2FE`) | **5.17:1** | Passes AA (4.5:1) |
| `--color-light-yellow` (`#A16207`) on `--color-light-yellow-bg` (`#FEF9C3`) | **4.58:1** | Passes AA (4.5:1) |
| `--color-light-red` (`#B91C1C`) on `--color-light-red-bg` (`#FEE2E2`) | **5.30:1** | Passes AA (4.5:1) |
| `--color-code-ink` (`#E2E8F0`) on `--color-code-bg` (`#0B1B33`) | **13.98:1** | Exceeds AAA (7:1) |
| `--color-ink` (`#0B1B33`) on `--color-surface` (`#FFFFFF`) | **17.23:1** | Exceeds AAA (7:1) |
| `--color-ink-muted` (`#3B4E6B`) on `--color-surface` (`#FFFFFF`) | **8.44:1** | Exceeds AAA (7:1) |

---

## 3. Type Scale & Spacing (Reused from 002 + Run Screen Roles)

Base scale from `002` §3 applies. Run-screen-specific roles:

| Role | `1920×1080` (`xl:` / `>= 1440px`) | `1366×768` (`< 1440px`) | Weight / Tracking |
|---|---|---|---|
| Game Clock (`role="timer"`) | `56px` (`3.5rem`), LH `1.05` | `40px` (`2.5rem`), LH `1.05` | `700`, `tabular-nums`, `--font-mono` |
| Panel Headings (`Customer`, `Agent timeline`) | `32px` (`2rem`), LH `1.2` | `24px` (`1.5rem`), LH `1.25` | `700`, `-0.015em` |
| Manager Brief & Entry Titles | `24px` (`1.5rem`), LH `1.5` | `18px` (`1.125rem`), LH `1.5` | `600` (titles), `400` (brief) |
| Plan Totals (`€1 308,00`) | `28px` (`1.75rem`), LH `1.2` | `22px` (`1.375rem`), LH `1.25` | `700`, `tabular-nums` |
| Plan Lines, Reason Chips, Badges | `18px` (`1.125rem`), LH `1.4` | `15px` (`0.9375rem`), LH `1.4` | `500`–`600` |
| Timestamps, Scores, Raw JSON | `16px` (`1rem`), LH `1.45` | `14px` (`0.875rem`), LH `1.45` | `500`, `tabular-nums`, `--font-mono` |

- **Outer container:** Full-width on `--color-canvas` (`max-width: 1760px` centred), horizontal padding `32px` at `1080p` (`24px` at `768p`), vertical padding `24px` at `1080p` (`16px` at `768p`), column gap `28px` at `1080p` (`20px` at `768p`).

---

## 4. Layout Specification

### 4.1 `1920×1080` (Projector) & `1366×768` (Laptop)
Two-column grid (`grid-cols-1 lg:grid-cols-[minmax(320px,35%)_1fr]`):

```text
+-----------------------------------+-----------------------------------------------+
| LEFT PANEL (~35%, sticky top)     | RIGHT PANEL (~65%, vertical scroll)           |
|                                   |                                               |
| [Customer pill: Hotel Aurora]     | Agent timeline                                |
| Level 1: The Weekly Order         |                                               |
|                                   | +-------------------------------------------+ |
| +-------------------------------+ | | 10:01  [Search]  Searched the catalog…  ▾ | |
| | Kitchen manager               | | +-------------------------------------------+ |
| | "We need 1,000 l of           | |                                               |
| |  lactose-free milk by…"       | | +-------------------------------------------+ |
| +-------------------------------+ | | 10:02  [Quote]   3 plans · [Yellow]     ▾ | |
|                                   | |   [Best ★ Recommended] [Better] [Good]    | |
| Deliver by:  Mon 16 Nov 06:00     | +-------------------------------------------+ |
| Order cut-off: 14:00              |                                               |
|                                   | +-------------------------------------------+ |
| +-------------------------------+ | | 10:03  [Order]   Waiting for your…  [Y] ▾ | |
| | GAME CLOCK                    | | +-------------------------------------------+ |
| | 10:03                         | |                                               |
| +-------------------------------+ |                                               |
|                                   |                                               |
| [        See result        ]      |                                               |
| (appears only when run finishes)  |                                               |
+-----------------------------------+-----------------------------------------------+
```

- **Left Panel (~35%):** `position: sticky; top: 24px; align-self: start;` on `lg:` (`≥ 1024px`). Contains:
  1. **Customer & Level Header:** Customer badge (`start.level.customer.name`) + Level title (`<h1>`, `tabIndex={-1}`).
  2. **Manager's Request Chat Bubble:** `--color-surface` card with `--color-brand-subtle` left accent (`4px solid --color-brand`), speech-bubble tail or `"Kitchen manager"` overline, and `start.level.brief` verbatim.
  3. **Schedule Strip:** 2-column compact grid on `--color-surface-subtle` (`--radius-control`) showing `Deliver by` (`formatDateTime(start.level.deadline)`) and `Order cut-off` (`formatTime(start.level.closingTime)`).
  4. **Game Clock Card:** High-contrast `--color-surface` card with `1.5px solid --color-border`. Label `"Game clock"` + `<div role="timer">` showing `HH:MM` (`gameTimeAt(start.clock, elapsedMs)`).
  5. **Finished CTA:** `"See result"` primary button (`--color-brand`, full width of left panel, `min-height: 52px`) rendered **only** after `nextStep` returns `null`. Placing it in the sticky left panel guarantees visibility above the fold at both `1920×1080` and `1366×768` without scrolling.
- **Right Panel (~65%):**
  1. **Section Heading:** `<h2>` `"Agent timeline"` + subtle count/status subtitle.
  2. **Timeline Log (`role="log"`, `aria-label="Agent timeline"`):** Vertical stack (`gap: 16px` at `1080p`, `gap: 12px` at `768p`), chronological top-to-bottom (newest at the bottom).
  3. **Auto-Scroll:** Whenever a new entry reveals, call `scrollIntoView({ behavior: shouldReduce ? 'auto' : 'smooth', block: 'nearest' })` on the newly revealed entry unless the user has manually scrolled away from the bottom.
  4. **Error Alert:** When `nextStep` rejects, render a `role="alert"` banner (`--color-error-surface` / `--color-error-ink`, identical to 002 §5.4) below the already revealed entries. Do **not** clear revealed entries and do **not** render `"See result"`.

---

## 5. Component Specifications

### 5.1 `LightBadge` (`src/components/LightBadge.tsx`) — Shared Across Specs 003–007
- **Props:** `{ light: Light; label?: string }` (`Light = "GREEN" | "BLUE" | "YELLOW" | "RED"`).
- **Root element:** `<span data-light={light} className="...">` inline-flex pill (`border-radius: --radius-chip`, `padding: 4px 12px`, `gap: 6px`, `font-weight: 600`, `border: 1.5px solid ...`).
- **Never colour alone:** Every badge renders an inline SVG icon (`16px × 16px`, `aria-hidden="true"`) + visible text label (default: `Green`, `Blue`, `Yellow`, `Red`, overridable via `label`).

| `light` | Default Label | Icon (`aria-hidden="true"`) | Background | Text & Icon | Border |
|---|---|---|---|---|---|
| `GREEN` | `Green` | Checkmark inside circle | `--color-light-green-bg` (`#DCFCE7`) | `--color-light-green` (`#15803D`) | `--color-light-green-border` (`#86EFAC`) |
| `BLUE` | `Blue` | `i` info inside circle | `--color-light-blue-bg` (`#E0F2FE`) | `--color-light-blue` (`#0369A1`) | `--color-light-blue-border` (`#7DD3FC`) |
| `YELLOW` | `Yellow` | Exclamation triangle | `--color-light-yellow-bg` (`#FEF9C3`) | `--color-light-yellow` (`#A16207`) | `--color-light-yellow-border` (`#FDE047`) |
| `RED` | `Red` | Octagon / X-circle | `--color-light-red-bg` (`#FEE2E2`) | `--color-light-red` (`#B91C1C`) | `--color-light-red-border` (`#FCA5A5`) |

---

### 5.2 Timeline Entry Card Anatomy (`TimelineEntry`)
Each entry is an `<article>` on `--color-surface` (`--radius-card`, `border: 1px solid --color-border`), with a `4px` left accent border (`--color-light-{green|blue|yellow|red}` when `light !== null`, or `--color-border-strong` when `light === null`).

1. **Interactive Header (`<button type="button" aria-expanded={expanded}>`):**
   - Full-width clickable row (`min-height: 56px`, `padding: 16px 20px`, `text-align: left`).
   - **Focus-visible:** `box-shadow: var(--shadow-focus); outline: none`.
   - **Left cluster:** Game time (`HH:MM`, `--font-mono`, `tabular-nums`, `--color-ink-muted`) + Kind pill (`Search` with magnifying-glass SVG, `Quote` with document-text SVG, or `Order` with shopping-cart/package SVG).
   - **Center cluster:** Entry title (`--color-ink`, `font-weight: 600`) + Reason chips (`--color-surface-subtle` pills showing `REASON_TEXT[code]`).
   - **Right cluster:** `LightBadge` (when `entry.light !== null`) + Chevron icon (`aria-hidden="true"`, rotates `180deg` when `aria-expanded="true"`, transition `150ms` suppressed under `prefers-reduced-motion`).

2. **Step-Kind Body (visible when entry is revealed):**
   - **Search (`kind === "search"`):**
     - `light: null`.
     - Title: `Searched the catalog: {total} products, {n} excluded`.
     - If any search result has `excluded: true`: render an **"Excluded products"** sub-list where each row shows product `name` (fallback `productId`), a RED `LightBadge` (`light="RED"`), and `REASON_TEXT[reason]` (or `reason` fallback).
   - **Quote (`kind === "quote"`):**
     - `light` = recommended plan's `policy.light`.
     - **Optional Tags Row:**
       - If `quote.scenarioOverlay === true`: render `"Scenario adjustment"` badge (`--color-tag-overlay-bg` / `--color-tag-overlay-ink`).
       - If `nonValioBrands(quote, search)` is non-empty: render inline info note (`--color-surface-subtle`, `border-left: 3px solid --color-brand`): `"Recommended plan uses another brand: {brands}."`
     - **Plan Options Grid (`best` / `better` / `good`):**
       - `grid-cols-1 xl:grid-cols-3 gap-3` at `1080p` (`md:grid-cols-3 gap-2.5` at `768p`).
       - Each plan card (`--radius-control`, `padding: 14px 16px`):
         - **Default (`recommended: false`):** `--color-surface`, `1px solid --color-border`.
         - **Recommended (`recommended: true`):** `--color-brand-subtle` subtle header tint (`#E0ECFA` at 40% or `#F0F6FD` on card), `2px solid --color-brand` border, and a `"Recommended"` pill (`--color-brand` fill, `#FFFFFF` text) next to the tier label (`Best` / `Better` / `Good`).
         - **Card contents (top to bottom):**
           1. Tier label (`Best` / `Better` / `Good`) + optional `"Recommended"` badge + `LightBadge` (`plan.policy.light`).
           2. Total price: `formatMoney(plan.totalCents)` (`tabular-nums`, bold).
           3. On-time delivery: `{formatQuantity(plan.onTimeQty)} of {formatQuantity(need.quantity)} on time`.
           4. Score: `Score {commaDecimal}` (e.g. `Score 0,94`, `tabular-nums`, `--color-ink-muted`).
           5. `plan.summary` (when present, `--color-ink-muted`).
           6. Plan lines list: each line shows product `name` from `search.results` (fallback `productId`) + `formatQuantity(line.quantity)`.
     - **Excluded Products (`quote.excludedProducts`):** If non-empty, render **"Excluded products"** sub-list with RED `LightBadge` and `REASON_TEXT` for each item.
   - **Order (`kind === "order"`):**
     - **`201` (`status: "ORDERED"`):** `LightBadge` (`GREEN` or `BLUE`), status text `"Order placed"`, plan/order summary (`orderId` in `--font-mono`).
     - **`202` (`status: "PENDING_APPROVAL"`):**
       - `LightBadge` (`YELLOW`).
       - While `onApprovalNeeded` promise is pending: `--color-light-yellow-bg` callout strip (`border: 1.5px solid --color-light-yellow-border`) with an attention dot (`motion-safe:animate-pulse`, static under `motion-reduce:animate-none`) and text **"Waiting for your approval"**.
       - After `onApprovalNeeded` promise resolves: strip settles to calm neutral `--color-surface-subtle` with text **"Approval requested"** (no decision claimed; Spec 004 owns decisions).
       - **Hard rule:** Zero buttons matching `/approve/i` anywhere in `RunScreen`.
     - **`403` (`status: "BLOCKED"`):**
       - `LightBadge` (`RED`).
       - `--color-light-red-bg` callout strip (`border: 1.5px solid --color-light-red-border`): **"Order blocked"** + gateway `error.message` + `REASON_TEXT` chips.
       - **Hard rule:** Visibly no approve or override affordance.
     - **`409` (`status: "ERROR"`, `QUOTE_EXPIRED`):**
       - `light: null`, neutral `--color-surface-subtle` callout with error code `QUOTE_EXPIRED` and gateway `error.message`.

3. **Expanded Raw-Data & Rule Panel (visible when `aria-expanded="true"`):**
   - Separated by `1px solid --color-border`, `padding: 16px 20px`, `--color-surface-subtle` background.
   - **Section 1 — `"Rule applied"`:**
     - Heading: `"Rule applied"` (`font-weight: 600`).
     - List (`<ul>`) of each reason code in monospace (`OVER_ORDER_LIMIT`) + plain-English `REASON_TEXT[code]`.
     - For `202` orders, also render `approval.reasonText` as a highlighted paragraph below the list.
   - **Section 2 — `"Raw gateway data"`:**
     - Heading: `"Raw gateway data"` (`font-weight: 600`).
     - `<pre>` block: `--color-code-bg` (`#0B1B33`), `--color-code-ink` (`#E2E8F0`), `--font-mono`, `padding: 14px 16px`, `border-radius: --radius-control`, `max-height: 280px`, `overflow: auto`, containing formatted JSON (`JSON.stringify(rawPayload, null, 2)`, includes `quoteId`).

---

## 6. Game Clock & Step Reveal Animation

### 6.1 Game Clock (`role="timer"`)
- Displays `gameTimeAt(start.clock, elapsedMs)` in `HH:MM` (`tabular-nums`, `--font-mono`).
- Status indicator beside/below the digits:
  - Active: small brand-blue dot (`motion-safe:animate-pulse`) + `"Running"` (continues ticking during `YELLOW` approval hand-off).
  - Finished (`nextStep` returned `null`) or reached `clock.end`: static dot + `"Stopped"` (or `"Cut-off reached"`).
- Set `aria-live="off"` on `role="timer"` so screen readers do not announce every game-minute tick.

### 6.2 Step Reveal Animation + Reduced-Motion Fallback
Define in `frontend/src/index.css`:
```css
@keyframes timeline-entry-reveal {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```
- **Full Motion:** Apply `motion-safe:animate-[timeline-entry-reveal_260ms_cubic-bezier(0.22,1,0.36,1)_both]` to each newly mounted `TimelineEntry` card.
- **Reduced Motion (`prefers-reduced-motion: reduce`):** Apply `motion-reduce:animate-none` (instant appearance, no translate/scale/pulse).

---

## 7. Accessibility & Keyboard Navigation

1. **Landmarks & Headings:**
   - Left panel: `<aside aria-label="Task and game clock">` (or `<section>`), `<h1>` for level title (`tabIndex={-1}`, focused on screen mount).
   - Right panel: `<section aria-label="Agent timeline">`, `<h2>` `"Agent timeline"`, `<div role="log" aria-label="Agent timeline" aria-live="polite">`.
2. **Keyboard Operability:**
   - Every timeline entry header is a native `<button type="button" aria-expanded={isExpanded}>`. `Enter` or `Space` toggles the expanded `"Rule applied"` + `<pre>` panel.
   - `<pre>` raw JSON container has `tabIndex={0}` when scrollable so keyboard-only users can scroll long payloads.
   - `"See result"` is a native `<button type="button">`.
   - Every interactive control uses `focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none`.
3. **Prohibited Controls:**
   - No element anywhere in `RunScreen` may have an accessible name matching `/approve/i`.

---

## 8. Final UI Copy & Reason-Code Texts

Use typographic apostrophes (`’`) and ellipses (`…`).

| Element | Exact Copy |
|---|---|
| Manager brief label | `Kitchen manager` |
| Schedule labels | `Deliver by` · `Order cut-off` |
| Game clock label | `Game clock` · `Running` / `Stopped` |
| Timeline heading | `Agent timeline` |
| Search entry title | `Searched the catalog: {total} products, {n} excluded` |
| Quote tags | `Scenario adjustment` · `Recommended` |
| Quote neutrality note | `Recommended plan uses another brand: {brands}.` |
| Plan tier labels | `Best` · `Better` · `Good` |
| Plan on-time text | `{onTime} of {needed} on time` |
| Plan score text | `Score {score}` (2 decimals, comma, e.g. `Score 0,94`) |
| Excluded list heading | `Excluded products` |
| Order `201` status | `Order placed` |
| Order `202` waiting / handed-off | `Waiting for your approval` → `Approval requested` |
| Order `403` blocked status | `Order blocked` |
| Expanded panel headings | `Rule applied` · `Raw gateway data` |
| Finished primary CTA | `See result` |
| LightBadge default labels | `Green` · `Blue` · `Yellow` · `Red` |

### `REASON_TEXT` Table (`src/lib/reasons.ts`)

| Code | Exact Text |
|---|---|
| `WITHIN_MANDATE` | `Within your mandate.` |
| `SPLIT_ORDER` | `Split across products or delivery dates.` |
| `SUBSTITUTION_ALLOWED` | `Uses a substitute your mandate allows.` |
| `OVER_ORDER_LIMIT` | `Total is above your per-order limit.` |
| `OVER_WEEK_LIMIT` | `Week total is above your weekly limit.` |
| `SUBSTITUTION_NOT_ALLOWED` | `Uses a substitute your mandate doesn’t allow.` |
| `LATE_DELIVERY` | `Some quantity arrives after the deadline.` |
| `SALES_BLOCKED` | `Product is blocked from sale.` |
| `ALLERGEN_EXCLUDED` | `Contains an allergen your mandate excludes.` |
| `LABEL_REQUIRED` | `Lacks a label your mandate requires.` |
| `MANDATE_INVALID` | `Mandate is missing, unsigned or revoked.` |
| `MANDATE_EXPIRED` | `Mandate has expired.` |
| `DATA_BOUNDARY` | `Outside this customer’s data.` |
| `ATTENTION_EXHAUSTED` | `No hearts left: the manager was too busy to answer.` |
| `PRICE_UNAVAILABLE` | `No price available for this customer.` |
