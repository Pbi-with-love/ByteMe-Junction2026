# Design Handoff — 002: Level Brief + Mandate (Valtakirja) Screen + Sign

> **Owner:** Antigravity (Argon) · **Implementer:** Codex (GPT-6 Luna)  
> **Scope:** `docs/design/002-mandate-screen.md` only. Shared tokens defined here are reused across Specs 003–007.

---

## 1. Design Decisions & Rationale

1. **Valio-Inspired Official Document Aesthetic:**  
   The game's core thesis is *"Agents don't need a chatbot. They need a mandate."* The Mandate screen (`Valtakirja`) is styled as a calm, authoritative Finnish letter of authority resting on a cool slate-blue desk canvas (`--color-canvas`). High-contrast navy ink on crisp white paper (`--color-surface`), fine horizontal rules, and a cobalt notary-style gateway stamp reinforce trust and legibility from the back of a demo room.
2. **Projector-First Readability (1920×1080) & Laptop Fit (1366×768):**  
   At `≥ 1440px` (1080p projector), body copy is `24px` (`1.5rem`) and headings scale to `36px` (`2.25rem`). The entire Mandate document—including the preset strip, all 4 inline editable controls, and the **Sign mandate** button—fits within `~760px` of vertical height so **Sign mandate** is visible without scrolling at `1920×1080`. Below `1440px` (e.g. `1366×768`), body text steps cleanly to `18px` (`1.125rem`) with zero horizontal overflow.
3. **Strict Isolation of Reserved Policy Light Colours:**  
   The four policy outcome colours (`GREEN`, `BLUE`, `YELLOW`, `RED`) are defined as shared `@theme` tokens for Specs 003–007 and are **never** used in Spec 002 for chips, buttons, the stamp, or error banners. Error banners use a distinct deep rose-burgundy (`--color-error-ink` / `--color-error-surface`) paired with a warning icon and explicit text prefix so they are never confused with a `RED` policy decision.
4. **Native Controls Styled as Inline Bold Authority:**  
   Per AC13 and AC19, the 4 editable values are native `<select>` and `<input type="checkbox">` elements. They are styled to read inline as bold, underlined/tinted authority clauses within the letter prose, with a visible chevron/checkbox affordance and a `3px` high-contrast focus ring.

---

## 2. Shared Design Tokens (Tailwind v4 `@theme`)

Paste into `frontend/src/index.css`. These tokens form the shared foundation for Specs 002–007.

```css
@import "tailwindcss";

@theme {
  /* === Surfaces & Ink === */
  --color-canvas: #F3F6FA;          /* Desk background */
  --color-surface: #FFFFFF;         /* Official paper / primary card */
  --color-surface-subtle: #EBF1F8;  /* Metadata band, chip idle fill */
  --color-ink: #0B1B33;             /* Primary text (16.9:1 on #FFF, 15.6:1 on #F3F6FA) */
  --color-ink-muted: #3B4E6B;       /* Secondary labels (8.2:1 on #FFF, 7.6:1 on #F3F6FA) */

  /* === Brand (Valio-like Blue/White) === */
  --color-brand: #0052B4;           /* Primary CTA, active chip, focus ring (7.6:1 w/ #FFF) */
  --color-brand-hover: #003E8A;     /* Hover state (10.3:1 w/ #FFF) */
  --color-brand-subtle: #E0ECFA;    /* Inline control tint, pressed chip tint */

  /* === Document Rules & Borders === */
  --color-border: #C9D6E8;          /* Hairline document rules */
  --color-border-strong: #7C93B3;   /* Control boundaries (3.13:1 on #FFF, WCAG 1.4.11) */

  /* === Stamp & Application Error (Non-Policy) === */
  --color-stamp: #0A4D8C;           /* Gateway seal ink (8.3:1 on #FFF) */
  --color-error-surface: #FDF2F5;   /* Alert banner background */
  --color-error-ink: #881337;       /* Alert text & border (9.7:1 on #FDF2F5) */

  /* === Reserved Policy Light Tokens (Specs 003–007 ONLY — DO NOT USE IN 002) === */
  --color-light-green: #15803D;
  --color-light-green-bg: #DCFCE7;
  --color-light-blue: #0369A1;
  --color-light-blue-bg: #E0F2FE;
  --color-light-yellow: #A16207;
  --color-light-yellow-bg: #FEF9C3;
  --color-light-red: #B91C1C;
  --color-light-red-bg: #FEE2E2;

  /* === Typography === */
  --font-sans: "Inter", system-ui, -apple-system, sans-serif;
  --font-mono: ui-monospace, "SFMono-Regular", Menlo, monospace;

  /* === Spacing & Radii === */
  --radius-card: 1rem;              /* 16px: brief & level cards */
  --radius-doc: 0.75rem;            /* 12px: official Valtakirja paper */
  --radius-control: 0.5rem;         /* 8px: selects, buttons, alerts */
  --radius-chip: 9999px;            /* Pill preset chips */

  /* === Focus Ring === */
  --shadow-focus: 0 0 0 2px #FFFFFF, 0 0 0 5px #0052B4;
}
```

