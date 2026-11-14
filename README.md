
# README.md: Agent Kitchen

> Junction 2026, Valio Aimo challenge "Trusted Trade Agents".
> This file is the single source of truth for what we are building and why.
> Read it fully before writing code. When this file and a request conflict, ask.

---

## 1. What we are building (one paragraph)

**Agent Kitchen** is an *interactive simulation platform for trusted autonomous purchasing*.
The player is a kitchen manager. An external AI purchasing agent buys ingredients from
Valio Aimo on the kitchen's behalf. The player's only real job is deciding **how much
authority to give the agent** (the "mandate", Finnish: *valtakirja*) and answering the
agent's approval requests. Underneath the game sits a real **Valio Aimo Trust Gateway**:
the interface through which any external agent can look up products, get signed quotes,
place orders, and be stopped when it exceeds its authority.

The game is the demo layer. The gateway is the actual answer to the challenge.

**Never pitch or describe this as "a restaurant management game".**

### Core message
> Agents don't need a chatbot. They need a mandate.
> Three promises: the **mandate** is the buyer's promise, the **quote** is Valio Aimo's
> promise, the **log** is proof both kept them.

### Challenge requirements we must visibly satisfy
| Requirement (core) | Where it lives |
|---|---|
| Product, price & availability lookup | `POST /search`, `POST /quote` |
| Inquiry → order at fixed price | Quote lifecycle + `POST /orders` |
| Permission & human approval | Mandate + policy engine + approval cards |

| Optional direction | Where it lives |
|---|---|
| Delivery reliability & sustainability | Ranking factors + labels in option cards |
| Substitution / exceptions | Plan generator (split, substitute, later date) |
| Traceability & explainability | Hash-chained log, "receipt that explains itself" |

---

## 2. Golden rules (non-negotiable)

1. **The gate is law, the prompt is a wish.** Every policy check runs in the backend
   gateway. The frontend never contains rules, limits, or secrets. If the agent asks for
   something outside its mandate, the gateway refuses, regardless of what the agent says.
2. **No secrets in code or in this file.** Valio API key, Anthropic API key and the
   quote-signing private key live in `.env` (gitignored). Provide `.env.example` only.
3. **Real data first.** Prices, availability, dates, reliability and carbon data come from
   the Valio mock API or its downloaded files. Scenario twists that the data cannot produce
   go through the *scenario overlay* (§9.3), which is always flagged in the log.
4. **Deterministic decisions, LLM for language.** Filtering, ranking, policy and scoring are
   plain code and give identical results on every run. The LLM is used only to
   (a) parse a free-text kitchen request into a structured need and
   (b) write human-readable explanations from a structured decision record.
   The LLM must never invent a price, quantity, date or product.
5. **No fake success.** A button never just shows "Order successful". Every game action
   calls the gateway and renders what the gateway returned.
6. **Data boundary.** An agent token is scoped to exactly one customer. The gateway never
   returns purchase prices, margins, other customers' prices or supplier contracts (§6.6).
7. **Demo safety.** Every level can run in `live` mode or `replay` mode (recorded gateway
   responses). Replay mode must look identical on screen.

---

## 3. Architecture

```
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ Game frontend (React + TS)   │        │ Buyer agent runner           │
│ screens, animations, input   │        │ LLM parse + calls gateway    │
│ NO rules, NO secrets         │        │ like any external agent      │
└──────────────┬───────────────┘        └──────────────┬───────────────┘
               │ HTTP (game + approvals)                │ HTTP (agent API)
               ▼                                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Valio Aimo Trust Gateway (backend)                                  │
│  discovery · mandates · search · quote engine · policy engine       │
│  plan generator · orders · approvals · audit log · scenario overlay │
└──────────────────────────────┬──────────────────────────────────────┘
                               ▼
              Valio mock API (price, availability, 3 download files)
```

The agent runner is deliberately a **separate caller** of the gateway, so we can say:
"swap our agent for any hotel's own agent; the gateway stays the same."

