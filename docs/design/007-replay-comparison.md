# Design Handoff — 007: Replay Comparison (Pixel Scoreboard)

> **Owner:** Antigravity (Argon) · **Implementer:** Codex (GPT-6 Luna)  
> **Scope:** `docs/design/007-replay-comparison.md` only. Supersedes the prior web-style `007` handoff. Reuses `docs/design/010-game-world.md` (24-colour palette, `--px` type scale, `PixelPanel` kit, button/focus tokens, `stop` emote, `heart` icon), `LightBadge` / light tokens from `003`/`010`, and `star_on` / `star_off` sprites from `005` (`Stars`).  
> **Domain framing:** Interactive simulation platform for trusted autonomous purchasing (*Valio Aimo Trust Gateway*). Never frame as a restaurant management game.

---

## 1. Design Decisions & Rationale

1. **Full-Screen Pixel Scoreboard in the Kitchen World Aesthetic (Zero `<canvas>`):**  
   `Compare` is a dedicated full-screen HTML scoreboard (`screen === 'compare'`) that brings the `010` cold-room pixel kitchen aesthetic to the verdict screen without mounting a `<canvas>`:
   - **Backdrop:** Subtle `010` checkerboard tile pattern (`#EEF4FA` / `#F8FAFC` with `#D6E3F0` grout) rendered purely in CSS `background-image` (`calc(16 * var(--px))` tile grid).
   - **Scoreboard Frame:** Crisp `#FFFFFF` paper card with `calc(1 * var(--px)) solid #0B1B33` outer border, pixel-bevel inner highlight (`#FFFFFF` top/left, `#CBD5E1` bottom/right), `var(--shadow-pixel)` drop shadow, and `4×4` steel corner rivets (`corner_rivet` sprite).
   - **Projector-Ready Zero Scroll:** Every element—headline, 3-promises sub-line, 9-row comparison table, and `"Back to levels"` button—fits inside both `1920×1080` (`--px: 6px`) and `1366×768` (`--px: 4px`) with zero vertical or horizontal scrolling.
2. **Dynamic Columns in Exact Gateway Order:**  
   Column count and order come directly from `Object.entries(compare.presets)` (e.g. 3 columns on Level 1, 2 columns on Levels 2–3). Using `table-layout: fixed` (`26%` metric row-header column + equal-width preset columns: `37%` each for 2 presets, `24.66%` each for 3 presets) guarantees balanced alignment without hard-coding preset keys.
3. **Never Colour Alone for "Best" or "Incident":**  
   - **Best column (`data-best="true"`, AC6):** Marked with a solid `--color-brand` (`#0052B4`) pixel `"Best balance"` ribbon tag featuring the `best_crown` (`10×8` pixel crown) sprite (`aria-hidden="true"`), a `calc(1.5 * var(--px))` top `--color-brand` cap with a `calc(0.5 * var(--px))` `--color-sky` (`#60A5FA`) inner highlight, `--color-brand-subtle` (`#E0F2FE`) header tint, and a subtle `#F8FAFC` column lane wash. If all columns tie on `stars`, no column receives `data-best="true"` or the tag.
   - **Per-row best cells (`data-best="true"`, AC7):** Marked with bold `tabular-nums`, a `calc(1 * var(--px))` left `--color-brand` accent bar, `--color-brand-subtle` (`#E0F2FE`) fill, and an `aria-hidden="true"` `best_check` (`8×8` pixel checkmark) sprite beside the value so `<td>` text matches gateway values verbatim.
   - **Safety-incident column (`data-incident="true"`, AC9):** Uses the shared `RED` policy light tokens (`--color-light-red` `#B91C1C`, `--color-light-red-bg` `#FEE2E2`)—no new colour values—paired with the `010` `stop` (`8×8` octagon `"X"`) pixel sprite (`aria-hidden="true"`), an `"Incident"` header tag, `"0 of 3 stars"` in bold `#B91C1C` with 3 `star_off` sprites, and `"Safety incident: {reason}"` text.
