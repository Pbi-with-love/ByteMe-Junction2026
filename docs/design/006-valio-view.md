# Design Handoff — 006: Valio Aimo View (Pixel Back-Office Terminal)

> **Owner:** Antigravity (Argon) · **Implementer:** Codex (GPT-6 Luna)  
> **Scope:** `docs/design/006-valio-view.md` only. Rewritten for the 010 pixel-art game world (`docs/design/010-game-world.md`); supersedes the earlier web-style 006 handoff.  
> **Reuses:** 010 24-colour pixel palette, `--px` unit scale, `Pixelify Sans` / `Press Start 2P`, `PixelPanel` (`terminal`, `notice`, `alert`), button/focus tokens, and shared `LightBadge` (`GREEN` / `BLUE` / `YELLOW` / `RED`).

---

## 1. Design Decisions & Rationale

1. **Full Back-Office Terminal Screen (Kitchen Hidden Behind):**  
   Activating **“See it from Valio Aimo’s side”** in the result panel switches the active screen to `'valio'` (the kitchen subtree stays mounted with `hidden` so the PixiJS world and open result panel survive). The screen is crafted as Valio Aimo’s **pixel back-office terminal**—built on 010’s `terminal` frame (`#1E3A5F` brand-blue header bar, `#0B1B33` pixel outlines, `#60A5FA` status accents, pixel bevel highlights, and `#FFFFFF` high-contrast body panels; **no green-on-black**). One glance tells hackathon judges: *the gateway enforced the rules and kept secrets secret*.
2. **One-Screen Projector Story (`1920×1080`, `--px: 6px`):**  
   Level 2 (~12 events, ~5–7 disclosure rows) fits a single `1920×1080` viewport **without page scroll**:
   - **Top:** Full-width terminal header bar with pulsing status LED, `"Valio Aimo view"`, `"Operator · read-only"` badge, `"Back to results"` ghost button, and a pixel-striped bottom trim.
   - **Upper strip:** `Data boundary` (3 horizontal tiers so judges read the disclosure rules first).
   - **Main 2-column grid (`38% / 62%`):** Left column stacks `Active agents`, `Blocked attempts` (RED pixel cards, zero buttons), and `Scenario adjustments`; right column showcases the `Returned to agent vs withheld` audit table.
   - When a run is longer (e.g. Level 3), internal scroll regions (`Blocked attempts` list and `Returned to agent vs withheld` table body with sticky `<thead>`) keep the header and `Data boundary` anchored on `1080p`. At `1366×768` (`--px: 4px`), the grid stacks into a single column with zero horizontal overflow.
3. **Strict Policy Light & Error Isolation + Non-Colour Markers:**  
   - Policy lights use the shared `LightBadge` (`src/components/LightBadge.tsx`) and 010’s reserved light tokens.
   - System/gateway errors use 010’s `alert` rose-burgundy (`#881337` on `#FDF2F5`) with a warning triangle icon—never policy `RED`.
   - `Never exposed` items (in `Data boundary` and in `Withheld` cells) use a high-contrast dark locked chip (`#1E293B` / `#F8FAFC`), the **8×8 pixel lock sprite** (`lock_8x8`), and explicit `"never exposed"` text so they never rely on colour alone.
4. **Scenario Adjustments Visibly Distinct from Real Gateway Data:**  
   Events with `actor === "scenario"` use a dedicated indigo-tinted dashed pixel frame (`--color-overlay-bg` `#EEF2FF` / `--color-overlay-ink` `#3730A3` / `--color-overlay-border` `#818CF8`—marked additions so they never collide with Policy Light `BLUE` `#E0F2FE` / `#0369A1`) and an explicit `"Scenario adjustment"` pill.

---

## 2. Tokens & Pixel Art (010 Kit Reuse + Marked Additions)

