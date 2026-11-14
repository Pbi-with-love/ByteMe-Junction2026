# Design Handoff — 007: Replay Comparison (The "Aha" Screen)

> **Owner:** Antigravity (Argon) · **Implementer:** Codex (GPT-6 Luna)  
> **Scope:** `docs/design/007-replay-comparison.md` only. Reuses shared tokens from `docs/design/002-mandate-screen.md`, `LightBadge` from `docs/design/003-agent-timeline.md`, and stars/hearts visuals from `docs/design/005-result-receipt.md` verbatim.

---

## 1. Design Decisions & Rationale

1. **One-Screen Projector Verdict (`1920×1080` & `1366×768`, Zero Scroll):**  
   The comparison screen is the visual climax of the pitch: the jury sees how **Strict**, **Balanced**, and **Loose** (or any 2–3 presets returned by `client.compare(levelId)`) trade off attention, cost, delivery, and safety at a glance. The entire view—`56px` core-message headline, level + three-promises sub-line, 9-row comparison table, and `"Back to levels"` button—fits inside `~790px` at `1920×1080` and `~626px` at `1366×768` with zero vertical or horizontal scrolling.
2. **Dynamic Columns Driven Strictly by Gateway Data:**  
   Column count and order come directly from `Object.entries(compare.presets)` (2 columns for Levels 2–3, 3 columns for Level 1). Using `table-layout: fixed` with a `26%` row-header column and equal-width preset columns (`37%` each for 2 presets, `24.6%` each for 3 presets) guarantees balanced alignment without hard-coding preset names.
3. **Never Colour Alone for "Best" or "Incident":**  
   - **Best column (`data-best="true"`):** Marked with a solid `--color-brand` (`#0052B4`) `"Best balance"` pill badge (with a star/award SVG) in the column header, a `3px` top `--color-brand` accent bar, and a subtle `--color-brand-subtle` tint—matching the `Recommended` plan card in Spec 003.
   - **Per-row best cells (`data-best="true"`):** Marked with bold numeric weight, a `3px` left `--color-brand` accent bar, subtle `--color-brand-subtle` fill, and an `aria-hidden="true"` checkmark SVG icon beside the value. Keeping the icon `aria-hidden="true"` ensures `<td>` text content matches gateway values verbatim for AC5.
   - **Safety-incident column (`data-incident="true"`):** Marked with the exact `RED` policy tokens from `LightBadge` (`--color-light-red`, `--color-light-red-bg`, `--color-light-red-border`) plus an octagon/X-circle SVG icon and explicit `"Safety incident: …"` / `"0 of 3 stars"` text so failure is unmistakable.
4. **Honest, Calm Missing-Data States:**  
   `"Not reported"` (absent optional fields) and `"Nothing ordered"` (`totalCost === null`) use `--color-ink-muted` (`#3B4E6B`) italicised or regular text—calm and non-alarming, visually distinct from `tabular-nums` metrics and never styled as an error.

---

## 2. Shared Design Tokens (Reused from 002, 003 & 005)

Reuse the `@theme` tokens from `docs/design/002-mandate-screen.md` §2, `docs/design/003-agent-timeline.md` §2, and `docs/design/005-result-receipt.md` §2 **unchanged**. **No new colour tokens are required** for Spec 007.

| Token (Source) | Value | Usage in Spec 007 |
|---|---|---|
| `--color-canvas` (`002`) | `#F3F6FA` | Outer page background |
| `--color-surface` (`002`) | `#FFFFFF` | Table card surface, default cells, secondary button |
| `--color-surface-subtle` (`002`) | `#EBF1F8` | Table header row base, alternating/hover subtle row tint |
| `--color-ink` (`002`) | `#0B1B33` | Headline, row headers, metric values |
| `--color-ink-muted` (`002`) | `#3B4E6B` | Sub-line, `"Not reported"` / `"Nothing ordered"`, `"None"` |
| `--color-brand` (`002`) | `#0052B4` | `"Best balance"` pill fill, best-column/cell accent bar & check icon |
| `--color-brand-subtle` (`002`) | `#E0ECFA` | Best-column header tint, best-cell subtle highlight |
| `--color-border` (`002`) | `#C9D6E8` | Table horizontal row dividers & outer card border |
| `--color-border-strong` (`002`) | `#7C93B3` | `"Back to levels"` button border |
| `--color-error-surface` (`002`) | `#FDF2F5` | `GatewayError` `role="alert"` banner fill |
| `--color-error-ink` (`002`) | `#881337` | `GatewayError` `role="alert"` banner text & border |
| `--color-light-red` (`002` / `LightBadge`) | `#B91C1C` | Incident cell text & icon, `0 of 3 stars` emphasis, incident header accent |
| `--color-light-red-bg` (`002` / `LightBadge`) | `#FEE2E2` | Incident cell fill (`#FEE2E2`) |
| `--color-light-red-border` (`003` / `LightBadge`) | `#FCA5A5` | Incident cell border & column top accent |
| `--color-star-filled` (`005`) | `#D97706` | Filled star SVG fill |
| `--color-star-empty` (`005`) | `#CBD5E1` | Empty star SVG fill |
| `--color-heart-filled` (`005`) | `#B91C1C` | Filled heart SVG fill in `Hearts left` row |
| `--shadow-focus` (`002`) | `0 0 0 2px #FFFFFF, 0 0 0 5px #0052B4` | Keyboard `:focus-visible` ring |