4. **Calm, Honest Missing-Data States:**  
   `"Not reported"` (absent optional fields) and `"Nothing ordered"` (`totalCost === null`) render in `--color-ink-muted` (`#475569`) regular weight—clearly distinct from `tabular-nums` metrics and never styled as an error.

---

## 2. Tokens & Pixel Sprites

### 2.1 Reused `010` Palette & Tokens (`010-game-world.md` §2 & §7)

| Token (`010`) | Hex / Value | Usage in `007` |
|---|---|---|
| `--px` | `4px` (`768p`), `6px` (`1080p`) | All sizing, borders, shadows, and type |
| `--color-canvas` | `#EEF4FA` (`f`) | Checkerboard tile A / page background |
| `--color-surface` | `#FFFFFF` (`w`) | Scoreboard card surface, odd rows, `ghost` button |
| `--color-surface-subtle` | `#D6E3F0` (`g`) | Tile grout, `<thead>` base, horizontal row dividers |
| `--color-ink` | `#0B1B33` (`o`) | `<h1>`, row headers, metric values (`17.23:1` on `#FFFFFF`) |
| `--color-ink-muted` | `#475569` (`k`) | Sub-line, `"Not reported"`, `"Nothing ordered"`, `"None"` (`7.5:1` on `#FFFFFF`) |
| `--color-brand` | `#0052B4` (`b`) | `"Best balance"` tag fill, best-column/cell accent bar (`7.33:1` w/ `#FFFFFF`) |
| `--color-brand-hover` | `#003E8A` (`d`) | Button hover state |
| `--color-brand-subtle` | `#E0F2FE` (`2`) | Best-column header & best-cell fill (`14.9:1` w/ `#0B1B33`) |
| `--color-sky` | `#60A5FA` (`s`) | Best-column top inner highlight line, header accent dot |
| `--color-border` | `#94A3B8` (`m`) | Inner bevel shadow, subtle column dividers |
| `--color-border-strong` | `#0B1B33` (`o`) | Outer scoreboard frame (`calc(1 * var(--px)) solid`), button border |
| `--color-light-red` | `#B91C1C` (`R`) | Incident column top bar, incident cell text/border, `0 of 3 stars` (`5.30:1` on `#FEE2E2`) |
| `--color-light-red-bg` | `#FEE2E2` (`4`) | Incident column header tint & incident cell fill |
| `--color-error-surface` | `#FDF2F5` (`a`) | `GatewayError` `PixelPanel` (`alert`) background |
| `--color-error-ink` | `#881337` (`e`) | `GatewayError` `PixelPanel` (`alert`) text & border (`8.74:1` on `#FDF2F5`) |
| `--shadow-pixel` | `calc(1 * var(--px)) calc(1 * var(--px)) 0 #0B1B33` | Outer scoreboard card & `PixelPanel` drop shadow |
| `--shadow-focus` | `0 0 0 calc(0.5 * var(--px)) #FFFFFF, 0 0 0 calc(1.25 * var(--px)) #0052B4` | Keyboard `:focus-visible` ring on `"Back to levels"` |

**Marked CSS Token Additions (using existing `010` §2 hexes `p` & `c`):**
- `--color-floor-alt: #F8FAFC;` (`010` key `p`: checkerboard tile B, even-row zebra tint, best-column lane wash)
- `--color-steel-light: #CBD5E1;` (`010` key `c`: scoreboard inner bottom/right bevel)

### 2.2 Reused & Marked-Addition Pixel Sprites

Every sprite uses `010` §2 palette keys only (`.` = transparent) and renders with `image-rendering: pixelated` and `aria-hidden="true"`:

- **Reused from `005` (`Stars` / `PixelSprite`):** `star_on`, `star_off` (referenced by name; rendered at `calc(5 * var(--px))` = `30×30px` at 1080p, `20×20px` at 768p).
- **Reused from `010` art kit:**
  - `stop` (`8×8` octagon `"X"`, `010` §4.4, rendered at `calc(4 * var(--px))` = `24×24px` at 1080p, `16×16px` at 768p).
  - `heart` icon (rendered at `calc(4 * var(--px))` in the `Hearts left` row). *Fallback addition if `010`/`004` does not yet export `heart` in `src/world/art.ts`:*
    ```text
    .oo..oo.
    oRRoORRo
    oRwRRRRo
    oRRRRRRo
    .oRRRRo.
    ..oRRo..
    ...oo...
    ........
    ```