### Stack (keep it light)
- Frontend: React + TypeScript + Vite + Tailwind + Framer Motion. **No Phaser, no 3D.**
- Backend: FastAPI (Python) by default. Express is acceptable if the team prefers Node;
  decide once, do not mix.
- Storage: SQLite (or JSON files for the very first prototype).
- Signing: ed25519 (e.g. PyNaCl) or HMAC-SHA256. Keep it to a small `signing` module.
- LLM: Anthropic API with plain tool-calling. No LangGraph or agent frameworks needed.

### Suggested repo layout
```
/frontend          React game
/gateway           FastAPI app
  /api             route handlers
  /domain          mandate, quote, order, approval, log models
  /policy          policy engine (pure functions, unit tested)
  /planner         plan generation + ranking (pure functions, unit tested)
  /valio           mock API client + file loaders + cache
  /scenarios       level definitions + overlays
/agent             buyer agent runner
/recordings        replay files for demo mode
/docs              data-notes.md, pitch notes
```

---

## 4. Valio mock API: what exists and what does not

### Exists
- `GET /api/ping`
- `POST /api/availability` body `{customer, requestedDate, products: [productId, ...]}` (1-1000 ids)
  - per product: `productId`, `closingTime` (order cut-off), `salesBlock`, `logisticModel`,
    `scheduleLines[]` each `{salesBlock, availableAmount, availableDate, salesUnit}`
- `POST /api/price` same body shape
  - per product: `catalogPrice`, `priceWithTax`, `listPrice`, `comparisonPrice` +
    `comparisonUnit` (normalised unit price, e.g. €/l), `tax`, `netPriceFound`, `error`;
    each price has `validFrom` / `validTo`
  - prices are **customer-specific**
- `GET /api/products/download`: product catalog file
- `GET /api/delivery-reliability/download`: reliability data
- `GET /api/carbon-footprint/download`: category-level carbon ranges

### Does NOT exist (we build it in the gateway)
- product search, order placement, mandates, approvals, substitution, audit log.

### TODO before building levels
Download the three files, inspect them, and write `docs/data-notes.md` with: all columns,
whether lactose-free / allergen / label / certificate fields exist, pack sizes vs
`salesUnit`, how reliability is keyed (product? supplier?), and which real products can
drive each level's twist. **Do not assume field names; verify them.**
The base URL and auth header format come from the resource portal docs; put them in `.env`.

---

## 5. Domain model

### 5.1 Mandate (the buyer's promise)
```json
{
  "mandateId": "mdt_01",
  "customerId": "123",
  "issuedBy": { "name": "Anna Virtanen", "role": "Kitchen manager" },
  "agentId": "kitchenbuyer-hotel-kamp",
  "limits": { "perOrderEur": 500, "perWeekEur": 3000 },
  "substitution": "same_category",
  "lateDelivery": "none",
  "hardConstraints": { "excludeAllergens": ["peanut"], "requireLabels": [] },
  "priorities": ["on_time", "price", "sustainability"],
  "validUntil": "2026-12-31T23:59:59+02:00",
  "signature": "base64..."
}
```
- `substitution`: `none` | `same_category` | `any`
- `lateDelivery`: `none` | `one_day`
- Signed by the gateway on behalf of the issuing human; verified on every request.

### 5.2 Quote (Valio Aimo's promise)
Contains: `quoteId`, `customerId`, `mandateId`, plan lines (productId, qty, salesUnit,
unit price, availableDate), totals, `expiresAt` = min(price `validTo`, `closingTime`),
evidence (source call timestamps), `policyResult`, `signature`.

State machine:
```
QUOTED → PENDING_APPROVAL → APPROVED → ORDERED → CONFIRMED
QUOTED → ORDERED                      (GREEN / BLUE, no approval needed)
any open state → EXPIRED              (past expiresAt)
PENDING_APPROVAL → REJECTED | EXPIRED (no answer before timeout)
```
An expired quote can be re-quoted; the UI must show whether the price changed.

