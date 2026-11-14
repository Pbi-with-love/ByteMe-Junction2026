# Design Handoff — 003: Activity Log + Game Clock (In-World Pixel UI)

> **Owner:** Antigravity (Argon) · **Implementer:** Codex (GPT-6 Luna)  
> **Scope:** `docs/design/003-agent-timeline.md` only. Supersedes the prior web-style `003` handoff visually while preserving its copy, gateway-truth rules, states, and accessibility requirements.  
> **Reuses:** `docs/design/010-game-world.md` (24-colour palette, `320×180` logical grid, `--px` unit scale, `Pixelify Sans` / `Press Start 2P`, `PixelPanel` bevel/shadow language, 4 emote shapes, focus ring) and `docs/design/011-character-art.md` (actor/decor positions).  
> **Domain framing:** Interactive simulation platform for trusted autonomous purchasing (*Valio Aimo Trust Gateway*). Never frame as a restaurant management game.

---

## 1. Design Decisions & Rationale

1. **In-World Pixel Activity Log Docked Below Delivery (`side` Area):**  
   `010`’s `side` column (`96 * var(--px)`, rightmost `30%` of the `320×180` kitchen) passes directly over the **Phone Station** (`x: 240..272, y: 18..34`), the robot at `phone` (`x: 240..256, y: 34..50`), the **Delivery Entrance** (`x: 304..320, y: 82..114`), and the robot/courier at `delivery` (`x: 288..304, y: 82..114`). Therefore, `ActivityLog` is **docked in the lower-right floor zone (`x: 224..318, y: 116..178` logical px)**—strictly below `y = 114`—so it covers **zero** station hotspots and **never** obscures the robot at `phone` or `delivery`.
2. **Crisp Pixel-Bevel Chrome & Unscaled `--px` Typography:**  
   `ActivityLog` and `GameClock` mount in an unscaled overlay layer inside `.world-frame` (full `320k × 180k` CSS px, using `calc(n * var(--px))` rather than `transform: scale(k)`). That keeps `getComputedStyle(el).fontSize` at `24px` (`1080p`, `--px: 6px`) and `16px` (`768p`, `--px: 4px`)—always `≥ 16px` and razor-sharp on projectors.
3. **Strict Policy Light Isolation & Multi-Channel `LightBadge`:**  
   `LightBadge` pairs `010`’s reserved `--color-light-*` tokens with `010`’s four shape-distinct `8×8` emote sprites (`calm`, `info`, `puzzled`, `stop`) and a visible word (`Green`, `Blue`, `Yellow`, `Red`). System/gateway errors (`409` / network) use `010`’s rose-burgundy `alert` palette (`#881337` on `#FDF2F5`) with `alert_error_8x8`—never policy `RED`.
4. **Explicit Non-Approvals & Calm Gateway Truth:**  
   The log never computes policy, prices, scores, hearts, or stars, and renders **zero** controls matching `/approve/i`. `202` entries settle to `"Approval requested"` (Spec `004` owns decisions); `403` entries render `"Order blocked"` in `RED` with no override affordance.
5. **HUD Game Clock with Reserved Room for `004` Hearts:**  
   `GameClock` (`role="timer"`) sits in the top `hud` bar (`height: 14 * --px`) between the hint status and `"Back to levels"`, leaving `36 * --px` (`216px` at 1080p, `144px` at 768p) immediately to its left for `004`’s 3-heart `HeartsMeter`.

---

## 2. Palette & Design Tokens (`010` Base + Marked Additions)