### 2.1 Reused 010 Tokens (`docs/design/010-game-world.md` §2 & §7)
Reuse all 010 `@theme` tokens **unchanged**:
- **Scale & fonts:** `--px` (`4px` default `< 1440px` / `1366×768`; `6px` at `>= 1440px` / `1920×1080`), `--font-sans` (`Pixelify Sans`), `--font-display` (`Press Start 2P`), `--font-mono` (`Pixelify Sans`), `--text-title: calc(6 * var(--px))`, `--text-heading: calc(5 * var(--px))`, `--text-body: calc(4 * var(--px))`.
- **Surfaces & inks:** `--color-canvas` (`#EEF4FA`), `--color-surface` (`#FFFFFF`), `--color-surface-subtle` (`#D6E3F0`), `--color-ink` (`#0B1B33`), `--color-ink-muted` (`#475569`), `--color-brand` (`#0052B4`), `--color-brand-hover` (`#003E8A`), `--color-brand-subtle` (`#E0F2FE`), `--color-sky` (`#60A5FA`), `--color-terminal-bg` (`#1E3A5F`), `--color-border` (`#94A3B8`), `--color-border-strong` (`#0B1B33`).
- **Pixel shadows & focus:** `--shadow-pixel: calc(1 * var(--px)) calc(1 * var(--px)) 0 #0B1B33`, `--shadow-focus: 0 0 0 calc(0.5 * var(--px)) #FFFFFF, 0 0 0 calc(1.25 * var(--px)) #0052B4`.
- **Policy lights & alert:** `--color-light-{green,blue,yellow,red}` + `-bg`, `--color-error-surface` (`#FDF2F5`), `--color-error-ink` (`#881337`).

### 2.2 Marked Additions for Spec 006 (`frontend/src/index.css` `@theme`)
Add **only** these tokens for the Valio back-office screen:

```css
  /* === Spec 006 Marked Additions (append inside @theme in src/index.css) === */
  --color-locked-bg: #1E293B;        /* "Never exposed" locked chip fill */
  --color-locked-ink: #F8FAFC;       /* "Never exposed" locked chip text (13.9:1 on #1E293B) */
  --color-locked-border: #0B1B33;    /* Matches 010 deep navy outline */

  --color-overlay-bg: #EEF2FF;       /* Scenario adjustment card background */
  --color-overlay-ink: #3730A3;      /* Scenario adjustment badge & timestamp (8.7:1 on #EEF2FF) */
  --color-overlay-border: #818CF8;   /* Dashed pixel border for Scenario adjustment cards */
```

#### Contrast Verification (Spec 006 Additions + Terminal Header)
| Pair | Ratio | Standard |
|---|---|---|
| `#FFFFFF` on `--color-terminal-bg` (`#1E3A5F`) | **11.4:1** | Exceeds AAA (7:1) |
| `#FFFFFF` on `--color-ink` (`#0B1B33`, operator tag) | **17.23:1** | Exceeds AAA (7:1) |
| `--color-locked-ink` (`#F8FAFC`) on `--color-locked-bg` (`#1E293B`) | **13.9:1** | Exceeds AAA (7:1) |
| `--color-overlay-ink` (`#3730A3`) on `--color-overlay-bg` (`#EEF2FF`) | **8.7:1** | Exceeds AAA (7:1) |
| `--color-ink` (`#0B1B33`) on `--color-surface` (`#FFFFFF`) | **17.23:1** | Exceeds AAA (7:1) |

### 2.3 Marked Additions: 8×8 Pixel Icon Grids (`src/world/art.ts`)
All six icons are **8×8** and use **only** 010 §2 palette keys (`o` = `#0B1B33`, `w` = `#FFFFFF`, `c` = `#CBD5E1`, `b` = `#0052B4`, `s` = `#60A5FA`, `R` = `#B91C1C`, `.` = transparent). Render via `PixelSprite` with `image-rendering: pixelated` and `aria-hidden="true"` at `calc(3 * var(--px))` (`18×18px` at `1080p`, `12×12px` at `768p`? Wait: keep icon box `calc(4 * var(--px))` = `24×24px` at `1080p` / `16×16px` at `768p` for crisp integer `2×` / `3×` sprite scaling!).

