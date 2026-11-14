# Design Handoff — 004: Phone Approval Card + Hearts + Countdown

> **Owner:** Antigravity (Argon) · **Implementer:** Codex (GPT-6 Luna)  
> **Scope:** `docs/design/004-phone-approval.md` only. Reuses shared tokens from `docs/design/002-mandate-screen.md` and `LightBadge` from `docs/design/003-agent-timeline.md` verbatim.

---

## 1. Design Decisions & Rationale

1. **Always-Present Hardware-Neutral Phone Beside the Timeline:**  
   The CSS phone frame sits persistently in the right-hand column of `RunScreen` for the entire run (`Idle` → `OPEN` → `Decided`/`Expired`/`Missed`). Keeping it mounted avoids layout jumps when a `202 PENDING_APPROVAL` arrives and gives the projector audience a clear visual anchor for *"this is where the human’s attention goes."* The frame uses a clean, unbranded dark-navy chassis (`--color-phone-chassis`) with zero manufacturer logos.
2. **Projector-First Type & Contrast (`1920×1080`) + Full-Height Laptop Fit (`1366×768`):**  
   At `1920×1080`, the approval headline (`reasonText`) is `28px` (`1.75rem`) and all body, explanation, option summary, and button text is `≥ 20px` (`1.25rem`) for effortless legibility from 5 m away. At `1366×768`, the frame scales to `380px` wide and `max-height: calc(100vh - 32px)` (`736px`) with compact `16px`–`18px` body text so the entire card—including **Approve**, **Choose other**, and **Reject**—fits above the fold with zero horizontal overflow.
3. **Gateway Is Law — Never Fake Success, Never Subtract Hearts, Never Approve RED:**  
   Every state renders strictly what the gateway returned. Action buttons disable immediately on tap (`Deciding`) without showing success text until `decideApproval()` resolves. `HeartsMeter` displays the gateway’s `heartsLeft` value verbatim. A `403 POLICY_BLOCKED` outcome renders `LightBadge light="RED"`, permanently removes the blocked plan’s button, and never displays an **Approve** affordance for a `RED` result.
4. **Multi-Signal Urgency & Reduced Motion:**  
   Arrival triggers a `520ms` micro-shake (`data-vibrate="on"`), and the countdown (`20 s` or `10 s` from `deadline − createdAt`) pairs numeric `tabular-nums` seconds with a draining progress bar that shifts to urgent styling at `≤ 5 s` (icon + bold label + red border/fill, never colour alone). Under `prefers-reduced-motion: reduce`, `data-vibrate="off"` disables the shake and replaces it with a static `3px` `--color-light-yellow` highlight ring.

---

## 2. Shared Design Tokens (Reused from 002 & 003 + Marked Additions)

Reuse the `@theme` block from `docs/design/002-mandate-screen.md` §2 and the Spec 003 additions from `docs/design/003-agent-timeline.md` §2 **unchanged**. Add only the following tokens to `frontend/src/index.css` `@theme` for Spec 004:

```css
  /* === Spec 004 Additions (append inside @theme in src/index.css) === */
  --color-phone-chassis: #0B1B33;       /* Unbranded phone outer bezel (matches --color-ink) */
  --color-phone-bezel-inner: #1E293B;   /* Subtle inner screen border */
  --color-heart-filled: #BE123C;        /* Filled attention heart (6.2:1 on #FFFFFF) */
  --color-heart-empty: #94A3B8;         /* Outline stroke for spent hearts */
  --shadow-phone: 0 20px 40px -12px rgba(11, 27, 51, 0.18), 0 4px 12px -2px rgba(11, 27, 51, 0.08);
```

