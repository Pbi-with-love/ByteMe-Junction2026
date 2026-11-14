# Design Handoff — 006: Valio Aimo View (Operator Console)

> **Owner:** Antigravity (Argon) · **Implementer:** Codex (GPT-6 Luna)  
> **Scope:** `docs/design/006-valio-view.md` only. Reuses shared tokens from `docs/design/002-mandate-screen.md` and `LightBadge` + overlay tokens from `docs/design/003-agent-timeline.md` verbatim.

---

## 1. Design Decisions & Rationale

1. **Clear Perspective Shift to Valio Aimo’s Operator Side:**  
   Buyer screens (002–005) rest on a light paper-and-desk aesthetic. When the presenter clicks **“See it from Valio Aimo’s side”**, the screen anchors with a full-width deep-navy operator header (`--color-operator-header` `#0B1B33`) and a quiet `"Operator · read-only"` badge. This immediately signals to hackathon judges that we have crossed the trust boundary into Valio Aimo’s gateway console—while staying 100% within the Valio-inspired blue/white palette.
2. **One-Screen Projector Story (`1920×1080`):**  
   The layout is engineered so Level 1 (~10 events, 1 agent, 1 `DATA_BOUNDARY_BLOCKED`, 1 `SCENARIO_OVERLAY`, 3–4 disclosure rows) fits on a single `1920×1080` viewport **without scrolling the page**:
   - **Top:** Operator header bar.
   - **Upper strip:** `Data boundary` (3 horizontal tiers so judges see the rules first).
   - **Main 2-column grid (`38% / 62%`):** Left column stacks `Active agents`, `Blocked attempts` (RED cards, zero buttons), and `Scenario adjustments` (indigo-tinted overlay cards); right column showcases the `Returned to agent vs withheld` audit table.
   - For longer levels (Level 2 / Level 3), internal scroll regions (`Blocked attempts` list and `Returned to agent vs withheld` table body) keep the header and `Data boundary` anchored on `1080p`, while `1366×768` stacks cleanly into a single column with zero horizontal overflow.
3. **Never Relying on Colour Alone for “Never Exposed” & Policy Lights:**  
   - Policy lights use the shared `LightBadge` (`src/components/LightBadge.tsx`: colour + SVG icon + text).
   - `Never exposed` items (both in the `Data boundary` tier and in the `Withheld` table column) use a dark-slate locked chip (`#1E293B` fill, `#F8FAFC` text, padlock SVG icon `aria-hidden="true"`, and explicit `"never exposed"` text) so they stand out unmistakably from `Public`, `Customer-scoped`, and ordinary withheld items without overlapping with `RED` policy badges or `error` alerts.
4. **Scenario Adjustments Visibly Distinct from Real Gateway Data:**  
   Events with `actor: "scenario"` use the `--color-tag-overlay-bg` (`#EEF2FF`) / `--color-tag-overlay-ink` (`#3730A3`) palette from Spec 003 paired with a `2px dashed` border and an explicit `"Scenario adjustment"` pill, visually separating simulated twists from real Valio Aimo gateway traffic.

---

## 2. Design Tokens (Reused from 002 & 003 + Marked Additions)

Reuse the `@theme` block from `docs/design/002-mandate-screen.md` §2 and the Spec 003 additions (`--color-light-*-border`, `--color-tag-overlay-bg`, `--color-tag-overlay-ink`) **unchanged**.  
Add **only** the following tokens to `frontend/src/index.css` `@theme` for Spec 006:

```css
  /* === Spec 006 Additions (append inside @theme in src/index.css) === */
  --color-operator-header: #0B1B33;       /* Deep Valio-navy top bar (matches --color-ink) */
  --color-operator-pill-bg: #1E3A5F;      /* "Operator · read-only" pill fill on dark header */
  --color-operator-pill-ink: #E0ECFA;     /* "Operator · read-only" pill text (9.1:1 on #1E3A5F) */
  --color-operator-pill-border: #3B5F8F;  /* Subtle pill border on dark header */

  --color-locked-bg: #1E293B;             /* "Never exposed" locked chip fill */
  --color-locked-ink: #F8FAFC;            /* "Never exposed" locked chip text (13.9:1 on #1E293B) */
  --color-locked-border: #0F172A;         /* "Never exposed" locked chip border */

  --color-tag-overlay-border: #A5B4FC;    /* Dashed/accent border for Scenario adjustment cards */
```