- **Marked Addition 1 — `best_crown` (`10×8`, for `"Best balance"` column tag; uses `o`, `s`, `w`, `b`):**  
  Render at `calc(5 * var(--px))` × `calc(4 * var(--px))` (`30×24px` at 1080p, `20×16px` at 768p).
  ```text
  .o..oo..o.
  osoossooso
  osssssssso
  oswwsswwso
  obbbbbbbbo
  osssssssso
  .oooooooo.
  ..........
  ```
- **Marked Addition 2 — `best_check` (`8×8`, for per-row `data-best="true"` cells; uses `o`, `b`, `w`):**  
  Render at `calc(4 * var(--px))` (`24×24px` at 1080p, `16×16px` at 768p).
  ```text
  .oooooo.
  obbbbbbo
  obbbbwbo
  obbwbwbo
  obwbbwbo
  obbbbbbo
  obbbbbbo
  .oooooo.
  ```
- **Marked Addition 3 — `arrow_back` (`8×8`, for `"Back to levels"` button; uses `o`, `b`, `s`):**  
  Render at `calc(4 * var(--px))` (`24×24px` at 1080p, `16×16px` at 768p).
  ```text
  ...oo...
  ..obo...
  .obboooo
  osbbbbbo
  .obboooo
  ..obo...
  ...oo...
  ........
  ```
- **Marked Addition 4 — `alert_triangle` (`10×9`, for `GatewayError` `PixelPanel` `alert` banner; uses `o`, `e`, `w`, `a`):**  
  Render at `calc(5 * var(--px))` × `calc(4.5 * var(--px))` (`30×27px` at 1080p, `20×18px` at 768p).
  ```text
  ....oo....
  ...oeeo...
  ..oewweo..
  ..oewweo..
  .oeewweeo.
  .oeeeeeoo.
  oeewweeeeo
  oeeeeeeeeo
  oooooooooo
  ```
- **Marked Addition 5 — `corner_rivet` (`4×4`, decorative pixel rivets at the 4 corners of `.compare-frame`; uses `o`, `c`, `m`):**
  ```text
  oooo
  ocmo
  ommo
  oooo
  ```

---

## 3. Responsive `--px` Scale & Typography

Ensure `:root` sets `--px: 4px` by default and upgrades to `6px` on `1080p` viewports:
```css
:root { --px: 4px; }
@media (min-width: 1440px) and (min-height: 900px) {
  :root { --px: 6px; }
}
```

| Role | Token / Size | `1920×1080` (`--px: 6px`) | `1366×768` (`--px: 4px`) | Font |
|---|---|---|---|---|
| Headline (`<h1>`) | `calc(6 * var(--px))` | `36px`, LH `1.2` | `24px`, LH `1.2` | `Press Start 2P`, `700` |
| Sub-line (Level + 3 promises) | `calc(4 * var(--px))` | `24px`, LH `1.3` | `16px`, LH `1.3` | `Pixelify Sans`, `400` (`700` on level title) |
| Preset Column Header (`<th scope="col">`) | `calc(5 * var(--px))` | `30px`, LH `1.15` | `20px`, LH `1.15` | `Pixelify Sans`, `700` |
| Tag (`"Best balance"` / `"Incident"`) | `calc(4 * var(--px))` | `24px`, LH `1.1` | `16px`, LH `1.1` | `Pixelify Sans`, `700` |
| Row Labels (`<th scope="row">`) & Values (`<td>`) | `calc(4 * var(--px))` | `24px`, LH `1.25` | `16px`, LH `1.25` | `Pixelify Sans`, `600` / `500–700`, `tabular-nums` |
| `"Back to levels"` Button | `calc(4 * var(--px))` | `24px`, LH `1.1` | `16px`, LH `1.1` | `Pixelify Sans`, `700` |