**`lock_8x8`** (Never-exposed chips & withheld items):
```text
..oooo..
.ocwwco.
.oc..co.
oooooooo
owwwwwwo
owwoowwo
owwccwwo
oooooooo
```

**`shield_8x8`** (`Data boundary` header icon):
```text
oooooooo
obssssbo
obwwwwbo
obwbbwbo
obwbbwbo
.obbbbo.
..obbo..
...oo...
```

**`agent_8x8`** (`Active agents` header icon — mini robot head):
```text
...oo...
...so...
.oooooo.
owwwwwwo
owboobwo
owswwswo
occcccco
.oooooo.
```

**`block_8x8`** (`Blocked attempts` header icon — RED barrier):
```text
..oooo..
.oRRRRo.
oRRRRRRo
oRwwwwRo
oRwwwwRo
oRRRRRRo
.oRRRRo.
..oooo..
```

**`spark_8x8`** (`Scenario adjustments` header icon — scenario twist):
```text
...oo...
..osso..
.oswwso.
oswwwwso
oswwwwso
.oswwso.
..obbo..
...oo...
```

**`ledger_8x8`** (`Returned to agent vs withheld` header icon — split ledger):
```text
oooooooo
owwbowwo
owcbowco
owwbowwo
owcbowco
owwbowwo
occbocco
oooooooo
```

---

## 3. Typography & Minimum Size Rule

Per 010 §7 and 006 `## Design`, **no visible text may be smaller than `calc(4 * var(--px))`** (`24px` at `1920×1080`, `16px` at `1366×768`).

| Role | Token / Size | `1920×1080` (`--px: 6px`) | `1366×768` (`--px: 4px`) | Font |
|---|---|---|---|---|
| Screen Title (`<h1>` `"Valio Aimo view"`) | `calc(6 * var(--px))` | `36px`, LH `1.15` | `24px`, LH `1.2` | `Press Start 2P` |
| Section Headings (`<h2>`, all 5) | `calc(5 * var(--px))` | `30px`, LH `1.25` | `20px`, LH `1.25` | `Press Start 2P` |
| Body, `<h3>`, Table Headers/Cells, Chips, Badges, Times, IDs | `calc(4 * var(--px))` | `24px`, LH `1.35` | `16px`, LH `1.35` | `Pixelify Sans` |

- **Outer shell:** Full-viewport `--color-canvas` (`#EEF4FA`) with subtle checkerboard floor-grout grid texture (`background-image: linear-gradient(to right, #D6E3F0 1px, transparent 1px), linear-gradient(to bottom, #D6E3F0 1px, transparent 1px); background-size: calc(16 * var(--px)) calc(16 * var(--px))`—echoing the 16×16 kitchen tile grid!). Sharp pixel corners (`border-radius: 0`) everywhere.

---

## 4. Layout Specification

### 4.1 `1920×1080` (Projector, `--px: 6px` — Level 2 Fits Without Page Scroll)