### Contrast Verification Summary (Spec 004 Pairs)
| Pair | Ratio | Standard |
|---|---|---|
| `--color-ink` (`#0B1B33`) on `--color-surface` (`#FFFFFF`) | **16.9:1** | Exceeds AAA (7:1) |
| `--color-ink-muted` (`#3B4E6B`) on `--color-surface` (`#FFFFFF`) | **8.2:1** | Exceeds AAA (7:1) |
| `--color-light-yellow` (`#A16207`) on `--color-light-yellow-bg` (`#FEF9C3`) | **4.58:1** | Passes AA (4.5:1) |
| `--color-light-red` (`#B91C1C`) on `--color-light-red-bg` (`#FEE2E2`) | **5.30:1** | Passes AA (4.5:1) |
| `--color-light-green` (`#15803D`) on `--color-light-green-bg` (`#DCFCE7`) | **4.57:1** | Passes AA (4.5:1) |
| `--color-surface` (`#FFFFFF`) on `--color-brand` (`#0052B4`) | **7.6:1** | Exceeds AAA (7:1) |
| `--color-heart-filled` (`#BE123C`) on `--color-surface` (`#FFFFFF`) | **6.20:1** | Passes AA (4.5:1) & UI (3:1) |
| `--color-error-ink` (`#881337`) on `--color-error-surface` (`#FDF2F5`) | **9.7:1** | Exceeds AAA (7:1) |

> **Rule for YELLOW contrast:** Never place `--color-light-yellow` (`#A16207`) text directly on `#FFFFFF` for small text; always pair it with `--color-light-yellow-bg` (`#FEF9C3`) in pills/badges/countdown chips, and use `--color-ink` (`#0B1B33`) for card body copy.

---

## 3. Reused `LightBadge` (`src/components/LightBadge.tsx`)

Reuse `LightBadge` from `docs/design/003-agent-timeline.md` §5.1 **without modification**:
- Props: `{ light: "GREEN" | "BLUE" | "YELLOW" | "RED"; label?: string }`.
- Renders `<span data-light={light}>` with `16px × 16px` SVG icon (`aria-hidden="true"`) + visible text (`Green`, `Blue`, `Yellow`, `Red`).
- In Spec 004:
  - `OPEN` approval card header uses `<LightBadge light="YELLOW" />`.
  - `403 POLICY_BLOCKED` error state uses `<LightBadge light="RED" />`.

---

## 4. Layout & Phone Placement (`1920×1080` and `1366×768`)

### 4.1 3-Column `RunScreen` Grid (Extending 003)
Update `RunScreen`’s desktop grid to accommodate the persistent right-hand phone column with zero horizontal overflow:

- **Outer container:** `max-width: 1856px` centred on `--color-canvas` (`#F3F6FA`).
- **Grid template (`lg:` / `≥ 1024px`):**
  - At `1920×1080` (`xl:` / `≥ 1440px`): `grid-cols-[360px_minmax(0,1fr)_440px]`, `gap: 28px`, horizontal page padding `32px`, vertical padding `24px`.
    - Check: `360 + 28 + (center ~960) + 28 + 440 = 1816px ≤ 1856px`.
  - At `1366×768` (`lg:` `1024px–1439px`): `grid-cols-[280px_minmax(0,1fr)_380px]`, `gap: 20px`, horizontal page padding `24px`, vertical padding `16px`.
    - Check: `280 + 20 + (center ~618) + 20 + 380 = 1318px` (`1366 - 48 = 1318px`).
- **Below `1024px`:** Single-column stack (`grid-cols-1`), with the phone column ordered first (`order-first lg:order-none`) when an approval is active so the player immediately sees the request.

```text
+-----------------------+---------------------------------------+-------------------------+
| LEFT (360px / 280px)  | CENTER (1fr, ~960px / ~618px)         | RIGHT (440px / 380px)   |
| sticky top: 24px      | scrolls naturally                     | sticky top: 24px        |
|                       |                                       |                         |
| [Customer pill]       | Agent timeline                        | +---------------------+ |
| Level title           | +-----------------------------------+ | |  [===]  (speaker)   | |
| [Manager brief]       | | 10:01 [Search] ...                | | |---------------------| |
| Deliver by / Cut-off  | +-----------------------------------+ | | Approvals   ♥♥♥ 2/3 | |
| [Game clock 10:03]    | | 10:02 [Quote]  3 plans [Yellow]   | | |---------------------| |
|                       | +-----------------------------------+ | | [Yellow]    [ 18 s ]| |
| [See result]          | | 10:03 [Order]  Waiting for... [Y] | | | [=========--------] | |
| (when run ends)       | +-----------------------------------+ | | Over per-order...   | |
|                       |                                       | | Agent explanation.. | |
|                       |                                       | | • Best [Recommended]| |
|                       |                                       | | • Better            | |
|                       |                                       | | • Good              | |
|                       |                                       | | [Approve]           | |
|                       |                                       | | [Choose other][Rej] | |
|                       |                                       | +---------------------+ |
+-----------------------+---------------------------------------+-------------------------+
```