### Contrast Verification Summary
| Pair | Ratio | Standard |
|---|---|---|
| `--color-ink` (`#0B1B33`) on `--color-surface` (`#FFFFFF`) | **16.9:1** | Exceeds AAA (7:1) |
| `--color-ink-muted` (`#3B4E6B`) on `--color-surface` (`#FFFFFF`) | **8.2:1** | Exceeds AAA (7:1) |
| `--color-surface` (`#FFFFFF`) on `--color-brand` (`#0052B4`) | **7.6:1** | Exceeds AAA (7:1) |
| `--color-brand` (`#0052B4`) on `--color-brand-subtle` (`#E0ECFA`) | **6.4:1** | Exceeds AA (4.5:1) |
| `--color-error-ink` (`#881337`) on `--color-error-surface` (`#FDF2F5`) | **9.7:1** | Exceeds AAA (7:1) |
| `--color-border-strong` (`#7C93B3`) on `--color-surface` (`#FFFFFF`) | **3.13:1** | Passes UI Component (3:1) |

---

## 3. Type Scale & Spacing

| Role | 1920×1080 (`xl:` / `>= 1440px`) | 1366×768 (default `< 1440px`) | Weight / Tracking |
|---|---|---|---|
| Document Title (`Valtakirja`, `<h1>`) | `36px` (`2.25rem`), LH `1.15` | `28px` (`1.75rem`), LH `1.2` | `700`, `-0.02em` |
| Screen / Level Title (`<h1>` / `<h2>`) | `32px` (`2rem`), LH `1.2` | `24px` (`1.5rem`), LH `1.25` | `700`, `-0.015em` |
| Document Body & Inline Controls | `24px` (`1.5rem`), LH `1.65` | `18px` (`1.125rem`), LH `1.6` | `400` (`700` on bold controls) |
| Metadata / Chips / Buttons | `18px` (`1.125rem`), LH `1.4` | `16px` (`1rem`), LH `1.4` | `600` (buttons/chips), `400` (labels) |
| Micro / Badge (`Signed by gateway…`) | `16px` (`1rem`), LH `1.4` | `14px` (`0.875rem`), LH `1.4` | `500`, `tabular-nums` / `--font-mono` |

- **Page container:** `max-width: 1040px` (`65rem`), centred, horizontal padding `32px` (`2rem`) at `1080p`, `24px` (`1.5rem`) at `768p`. Vertical page padding `28px` (`1.75rem`) at `1080p`, `20px` (`1.25rem`) at `768p`.
- **Card internal padding:** `36px 44px` at `1080p`, `24px 28px` at `768p`.

---

## 4. Layout Specification

### 4.1 Level List Screen (001 Addition)
- Existing `<article>` cards gain a primary action button **"Start level"** aligned to the card footer or right edge (`min-height: 48px`, `padding: 0 24px`).

### 4.2 Mission Brief Screen (`1920×1080` & `1366×768`)
- Single centred card (`max-width: 820px`) on `--color-canvas`.
- **Top bar:** `"← Back to levels"` ghost/outline button.
- **Card header:** Level title (`<h1>`, `tabIndex={-1}`) + Customer name pill (`level.customer.name`).
- **Card body:** `level.brief` in projector-large body type (`24px` at 1080p, `18px` at 768p).
- **Schedule strip:** 2-column grid (`grid-cols-1 sm:grid-cols-2 gap-4`) on `--color-surface-subtle` with `"Deliver by"` (`formatDateTime(level.deadline)`) and `"Order cut-off"` (`formatDateTime(level.closingTime)`).
- **Card footer:** Primary button **"Write the mandate"** (`--color-brand`).
- **Error / Loading:** If `presets()` or `startLevel()` is loading, show `"Loading level…"` centred in `<main>`. If either rejects, render only the `role="alert"` error banner + `"Back to levels"` button (no brief card).

### 4.3 Mandate (`Valtakirja`) Screen