Every visible string is `≥ 4 * --px` (`16px` at 768p, `24px` at 1080p).

---

## 4. Layout Specification (Zero Scroll at Both Resolutions)

### 4.1 3-Column Comparison (`1920×1080` & `1366×768`, e.g. Level 1)
```text
+------------------------------------------------------------------------------------+
| AGENTS DON’T NEED A CHATBOT. THEY NEED A MANDATE.                                  |
| Level 1: The Weekly Order · Mandate = buyer’s promise · Quote = Valio Aimo’s       |
| promise · Log = proof both kept them                                               |
+------------------------------------------------------------------------------------+
| [■]              |                  | [👑 Best balance]        |               [■] |
| Metric           | Strict           | Balanced                 | Loose             |
|------------------+------------------+--------------------------+-------------------|
| Approvals asked  | 4                | 1                        | [✓] 0             |
| Hearts used      | 3                | 1                        | [✓] 0             |
| Hearts left      | 0                | 2 ♥♥                     | [✓] 3 ♥♥♥         |
| Cost             | €910,00          | [✓] €1 295,00            | €1 350,00         |
| Kitchen          | 70 %             | [✓] 100 %                | 70 %              |
| Wallet           | 100              | 97                       | [✓] 100           |
| Safety           | 100              | 100                      | 100               |
| Stars            | ★☆☆ 1 of 3 stars | ★★★ 3 of 3 stars         | ★☆☆ 1 of 3 stars  |
| Incident         | None             | None                     | None              |
| [■]              |                  |                          |               [■] |
+------------------------------------------------------------------------------------+
| [← Back to levels]                                                                 |
+------------------------------------------------------------------------------------+
```

### 4.2 2-Column Comparison (e.g. Level 2 & Level 3)
- Same `<table>` with 2 preset `<th scope="col">` columns (`26%` metric label + `37%` per preset column).
- **Level 2 (equal `stars`):** Neither column gets `data-best="true"` or `"Best balance"`. Per-row `data-best="true"` cells (`Approvals asked`, `Hearts used`, `Hearts left`) still highlight the attention difference.
- **Level 3 (Safety Incident on `allergen_off`):**
```text
| Metric           | [👑 Best balance]        | [X Incident]                    |
|                  | Allergen on              | Allergen off                    |
|------------------+--------------------------+---------------------------------|
| ...              | ...                      | ...                             |
| Stars            | ★★★ 3 of 3 stars         | ☆☆☆ 0 of 3 stars                |
| Incident         | None                     | [X] Safety incident: Contains   |
|                  |                          |     egg (AE)                    |
```

### 4.3 Height Budget Verification
- **`1366×768` (`--px: 4px`):** Outer padding `32px` + header (2-line `<h1>` + sub-line) `107px` + table (`<thead>` `52px` + 9 rows × `36px` + frame `12px` = `388px`) + footer `56px` = **`583px` ≤ `768px`** (`185px` spare).
- **`1920×1080` (`--px: 6px`):** Outer padding `60px` + header `157px` + table (`<thead>` `78px` + 9 rows × `53px` + frame `18px` = `573px`) + footer `84px` = **`874px` ≤ `1080px`** (`206px` spare).

### 4.4 CSS / Tailwind Structure per Element
- **Page wrapper (`<main aria-label="Preset comparison">`):**  
  Checkerboard background (`#EEF4FA` / `#F8FAFC` at `calc(16 * var(--px))` tile size) + `mx-auto max-w-[calc(290*var(--px))] px-[calc(6*var(--px))] py-[calc(4*var(--px))] min-h-screen`
- **Headline (`<h1>`, `tabIndex={-1}`):**  
  `m-0 font-display text-[calc(6*var(--px))] leading-[1.2] text-ink`