### Contrast Verification Summary
| Pair | Ratio | Standard |
|---|---|---|
| `--color-ink` (`#0B1B33`) on `--color-surface` (`#FFFFFF`) | **16.9:1** | Exceeds AAA (7:1) |
| `--color-ink` (`#0B1B33`) on `--color-brand-subtle` (`#E0ECFA`) | **14.2:1** | Exceeds AAA (7:1) |
| `--color-ink-muted` (`#3B4E6B`) on `--color-surface` (`#FFFFFF`) | **8.2:1** | Exceeds AAA (7:1) |
| `#FFFFFF` on `--color-brand` (`#0052B4`) (`"Best balance"` pill) | **7.6:1** | Exceeds AAA (7:1) |
| `--color-light-red` (`#B91C1C`) on `--color-light-red-bg` (`#FEE2E2`) | **5.30:1** | Passes AA (4.5:1) |
| `--color-error-ink` (`#881337`) on `--color-error-surface` (`#FDF2F5`) | **9.7:1** | Exceeds AAA (7:1) |

---

## 3. Type Scale & Spacing

| Role | `1920×1080` (`min-[1440px]:` / `xl:`) | `1366×768` (default `< 1440px`) | Weight / Tracking |
|---|---|---|---|
| Core-Message Headline (`<h1>`) | `56px` (`3.5rem`), LH `1.08` | `38px` (`2.375rem`), LH `1.12` | `700`, `-0.025em` |
| Sub-line (Level + 3 promises) | `24px` (`1.5rem`), LH `1.35` | `18px` (`1.125rem`), LH `1.4` | `400` (`600` on level title) |
| Preset Column Headers (`<th scope="col">`) | `26px` (`1.625rem`), LH `1.2` | `20px` (`1.25rem`), LH `1.25` | `700`, `-0.01em` |
| Row Labels (`<th scope="row">`) & Cell Values (`<td>`) | `24px` (`1.5rem`), LH `1.25` | `18px` (`1.125rem`), LH `1.3` | `600` (row labels), `500`–`700` (values), `tabular-nums` |
| `"Best balance"` Tag & Incident Badge | `16px` (`1rem`), LH `1.2` | `14px` (`0.875rem`), LH `1.2` | `700`, uppercase/title |
| `"Back to levels"` Button | `20px` (`1.25rem`), LH `1.2` | `16px` (`1rem`), LH `1.2` | `600` |

- **Outer container (`<main>`):** `max-width: 1680px` centred on `--color-canvas`; padding `24px 32px` at `1080p`, `16px 24px` at `768p`.
- **Table cell padding:** `11px 20px` at `1080p` (`9px 14px` at `768p`) so all 9 rows + header fit cleanly above the fold.

---

## 4. Layout Specification

### 4.1 3-Column Comparison (`1920×1080`, e.g. Level 1)
```text
+-----------------------------------------------------------------------------------+
| Agents don’t need a chatbot. They need a mandate.                                 |
| Level 1: The Weekly Order · Mandate = buyer’s promise · Quote = Valio Aimo’s      |
| promise · Log = proof both kept them                                              |
+-----------------------------------------------------------------------------------+
| Metric            | Strict           | ★ Best balance             | Loose         |
|                   |                  | Balanced                   |               |
|-------------------+------------------+----------------------------+---------------|
| Approvals asked   | 4                | 1                          | [✓] 0         |
| Hearts used       | 3                | 1                          | [✓] 0         |
| Hearts left       | 0                | 2 ♥♥                       | [✓] 3 ♥♥♥     |
| Cost              | €910,00          | [✓] €1 295,00              | €1 350,00     |
| Kitchen           | 70 %             | [✓] 100 %                  | 70 %          |
| Wallet            | 100              | 97                         | [✓] 100       |
| Safety            | 100              | 100                        | 100           |
| Stars             | ★☆☆  1 of 3 stars| ★★★  3 of 3 stars          | ★☆☆  1 of 3   |
| Incident          | None             | None                       | None          |
+-----------------------------------------------------------------------------------+
| [← Back to levels]                                                                |
+-----------------------------------------------------------------------------------+
```