### 2.1 Reused `010` Tokens (`frontend/src/index.css` `@theme`)
All `24` palette keys (`o, w, f, p, g, b, d, s, t, c, m, k, u, n, G, 1, B, 2, Y, 3, R, 4, e, a`) and `@theme` tokens from `docs/design/010-game-world.md` §2 & §7 are reused **unchanged**:
- `--px`: `4px` (`< 1440px` / `1366×768`) and `6px` (`>= 1440px` / `1920×1080`).
- `--font-sans`: `"Pixelify Sans", system-ui, sans-serif`
- `--font-display`: `"Press Start 2P", monospace`
- `--font-mono`: `"Pixelify Sans", monospace`
- `--shadow-pixel`: `calc(1 * var(--px)) calc(1 * var(--px)) 0 #0B1B33`
- `--shadow-focus`: `0 0 0 calc(0.5 * var(--px)) #FFFFFF, 0 0 0 calc(1.25 * var(--px)) #0052B4`

### 2.2 Marked Additions for Spec `003` (`frontend/src/index.css` `@theme`)
Append **only** these tokens inside `@theme`:

```css
  /* === Spec 003 Marked Additions (append inside @theme in src/index.css) === */
  --color-light-green-border: #86EFAC;   /* NEW: GREEN badge & entry border */
  --color-light-blue-border: #7DD3FC;    /* NEW: BLUE badge & entry border */
  --color-light-yellow-border: #FDE047;  /* NEW: YELLOW badge & entry border */
  --color-light-red-border: #FCA5A5;     /* NEW: RED badge & entry border */

  --color-code-bg: #0B1B33;              /* Reuses 010 `o` — raw JSON <pre> bg */
  --color-code-ink: #E2E8F0;             /* NEW: raw JSON text (13.98:1 on #0B1B33) */

  --color-tag-overlay-bg: #EEF2FF;       /* NEW: "Scenario adjustment" badge bg (matches 006) */
  --color-tag-overlay-ink: #3730A3;      /* NEW: "Scenario adjustment" text (8.70:1 on #EEF2FF) */

  --color-floor-alt: #F8FAFC;            /* Reuses 010 `p` — expanded detail surface */
  --color-steel-light: #CBD5E1;          /* Reuses 010 `c` — inner pixel bevel shadow */
```

### 2.3 Contrast Verification Summary
| Pair | Ratio | Standard |
|---|---|---|
| `--color-ink` (`#0B1B33`) on `--color-surface` (`#FFFFFF`) | **17.23:1** | Exceeds AAA (7:1) |
| `--color-ink-muted` (`#475569`) on `--color-surface` (`#FFFFFF`) | **7.50:1** | Exceeds AAA (7:1) |
| `#FFFFFF` on `--color-terminal-bg` (`#1E3A5F`) | **11.40:1** | Exceeds AAA (7:1) |
| `--color-light-green` (`#15803D`) on `--color-light-green-bg` (`#DCFCE7`) | **4.57:1** | Passes AA (4.5:1) |
| `--color-light-blue` (`#0369A1`) on `--color-light-blue-bg` (`#E0F2FE`) | **5.17:1** | Passes AA (4.5:1) |
| `--color-light-yellow` (`#A16207`) on `--color-light-yellow-bg` (`#FEF9C3`) | **4.58:1** | Passes AA (4.5:1) |
| `--color-light-red` (`#B91C1C`) on `--color-light-red-bg` (`#FEE2E2`) | **5.30:1** | Passes AA (4.5:1) |
| `--color-code-ink` (`#E2E8F0`) on `--color-code-bg` (`#0B1B33`) | **13.98:1** | Exceeds AAA (7:1) |
| `--color-tag-overlay-ink` (`#3730A3`) on `--color-tag-overlay-bg` (`#EEF2FF`) | **8.70:1** | Exceeds AAA (7:1) |
| `--color-error-ink` (`#881337`) on `--color-error-surface` (`#FDF2F5`) | **8.74:1** | Exceeds AAA (7:1) |

---

## 3. Pixel Sprites & Icons (8×8 Palette-Indexed Grids)

All icons use **only `010` §2 palette keys** (`.` = transparent; zero new hexes required for sprites) and render via crisp pixel SVG (`viewBox="0 0 8 8"`, `shape-rendering="crispEdges"`, `aria-hidden="true"`) at `calc(3.5 * var(--px))` (`21×21px` at 1080p, `14×14px` at 768p) or `calc(4 * var(--px))` (`24×24px` at 1080p, `16×16px` at 768p).