- **Sub-line (`<p>`):**  
  `mt-[calc(2*var(--px))] mb-[calc(4*var(--px))] text-[calc(4*var(--px))] leading-[1.3] text-ink-muted` (wrap `{levelTitle}` in `<strong className="font-bold text-ink">`)
- **Scoreboard Frame (`div.compare-frame`):**  
  `relative overflow-x-auto rounded-none border-[calc(1*var(--px))] border-border-strong bg-surface shadow-[var(--shadow-pixel)]`  
  Inner pixel bevel: `box-shadow: inset calc(0.5*var(--px)) calc(0.5*var(--px)) 0 #FFFFFF, inset calc(-0.5*var(--px)) calc(-0.5*var(--px)) 0 #CBD5E1, var(--shadow-pixel);`  
  Optional 4 `corner_rivet` sprites (`aria-hidden="true"`) anchored `calc(1 * var(--px))` from each corner.
- **`<table aria-labelledby="compare-heading">`:**  
  `w-full table-fixed border-collapse text-left`
- **`<th scope="col">` (Metric):**  
  `w-[26%] border-b-[calc(0.5*var(--px))] border-border-strong bg-surface-subtle px-[calc(3*var(--px))] py-[calc(2*var(--px))] align-bottom text-[calc(4*var(--px))] font-bold text-ink-muted`
- **`<th scope="col">` (Preset default):**  
  `border-b-[calc(0.5*var(--px))] border-border-strong bg-surface-subtle px-[calc(3*var(--px))] py-[calc(2*var(--px))] align-bottom text-[calc(5*var(--px))] leading-[1.15] font-bold text-ink`
- **`<th scope="col" data-best="true">`:**  
  Add `border-t-[calc(1.5*var(--px))] border-t-brand bg-brand-subtle` + `box-shadow: inset 0 calc(0.5*var(--px)) 0 #60A5FA;`
- **`<th scope="col" data-incident="true">`:**  
  Add `border-t-[calc(1.5*var(--px))] border-t-light-red bg-light-red-bg`
- **Tag pill (`"Best balance"` / `"Incident"`):**  
  `mb-[calc(1*var(--px))] inline-flex items-center gap-[calc(1.5*var(--px))] rounded-none border-[calc(0.5*var(--px))] border-border-strong px-[calc(2*var(--px))] py-[calc(0.5*var(--px))] text-[calc(4*var(--px))] leading-[1.1] font-bold shadow-[calc(0.5*var(--px))_calc(0.5*var(--px))_0_#0B1B33]` (`bg-brand text-surface` for Best; `bg-light-red text-surface` for Incident).
- **Zebra rows (`tbody tr:nth-child(even)`):**  
  `bg-[#F8FAFC]`, hover: `hover:bg-canvas`.
- **`<th scope="row">`:**  
  `border-b border-surface-subtle px-[calc(3*var(--px))] py-[calc(1.75*var(--px))] text-[calc(4*var(--px))] leading-[1.25] font-bold text-ink`
- **`<td>` (default):**  
  `border-b border-surface-subtle px-[calc(3*var(--px))] py-[calc(1.75*var(--px))] text-[calc(4*var(--px))] leading-[1.25] font-medium text-ink tabular-nums`
- **`<td data-best="true">`:**  
  Add `border-l-[calc(1*var(--px))] border-l-brand bg-brand-subtle font-bold` + inline `best_check` sprite (`aria-hidden="true"`).
- **`<td>` (muted: `"Not reported"`, `"Nothing ordered"`, `"None"`):**  
  `text-ink-muted font-normal`
- **`<td>` (Incident row when `incident !== null`):**  
  `border-l-[calc(1*var(--px))] border-l-light-red bg-light-red-bg font-bold text-light-red` + inline `stop` sprite (`aria-hidden="true"`).

---

## 5. Interactive States, Micro-Animations & Accessibility