### 5.3 Order
Created only from a valid, unexpired quote whose policy result allows it. Stored locally
(the mock API has no order endpoint). Fields: `orderId`, `quoteId`, lines, total, status.

### 5.4 Approval
`approvalId`, `quoteId`, reason codes, options (good/better/best plans), `recommended`,
`deadline` (real-time countdown), `decision`: `approved | alternative:<planId> | rejected | expired`.

### 5.5 Log event
`seq`, `timestamp`, `actor` (agent / human / gateway / scenario), `type`, `payload`,
`prevHash`, `hash` = sha256(prevHash + canonical payload). Append-only.

---

## 6. Gateway behaviour

### 6.1 Endpoints
| Method | Path | Purpose |
|---|---|---|
| GET | `/.well-known/agent-commerce.json` | Capabilities, mandate schema, policy summary |
| POST | `/mandates` | Create + sign a mandate |
| POST | `/search` | Search the downloaded catalog (keyword + attribute filters) |
| POST | `/quote` | Build plans from price + availability, rank, policy-check, sign |
| POST | `/orders` | Place order from quote id |
| POST | `/approvals/{id}` | Human decision |
| GET | `/log?view=buyer\|valio` | Audit trail, two views |
| POST | `/game/levels/{id}/start` | Load scenario, reset state (game-only) |

### 6.2 Policy engine: four outcomes
| Light | Meaning | Player sees |
|---|---|---|
| 🟢 GREEN | Within mandate | Agent just does it |
| 🔵 BLUE | Within mandate but notable (split order, allowed substitution) | Info toast, no cost |
| 🟡 YELLOW | Outside mandate but approvable | Phone approval card, costs 1 heart |
| 🔴 RED | Never allowed | Blocked with reason, **no approve button** |

### 6.3 Evaluation order (first match wins per item; order result = worst light)
1. Mandate missing, unsigned, expired, or wrong customer → RED
2. Data-boundary violation (asking for other customers, purchase prices) → RED
3. Product `salesBlock` → RED for that product (excluded from plans)
4. Hard constraint violated (allergen, required label) → RED for that product
5. Quote expired → re-quote (not a light)
6. Total > `perOrderEur` or week total > `perWeekEur` → YELLOW.
   Limits are checked on the **sum of all orders created from the same need/quote**, so
   splitting one need into several small orders can never bypass a limit. Unit test required.
7. Substitution beyond allowed level → YELLOW
8. Delivery later than deadline beyond `lateDelivery` → YELLOW
9. Split across products/dates, or substitution within allowed level → BLUE
10. Otherwise → GREEN

Policy functions are pure and must have unit tests for every rule.

### 6.4 Plan generator (response logic for partial availability)
Given a need `{query, qty, unit, deadline}`:
1. Candidates = catalog matches minus RED products.
2. Fetch price + availability for candidates (one batched call each).
3. Build plans: (a) single product on time, (b) split across products on time,
   (c) single product with later date, (d) split across dates.
4. Score each plan with weights from `mandate.priorities` (first 0.5, second 0.3, third 0.2):
   - on_time = qty delivered by deadline / qty needed
   - price = cheapest plan cost / this plan cost (use `comparisonPrice` to normalise units)
   - sustainability = share of qty with labels/certificates, plus lower carbon category
   - reliability penalty from delivery-reliability data
5. Present top 3 as **best / better / good**, recommended = highest score.

### 6.5 Explanations
The LLM receives the structured decision record (plans, scores, policy reasons) and writes
2-3 sentences. It may only use values present in the record.
Neutrality: if the recommended plan uses a non-Valio brand, say so plainly.

### 6.6 Data boundary tiers
- Public: catalog, labels, certificates, category carbon ranges.
- Customer-scoped: that customer's prices, quotes, orders, log.
- Never exposed: purchase prices, margins, other customers' data, supplier contracts.
The Valio view in the game shows "returned to agent" vs "withheld" for every call.

---

## 7. Game mechanics