### 3.1 Reused `010` Emote Icons (`LightBadge`)
Reuse `calm` (`GREEN`), `info` (`BLUE`), `puzzled` (`YELLOW`), and `stop` (`RED`) from `docs/design/010-game-world.md` §4.4 verbatim at `calc(3.5 * var(--px))` inside `LightBadge`.

### 3.2 Marked New Icons (`src/world/art.ts` / `PixelSprite`)

**`clock_8x8` (`GameClock` HUD icon — `o, w, c, b`)**
```text
..oooo..
.ocwwco.
owwbbwwo
owwbwwwo
owwbbbwo
owwwwwwo
.ocwwco.
..oooo..
```

**`kind_search_8x8` (`Search` entry icon — `o, w, s, b`)**
```text
.oooo...
owsswo..
oswwso..
owsswo..
.ooooo..
....obo.
.....obo
......oo
```

**`kind_quote_8x8` (`Quote` entry icon — `o, w, b, m`)**
```text
.oooooo.
owwwwwwo
owbbbbwo
owwwwwwo
owmmmmwo
owwwwwwo
owmmmmwo
.oooooo.
```

**`kind_order_8x8` (`Order` entry icon — `o, u, n, w`)**
```text
.oooooo.
ouuuuuuo
ounnnnno
owuuuuwo
ouuuuuuo
ouunnuuo
ounnnnno
.oooooo.
```

**`chevron_down_8x8` (Expand/collapse chevron — `o, b`)**
```text
........
........
oo....oo
obboobbo
.obbbbo.
..obbo..
...oo...
........
```

**`alert_error_8x8` (Gateway/409 error icon — `o, e, w`)**
```text
...oo...
..oeeo..
..oewo..
.oeeweo.
.oeeweo.
oeeeeeeo
oeeweeeo
oooooooo
```

---

## 4. Exact World Layout & Overlay Geometry (`1920×1080` & `1366×768`)

### 4.1 Overlay Containers (`GameWorld` `hud | center | side`)
Expose explicit overlay containers inside `.world-frame` (unscaled screen coordinates, `pointer-events: none` on wrappers, `pointer-events: auto` on interactive panels/controls):
- `[data-area="hud"]`: Top bar (`left: 0; top: 0; width: 100%; height: calc(14 * var(--px))`).
- `[data-area="center"]`: Hosts `PixelPanel` dialogs (`left: 0; top: calc(14 * var(--px)); width: calc(224 * var(--px)); bottom: 0`).
- `[data-area="side"]`: Right column (`left: calc(224 * var(--px)); top: calc(14 * var(--px)); width: calc(96 * var(--px)); bottom: 0`).

### 4.2 Exact `ActivityLog` Box & Hotspot Clearance (Open Question 2)
Inside `[data-area="side"]`, `ActivityLog` anchors to the **bottom** (`position: absolute; right: calc(2 * var(--px)); bottom: calc(2 * var(--px)); width: calc(94 * var(--px)); height: calc(62 * var(--px))`), leaving the entire upper/mid `side` area (`y = 14..116` logical px) open for the kitchen world.

| Metric | Logical (`320×180`) | `1920×1080` (`--px: 6px`) | `1366×768` (`--px: 4px`, canvas `1280×720`) |
|---|---|---|---|
| `ActivityLog` Left (`x`) | `224` | `1344 px` | `896 px` |
| `ActivityLog` Top (`y`) | `116` | `696 px` | `464 px` |
| `ActivityLog` Width (`w`) | `94` (`29.375% ≤ 30%`) | `564 px` | `376 px` |
| `ActivityLog` Height (`h`) | `62` | `372 px` | `248 px` |
| `ActivityLog` Right / Bottom margin | `2` / `2` | `12 px` / `12 px` | `8 px` / `8 px` |