### 4.2 2-Column Comparison (`1920×1080` & `1366×768`, e.g. Level 2 & Level 3)
- Same `<table>` structure with 2 preset `<th scope="col">` columns (`26%` metric label + `37%` per preset column).
- **Level 2 (equal stars):** Neither column receives `data-best="true"` or the `"Best balance"` tag. Per-row best cells (`Approvals asked`, `Hearts used`, `Hearts left`) still highlight the attention difference cleanly.
- **Level 3 (Safety Incident on `allergen_off`):**
```text
| Metric            | ★ Best balance             | [!] Incident                    |
|                   | Allergen on                | Allergen off                    |
|-------------------+----------------------------+---------------------------------|
| ...               | ...                        | ...                             |
| Stars             | ★★★  3 of 3 stars          | ☆☆☆  0 of 3 stars               |
| Incident          | None                       | [✕] Safety incident: Contains   |
|                   |                            |     egg (AE)                    |
+-----------------------------------------------------------------------------------+
```

### 4.3 Tailwind Class Guidance per Element
- **Page wrapper (`<main>`):** `mx-auto max-w-[1680px] px-6 py-4 min-[1440px]:px-8 min-[1440px]:py-6`
- **Headline (`<h1>`, `tabIndex={-1}`):** `m-0 text-[2.375rem] leading-[1.12] font-bold tracking-[-0.025em] text-ink min-[1440px]:text-[3.5rem] min-[1440px]:leading-[1.08]`
- **Sub-line (`<p>`):** `mt-2 mb-5 text-lg text-ink-muted min-[1440px]:text-2xl`
- **Table card shell:** `overflow-x-auto rounded-[var(--radius-card)] border border-border bg-surface shadow-sm`
- **`<table>`:** `w-full table-fixed border-collapse text-left`
- **`<th scope="col">` (Metric):** `w-[26%] border-b-2 border-border bg-surface-subtle px-3.5 py-3 text-lg font-semibold text-ink-muted min-[1440px]:px-5 min-[1440px]:py-3.5 min-[1440px]:text-2xl`
- **`<th scope="col">` (Preset default):** `border-b-2 border-border bg-surface-subtle px-3.5 py-3 text-xl font-bold text-ink min-[1440px]:px-5 min-[1440px]:py-3.5 min-[1440px]:text-[1.625rem]`
- **`<th scope="col" data-best="true">`:** Add `border-t-4 border-t-brand bg-brand-subtle/60`
- **`<th scope="col" data-incident="true">`:** Add `border-t-4 border-t-light-red bg-light-red-bg/50`
- **`<th scope="row">`:** `border-b border-border px-3.5 py-2.5 text-lg font-semibold text-ink min-[1440px]:px-5 min-[1440px]:py-3 min-[1440px]:text-2xl`
- **`<td>` (default):** `border-b border-border px-3.5 py-2.5 text-lg font-medium text-ink tabular-nums min-[1440px]:px-5 min-[1440px]:py-3 min-[1440px]:text-2xl`
- **`<td data-best="true">`:** Add `bg-brand-subtle/45 font-bold border-l-4 border-l-brand`
- **`<td>` (muted: `"Not reported"` / `"Nothing ordered"` / `"None"`):** `text-ink-muted italic font-normal`
- **`<td>` (Incident row when `incident !== null`):** `bg-light-red-bg text-light-red font-bold border-l-4 border-l-light-red`
- **Footer `"Back to levels"` button:** `mt-5 inline-flex min-h-[48px] items-center gap-2 rounded-[var(--radius-control)] border-[1.5px] border-border-strong bg-surface px-6 text-base font-semibold text-ink hover:border-brand hover:bg-surface-subtle focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] min-[1440px]:min-h-[52px] min-[1440px]:text-xl`

---

## 5. Component & Cell States

1. **Loading State (`client.compare` pending):**  
   Centred in `<main>` on `--color-canvas`: `"Loading comparison…"` (`24px` at `1080p`, `18px` at `768p`, `--color-ink-muted`), accompanied by the `"Back to levels"` button so the user is never trapped.