### 7.1 Player resources
- **Attention ❤️❤️❤️** (3 per level). Each YELLOW approval card costs 1 heart when shown.
  At 0 hearts, further YELLOW requests are auto-expired (manager too busy) and the action
  is not taken.
- **Risk** is not a counter; it shows up as consequences in scoring.

The whole game is one tension: tight mandate → many approvals → out of hearts → missed
orders. Loose mandate → no approvals → costly or unsafe choices. Find the balance.

### 7.2 Level loop (60-120 seconds)
1. **Brief**: mission card (customer, need, deadline, cut-off).
2. **Mandate**: player sets 4 controls (per-order limit 200/500/2000 €, substitution,
   late delivery, allergen rule) and presses **Sign**. Stamp animation.
3. **Run**: game clock runs from 10:00 to `closingTime` (default 1 real second = 4 game
   minutes). Agent acts; timeline shows each step with its light. YELLOW → phone vibrates,
   approval card with **20 s real-time countdown**, options best/better/good,
   actions Approve / Choose other / Reject.
4. **Result**: scores, stars, receipt that explains itself, button **"See it from Valio
   Aimo's side"**.

### 7.3 Scoring
- 🍳 **Kitchen** = qty delivered on time / qty needed × 100
- 💶 **Wallet** = max(0, 100 − 3 × overspend%) where overspend% is vs the best compliant plan
- 🛡️ **Safety** = 100; any hard-constraint incident → 0; each low-reliability choice −20
- ❤️ **Hearts left** (0-3)

Stars:
- ⭐⭐⭐ Kitchen 100, Wallet ≥ 90, Safety 100, Hearts ≥ 1
- ⭐⭐ Kitchen ≥ 90 and Safety ≥ 80 (a hotel missing 30% of an ingredient is a service failure)
- ⭐ anything else with Safety > 0
- 💥 Safety incident: 0 stars, red "Safety incident" screen

### 7.4 Replay comparison (the "aha" screen)
After a level the player can replay it with presets **Strict / Balanced / Loose**.
Results appear side by side (approvals asked, hearts used, cost, kitchen %, safety).
This screen is the visual answer to the challenge's "guardrails model" question.

---

## 8. Levels

MVP = Levels 1-3. Build them on the same gateway and policy engine, never as separate fakes.

### Level 1: The Weekly Order (Hotel)
- Need: 1,000 l lactose-free milk by Monday 06:00, cut-off 14:00.
- Hidden twist: only ~700 l of the Valio product available on time; rest needs another
  brand or a later date.
- Expected:
  - Strict (200 €, no substitution, no late): 3+ approvals, hearts run out, 300 l missing
    (Kitchen 70) → ⭐
  - Loose (2000 €, any, one day, priorities `price, on_time, sustainability`): the cheapest
    plan is "1,000 l Valio: 700 l Monday + 300 l Tuesday" (cheaper than the on-time split with
    the other brand). Agent picks it automatically (BLUE, 0 approvals), Kitchen 70 → ⭐.
    Lesson: the agent did exactly what the mandate allowed; the mandate allowed too much.
  - Balanced (500 €, same category, none): 1 approval for budget, full on time → ⭐⭐⭐
  - The reliability penalty (§6.4) stays in ranking unchanged.

### Level 2: The Stock-out (Restaurant)
- Need: standing order of a cheese/dairy item; mid-week `salesBlock` or zero availability.
- Agent must propose a compatible substitute and explain the trade-off (price, unit, label).
- Teaches BLUE vs YELLOW: substitution inside vs outside allowed level.
- The standing order has two deliveries in the week (Wednesday + Friday); the item is blocked
  all week, so each delivery is its own need/quote/order.
- Expected: Strict (no substitution) → 2 approvals (one per delivery), 1 heart left;
  Balanced (same category) → 0 approvals, 2 BLUE toasts. Both ⭐⭐⭐; the compare screen shows
  the attention cost.

### Level 3: Allergy Emergency (School kitchen)
- Need: substitute for an unavailable item; cheapest substitute contains an allergen.
- Allergen rule ON → gateway blocks the product (RED, no approve button), agent picks a
  safe option → good score.