**Intersection Verification (Zero Overlap):**
- `storage` (`x: 16..64, y: 18..50`): Clear (`x` & `y`).
- `terminal` (`x: 128..176, y: 18..34`): Clear (`x` & `y`).
- `phone` (`x: 240..272, y: 18..34`) & robot at `phone` (`240, 34` → `y: 34..50`): Clear (`log.top = 116 > 50`).
- `delivery` (`x: 304..320, y: 82..114`), robot at `delivery` (`288, 82` → `y: 82..98`), & courier (`288, 98` → `y: 98..114`): Clear (`log.top = 116 > 114`).
- `desk` (`x: 16..64, y: 130..162`): Clear (`log.left = 224 > 64`).

```text
0                  224              320 (logical x)
+-----------------------------------+  y=0
| HUD: [Title][Customer][Hint][♥♥♥][10:03][Back] |  y=14
+-----------------------------------+
| [Storage]   [Terminal]   [Phone]  |  y=18..50 (Robot @ phone = 240,34)
|                                   |
|     [Counter]     [Counter]  [Del]|  y=66..114 (Robot @ delivery = 288,82)
|                           +-------+  y=116
| [Desk]                    | LOG   |
|                           | DOCK  |  94×62 logical px (scrolls inside)
+---------------------------+-------+  y=178 (2px bottom margin)
```

---

## 5. Type Scale & Component Specifications

### 5.1 Type Scale (`calc(n * var(--px))`, Minimum `4 * --px`)
| Role | Token | `1920×1080` (`--px: 6px`) | `1366×768` (`--px: 4px`) | Font |
|---|---|---|---|---|
| `GameClock` digits (`HH:MM`) | `calc(5 * var(--px))` | `30 px` | `20 px` | `Press Start 2P`, `tabular-nums` |
| HUD Title (`<h1>`), `ActivityLog` Header | `calc(4 * var(--px))` | `24 px` | `16 px` | `Press Start 2P` |
| Entry Titles, Plan Totals, Badges, Chips, JSON | `calc(4 * var(--px))` | `24 px` | `16 px` | `Pixelify Sans` |

> **Hard rule:** No visible text anywhere in `GameClock`, `ActivityLog`, or `LightBadge` may be smaller than `calc(4 * var(--px))` (`24px` at 1080p, `16px` at 768p).

### 5.2 `GameClock` (`src/components/GameClock.tsx`) in `hud`
- **Props:** `{ time: string; running?: boolean }` (rendered inside `[data-area="hud"]`).
- **Semantics:** `<div role="timer" aria-label="Game clock" aria-live="off" className="game-clock">`.
- **Frame & Bevel:**
  - `display: inline-flex; align-items: center; gap: calc(1.5 * var(--px)); min-height: calc(9 * var(--px)); padding: calc(1 * var(--px)) calc(2.5 * var(--px));`
  - `background: var(--color-surface)` (`#FFFFFF`), `border: calc(0.5 * var(--px)) solid var(--color-border-strong)` (`#0B1B33`), `border-radius: 0`.
  - Inner bevel: `box-shadow: inset calc(0.5 * var(--px)) calc(0.5 * var(--px)) 0 var(--color-steel-light), calc(0.5 * var(--px)) calc(0.5 * var(--px)) 0 var(--color-border-strong)`.
- **Contents:**
  1. `clock_8x8` pixel sprite (`calc(4 * var(--px))`, `aria-hidden="true"`).
  2. `<span className="game-clock-digits">{time}</span>` (`Press Start 2P`, `calc(5 * var(--px))`, `#0B1B33`, `tabular-nums`, `line-height: 1`).
  3. Status LED (`calc(2 * var(--px))` square): `#0052B4` (`motion-safe:animate-pulse`) while `running === true`; `#475569` static when stopped/finished.