### 4.2 CSS Phone Frame Dimensions (Exact `px`)
| Property | `1920×1080` (`xl:` `≥ 1440px`) | `1366×768` (`< 1440px`) |
|---|---|---|
| Outer frame width | `440px` | `380px` |
| Outer frame height | `min-height: 760px; max-height: calc(100vh - 48px)` (up to `~920px`) | `min-height: 640px; max-height: calc(100vh - 32px)` (`736px`) |
| Outer bezel padding | `14px` | `10px` |
| Outer border-radius | `36px` | `30px` |
| Inner screen border-radius | `24px` | `20px` |
| Top speaker notch (`aria-hidden`) | `64px × 6px` pill centred in top bezel | `52px × 5px` pill centred in top bezel |
| Phone sticky offset | `position: sticky; top: 24px` | `position: sticky; top: 16px` |
| Inner screen overflow | `display: flex; flex-direction: column; overflow-y: auto` | `display: flex; flex-direction: column; overflow-y: auto` |

---

## 5. Type Scale (Inside Phone Frame)

All projector (`1920×1080`) body copy is `≥ 20px` and headlines are `≥ 28px`.

| Role | `1920×1080` (`xl:`) | `1366×768` (default) | Weight / Tracking |
|---|---|---|---|
| Approval Headline (`reasonText`, `<h2>`) | `28px` (`1.75rem`), LH `1.2` | `22px` (`1.375rem`), LH `1.25` | `700`, `-0.015em` |
| Agent Explanation (`agentExplanation`) | `20px` (`1.25rem`), LH `1.45` | `16px` (`1rem`), LH `1.45` | `400`, `--color-ink-muted` |
| Option Summary (`option.summary`) | `20px` (`1.25rem`), LH `1.35` | `16px` (`1rem`), LH `1.35` | `500`, `--color-ink` |
| Tier Label & `"Recommended"` Pill | `18px`–`20px`, LH `1.3` | `14px`–`16px`, LH `1.3` | `700` |
| Action Buttons (`Approve`, `Choose other`, `Reject`) | `20px` (`1.25rem`), LH `1.2` | `16px` (`1rem`), LH `1.2` | `600` |
| Phone Status Bar Title & Hearts Text (`2 of 3`) | `18px` (`1.125rem`), LH `1.2` | `15px` (`0.9375rem`), LH `1.2` | `600`, `tabular-nums` |
| Countdown Seconds (`20 s`, `5 s`) | `20px` (`1.25rem`), LH `1.1` | `16px` (`1rem`), LH `1.1` | `700`, `tabular-nums`, `--font-mono` |

---

## 6. Component Anatomy & States

### 6.1 Phone Status Bar & `HeartsMeter` (`src/components/HeartsMeter.tsx`)
Persistent header inside the top of the phone screen (`padding: 14px 18px` at 1080p, `10px 14px` at 768p; `border-bottom: 1px solid --color-border`; `--color-surface-subtle` background).
- **Left:** `"Approvals"` (`--color-ink`, `font-weight: 600`).
- **Right:** `<HeartsMeter hearts={hearts} max={maxHearts} />`:
  - Root element: `role="group"` (or `aria-label="Attention: {hearts} of {maxHearts} hearts left"`).
  - Renders `max` heart SVGs (`24px × 24px` at 1080p, `20px × 20px` at 768p, `aria-hidden="true"`):
    - Filled (`index < hearts`): solid `--color-heart-filled` (`#BE123C`).
    - Empty (`index >= hearts`): `2px` outline stroke `--color-heart-empty` (`#94A3B8`), transparent fill.
  - Adjacent text: `"{hearts} of {max}"` (`tabular-nums`, `--color-ink`, `aria-hidden="true"` since the container `aria-label` carries the full sentence).
  - **Change pulse:** When `hearts` changes, apply a short `220ms` scale pulse (`scale: [1, 1.16, 1]`) under `motion-safe`; instant update under `prefers-reduced-motion: reduce`.
  - **Zero frontend math:** Never decrements locally; renders only `hearts` from `approvalEvent.heartsLeft` / `start.hearts`.

