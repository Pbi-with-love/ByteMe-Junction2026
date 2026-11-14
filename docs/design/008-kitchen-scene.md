# Design Handoff — 008: Kitchen Scene with Robot Agent (Level B Visuals)

> **Owner:** Antigravity (Argon) · **Implementer:** Codex (GPT-6 Luna)  
> **Scope:** `docs/design/008-kitchen-scene.md` only. Reuses shared tokens from `docs/design/002-mandate-screen.md`, `LightBadge` icon shapes from `docs/design/003-agent-timeline.md`, and the 3-column `RunScreen` layout from `docs/design/003-agent-timeline.md` and `docs/design/004-phone-approval.md` verbatim.

---

## 1. Design Decisions & Rationale

1. **Glanceable "Where Is the Agent?" Layer for the Projector Audience:**  
   At `1920×1080` from 3–5 m away, the centre `Agent timeline` is the source of truth, while the `KitchenScene` in the left panel gives an instant visual summary of what the agent is doing right now (`storage` → `terminal` → `door` / `manager`) and how the policy engine reacted (`calm`, `info`, `puzzled`, `stop`).
2. **Anchored Above `"See result"` Without Ever Overlapping Timeline or Phone:**  
   Mounted as the **last child of the sticky left panel** (`360px` at `1920×1080`, `280px` at `1366×768`), the scene scales to the column width (`viewBox="0 0 400 250"`, `16:10` aspect ratio) and keeps a tight vertical budget so the entire left panel—including the game clock and `"See result"` button—stays inside the `768px` laptop viewport with zero overlap onto `[role="log"]` or the phone frame.