- **HUD Layout Fit:**
  - `hud` is a single horizontal flex row (`padding: 0 calc(3 * var(--px)); gap: calc(2.5 * var(--px)); background: rgba(255, 255, 255, 0.94); border-bottom: calc(0.75 * var(--px)) solid #0B1B33`).
  - Order: `[<h1> title + customer pill]` → `[hint role="status" (flex: 1, truncate)]` → `[004 Hearts slot (~36 * --px)]` → `[GameClock]` → `["Back to levels" ghost button]`.

### 5.3 `LightBadge` (`src/components/LightBadge.tsx`)
- **Props:** `{ light: Light; label?: string }`.
- **Root:** `<span data-light={light} className="light-badge">` (`inline-flex; align-items: center; gap: calc(1 * var(--px)); padding: calc(0.5 * var(--px)) calc(1.5 * var(--px)); border: calc(0.5 * var(--px)) solid ...; border-radius: 0; font-size: calc(4 * var(--px)); font-weight: 700; line-height: 1.2`).
- **Never colour alone:** Renders the `8×8` `010` emote sprite (`calc(3.5 * var(--px))`, `aria-hidden="true"`) + visible text (`Green`, `Blue`, `Yellow`, `Red`, or `label`).

| `light` | Default Word | `010` Sprite | Background | Text & Border |
|---|---|---|---|---|
| `GREEN` | `Green` | `calm` | `--color-light-green-bg` (`#DCFCE7`) | `--color-light-green` (`#15803D`) / `--color-light-green-border` (`#86EFAC`) |
| `BLUE` | `Blue` | `info` | `--color-light-blue-bg` (`#E0F2FE`) | `--color-light-blue` (`#0369A1`) / `--color-light-blue-border` (`#7DD3FC`) |
| `YELLOW` | `Yellow` | `puzzled` | `--color-light-yellow-bg` (`#FEF9C3`) | `--color-light-yellow` (`#A16207`) / `--color-light-yellow-border` (`#FDE047`) |
| `RED` | `Red` | `stop` | `--color-light-red-bg` (`#FEE2E2`) | `--color-light-red` (`#B91C1C`) / `--color-light-red-border` (`#FCA5A5`) |

### 5.4 `ActivityLog` (`src/components/ActivityLog.tsx`)
- **Outer Dock Frame:**
  - `display: flex; flex-direction: column; border: calc(1 * var(--px)) solid #0B1B33; border-radius: 0; background: #FFFFFF;`
  - Pixel bevel + drop shadow: `box-shadow: inset calc(0.5 * var(--px)) calc(0.5 * var(--px)) 0 #FFFFFF, inset calc(-0.5 * var(--px)) calc(-0.5 * var(--px)) 0 #CBD5E1, var(--shadow-pixel)`.
- **Dock Header Bar (`flex-shrink: 0`):**
  - `background: #1E3A5F; color: #FFFFFF; padding: calc(1.5 * var(--px)) calc(2 * var(--px)); border-bottom: calc(0.75 * var(--px)) solid #0B1B33;`
  - Contains `"Activity log"` (`Press Start 2P`, `calc(4 * var(--px))`) + entry count pill (`#60A5FA` / `#0B1B33`, `tabular-nums`).
- **Scrollable Log Container (`<div role="log" aria-label="Activity log" aria-live="polite">`):**
  - Mounted from kitchen start (even when `entries.length === 0`).
  - `flex: 1 1 auto; overflow-y: auto; padding: calc(2 * var(--px)); display: flex; flex-direction: column; gap: calc(2 * var(--px)); background: #EEF4FA;`.
  - **Empty State:** Calm muted note (`#475569`): `"No agent activity yet."`
  - **Auto-Scroll:** On new entry, scroll newest card (bottom) into view: `el.scrollIntoView({ behavior: shouldReduce ? 'auto' : 'smooth', block: 'nearest' })`.