### Contrast Verification Summary (Spec 006 Additions)
| Pair | Ratio | Standard |
|---|---|---|
| `#FFFFFF` on `--color-operator-header` (`#0B1B33`) | **16.9:1** | Exceeds AAA (7:1) |
| `--color-operator-pill-ink` (`#E0ECFA`) on `--color-operator-pill-bg` (`#1E3A5F`) | **9.1:1** | Exceeds AAA (7:1) |
| `--color-locked-ink` (`#F8FAFC`) on `--color-locked-bg` (`#1E293B`) | **13.9:1** | Exceeds AAA (7:1) |
| `--color-tag-overlay-ink` (`#3730A3`) on `--color-tag-overlay-bg` (`#EEF2FF`) | **8.7:1** | Exceeds AAA (7:1) |
| `--color-ink` (`#0B1B33`) on `--color-surface` (`#FFFFFF`) | **16.9:1** | Exceeds AAA (7:1) |

---

## 3. Type Scale & Spacing

All body copy at `1920×1080` is `≥ 20px` (`1.25rem`) for projector legibility.

| Role | `1920×1080` (`xl:` / `>= 1440px`) | `1366×768` (default `< 1440px`) | Weight / Tracking |
|---|---|---|---|
| Screen Title (`<h1>` `"Valio Aimo view"`) | `32px` (`2rem`), LH `1.15` | `24px` (`1.5rem`), LH `1.2` | `700`, `-0.02em` |
| Section Headings (`<h2>`, all 5) | `24px` (`1.5rem`), LH `1.25` | `20px` (`1.25rem`), LH `1.3` | `700`, `-0.01em` |
| Body, Table Cells, Summaries | `20px` (`1.25rem`), LH `1.45` | `16px` (`1rem`), LH `1.45` | `400` (`600` on headers) |
| Tier Chips, Reason Chips, Badges | `16px` (`1rem`), LH `1.3` | `14px` (`0.875rem`), LH `1.3` | `600` |
| Monospace IDs, Times (`HH:MM`), Codes | `16px` (`1rem`), LH `1.35` | `14px` (`0.875rem`), LH `1.35` | `500`, `tabular-nums`, `--font-mono` |

- **Outer container:** Full-width `--color-canvas` (`#F3F6FA`), content `max-width: 1840px` centred.
- **Page padding:** `px-8 py-4` (`32px` horizontal, `16px` vertical) at `1080p`; `px-5 py-4` (`20px` / `16px`) at `768p`.
- **Section card padding:** `p-4` (`16px`) at `1080p` to keep Level 1 within `1080px` height; `p-4` at `768p`.

---

## 4. Layout Specification

### 4.1 `1920×1080` (Projector — Level 1 Fits Without Page Scroll)

```text
+---------------------------------------------------------------------------------------------------+
| [VALIO AIMO VIEW]   (Operator · read-only)                                    [ Back to results ] |
+---------------------------------------------------------------------------------------------------+
| Data boundary                                                                                     |
| +-------------------------------+ +-------------------------------+ +---------------------------+ |
| | Public                        | | Customer-scoped               | | Never exposed (locked)    | |
| | [catalog] [labels]            | | [prices] [quotes]             | | [🔒 purchasePrices]       | |
| | [certificates] [categoryCarb] | | [orders] [log]                | | [🔒 margins] [🔒 ...]     | |
| +-------------------------------+ +-------------------------------+ +---------------------------+ |
+---------------------------------------------------------------------------------------------------+
| LEFT COLUMN (38%)                               | RIGHT COLUMN (62%)                              |
|                                                 |                                                 |
| Active agents                                   | Returned to agent vs withheld                   |
| +---------------------------------------------+ | +------+-------+-------+------------+---------+ |
| | Agent               | Customer | Mandates   | | | Time | Agent | Call  | Returned   | Withheld| |
| | kitchenbuyer-hotel… | 123      | mdt_01     | | |------+-------+-------+------------+---------| |
| +---------------------------------------------+ | | 10:01| kit…  | SEARCH| [catalog]  | [sup…]  | |
|                                                 | | |      |       |       | [labels]   |         | |
| Blocked attempts                                | | |------+-------+-------+------------+---------| |
| +---------------------------------------------+ | | 10:02| kit…  | DATA_ | Nothing    | [🔒purc | |
| |▌ [🔴 Red]  10:02 · kitchenbuyer-hotel…      | | |      |       | BOUN… |            | never   | |
| |▌ DATA_BOUNDARY_BLOCKED  [DATA_BOUNDARY]     | | |      |       |       |            | exposed]| |
| |▌ Agent asked for purchase prices; refused.  | | |------+-------+-------+------------+---------| |
| |▌ (zero buttons)                             | | | 10:03| kit…  | QUOTE_| [netPrices]| [🔒purc | |
| +---------------------------------------------+ | |      |       | CREA… | [quotes]   | never   | |
|                                                 | | |      |       |       |            | exposed]| |
| Scenario adjustments                            | | +------+-------+-------+------------+---------+ |
| + - - - - - - - - - - - - - - - - - - - - - - + |                                                 |
| | [Scenario adjustment]  10:00                | |                                                 |
| | Level 1 loaded (no overlay needed).         | |                                                 |
| + - - - - - - - - - - - - - - - - - - - - - - + |                                                 |
+---------------------------------------------------------------------------------------------------+
```