```text
+===================================================================================================+
| [■] VALIO AIMO VIEW   [Operator · read-only]                                    [ Back to results ] |
| ░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░ |
+===================================================================================================+
| [shield] Data boundary                                                                            |
| +-------------------------------+ +-------------------------------+ +---------------------------+ |
| | Public                        | | Customer-scoped               | | Never exposed             | |
| | [catalog] [labels]            | | [netPrices] [quotes]          | | [lock purchasePrices]     | |
| | [certificates] [categoryCarb] | | [orders] [availability]       | | [lock margins]            | |
| +-------------------------------+ +-------------------------------+ +---------------------------+ |
+---------------------------------------------------------------------------------------------------+
| LEFT COLUMN (38%)                               | RIGHT COLUMN (62%)                              |
|                                                 |                                                 |
| [agent] Active agents                           | [ledger] Returned to agent vs withheld          |
| +---------------------------------------------+ | +------+-------+-------+------------+---------+ |
| | Agent               | Customer | Mandates   | | | Time | Agent | Call  | Returned   | Withheld| |
| | kitchenbuyer-hotel… | 123      | mdt_01     | | |------+-------+-------+------------+---------| |
| +---------------------------------------------+ | | 10:01| kit…  | SEARCH| [catalog]  | [sup…]  | |
|                                                 | | |      |       |       | [labels]   |         | |
| [block] Blocked attempts                        | | |------+-------+-------+------------+---------| |
| +---------------------------------------------+ | | 10:02| kit…  | POLICY| Nothing    | [lock   | |
| |▌ [RED]  10:02 · kitchenbuyer-hotel…         | | |      |       | _BLOC…|            | purc…   | |
| |▌ SALES_BLOCKED  [PRICE_CAP_EXCEEDED]        | | |      |       |       |            | never   | |
| |▌ Quote exceeded per-order limit; blocked.   | | |      |       |       |            | exposed]| |
| |▌ (zero buttons)                             | | |------+-------+-------+------------+---------| |
| +---------------------------------------------+ | | 10:03| kit…  | QUOTE_| [netPrices]| [lock   | |
|                                                 | | |      |       | CREA… | [quotes]   | margins | |
| [spark] Scenario adjustments                    | | |      |       |       |            | never   | |
| + - - - - - - - - - - - - - - - - - - - - - - + | |      |       |       |            | exposed]| |
| | [Scenario adjustment]  10:00                | | +------+-------+-------+------------+---------+ |
| | Supplier price hike applied.                | |                                                 |
| + - - - - - - - - - - - - - - - - - - - - - - + |                                                 |
+---------------------------------------------------------------------------------------------------+
```

- **Vertical budget at `1920×1080` (`--px: 6px`):**
  - Terminal header bar: `~13 * --px` (`78px`).
  - `Data boundary` strip: `~28 * --px` (`168px`).
  - Main 2-column grid (`grid-template-columns: minmax(460px, 38%) 1fr; gap: calc(3 * var(--px))`): `~132 * --px` (`792px`).
  - Total height: `~1060px` (fits inside `1080px` with **zero page scroll** for Level 2).
- **What scrolls when longer (e.g. Level 3):**
  - `Returned to agent vs withheld` table wrapper: `max-height: calc(114 * var(--px))` (`684px` at `1080p`) with `overflow-y: auto` and sticky `thead` (`position: sticky; top: 0; background: var(--color-surface-subtle); z-index: 1`).
  - `Blocked attempts` list: `max-height: calc(46 * var(--px))` (`276px` at `1080p`) with `overflow-y: auto`.
  - Scrollable containers receive `tabIndex={0}` when overflowing so keyboard users can scroll them.

### 4.2 `1366×768` (Laptop, `--px: 4px`)
- `Data boundary` tiers: `grid-template-columns: repeat(3, minmax(0, 1fr))` (`gap: calc(3 * var(--px))`).
- Main 2-column grid collapses to single-column stack (`grid-template-columns: 1fr; gap: calc(3 * var(--px))`):
  1. `Data boundary`
  2. `Active agents`
  3. `Blocked attempts` (no `max-height` cap; page scrolls vertically)
  4. `Scenario adjustments`
  5. `Returned to agent vs withheld` (wrapped in `overflow-x: auto` so the 5-column table never causes page-level horizontal overflow).

---

## 5. Section Frames, Controls & Micro-Animations

### 5.1 Terminal Module Frame (All 5 Sections)
- Outer frame: `border-radius: 0`, `border: calc(0.75 * var(--px)) solid #0B1B33`, `background: var(--color-surface)`, `box-shadow: var(--shadow-pixel)`.
- Inner top-left pixel bevel highlight: `box-shadow: inset calc(0.5 * var(--px)) calc(0.5 * var(--px)) 0 #FFFFFF, var(--shadow-pixel)`.
- Header band inside each module: `display: flex; align-items: center; gap: calc(2 * var(--px))`, `padding: calc(1.75 * var(--px)) calc(2.5 * var(--px))`, `border-bottom: calc(0.5 * var(--px)) solid #0B1B33`, `background: var(--color-surface-subtle)` (`#D6E3F0`) — except `Blocked attempts` (`--color-light-red-bg` `#FEE2E2`) and `Scenario adjustments` (`--color-overlay-bg` `#EEF2FF`).
- Module body padding: `calc(2.5 * var(--px))`.