### 5.5 `TimelineEntry` Card & Interactive States
Each entry is an `<article>` (`background: #FFFFFF; border: calc(0.5 * var(--px)) solid #94A3B8; border-left: calc(1.5 * var(--px)) solid var(--entry-accent); border-radius: 0; box-shadow: inset calc(-0.5 * var(--px)) calc(-0.5 * var(--px)) 0 #D6E3F0`):
- `--entry-accent`: `--color-light-{green|blue|yellow|red}` when `light !== null`; `--color-border-strong` (`#0B1B33`) when `light === null`; `--color-error-ink` (`#881337`) for `409` / error.

1. **Header Button (`<button type="button" aria-expanded={expanded}>`):**
   - Full-width, `min-height: calc(10 * var(--px))`, `padding: calc(1.5 * var(--px)) calc(2 * var(--px))`, `text-align: left`, `display: grid; gap: calc(1 * var(--px))`.
   - **States:**
     - `default`: `#FFFFFF` background.
     - `hover`: `#EEF4FA` background, `border-color: #0052B4`.
     - `active` (pressed): `transform: translate(calc(0.25 * var(--px)), calc(0.25 * var(--px)))`, `#D6E3F0` background.
     - `focus-visible`: `outline: none; box-shadow: var(--shadow-focus)`.
     - `disabled`: `opacity: 0.6; cursor: not-allowed` (if ever disabled).
   - **Row 1 (Meta):** `formatTime(at)` (`tabular-nums`, `#475569`) + Kind chip (`kind_search_8x8` + `"Search"` / `kind_quote_8x8` + `"Quote"` / `kind_order_8x8` + `"Order"`) + `LightBadge` (when `light !== null`) + `chevron_down_8x8` (rotates `180deg` when `aria-expanded="true"`).
   - **Row 2 (Title & Chips):** `entry.title` (`#0B1B33`, `font-weight: 700`) + Reason chips (`#D6E3F0` bg, `#0B1B33` ink, `REASON_TEXT[code]`).

2. **Step-Kind Body (visible on card):**
   - **Search (`kind === "search"`):** `light: null`. Title: `Searched the catalog: {total} products, {n} excluded`. If any row has `excluded: true`, render `"Excluded products"` list with RED `LightBadge`, product `name` (fallback `productId`), and `REASON_TEXT[excluded.reason]`.
   - **Quote (`kind === "quote"`):** `light` = recommended plan's `policy.light`. Shows recommended plan `summary` (fallback `formatMoney(total)`).
     - `"Scenario adjustment"` badge (`--color-tag-overlay-bg` / `--color-tag-overlay-ink`) iff `quote.scenarioOverlay`.
     - `"Recommended plan uses another brand: {brands}."` note iff `nonValioBrands(quote, search)` is non-empty.
     - `quote.excludedProducts`: `"Excluded products"` list with RED `LightBadge` + `REASON_TEXT`.
   - **Order (`kind === "order"`):**
     - `201` (`ORDERED`): `Ordered {orderId}` + `LightBadge` (`GREEN`/`BLUE`).
     - `202` (`PENDING_APPROVAL`): `LightBadge` (`YELLOW`) + `"Approval requested"` (calm `#FEF9C3` / `#D6E3F0` strip; zero `/approve/i` controls).
     - `403` (`BLOCKED`): `LightBadge` (`RED`) + `"Order blocked"` + gateway `error.message` (visibly zero approve/override controls).
     - `409` / other (`ERROR`): `light: null`, `alert_error_8x8` + `{code}: {message}` in `--color-error-surface` / `--color-error-ink`.