#### At `1920×1080` (Projector — Sign visible above the fold)
```text
+-------------------------------------------------------------------------+
| [← Back to levels]                                                      |
|                                                                         |
| Presets:  (Strict)  ([Balanced])  (Loose)     [Custom] (when unmatched) |
+-------------------------------------------------------------------------+
| VALTAKIRJA  ·  Mandate                                                  |
| Customer: Hotel Aurora (fictional)   Issued by: Anna Virtanen, Kitchen  |
| Agent:    kitchenbuyer-hotel-aurora             manager                 |
|-------------------------------------------------------------------------|
|                                                                         |
|  I authorise kitchenbuyer-hotel-aurora to place orders up to            |
|  [ €500,00 ▾ ] per order, with [ same-category substitutes ▾ ]          |
|  and [ never late ▾ ].                                                  |
|                                                                         |
|  [✓] Never buy products containing peanut (AP).                         |
|                                                                         |
|-------------------------------------------------------------------------|
|  Signature: _______________________        [   Sign mandate   ]         |
+-------------------------------------------------------------------------+
```
- **Total height before signing:** ~`740px` (comfortably inside `1080px` with ~`340px` margin).
- **Signed state:** The `Stamp` lands in the upper-right / signature zone of the paper (`position: relative` container, `pointer-events: none`), and the **Signed Summary Panel** renders cleanly inside or immediately below the signature rule, keeping the entire signed document legible.

#### At `1366×768` (Laptop)
- Same single-column document flow; `max-width: 920px`.
- Metadata row wraps cleanly into a 2-column or 3-column CSS Grid (`grid-cols-1 md:grid-cols-3 gap-3`).
- Preset chips wrap cleanly (`flex-wrap: wrap; gap: 10px`).
- Signature row stacks cleanly if needed (`flex-wrap: wrap; justify-content: space-between; gap: 16px`).
- **Zero horizontal scroll** (`overflow-x: hidden` never needed; all widths fluid within `100%`).

---

## 5. Component States

### 5.1 Preset Chips (`<button type="button" aria-pressed={isPressed}>`)
- **Default (`aria-pressed="false"`):** Fill `--color-surface`, border `1.5px solid --color-border-strong`, text `--color-ink`, `min-height: 44px`, `padding: 0 20px`, `border-radius: --radius-chip`.
- **Hover:** Fill `--color-surface-subtle`, border `--color-brand`.
- **Pressed (`aria-pressed="true"`):** Fill `--color-brand`, border `--color-brand`, text `#FFFFFF`, font-weight `600`.
- **Focus-visible:** `box-shadow: var(--shadow-focus); outline: none`.
- **Disabled (while signing / after signed):** `opacity: 0.55`, `cursor: not-allowed`, hover suppressed.
- **Custom note:** When no chip is pressed, show a muted pill/tag beside the chips: `"Custom"` (`--color-surface-subtle` fill, `--color-ink-muted` text, `1px solid --color-border`).

### 5.2 Inline Bold Value Controls (`<select>` & `<input type="checkbox">`)
- **Selects (Per-order limit, Substitution, Late delivery):**
  - **Default:** Inline-block, `font-weight: 700`, text `--color-ink`, background `--color-brand-subtle`, bottom border `2px solid --color-brand`, `border-radius: 6px`, `padding: 2px 10px`, native chevron visible.
  - **Hover:** Background `#D0E2F7`, bottom border `--color-brand-hover`.
  - **Focus-visible:** `box-shadow: var(--shadow-focus); outline: none`.
  - **Disabled / Signed:** Background `--color-surface-subtle`, border-bottom `1.5px solid --color-border`, text `--color-ink-muted`, `cursor: default`.
- **Allergen Checkbox:**
  - **Default:** Native `<input type="checkbox">` (`22px × 22px` at 1080p, `18px × 18px` at 768p) with `accent-color: #0052B4`, inside a `<label>` with `min-height: 44px` hit area.
  - **Focus-visible:** `box-shadow: var(--shadow-focus); outline: none`.
  - **Disabled (empty `allergenRuleCodes`, signing, or signed):** `opacity: 0.6`, `cursor: not-allowed`. When `allergenRuleCodes` is empty, label reads `"No allergen rule in this level"`.

### 5.3 Sign Button (`<button type="button">`)
- **Default:** `"Sign mandate"` — Fill `--color-brand`, text `#FFFFFF`, `min-height: 52px`, `padding: 0 28px`, `border-radius: --radius-control`, `font-weight: 600`.
- **Hover:** Fill `--color-brand-hover`.
- **Focus-visible:** `box-shadow: var(--shadow-focus); outline: none`.
- **Signing (`disabled`, `aria-busy="true"`):** `"Signing…"` — Fill `--color-brand`, `opacity: 0.75`, `cursor: wait`.
- **Signed:** Replaced or accompanied by the Signed panel; controls & chips are disabled/read-only.
- **Error:** Re-enabled (`"Sign mandate"`), focusable; `role="alert"` banner appears above/below the signature row.