### 5.2 Terminal Header (`<header>`)
- Full-width `--color-terminal-bg` (`#1E3A5F`), bottom border `calc(1 * var(--px)) solid #0B1B33`, plus a `calc(1 * var(--px))` pixel-striped accent rule (`repeating-linear-gradient(90deg, #0052B4 0, #0052B4 calc(2 * var(--px)), #60A5FA calc(2 * var(--px)), #60A5FA calc(3 * var(--px)), #1E3A5F calc(3 * var(--px)), #1E3A5F calc(4 * var(--px)))`).
- Left cluster:
  - Status LED pixel square (`calc(2 * var(--px)) × calc(2 * var(--px))`, `#60A5FA`, `border: calc(0.5 * var(--px)) solid #0B1B33`, `aria-hidden="true"`).
  - `<h1>` (`tabIndex={-1}`): `"Valio Aimo view"` (`font-family: var(--font-display)`, `font-size: var(--text-title)`, `color: #FFFFFF`).
  - Tag `<span>`: `"Operator · read-only"` (`background: #0B1B33`, `color: #FFFFFF`, `border: calc(0.5 * var(--px)) solid #60A5FA`, `padding: calc(0.75 * var(--px)) calc(2 * var(--px))`, `font-size: var(--text-body)`).
- Right cluster:
  - `<button type="button">` `"Back to results"` using 010’s `ghost` button spec:
    - **Default:** `#FFFFFF` bg, `#0052B4` ink, `calc(0.5 * var(--px)) solid #0B1B33` border, `calc(0.75 * var(--px)) calc(0.75 * var(--px)) 0 #0B1B33` shadow, `min-height: calc(10 * var(--px))`, `padding: 0 calc(4 * var(--px))`, `font-size: var(--text-body)`.
    - **Hover:** `#E0F2FE` bg, `#003E8A` ink.
    - **Active / Pressed:** `transform: translate(calc(0.5 * var(--px)), calc(0.5 * var(--px)))`, shadow reduced to `calc(0.25 * var(--px)) calc(0.25 * var(--px)) 0 #0B1B33`.
    - **Focus-visible:** `outline: none; box-shadow: var(--shadow-focus)`.
    - **Disabled:** `opacity: 0.65; cursor: not-allowed`.

### 5.3 Section 1: `Data boundary`
- Header icon: `shield_8x8` + `<h2>` `"Data boundary"`.
- Three labelled lists (`<h3>` + `<ul>` of `<li>` pixel chips):
  1. **`Public`**: `--color-surface-subtle` (`#D6E3F0`) bg, `--color-ink` (`#0B1B33`) text, `calc(0.5 * var(--px)) solid #94A3B8` border.
  2. **`Customer-scoped`**: `--color-brand-subtle` (`#E0F2FE`) bg, `--color-ink` (`#0B1B33`) text, `calc(0.5 * var(--px)) solid #0052B4` border.
  3. **`Never exposed`**: Visually strongest — `--color-locked-bg` (`#1E293B`) bg, `--color-locked-ink` (`#F8FAFC`) text, `calc(0.5 * var(--px)) solid #0B1B33` border, leading `lock_8x8` sprite (`aria-hidden="true"`).
- Items come verbatim from `discovery.dataDisclosure.public`, `.customerScoped`, `.neverExposed`.