### 6.2 Idle State (`approval === null`)
- Centered vertically inside the phone screen (`padding: 32px 24px`, `text-align: center`).
- Subtle circular icon (`48px`, `--color-surface-subtle` fill, `--color-ink-muted` bell/check-inbox SVG, `aria-hidden="true"`).
- Heading: `"No requests"` (`24px` at 1080p, `20px` at 768p, `font-weight: 600`, `--color-ink`).
- Helper text: `"Your agent will message you here if an order needs your approval."` (`20px` at 1080p, `16px` at 768p, `--color-ink-muted`).
- `data-vibrate="off"`, no card, no buttons.

### 6.3 Open Approval Card (`status === "OPEN"`, `role="alertdialog"`)
Card root: `role="alertdialog"`, `aria-labelledby="approval-reason-heading"`, `aria-describedby="approval-explanation"`, `padding: 20px` at 1080p (`14px 16px` at 768p).

1. **Top Bar (Light + Countdown):**
   - Left: `<LightBadge light="YELLOW" />` (switches to `RED` only if `403 POLICY_BLOCKED` occurs).
   - Right: Countdown pill + draining bar (see §6.4).
2. **Headline (`<h2 id="approval-reason-heading" tabIndex={-1}>`):**
   - Renders `approval.reasonText` verbatim. Focused programmatically on card arrival.
3. **Agent Explanation (`<p id="approval-explanation">`):**
   - Renders `approval.agentExplanation` verbatim (`--color-ink-muted`, 2–3 sentences).
4. **Options List (`approval.options` in gateway order: `best`, `better`, `good`):**
   - Each option row (`border-radius: --radius-control`, `padding: 12px 14px` at 1080p, `10px 12px` at 768p):
     - **Recommended (`option.recommended === true`):** `border: 2px solid --color-brand`, background `#F0F6FD` (soft tint of `--color-brand-subtle`). Header row shows Tier (`Best` / `Better` / `Good`) + `"Recommended"` pill (`--color-brand` fill, `#FFFFFF` text, `padding: 2px 10px`, `border-radius: --radius-chip`).
     - **Non-recommended:** `border: 1px solid --color-border`, background `--color-surface`. Header row shows Tier (`Best` / `Better` / `Good`).
     - **Summary:** `option.summary` verbatim below the tier header (gateway-formatted € and dates).
5. **Action Area:**
   - **Default (`OPEN`):**
     - **Primary:** `"Approve"` (`--color-brand` fill, `#FFFFFF` text, `min-height: 52px` at 1080p / `46px` at 768p, full width of phone screen). Calls `decideApproval(id, "approved")`.
     - **Secondary row (`grid-cols-2 gap-2.5`):**
       - `"Choose other"` (outline: `1.5px solid --color-border-strong`, `--color-surface` fill, `--color-ink` text, `min-height: 48px` at 1080p / `44px` at 768p, `aria-expanded={showAlternatives}`).
       - `"Reject"` (outline: `1.5px solid --color-error-ink`, `--color-surface` fill, `--color-error-ink` text, `min-height: 48px` at 1080p / `44px` at 768p). Calls `decideApproval(id, "rejected")`.
   - **When `"Choose other"` is active (`showAlternatives === true`):**
     - Reveals the non-recommended options (excluding any `planId` permanently removed by `403 POLICY_BLOCKED`) as selectable `<button type="button">` cards below the options list (or converts those non-recommended rows into interactive buttons):
       - Label format: `"Choose {Tier}: {summary}"` (with Tier badge + summary).
       - Styling: `border: 1.5px solid --color-brand`, `--color-surface` fill, hover `--color-brand-subtle`, `min-height: 52px`, `text-align: left`.
       - Picking one calls `decideApproval(id, "alternative", option.planId)` once.
     - `"Choose other"` button toggles label to `"Hide options"` (or remains `aria-expanded="true"`).

### 6.4 Countdown Visual (20 s and 10 s Deadlines)
- Initial seconds: `Math.max(0, Math.ceil((Date.parse(deadline) - Date.parse(createdAt)) / 1000))` — starts at `20` for 20 s mocks and `10` for 10 s deadlines (H-04).
- **Visual elements:**
  - **Seconds pill:** Clock SVG (`aria-hidden="true"`) + `"{secondsLeft} s"` (`--font-mono`, `tabular-nums`, `font-weight: 700`).
  - **Draining bar:** Full-width `6px` track (`--color-surface-subtle`, `border-radius: 9999px`) immediately below the top bar; inner fill width = `(secondsLeft / initialSeconds) * 100%` (`transition: width 1000ms linear` under `motion-safe`, instant step under `motion-reduce`).