### 5.4 Error Banner (`role="alert"`)
- **Appearance:** Fill `--color-error-surface` (`#FDF2F5`), `border: 1.5px solid --color-error-ink`, `border-left: 5px solid --color-error-ink`, `border-radius: --radius-control`, `padding: 14px 18px`.
- **Distinguishability from Policy RED:** Includes a crisp SVG warning triangle icon (`aria-hidden="true"`) + bold `"Error:"` prefix before the gateway/replay message.

### 5.5 Signed Panel & Stamp
- **Signed Panel:** Renders **only** after `signMandate()` resolves.
  - Heading (`<h2>`, `tabIndex={-1}`): `"Mandate signed"`
  - Verbatim `summaryText` in a highlighted quote block (`border-left: 3px solid --color-brand`, `--color-surface-subtle`).
  - Metadata row: `mandateId` (`font-mono`), `formatDateTime(issuedAt)`, `status` (e.g. `ACTIVE`).
  - Signature badge: `"Signed by gateway · {alg} · key {keyId}"` (never "verified" or "valid").

---

## 6. Stamp Animation Spec (`src/components/Stamp.tsx`)

- Use `useReducedMotion()` from `motion/react`.
- Render `<motion.div data-motion={shouldReduce ? 'reduced' : 'full'} ...>` styled as a double-ringed rectangular/circular notary seal (`border: 3px solid --color-stamp`, text `--color-stamp`, uppercase `"GATEWAY SIGNED"` + `mandateId`).
- **Full Motion (`data-motion="full"`):**
  - `initial={{ opacity: 0, scale: 1.6, rotate: -12 }}`
  - `animate={{ opacity: 1, scale: 1, rotate: -6 }}`
  - `transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1], delay: 0.04 }}`
- **Reduced Motion (`data-motion="reduced"`):**
  - `initial={{ opacity: 0 }}`
  - `animate={{ opacity: 1 }}`
  - `transition={{ duration: 0.12, ease: 'linear' }}` (opacity only, `120ms ≤ 150ms`, no scale/rotate/translate).

---

## 7. Accessibility & Keyboard Navigation

1. **Keyboard Order (Mandate Screen):**
   1. `"Back to levels"` button
   2. Preset chips (`Strict`, `Balanced`, `Loose`, …) in DOM order
   3. Per-order limit `<select>`
   4. Substitution `<select>`
   5. Late delivery `<select>`
   6. Allergen rule `<input type="checkbox">`
   7. `"Sign mandate"` `<button>`
2. **Programmatic Focus Targets (`tabIndex={-1}` + `.focus()`):**
   - Entering Brief screen → focus `<h1>` (`level.title`).
   - Entering Mandate screen → focus `<h1>` (`"Valtakirja"`).
   - After `signMandate()` resolves → focus Signed panel heading (`"Mandate signed"`).
3. **ARIA & Semantics:**
   - All interactive controls are native `<button>`, `<select>`, or `<input type="checkbox">`.
   - Preset chips use `aria-pressed={true | false}`.
   - Sign button uses `aria-busy="true"` while pending.
   - All rejection/failure messages render inside `role="alert"`.

---

## 8. Final UI Copy (English, Typographic Quotes/Apostrophes)

| Element | Exact Copy |
|---|---|
| Level card button | `Start level` |
| Loading state | `Loading level…` |
| Brief back button | `Back to levels` |
| Brief primary button | `Write the mandate` |
| Brief labels | `Deliver by` · `Order cut-off` |
| Mandate heading & subtitle | `Valtakirja` · `Mandate` |
| Mandate metadata labels | `Customer` · `Issued by` · `Agent` |
| Preset strip label & custom tag | `Presets` · `Custom` |
| Substitution labels | `no substitutes` (`none`) · `same-category substitutes` (`same_category`) · `any substitute` (`any`) |
| Late delivery labels | `never late` (`none`) · `up to one day late` (`one_day`) |
| Allergen checkbox (active) | `Never buy products containing {list}.` |
| Allergen checkbox (empty) | `No allergen rule in this level` |
| Sign button (idle / pending) | `Sign mandate` / `Signing…` |
| Signed panel heading | `Mandate signed` |
| Signed badge | `Signed by gateway · {alg} · key {keyId}` |
| Replay no-recording error | `Replay has no recorded mandate for these values. Pick a preset, or use a live gateway.` |