- Allergen rule OFF → agent buys the cheaper unsafe item → **Safety incident**.
- Lesson: some rules must never be left to a hurried human approval.
- Pitch note: a real deployment would default these rules ON; the toggle exists to teach.

### Stretch levels (only after MVP is solid)
- Level 4 Standing-order drift: recurring order creeps up; agent flags anomaly before auto-renewal.
- Level 5 Last-minute banquet: multi-product need from a recipe, partial sourcing.
- Level 6 Seasonal offer: Valio Aimo's seller agent proposes a product; buyer agent evaluates it
  against the mandate (agent-to-agent).

---

## 9. Scenarios and data

### 9.1 Level definition file (`/gateway/scenarios/level1.json`)
customer, need, deadline, cut-off, candidate product ids (from real data), preset mandates,
expected outcome per preset (used by tests), optional overlay.

### 9.2 Prefer real twists
First try to find real products in the mock data whose `scheduleLines` naturally create the
twist (partial quantity, later date, salesBlock).

### 9.3 Scenario overlay
If the data cannot produce a twist, the overlay may adjust availability or flags for
specific product ids. Every overlay change is logged with `actor: "scenario"` and shown in
the Valio view as "scenario adjustment". Prices are never overlaid.

### 9.4 Recordings
`/recordings/levelN-<preset>.json` stores gateway responses for replay mode. Regenerate
whenever gateway logic changes.

---

## 10. UI

### Visual level
- **Level A (must have)**: card-based UI: mandate document, agent timeline, phone approval
  card, result board, receipt, Valio view.
- **Level B (nice to have)**: static 2D kitchen illustration with a small robot agent that
  moves between fixed points (storage, terminal, delivery door) with speech bubbles.
- No free movement, no tile maps, no physics.

### Screens
1. **Mandate (Valtakirja)**: looks like a real signed document; editable bold values;
   "Sign" stamps it.
2. **Agent timeline**: chat input left, step timeline right, each step clickable for raw data
   and the rule applied.
3. **Phone**: CSS phone frame, vibrate animation, approval card with countdown.
4. **Result + receipt**: score bars, stars, narrative receipt, log hash badge.
5. **Valio view**: active agents, mandates, blocked attempts, "returned vs withheld" table.
6. **Replay comparison**: three columns Strict / Balanced / Loose.

### Style
- Valio-like blue/white base, flat illustrations, no copyrighted characters or logos we
  do not own.
- The four light colours are used identically everywhere.
- Robot emotes: calm (green), info (blue), scratching head (yellow), raised palm (red).
- Must work on a projector: large type, high contrast.

---

## 11. Build priorities (in order)

1. Inspect data → `docs/data-notes.md`.
2. Gateway: valio client, search, quote, policy engine with tests, orders, log.
3. Agent runner calling the gateway for Level 1.
4. Frontend Level A screens wired to Level 1.
5. Replay mode + recording for Level 1.
6. Levels 2 and 3.
7. Replay comparison screen, Valio view.
8. Level B visuals, discovery file polish.
9. Stretch levels.

At any point the newest stable build must be demoable.

---

## 12. Conventions

- TypeScript strict mode; Python type hints; small pure functions for policy and planner.
- Money as integer cents internally; display in € with comma decimal (Finnish style) in UI.
- Times in Europe/Helsinki; store ISO 8601 with offset.
- All user-facing text in English.
- Typographic quotes and apostrophes in UI copy.
- Every gateway response includes `requestId` and appears in the log.
- Before adding a dependency, check it is really needed.

---

## 13. Glossary

- **Mandate / valtakirja**: signed authority the buyer gives its agent.
- **Quote**: signed, time-limited offer from Valio Aimo.
- **Gateway**: Valio Aimo's agent-facing interface; enforces all rules.
- **Plan**: one way to fulfil a need (products × quantities × dates).
- **Hearts**: the manager's limited attention in the game.
- **Overlay**: flagged scenario adjustment when real data cannot produce a twist.