- **Normal state (`secondsLeft > 5`):**
  - Seconds pill: `--color-surface-subtle` fill, `--color-ink` text, `1px solid --color-border`.
  - Draining bar fill: `--color-brand` (`#0052B4`).
- **Urgent state (`secondsLeft <= 5`, never colour-only):**
  - Seconds pill: `--color-light-red-bg` (`#FEE2E2`) fill, `--color-light-red` (`#B91C1C`) text, `1.5px solid --color-light-red-border`, warning icon (`aria-hidden="true"`), and `"Hurry"` prefix (`"Hurry · 5 s"`).
  - Draining bar fill: `--color-light-red` (`#B91C1C`).
  - Under `motion-safe`, pill has subtle `animate-pulse`; static under `motion-reduce`.
- **At `0 s`:**
  - Calls `getApproval(id)` (polling every `1 s`, max `10` calls while gateway still returns `OPEN`). Buttons remain enabled until the gateway returns `EXPIRED` or another closed state. Subtle status line `"Checking with gateway…"` appears beside `0 s`.

### 6.5 Complete Interactive & Gateway State Matrix

| State | Trigger | Card Content & Buttons | Vibrate |
|---|---|---|---|
| **Idle** | `approval === null` | `"No requests"` + helper text; `HeartsMeter` in status bar; no buttons | `off` |
| **Open** | `status === "OPEN"` | `LightBadge` YELLOW, countdown, `reasonText`, `agentExplanation`, options + **Approve** / **Choose other** / **Reject** | `on` (`off` if reduced motion) |
| **Deciding** | Any decision button clicked | All action buttons `disabled` (`opacity: 0.6`, `cursor: wait`), clicked button shows spinner + `"Sending…"` (`aria-busy="true"`); no success text yet | `on` (`off` if reduced motion) |
| **Decided** | `200` `ApprovalDecision` (`APPROVED` / `REJECTED` / `alternative`) | Status pill (`--color-light-green-bg` / `--color-light-green` for `CONFIRMED`; neutral `--color-surface-subtle` / `--color-ink` for `REJECTED`), verbatim summary `"{Status} · order {orderStatus}"` (e.g. `"Approved · order CONFIRMED"`), `decision` detail if `alternative:<planId>`, `reasonText` for context, **no action buttons** | `off` |
| **Expired** | Gateway returns `status: "EXPIRED"` after `0 s` | Neutral/amber status banner: `"Expired: no answer in time"`, `orderStatus` if present, **no action buttons** | `off` |
| **Late Tap (409)** | `decideApproval` rejects `INVALID_STATE` (`409`) | `role="alert"` banner: `"This request was already closed by the gateway"`, immediately calls `getApproval(id)` once and transitions to the returned closed state (no success text at any point) | `off` |
| **Blocked (403 RED)** | `decideApproval` rejects `POLICY_BLOCKED` (`403`) | Shows `<LightBadge light="RED" />` + gateway `error.message` in `role="alert"`, **permanently removes** that `planId`’s button, calls `getApproval(id)` once: if still `OPEN`, remaining non-RED actions stay enabled (never shows Approve for a RED result); if closed, renders closed state with no buttons | `on` if still `OPEN`, else `off` |
| **Not Found (404)** | `NOT_FOUND` (`404`) | `role="alert"` banner: `"Request not found"`, **no buttons** | `off` |
| **Network / Upstream Error** | `NETWORK_ERROR` / `UPSTREAM_ERROR` / `HTTP_ERROR` | `role="alert"` banner (`--color-error-surface` / `--color-error-ink` + warning icon + `"Error:"` prefix + message); **all remaining action buttons re-enabled** so player can retry | `on` if `OPEN` |
| **Arrived Closed / `ATTENTION_EXHAUSTED`** | `approval.status !== "OPEN"` on arrival | No buttons, no countdown, calls no client method. If `reasons` contains `ATTENTION_EXHAUSTED`, shows `"Manager too busy: out of attention"` + gateway’s `reasonText` | `off` |