### 5.4 Section 2: `Active agents`
- Header icon: `agent_8x8` + `<h2>` `"Active agents"`.
- Real `<table>` with `<caption className="sr-only">Active agents</caption>`:
  - `<thead>` `<th scope="col">`: `"Agent"`, `"Customer"`, `"Mandates"`.
  - `<tbody>`: one `<tr>` per distinct `agentId` in `valioLog` events (in `seq` order of first appearance); `tr:hover` subtle `#EEF4FA` highlight:
    - `Agent`: `agentId` (`font-weight: 700`, `--color-ink`).
    - `Customer`: `customerId` (`--color-ink-muted`).
    - `Mandates`: every `refs.mandateId` from that agent’s `MANDATE_SIGNED` events as `--color-brand-subtle` pixel chips (or `"None"` in `--color-ink-muted` if none).

### 5.5 Section 3: `Blocked attempts`
- Header icon: `block_8x8` + `<h2>` `"Blocked attempts"`.
- Includes every event where `light === "RED"` OR `type` is `"POLICY_BLOCKED"` or `"DATA_BOUNDARY_BLOCKED"`, in `seq` order.
- Each item is an `<article>` (or `<li>` inside `<ul>`) with:
  - `#FFFFFF` bg, `calc(0.5 * var(--px)) solid var(--color-light-red)` (`#B91C1C`) border, `calc(1.5 * var(--px))` left accent bar in `#B91C1C`.
  - Top row: shared `LightBadge` (`light="RED"`), `formatTime(event.at)`, `event.agentId`.
  - Middle row: `event.type` (`font-weight: 700`) + reason-code chips (`event.reasons`, `--color-light-red-bg` `#FEE2E2` bg, `--color-light-red` `#B91C1C` ink, `calc(0.5 * var(--px)) solid #B91C1C`).
  - Summary: `event.summary` (`--color-ink`).
  - **Hard rule:** Zero `<button>` elements anywhere in this section (`RED` is never overridable).
- **Empty state:** When 0 blocked events, render `"No blocked attempts."` in a `--color-surface-subtle` pixel box (`--color-ink-muted`).

### 5.6 Section 4: `Scenario adjustments`
- Header icon: `spark_8x8` + `<h2>` `"Scenario adjustments"`.
- Includes every event with `actor === "scenario"`, in `seq` order.
- Each item is visibly distinct from real gateway traffic:
  - `--color-overlay-bg` (`#EEF2FF`) bg, `calc(0.5 * var(--px)) dashed var(--color-overlay-border)` (`#818CF8`) border, `padding: calc(2 * var(--px))`.
  - Pill badge: `"Scenario adjustment"` (`background: var(--color-overlay-ink)` `#3730A3`, `color: #FFFFFF`, `padding: calc(0.5 * var(--px)) calc(1.5 * var(--px))`).
  - Timestamp: `formatTime(event.at)` (`color: var(--color-overlay-ink)`).
  - Summary: `event.summary` (`--color-ink`).
- **Empty state:** When 0 scenario events, render `"No scenario adjustments."` in a `--color-surface-subtle` pixel box (`--color-ink-muted`).

### 5.7 Section 5: `Returned to agent vs withheld`
- Header icon: `ledger_8x8` + `<h2>` `"Returned to agent vs withheld"`.
- Real `<table>` with `<caption className="sr-only">Returned to agent vs withheld</caption>`:
  - `<thead>` `<th scope="col">`: `"Time"`, `"Agent"`, `"Call"`, `"Returned to agent"`, `"Withheld"`.
  - `<tbody>`: one `<tr>` per event in `valioLog` that has `disclosure` (in `seq` order); `tr:hover` subtle `#EEF4FA` row highlight for horizontal scanability:
    - `Time`: `formatTime(event.at)` (`white-space: nowrap`, `font-variant-numeric: tabular-nums`).
    - `Agent`: `event.agentId`.
    - `Call`: `event.type` (`font-weight: 700`).
    - `Returned to agent`: `<ul>` of pixel chips (`--color-surface-subtle`, `calc(0.5 * var(--px)) solid #94A3B8`, `--color-ink`). If empty, `"Nothing"`.
    - `Withheld`: `<ul>` of pixel chips. If empty, `"Nothing"`.
      - **Standard withheld item** (not in `discovery.dataDisclosure.neverExposed`): `--color-surface-subtle`, `calc(0.5 * var(--px)) solid #94A3B8`, `--color-ink-muted`.
      - **Never-exposed withheld item** (exact string match in `discovery.dataDisclosure.neverExposed`):
        - Dark locked chip: `--color-locked-bg` (`#1E293B`), `--color-locked-ink` (`#F8FAFC`), `calc(0.5 * var(--px)) solid #0B1B33`.
        - Leading `lock_8x8` pixel sprite (`aria-hidden="true"`).
        - Item name + visible `"never exposed"` tag (`font-size: var(--text-body)`, `text-transform: uppercase`), ensuring both non-colour distinction and accessible text `"never exposed"`.