- **Vertical budget at `1920×1080` (Level 1):**
  - Header bar: `~68px`
  - `Data boundary` strip: `~130px`
  - Main 2-column grid (`grid-cols-1 xl:grid-cols-[minmax(460px,38%)_1fr] gap-5`): `~680px`
  - Total height: `~910px` (comfortably inside `1080px` with `~170px` breathing room, **zero page scroll**).
- **What scrolls if longer (Level 2 / Level 3):**
  - On `xl:` (`>= 1440px`), the `Returned to agent vs withheld` table wrapper uses `xl:max-h-[680px] xl:overflow-y-auto` (with `thead` sticky: `sticky top-0 bg-[var(--color-surface-subtle)] z-10`).
  - The `Blocked attempts` list uses `xl:max-h-[280px] xl:overflow-y-auto` when > 2 items.
  - Scrollable containers receive `tabIndex={0}` only when overflowing (or standard `overflow-y-auto` region) so keyboard users can scroll them.

### 4.2 `1366×768` (Laptop)
- `Data boundary` tiers: `grid-cols-1 md:grid-cols-3 gap-3`.
- Main 2-column grid collapses to single-column stack (`grid-cols-1 gap-4`):
  1. `Data boundary`
  2. `Active agents`
  3. `Blocked attempts`
  4. `Scenario adjustments`
  5. `Returned to agent vs withheld` (wrapped in `overflow-x-auto` so the 5-column table never causes page-level horizontal overflow).
- Typography steps down to the `< 1440px` column in §3 (`16px` body, `20px` `<h2>`, `24px` `<h1>`).

---

## 5. Section & Component Specifications

### 5.1 Operator Header (`<header>`)
- Full-width `--color-operator-header` (`#0B1B33`) with bottom border `2px solid --color-brand` (`#0052B4`).
- Left cluster:
  - `<h1>` (`tabIndex={-1}`): `"Valio Aimo view"` (`text-white font-bold`).
  - Tag `<span>`: `"Operator · read-only"` (`bg-[var(--color-operator-pill-bg)] text-[var(--color-operator-pill-ink)] border border-[var(--color-operator-pill-border)] rounded-full px-3 py-1 text-sm font-semibold`).
- Right cluster:
  - `<button type="button">`: `"Back to results"` (`bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-brand-subtle)] font-semibold rounded-[var(--radius-control)] px-5 min-h-[44px]`).

### 5.2 Section 1: `Data boundary`
- Card (`--color-surface`, `1px solid --color-border`, `--radius-card`), `<h2>` `"Data boundary"`.
- Three labelled lists (`grid-cols-1 md:grid-cols-3 gap-4`), each with an `<h3>` and `<ul>` of `<li>` chips:
  1. **`Public`**: `--color-surface-subtle` (`#EBF1F8`) fill, `--color-ink` text, `1px solid --color-border`.
  2. **`Customer-scoped`**: `--color-brand-subtle` (`#E0ECFA`) fill, `--color-ink` text, `1px solid --color-brand`.
  3. **`Never exposed`**: Visually strongest — `--color-locked-bg` (`#1E293B`) fill, `--color-locked-ink` (`#F8FAFC`) text, `1.5px solid --color-locked-border` (`#0F172A`), leading padlock SVG icon (`16px × 16px`, `aria-hidden="true"`).
- Items come verbatim from `discovery.dataDisclosure.public`, `.customerScoped`, `.neverExposed`.