1. **Button States (`"Back to levels"`, `010` `ghost` button):**
   - `default`: `#FFFFFF` bg, `#0052B4` text, `calc(0.5 * var(--px)) solid #0B1B33` border, `shadow-[calc(0.75*var(--px))_calc(0.75*var(--px))_0_#0B1B33]`, `min-height: calc(10 * var(--px))`, `arrow_back` sprite (`aria-hidden="true"`).
   - `hover`: `bg-brand-subtle` (`#E0F2FE`), `text-brand-hover` (`#003E8A`).
   - `active` (pressed): `translate-x-[calc(0.5*var(--px))] translate-y-[calc(0.5*var(--px))] shadow-[calc(0.25*var(--px))_calc(0.25*var(--px))_0_#0B1B33]`.
   - `focus-visible`: `outline-none shadow-[var(--shadow-focus)]`.
   - `disabled`: `opacity-65 cursor-not-allowed`.
2. **Loading (`client.compare` pending):**  
   Centred `PixelPanel` (`notice` variant: `#FFFFFF` surface, `calc(1.5 * var(--px))` `#0052B4` top bar, `calc(1 * var(--px)) solid #0B1B33` border, `var(--shadow-pixel)`) with `role="status"` text `"Loading comparison…"` and `"Back to levels"` button.
3. **Error (`GatewayError`):**  
   Render **no `<table>`**. Render `010` `PixelPanel` (`alert` variant: `role="alert"`, `#FDF2F5` bg, `#881337` text & `calc(1 * var(--px))` border, `calc(2 * var(--px))` left accent, `alert_triangle` sprite `aria-hidden="true"`, `error.message`) and `"Back to levels"` button.
4. **Stars & Hearts:**  
   - `Stars` (`005`): `star_on` / `star_off` sprites + visible text `"{stars} of 3 stars"`. For `0` stars, 3 `star_off` sprites + `"0 of 3 stars"` in `text-light-red font-bold`.
   - `Hearts left`: integer `{heartsLeft}` + `heartsLeft` `heart` sprites (`aria-hidden="true"`). When `0`, renders `"0"` with no heart sprites.
5. **Micro-Animations & Reduced Motion (`motion/react` + CSS):**  
   - **Scoreboard Entrance:** Wrap `div.compare-frame` in `MotionConfig reducedMotion="user"`: `initial={{ opacity: 0, y: 8 }}` → `animate={{ opacity: 1, y: 0 }}` (`duration: 0.24s`, `ease: [0.22, 1, 0.36, 1]`). Under `useReducedMotion()`, `duration: 0, y: 0`.
   - **Best-Column Crown Bob:** 2-frame pixel bob (`translateY(0)` → `translateY(calc(-0.5 * var(--px)))` every `1.6s`, `steps(2, end)`) on `best_crown` only; disabled under `@media (prefers-reduced-motion: reduce)`.
6. **Keyboard & Landmarks:**  
   - `<main aria-label="Preset comparison">`, `<h1>` (`tabIndex={-1}`) focused when data/error settles.
   - Real `<table>` with `<th scope="col">` and `<th scope="row">`; all decorative pixel sprites carry `aria-hidden="true"`.
   - `"Back to levels"` is a native `<button type="button">` reachable via `Tab` and activated with `Enter` or `Space`.

---

## 6. Final UI Copy (English, Typographic Quotes & Apostrophes)

| Element | Exact Copy |
|---|---|
| Headline (`<h1>`) | `Agents don’t need a chatbot. They need a mandate.` |
| Sub-line | `{levelTitle} · Mandate = buyer’s promise · Quote = Valio Aimo’s promise · Log = proof both kept them` |
| Loading state | `Loading comparison…` |
| Metric column header | `Metric` |
| Best column tag | `Best balance` |
| Incident column tag | `Incident` |
| Row 1–9 headers | `Approvals asked`, `Hearts used`, `Hearts left`, `Cost`, `Kitchen`, `Wallet`, `Safety`, `Stars`, `Incident` |
| Absent optional field | `Not reported` |
| Null `totalCost` | `Nothing ordered` |
| Null `incident` | `None` |
| Non-null `incident` | `Safety incident: {incident.reason}` |
| Stars text | `{stars} of 3 stars` |
| Footer button | `Back to levels` |