2. **Error State (`GatewayError`):**  
   Render **no `<table>`**. Show a `role="alert"` banner matching `002` §5.4 (`--color-error-surface` `#FDF2F5`, `border: 1.5px solid --color-error-ink`, `border-left: 5px solid --color-error-ink`, warning triangle SVG `aria-hidden="true"`, bold `"Error:"` prefix + `error.message`) and the `"Back to levels"` button below it.
3. **`Hearts left` Cell:**  
   Renders the integer (`{heartsLeft}`) followed by `heartsLeft` filled heart SVGs (`20px × 20px` at `1080p`, `16px × 16px` at `768p`, `aria-hidden="true"`, `--color-heart-filled` `#B91C1C`). When `heartsLeft === 0`, renders `"0"` with no filled hearts (optionally muted empty outline or just `"0"` so text stays exact).
4. **`Stars` Cell:**  
   Renders 3 star SVGs (`22px × 22px` at `1080p`, `18px × 18px` at `768p`, `aria-hidden="true"`; filled = `--color-star-filled` `#D97706`, empty = `--color-star-empty` `#CBD5E1`) + visible text `"{stars} of 3 stars"`. For `0` stars, all 3 stars are `--color-star-empty` and text `"0 of 3 stars"` is styled in `--color-light-red` (`#B91C1C`) `font-bold`.
5. **`Incident` Cell:**  
   - When `incident === null`: `"None"` (`--color-ink-muted`).
   - When `incident !== null`: Uses `RED` tokens from `LightBadge` (`--color-light-red-bg` `#FEE2E2`, `--color-light-red` `#B91C1C`, `--color-light-red-border` `#FCA5A5`), octagon/X-circle SVG (`18px × 18px`, `aria-hidden="true"`), and exact text `"Safety incident: " + incident.reason`.

---

## 6. Reveal Animation & Reduced Motion (`motion/react`)

Wrap with `MotionConfig reducedMotion="user"` and read `useReducedMotion()` (consistent with Specs 002 and 005):

- **Animate the table card wrapper** (never animate `<tr>`/`<td>` display properties so native table layout stays intact):
  - **Full Motion (`shouldReduce === false`):** `initial={{ opacity: 0, y: 10 }}`, `animate={{ opacity: 1, y: 0 }}`, `transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}`.
  - **Reduced Motion (`shouldReduce === true`):** `initial={{ opacity: 1, y: 0 }}`, `animate={{ opacity: 1, y: 0 }}`, `transition={{ duration: 0 }}` (instant appearance, no translate).

---

## 7. Accessibility & Keyboard Navigation

1. **Landmarks & Focus:**  
   - `<main aria-label="Preset comparison">`
   - `<h1>` (`tabIndex={-1}`) programmatically focused when comparison data resolves (or when error renders).
2. **Real `<table>` Semantics:**  
   - `<table aria-labelledby="compare-heading">` (or `<caption className="sr-only">Comparison of preset runs for {levelTitle}</caption>`).
   - Every column header uses `<th scope="col">` in `<thead>`.
   - Every metric row header uses `<th scope="row">` in `<tbody>`.
   - All decorative icons (best-cell checkmark, `"Best balance"` star, hearts, stars, incident octagon) carry `aria-hidden="true"`.
3. **Keyboard & Focus:**  
   - `"Back to levels"` is a native `<button type="button">` reachable via `Tab` and activated with `Enter` or `Space`, displaying `--shadow-focus` on `:focus-visible`.

---

## 8. Final UI Copy (English, Typographic Quotes & Apostrophes)

| Element | Exact Copy |
|---|---|
| Headline (`<h1>`) | `Agents don’t need a chatbot. They need a mandate.` |
| Sub-line | `{levelTitle} · Mandate = buyer’s promise · Quote = Valio Aimo’s promise · Log = proof both kept them` |
| Loading state | `Loading comparison…` |
| Metric column header | `Metric` |
| Best column tag | `Best balance` |
| Row 1 header | `Approvals asked` |
| Row 2 header | `Hearts used` |
| Row 3 header | `Hearts left` |
| Row 4 header | `Cost` |
| Row 5 header | `Kitchen` |
| Row 6 header | `Wallet` |
| Row 7 header | `Safety` |
| Row 8 header | `Stars` |
| Row 9 header | `Incident` |
| Absent optional field | `Not reported` |
| Null `totalCost` | `Nothing ordered` |
| Null `incident` | `None` |
| Non-null `incident` | `Safety incident: {incident.reason}` |
| Stars text | `{stars} of 3 stars` |
| Footer button | `Back to levels` |