### 5.8 Micro-Animations & `prefers-reduced-motion` Fallbacks
- **Terminal status LED:** 2-step pixel pulse (`@keyframes valio-led { 0%, 49% { background: #60A5FA; } 50%, 100% { background: #FFFFFF; } }`, `1.6s steps(1, end) infinite`).
- **Screen settle:** Crisp 2-step pixel reveal (`120ms steps(2, end)`) on `<main>` entry.
- **Reduced motion (`@media (prefers-reduced-motion: reduce)`):**
  - Status LED holds static `#60A5FA` (`animation: none`).
  - Screen settle and button active/hover transitions disabled (`animation: none; transition: none`).

---

## 6. Screen States

1. **Loading State:**  
   While `client.discovery()` and `client.getLog("valio")` are pending, render centered on `--color-canvas` using 010’s `notice` `PixelPanel`: `"Loading Valio view…"` (`font-size: var(--text-body)`, `--color-ink`). None of the five `<h2>` sections render yet.
2. **Error State (`role="alert"`):**  
   If either call rejects:
   - Render the Terminal Header (`<h1>` `"Valio Aimo view"` + working `"Back to results"` `<button>`).
   - Render 010’s `alert` `PixelPanel` (`role="alert"`, `--color-error-surface` `#FDF2F5`, `--color-error-ink` `#881337`, warning triangle icon `aria-hidden="true"`, bold `"Error:"` prefix + `GatewayError.message`).
   - Render **none** of the five `<h2>` sections.
3. **Empty States:**  
   - `Blocked attempts` empty → `"No blocked attempts."`
   - `Scenario adjustments` empty → `"No scenario adjustments."`
   - `Returned to agent` or `Withheld` cell empty → `"Nothing"`
4. **No-Secrets Enforcement (G-05):**  
   Render only fields validated by `LogEventSchema` (`at`, `agentId`, `type`, `reasons`, `summary`, `light`, `refs`, `disclosure`). Never render unparsed fields.

---

## 7. Accessibility & Keyboard Navigation

1. **Programmatic Focus on Mount:** Focus `<h1>` (`"Valio Aimo view"`, `tabIndex={-1}`) when `ValioView` mounts.
2. **Keyboard Focus Order:**
   1. `"Back to results"` `<button type="button">` in `<header>`
   2. Scrollable `Blocked attempts` region (only if overflowing, `tabIndex={0}`)
   3. Scrollable `Returned to agent vs withheld` table wrapper (only if overflowing, `tabIndex={0}`)
   - Focus ring on all focusable elements: `outline: none; box-shadow: var(--shadow-focus);`.
3. **Landmark & Table Semantics:** `<header>`, `<main>`, five `<section aria-labelledby="...">` blocks, real `<table>`/`<thead>`/`<tbody>`/`<th scope="col">`/`<td>`, zero `<button>` elements inside `Blocked attempts`.

---

## 8. Final UI Copy (English, Typographic Quotes/Apostrophes)

| Element | Exact Copy |
|---|---|
| Result panel entry button (`ResultPanel`) | `See it from Valio Aimo’s side` |
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