3. **HTML Speech Bubble Above the SVG for True Projector Typography & Ellipsis:**  
   Rendering the speech bubble in HTML directly above the `<svg>` (with a small downward pointer aligned to the robot's horizontal `%` position) guarantees exact `18px` (`1080p`) / `16px` (`768p`) text, native CSS 2-line `line-clamp` with ellipsis, `16.9:1` contrast, and zero risk of ever covering the robot's head emote.
4. **Shape + Token Emotes, Zero Distracting Idle Loops:**  
   Every emote pairs the existing `--color-light-*` tokens with a distinct robot **arm/head pose** and a **head icon reusing `LightBadge` shapes** (checkmark, `"i"`, exclamation triangle + scratching hand, octagon + raised palm). Movement takes `450ms` (`≤ 600ms`) so the robot settles well before Spec 003's `1000ms` reveal gap, and `prefers-reduced-motion` switches to an instant `0ms` jump.

---

## 2. Shared Design Tokens (Reused + Marked Addition)

Reuse `@theme` from `docs/design/002-mandate-screen.md` §2 and the Spec 003 additions from `docs/design/003-agent-timeline.md` §2 **unchanged** (`--color-canvas`, `--color-surface`, `--color-surface-subtle`, `--color-ink`, `--color-ink-muted`, `--color-brand`, `--color-brand-hover`, `--color-brand-subtle`, `--color-border`, `--color-border-strong`, `--color-light-{green,blue,yellow,red}`, `--color-light-{green,blue,yellow,red}-bg`, `--color-light-{green,blue,yellow,red}-border`, `--radius-card`, `--radius-control`, `--radius-chip`, `--shadow-focus`).

Add only **one** non-light surface token to `frontend/src/index.css` `@theme` if needed for the kitchen wall backdrop:

```css
  /* === Spec 008 Addition (append inside @theme in src/index.css) === */
  --color-kitchen-wall: #F8FAFC; /* Subtle cool-white kitchen wall backdrop */
```

> **Light token rule:** All four emote colours **must** reference `--color-light-green`, `--color-light-blue`, `--color-light-yellow`, `--color-light-red` and their `-bg` / `-border` counterparts via CSS `var(...)`. Do not introduce any new light hex values.

---

## 3. Placement & Responsive Layout (`1920×1080` & `1366×768`)

`RunScreen` keeps the exact 3-column grid from `docs/design/004-phone-approval.md` §4.1:
- `1920×1080` (`xl:` / `≥ 1440px`): `grid-cols-[360px_minmax(0,1fr)_440px]`, `gap: 28px`, padding `24px 32px`.
- `1366×768` (`lg:` `1024px–1439px`): `grid-cols-[280px_minmax(0,1fr)_380px]`, `gap: 20px`, padding `16px 24px`.
- `< 1024px`: single-column stack (`grid-cols-1`); `<KitchenScene>` stacks naturally at the bottom of the left-panel block.

### 3.1 Left Panel Vertical Budget (Staying Above the Fold at `768px`)

| Left-Panel Block | `1920×1080` (`360px` col) | `1366×768` (`280px` col) |
|---|---|---|
| Customer pill + Level `<h1>` + Brief + Schedule + Clock + `"See result"` | `~536px` | `~406px` |
| **KitchenScene Card** (header + optional 2-line bubble + `16:10` SVG) | `~336px` (`100%` of `360px`) | `~252px` (`100%` of `280px`) |
| **Total Left Panel Height** | **`~872px`** (`≤ 1032px` avail.) | **`~658px`** (`≤ 736px` avail.) |

```text
1920×1080 (Left col = 360px)                 1366×768 (Left col = 280px)
+-----------------------------------+        +---------------------------+
| [Customer]  Level title           |        | [Customer] Level title    |
| [Manager brief]                   |        | [Manager brief]           |
| Deliver by / Cut-off              |        | Deliver by / Cut-off      |
| [Game clock 10:03]                |        | [Game clock 10:03]        |
| [See result] (when finished)      |        | [See result] (when done)  |
|-----------------------------------|        |---------------------------|
| Kitchen           [Hide kitchen]  |        | Kitchen    [Hide kitchen] |
| +-------------------------------+ |        | +-----------------------+ |
| | Searched the catalog: 12…     | |        | | Searched the catalog… | |
| +---------------v---------------+ |        | +-----------v-----------+ |
| | [Storage][Term][Door] [Mgr]   | |        | | [Stg][Trm][Door][Mgr] | |
| |            [Robot]            | |        | |        [Robot]        | |
| +-------------------------------+ |        | +-----------------------+ |
+-----------------------------------+        +---------------------------+
```

- **Outer `<KitchenScene>` card:** `--color-surface` (`#FFFFFF`), `1px solid --color-border`, `border-radius: --radius-card` (`16px`), `padding: 12px` at `1080p` (`10px` at `768p`), `width: 100%`, `overflow: hidden`.
- **SVG container:** `width: 100%; aspect-ratio: 16 / 10; display: block;` (`334px × 209px` inner at `1080p`; `258px × 161px` inner at `768p`).

---

## 4. Flat 2D Kitchen Illustration (`viewBox="0 0 400 250"`)

Our own flat, geometric, Valio-like blue/white inline `<svg viewBox="0 0 400 250" aria-hidden="true">`. Zero copyrighted characters, zero brand logos, zero photos, zero internal gradients.

### 4.1 Room Backdrop & Floor
- **Wall (`y: 0..178`):** `<rect x="0" y="0" width="400" height="178" fill="var(--color-kitchen-wall)" />`
- **Tiled wainscot (`y: 118..178`):** `<rect x="0" y="118" width="400" height="60" fill="var(--color-surface-subtle)" />` with subtle horizontal tile line at `y="148"` (`stroke="var(--color-border)" strokeWidth="1"`).
- **Floor (`y: 178..250`):** `<rect x="0" y="178" width="400" height="72" fill="var(--color-brand-subtle)" />`
- **Baseboard rule:** `<line x1="0" y1="178" x2="400" y2="178" stroke="var(--color-border-strong)" strokeWidth="2" />`

### 4.2 Fixed Spots, Shapes, Colours & Robot `{x, y}` Coordinates

Robot `{x, y}` is the **horizontal centre and vertical anchor** of the robot `<motion.g>` so its wheels/feet rest cleanly on the floor line (`y + 20 = 178`).

| Spot | Robot `{x, y}` | Bubble Pointer `x%` | Exact Label |
|---|---|---|---|
| `storage` | `{ x: 52, y: 158 }` | `13%` | `Storage` |
| `terminal` | `{ x: 148, y: 158 }` | `37%` | `Terminal` |
| `door` | `{ x: 248, y: 158 }` | `62%` | `Delivery door` |
| `manager` | `{ x: 332, y: 158 }` | `83%` | `Manager` |

1. **`storage` — Cold Room / Shelves (`x: 14..88`, `y: 44..178`):**
   - Outer cabinet/rack frame: `<rect x="16" y="44" width="70" height="134" rx="4" fill="var(--color-surface)" stroke="var(--color-border-strong)" strokeWidth="1.5" />`
   - Top cold-room header strip: `<rect x="16" y="44" width="70" height="16" rx="4" fill="var(--color-brand)" />` with a small white snowflake/dot circle (`cx="26" cy="52" r="3" fill="var(--color-surface)"`) and 2 thermometer ticks (`#E0F2FE`).
   - Three shelf bars at `y = 88, 122, 156` (`height="4"`, `fill="var(--color-border-strong)"`).
   - Generic dairy cartons/crates on shelves: simple rects in `var(--color-brand-subtle)` (`#E0ECFA`), `var(--color-brand)` (`#0052B4`), and `var(--color-surface-subtle)` (`#EBF1F8`) with `1px` `--color-border` strokes (no text or logos).

2. **`terminal` — Ordering Screen (`x: 118..178`, `y: 98..178`):**
   - Counter/desk base: `<rect x="118" y="136" width="60" height="42" rx="3" fill="var(--color-surface)" stroke="var(--color-border-strong)" strokeWidth="1.5" />` + top lip `<rect x="114" y="132" width="68" height="6" rx="2" fill="var(--color-brand-subtle)" stroke="var(--color-border-strong)" strokeWidth="1" />`.
   - Monitor stand: `<rect x="144" y="122" width="8" height="10" fill="var(--color-ink-muted)" />`.
   - Monitor bezel: `<rect x="126" y="96" width="44" height="28" rx="3" fill="var(--color-ink)" />`.
   - Monitor screen: `<rect x="129" y="99" width="38" height="22" rx="1.5" fill="var(--color-light-blue-bg)" />` with 3 tiny horizontal UI lines (`fill="var(--color-brand)"`).

3. **`door` — Delivery Door (`x: 214..282`, `y: 42..178`):**
   - Awning/header bar: `<rect x="212" y="40" width="72" height="12" rx="2" fill="var(--color-brand)" />` (small white inward-arrow chevron centred at `x = 248`).
   - Door leaf: `<rect x="216" y="52" width="64" height="126" fill="var(--color-surface)" stroke="var(--color-border-strong)" strokeWidth="2" />`.
   - Porthole window: `<rect x="234" y="68" width="28" height="32" rx="4" fill="var(--color-brand-subtle)" stroke="var(--color-border-strong)" strokeWidth="1.5" />`.
   - Push-bar handle: `<rect x="224" y="116" width="48" height="5" rx="2.5" fill="var(--color-brand)" />`.

4. **`manager` — Kitchen Manager (`x: 342..384`, `y: 78..178`):**
   - Placed slightly right of the robot's `x = 332` anchor so the robot stands beside the manager without overlapping.
   - Generic flat-geometric person (no facial likeness or copyrighted character):
     - Legs/trousers: `<rect x="354" y="140" width="9" height="38" rx="3" fill="var(--color-ink-muted)" />` + `<rect x="366" y="140" width="9" height="38" rx="3" fill="var(--color-ink-muted)" />`.
     - White kitchen jacket torso: `<rect x="350" y="106" width="29" height="38" rx="7" fill="var(--color-surface)" stroke="var(--color-border-strong)" strokeWidth="1.5" />` with a subtle `#0052B4` collar V-line.
     - Head: `<circle cx="364.5" cy="92" r="11" fill="var(--color-surface-subtle)" stroke="var(--color-border-strong)" strokeWidth="1.5" />`.
     - Raised forearm + unbranded phone: `<path d="M350 118 L340 124" stroke="var(--color-border-strong)" strokeWidth="5" strokeLinecap="round" />` + `<rect x="334" y="114" width="8" height="13" rx="2" fill="var(--color-ink)" />` with `<rect x="335.5" y="116" width="5" height="9" rx="1" fill="var(--color-light-yellow-bg)" />`.

5. **Spot Labels (on the floor strip, `y = 224`):**
   - Four subtle pill labels centred at `x = 52, 148, 248, 348`:
     - Active spot pill: `fill="var(--color-brand)"`, text `fill="var(--color-surface)"` (`fontSize="11"`, `fontWeight="700"`).
     - Inactive spot pill: `fill="var(--color-surface)"`, `stroke="var(--color-border)"`, text `fill="var(--color-ink-muted)"` (`fontSize="11"`, `fontWeight="600"`).

---

## 5. Robot Design & 4 Emotes

### 5.1 Base Robot (`~42` units tall ≈ `16.8%` of `250` height)
Drawn inside `<motion.g>` relative to `(0, 0)` (which maps to `{x, y}`):
- **Wheels/feet (`y: +14..+20`):** Two rounded wheels `<rect x="-11" y="14" width="8" height="6" rx="3" fill="var(--color-ink-muted)" />` and `<rect x="3" y="14" width="8" height="6" rx="3" fill="var(--color-ink-muted)" />`.
- **Torso (`y: -4..+14`):** `<rect x="-13" y="-4" width="26" height="19" rx="5" fill="var(--color-surface)" stroke="var(--color-ink)" strokeWidth="1.75" />` with a Valio-blue chest accent `<rect x="-8" y="3" width="16" height="5" rx="2.5" fill="var(--color-brand)" />`.
- **Head (`y: -22..-6`):** `<rect x="-12" y="-22" width="24" height="16" rx="5" fill="var(--color-surface)" stroke="var(--color-ink)" strokeWidth="1.75" />` and visor `<rect x="-9" y="-19" width="18" height="10" rx="3" fill="var(--color-ink)" />`.
- **Antenna stem:** `<line x1="0" y1="-22" x2="0" y2="-27" stroke="var(--color-ink)" strokeWidth="1.75" />`.

### 5.2 Four Emotes (Pose + Head Icon Using `LightBadge` Shapes & Light Tokens)

| `emote` | `Light` | Robot Pose (Shape Change) | Visor Eyes | Head Icon Badge (`cx=0, cy=-34`, `16×16` area) |
|---|---|---|---|---|
| `calm` | `GREEN` | Both arms relaxed downward (`x: -16, +13`, `y: -2..+9`) | Two calm round dots (`r="1.8"`, `#E0F2FE`) | **Circle** (`r="7.5"`, fill `--color-light-green-bg`, stroke `--color-light-green`) + **checkmark** path in `--color-light-green` |
| `info` | `BLUE` | Right arm angled outward-up in a presenting gesture (`-30°`) | Alert bright dots (`r="2"`, `#E0F2FE`) | **Circle** (`r="7.5"`, fill `--color-light-blue-bg`, stroke `--color-light-blue`) + **`"i"`** dot & stem in `--color-light-blue` |
| `puzzled` | `YELLOW` | Right arm bent up with hand **scratching top-right of head** (`L14,-10 L10,-22`); head tilted `-5°` | Asymmetric eyes (one flat, one raised arc) | **Triangle** (`LightBadge` YELLOW shape, fill `--color-light-yellow-bg`, stroke `--color-light-yellow`) + **`!`** or **`?`** mark in `--color-light-yellow` |
| `stop` | `RED` | Left arm **raised high with open flat palm** (`rect` + 3 finger notches at `x: -21, y: -18`, stroke `--color-light-red`) | Firm horizontal bars (`#FEE2E2`) | **Octagon** (`LightBadge` RED shape, fill `--color-light-red-bg`, stroke `--color-light-red`) + **`×`** cross in `--color-light-red` |

---

## 6. Speech Bubble Style

Rendered in HTML directly above the `<svg>` inside the `aria-hidden="true"` illustration wrapper:
- **Visibility:** Rendered **only** when `line !== null`. Absent from the DOM before the first timeline entry reveals.
- **Container:** `position: relative`, `--color-surface` (`#FFFFFF`) fill, `1.5px solid --color-border-strong` (`#7C93B3`), `border-radius: --radius-control` (`8px`), `padding: 8px 12px`, `margin-bottom: 10px`.
- **Pointer tail:** `10px × 10px` rotated square (`transform: translateX(-50%) rotate(45deg)`) anchored to the bottom edge of the bubble at `left: {spotXPercent}%` (`13%`, `37%`, `62%`, `83%`), matching the bubble fill and bottom/right border so it points cleanly toward the robot without overlapping the SVG or the robot's head icon. Under full motion, `transition: left 450ms cubic-bezier(0.22, 1, 0.36, 1)`; under reduced motion, `transition: none`.
- **Typography & Contrast:**
  - `1920×1080` (`xl:`): `18px` (`1.125rem`), line-height `1.3`, `font-weight: 600`, `--color-ink` (`#0B1B33` on `#FFFFFF` = **16.9:1**).
  - `1366×768` (default): `16px` (`1rem`), line-height `1.25`, `font-weight: 600`, `--color-ink`.
  - **Max 2 lines with ellipsis:** `display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;`.

---

## 7. Motion & Reduced-Motion Fallback (`motion/react`)

- **`robotTransition(reduced: boolean)`:**
  - `reduced === false`: `{ type: "tween", duration: 0.45, ease: [0.22, 1, 0.36, 1] }` (`450ms ≤ 600ms`).
  - `reduced === true`: `{ duration: 0 }` (instant jump to new `{x, y}`).
- **Emote change cue:**
  - Wrap the head icon badge in `<motion.g key={emote}>`:
    - Full motion: `initial={{ opacity: 0.65, scale: 0.85 }}`, `animate={{ opacity: 1, scale: 1 }}`, `transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}` (`180ms ≤ 200ms`).
    - Reduced motion: `initial={false}`, `animate={{ opacity: 1, scale: 1 }}`, `transition={{ duration: 0 }}`.
- **No idle loops:** Zero continuous bob, float, blink, or pulse animations.

---

## 8. Hide/Show Kitchen Toggle & Accessibility

- **Header row (always visible, outside `aria-hidden="true"`):**
  - Left: subtle label `"Kitchen"` (`14px`–`16px`, `font-weight: 600`, `--color-ink-muted`).
  - Right: native `<button type="button" aria-expanded={visible}>`:
    - Visible state (default `true`): `"Hide kitchen"` (`aria-expanded="true"`).
    - Collapsed state (`false`): `"Show kitchen"` (`aria-expanded="false"`).
  - **Button style (ghost):** `background: transparent`, `border: 1.5px solid --color-border-strong`, `color: --color-ink-muted`, `border-radius: --radius-control` (`8px`), `min-height: 36px`, `padding: 0 12px`, `font-size: 14px` (`16px` at `xl:`), `font-weight: 600`.
    - Hover: `background: --color-surface-subtle`, `border-color: --color-brand`, `color: --color-ink`.
    - Focus-visible: `box-shadow: var(--shadow-focus); outline: none`.
  - **Collapsed state:** The `aria-hidden="true"` wrapper (speech bubble + `<svg>`) is unmounted; only the compact `~48px` header bar remains. State is component-local `useState(true)` (no `localStorage` / `sessionStorage`).
- **Accessibility & Testing Attributes:**
  - Root element carries `data-spot={spot}`, `data-emote={emote}`, `data-motion={reduced ? "reduced" : "full"}`.
  - Both the speech bubble and `<svg>` sit inside `<div aria-hidden="true">`; screen readers read the `Agent timeline` (`role="log"`) as the single source of truth without duplicate announcements.
  - No element inside `KitchenScene` has an accessible name matching `/approve/i`.

---

## 9. Exact UI Copy

| Element | Exact Copy |
|---|---|
| Section label | `Kitchen` |
| Toggle (when shown) | `Hide kitchen` |
| Toggle (when hidden) | `Show kitchen` |
| Spot labels | `Storage` · `Terminal` · `Delivery door` · `Manager` |
| Speech bubble | `entry.title` verbatim (absent when `entry === null`) |

---

## 10. Assumptions & Open Questions for Implementation

- **Assumptions:** `KitchenScene` is mounted as the last child of the left panel in `RunScreen.tsx` after `"See result"`. When `RunScreen` is in `replay` or `live` mode, `lastRevealedEntry` is the most recently revealed `TimelineEntry` (or `null` before the first reveal).
- **Open questions:** None — all layout widths (`360px` / `280px`), `LightBadge` shapes, and `useReducedMotion()` contracts align with Specs 003, 004, and 008.