### 5.3 Section 2: `Active agents`
- Card (`--color-surface`, `1px solid --color-border`, `--radius-card`), `<h2>` `"Active agents"`.
- Real `<table>` with `<caption className="sr-only">Active agents</caption>`:
  - `<thead>` `<th scope="col">`: `"Agent"`, `"Customer"`, `"Mandates"`.
  - `<tbody>`: one `<tr>` per distinct `agentId` in `valioLog` events (in `seq` order of first appearance):
    - `Agent`: `agentId` (`--font-mono`, `--color-ink`, `font-semibold`).
    - `Customer`: `customerId` (`--font-mono`, `--color-ink-muted`).
    - `Mandates`: every `refs.mandateId` from that agent’s `MANDATE_SIGNED` events as `--color-brand-subtle` monospace pills (or `"None"` in `--color-ink-muted` if none).

### 5.4 Section 3: `Blocked attempts`
- Card (`--color-surface`, `1px solid --color-border`, `--radius-card`), `<h2>` `"Blocked attempts"`.
- Includes every event where `light === "RED"` OR `type` is `"POLICY_BLOCKED"` or `"DATA_BOUNDARY_BLOCKED"`, in `seq` order.
- Each item is an `<article>` (or `<li>` inside `<ul>`) with:
  - `--color-light-red-bg` (`#FEE2E2`) subtle header or crisp `--color-surface` card with `4px solid --color-light-red` (`#B91C1C`) left border and `1px solid --color-light-red-border` (`#FCA5A5`).
  - Top row: `LightBadge` (`light="RED"`), `formatTime(event.at)` (`--font-mono`), `event.agentId` (`--font-mono`).
  - Middle row: `event.type` (`--font-mono font-semibold`) + reason-code pills (`event.reasons`, `--font-mono bg-[var(--color-light-red-bg)] text-[var(--color-light-red)] border border-[var(--color-light-red-border)]`).
  - Summary: `event.summary` (`--color-ink`).
  - **Hard rule:** Zero `<button>` elements anywhere in this section (`RED` is never overridable).
- **Empty state:** When 0 blocked events, render `"No blocked attempts."` in a calm `--color-surface-subtle` box (`--color-ink-muted`).

### 5.5 Section 4: `Scenario adjustments`
- Card (`--color-surface`, `1px solid --color-border`, `--radius-card`), `<h2>` `"Scenario adjustments"`.
- Includes every event with `actor === "scenario"`, in `seq` order.
- Each item is styled distinctly from real gateway events:
  - Background `--color-tag-overlay-bg` (`#EEF2FF`), `2px dashed --color-tag-overlay-border` (`#A5B4FC`), `--radius-control`, `padding: 12px 16px`.
  - Pill badge: `"Scenario adjustment"` (`bg-[var(--color-tag-overlay-ink)] text-white px-2.5 py-0.5 rounded-full text-sm font-semibold`).
  - Timestamp: `formatTime(event.at)` (`--font-mono text-[var(--color-tag-overlay-ink)]`).
  - Summary: `event.summary` (`--color-ink`).
- **Empty state:** When 0 scenario events, render `"No scenario adjustments."` in a calm `--color-surface-subtle` box (`--color-ink-muted`).

### 5.6 Section 5: `Returned to agent vs withheld`
- Card (`--color-surface`, `1px solid --color-border`, `--radius-card`), `<h2>` `"Returned to agent vs withheld"`.
- Real `<table>` with `<caption className="sr-only">Returned to agent vs withheld</caption>`:
  - `<thead>` `<th scope="col">`: `"Time"`, `"Agent"`, `"Call"`, `"Returned to agent"`, `"Withheld"` (exact header text per AC10).
  - `<tbody>`: one `<tr>` per event in `valioLog` that has `disclosure` (in `seq` order):
    - `Time`: `formatTime(event.at)` (`--font-mono tabular-nums whitespace-nowrap`).
    - `Agent`: `event.agentId` (`--font-mono`).
    - `Call`: `event.type` (`--font-mono font-semibold`).
    - `Returned to agent`: `<ul>` of chips (`--color-surface-subtle`, `1px solid --color-border`, `--color-ink`) for each item in `disclosure.returnedToAgent`. If empty, render `"Nothing"` (`--color-ink-muted italic`).
    - `Withheld`: `<ul>` of chips for each item in `disclosure.withheld`. If empty, render `"Nothing"` (`--color-ink-muted italic`).
      - **Standard withheld item** (not in `discovery.dataDisclosure.neverExposed`): `--color-surface-subtle` fill, `1px solid --color-border`, `--color-ink-muted` text.
      - **Never-exposed withheld item** (exact string match in `discovery.dataDisclosure.neverExposed`):
        - Dark locked chip: `bg-[var(--color-locked-bg)] text-[var(--color-locked-ink)] border-[1.5px] border-[var(--color-locked-border)]` (`#1E293B` / `#F8FAFC`).
        - Padlock SVG icon (`14px × 14px`, `aria-hidden="true"`).
        - Item name (`--font-mono font-semibold`) + visible tag `<span>never exposed</span>` (e.g. `bg-white/15 px-1.5 py-0.5 rounded text-xs uppercase tracking-wide`), guaranteeing both visual prominence without colour alone and the accessible text `"never exposed"` (AC10).