---

## 7. Motion & Reduced Motion (`motion/react`)

Use `useReducedMotion()` from `motion/react` on the phone wrapper:

- **Phone attribute:** `data-vibrate={isRinging && !shouldReduce ? "on" : "off"}` (where `isRinging` is `true` only when `approval?.status === "OPEN"`).
- **Vibrate animation (Full Motion, `≤ 600ms`):**
  - `animate={{ x: [0, -6, 6, -5, 5, -3, 3, 0], rotate: [0, -1.2, 1.2, -0.8, 0.8, 0, 0, 0] }}`
  - `transition={{ duration: 0.52, ease: "easeInOut" }}` (triggered when a new `OPEN` `approvalId` arrives).
- **Reduced Motion (`shouldReduce === true`):**
  - No `x`, `y`, `scale`, or `rotate` transforms (`data-vibrate="off"`).
  - Instead, apply a static `3px solid --color-light-yellow` outer highlight ring (`box-shadow: 0 0 0 3px #A16207`) on the phone screen while `approval?.status === "OPEN"`.
- **Card / State Transitions (`≤ 200ms`):**
  - Full motion: `initial={{ opacity: 0, y: 6 }}`, `animate={{ opacity: 1, y: 0 }}`, `transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}`.
  - Reduced motion: `initial={{ opacity: 0 }}`, `animate={{ opacity: 1 }}`, `transition={{ duration: 0.12, ease: "linear" }}`.

---

## 8. Accessibility & Keyboard Navigation

1. **Focus on Arrival:** When an approval card mounts (`OPEN` or arrived-closed), programmatically focus its `<h2>` (`reasonText` or `"Manager too busy: out of attention"`) via `tabIndex={-1}` + `.focus()`.
2. **Focus Containment (AC15):** While the card is `OPEN` and at least one action button is enabled, trap `Tab` / `Shift+Tab` inside the `role="alertdialog"` card so focus cycles cleanly across **Approve**, **Choose other**, revealed alternative option buttons, and **Reject** without escaping to the background timeline. Release the trap as soon as the card settles (no enabled buttons).
3. **Keyboard Activation:** Every action and alternative option is a native `<button type="button">` operable with `Enter` and `Space`, with `focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none`.
4. **Screen-Reader Announcements:**
   - `role="alertdialog"` + `aria-labelledby` announces the new approval on focus.
   - A polite live region (`aria-live="polite"`, visually hidden or subtle) announces countdown milestones only at `10 seconds left`, `5 seconds left`, and `Time expired, checking with gateway`—never every second.
   - Errors (`409`, `403`, `404`, network/upstream) render in `role="alert"` so screen readers announce them immediately.
   - `HeartsMeter` exposes `aria-label="Attention: {n} of {m} hearts left"`.

---

## 9. Final UI Copy (English, Typographic Quotes/Apostrophes)

| Element | Exact Copy |
|---|---|
| Phone status bar title | `Approvals` |
| Hearts meter accessible label | `Attention: {n} of {m} hearts left` |
| Hearts meter visible text | `{n} of {m}` |
| Idle screen heading | `No requests` |
| Idle screen helper | `Your agent will message you here if an order needs your approval.` |
| Option tier labels | `Best` · `Better` · `Good` |
| Recommended option badge | `Recommended` |
| Countdown normal / urgent | `{n} s` / `Hurry · {n} s` |
| Countdown polling at `0 s` | `Checking with gateway…` |
| Primary / secondary / reject buttons | `Approve` · `Choose other` (open: `Hide options`) · `Reject` |
| In-flight button text | `Sending…` |
| Decided state (approved) | `Approved · order {orderStatus}` |
| Decided state (alternative) | `Alternative chosen ({planId}) · order {orderStatus}` |
| Decided state (rejected) | `Rejected · order {orderStatus}` |
| Expired state | `Expired: no answer in time` |
| Late tap (`409 INVALID_STATE`) | `This request was already closed by the gateway` |
| Arrived closed (`ATTENTION_EXHAUSTED`) | `Manager too busy: out of attention` |
| Not found (`404 NOT_FOUND`) | `Request not found` |
| Network / upstream error prefix | `Error: {gatewayMessage}` |