3. **Expanded Detail Region (visible when `aria-expanded="true"`):**
   - Separated by `calc(0.5 * var(--px)) solid #94A3B8`, `background: #F8FAFC`, `padding: calc(2 * var(--px))`.
   - **Quote Plans (vertical stack inside narrow `side` dock):** Each plan (`Best` / `Better` / `Good`) as a crisp sub-card (`#FFFFFF`, `border: calc(0.5 * var(--px)) solid #94A3B8`; recommended plan has `calc(1 * var(--px)) solid #0052B4` border + `#E0F2FE` header + `"Recommended"` text tag): tier, `LightBadge`, `formatMoney(total)`, `{formatQuantity(onTime)} of {formatQuantity(need.quantity)} on time`, `Score {commaDecimal}`, `summary`, and plan lines with product `name` (fallback `productId`).
   - **`"Rule applied"`:** List of each reason code + `REASON_TEXT[code]` (and `approval.reasonText` for `202` orders).
   - **`"Raw gateway data"`:** `<pre tabIndex={0}>` (`--color-code-bg` `#0B1B33`, `--color-code-ink` `#E2E8F0`, `max-height: calc(36 * var(--px))`, `overflow: auto`, `padding: calc(1.5 * var(--px))`, formatted JSON containing `quoteId`).

---

## 6. Micro-Animations & Reduced-Motion Fallbacks

```css
@keyframes timeline-entry-reveal {
  from { opacity: 0; transform: translateY(calc(1.5 * var(--px))); }
  to { opacity: 1; transform: translateY(0); }
}
```
- **Entry reveal:** `motion-safe:animate-[timeline-entry-reveal_200ms_steps(4,end)_both]` (crisp 4-step pixel reveal); `motion-reduce:animate-none` (instant appearance).
- **Chevron rotation:** `motion-safe:transition-transform motion-safe:duration-150`; `motion-reduce:transition-none`.
- **Clock LED pulse:** `motion-safe:animate-pulse` while running; `motion-reduce:animate-none` (solid `#0052B4` square).
- **Auto-scroll:** `behavior: shouldReduce ? 'auto' : 'smooth'`.

---

## 7. Accessibility & Keyboard Navigation

1. **Landmarks & Roles:**
   - `GameClock`: `role="timer"`, `aria-label="Game clock"`, `aria-live="off"`.
   - `ActivityLog`: `role="log"`, `aria-label="Activity log"`, `aria-live="polite"`; mounted from kitchen start.
2. **Keyboard Operability:**
   - Every entry header is a `<button type="button" aria-expanded={expanded}>` (`Enter`/`Space` toggles detail region).
   - Scrollable `<pre>` has `tabIndex={0}`.
   - All interactive controls use `focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none`.
3. **Prohibited Controls:** Zero elements matching `/approve/i` anywhere in `ActivityLog`.

---

## 8. Exact UI Copy & `REASON_TEXT` Table

| Element | Exact Copy |
|---|---|
| Clock accessible name | `Game clock` |
| Log heading & accessible name | `Activity log` |
| Empty log note | `No agent activity yet.` |
| Kind labels | `Search` · `Quote` · `Order` |
| Search entry title | `Searched the catalog: {total} products, {n} excluded` |
| Quote tags & neutrality | `Scenario adjustment` · `Recommended` · `Recommended plan uses another brand: {brands}.` |
| Plan tiers & metrics | `Best` · `Better` · `Good` · `{onTime} of {needed} on time` · `Score {score}` |
| Excluded list heading | `Excluded products` |
| Order statuses | `Ordered {orderId}` · `Approval requested` · `Order blocked` · `{code}: {message}` |
| Expanded headings | `Rule applied` · `Raw gateway data` |
| `LightBadge` default labels | `Green` · `Blue` · `Yellow` · `Red` |

### `REASON_TEXT` (`src/lib/reasons.ts`)
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

---

## 9. Open Questions / Assumptions for Implementation
- **Unscaled Overlay Layer:** `GameWorld`’s current `.world-overlay` applies `transform: scale(scale)`. Mount `[data-area="hud"]`, `[data-area="center"]`, and `[data-area="side"]` in an unscaled `100%` overlay inside `.world-frame` using `var(--px)` so `getComputedStyle().fontSize` is `24px` (`1080p`) / `16px` (`768p`) (`>= 16px`).
- **Narrow `side` Dock:** Because `ActivityLog` is `94 * --px` wide (`564px` at 1080p, `376px` at 768p), plan cards inside an expanded quote entry stack vertically (`grid-cols-1`) with zero horizontal overflow.