---

## 6. Screen States

1. **Loading State:**  
   On mount while `client.discovery()` and `client.getLog("valio")` are pending, render centered in `<main>` on `--color-canvas`:
   - Text: `"Loading Valio view…"` (`text-xl font-semibold text-[var(--color-ink)]`).
   - Do not render the five `<h2>` sections yet.
2. **Error State (`role="alert"`):**  
   If either `discovery()` or `getLog("valio")` rejects:
   - Render the Operator Header (`<h1>` `"Valio Aimo view"` + working `"Back to results"` `<button>`).
   - Render a `role="alert"` banner (`--color-error-surface` `#FDF2F5`, `border: 1.5px solid --color-error-ink`, `border-left: 5px solid --color-error-ink`, warning triangle SVG `aria-hidden="true"`, bold `"Error:"` prefix + `GatewayError.message`).
   - Render **none** of the five `<h2>` sections (AC12).
3. **Empty States:**  
   - `Blocked attempts` empty → `"No blocked attempts."`
   - `Scenario adjustments` empty → `"No scenario adjustments."`
   - `Returned to agent` or `Withheld` cell empty → `"Nothing"`
4. **No-Secrets Enforcement (G-05):**  
   Render only fields validated by `LogEventSchema` (`at`, `agentId`, `type`, `reasons`, `summary`, `light`, `refs`, `disclosure`). Never render unparsed fields.

---

## 7. Accessibility & Keyboard Navigation

1. **Programmatic Focus on Mount:**  
   Focus `<h1>` (`"Valio Aimo view"`, `tabIndex={-1}`) when `ValioView` mounts.
2. **Keyboard Focus Order:**  
   1. `"Back to results"` `<button type="button">` in `<header>`
   2. Scrollable `Blocked attempts` region (only if overflowing, `tabIndex={0}`)
   3. Scrollable `Returned to agent vs withheld` table wrapper (only if overflowing, `tabIndex={0}`)
   - Focus ring on all focusable elements: `focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none`.
3. **Table & Landmark Semantics:**  
   - `<header>` for top bar, `<main>` for the five `<section aria-labelledby="...">` blocks.
   - Real `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th scope="col">`, `<td>` for both `Active agents` and `Returned to agent vs withheld`.
   - Zero `<button>` elements inside `Blocked attempts`.
4. **Reduced Motion:**  
   No animation is required; if any subtle transition is added on hover, honour `motion-reduce:transition-none`.

---

## 8. Final UI Copy (English, Typographic Quotes/Apostrophes)

| Element | Exact Copy |
|---|---|
| Result screen entry button (`Result.tsx`) | `See it from Valio Aimo’s side` |
| Loading state | `Loading Valio view…` |
| Screen heading (`<h1>`) | `Valio Aimo view` |
| Operator tag | `Operator · read-only` |
| Back button | `Back to results` |
| Section 1 heading (`<h2>`) | `Data boundary` |
| Section 1 tier headings (`<h3>`) | `Public` · `Customer-scoped` · `Never exposed` |
| Section 2 heading (`<h2>`) | `Active agents` |
| Section 2 table headers (`<th>`) | `Agent` · `Customer` · `Mandates` |
| Section 3 heading (`<h2>`) | `Blocked attempts` |
| Section 3 empty state | `No blocked attempts.` |
| Section 4 heading (`<h2>`) | `Scenario adjustments` |
| Section 4 item badge | `Scenario adjustment` |
| Section 4 empty state | `No scenario adjustments.` |
| Section 5 heading (`<h2>`) | `Returned to agent vs withheld` |
| Section 5 table headers (`<th>`) | `Time` · `Agent` · `Call` · `Returned to agent` · `Withheld` |
| Section 5 never-exposed marker | `never exposed` |
| Section 5 empty disclosure list | `Nothing` |
| Error banner prefix (`role="alert"`) | `Error:` |
