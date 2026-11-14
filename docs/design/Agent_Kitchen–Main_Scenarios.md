# Agent Kitchen – Main Scenarios (API contract v1)

These scenarios run against `API_CONTRACT.md` v1, so every outcome is a light, HTTP status, reason code or log event the contract defines. Old catalog terms map as: AUTONOMOUS = GREEN or BLUE (201 `ORDERED`), NEEDS\_APPROVAL = YELLOW (202 `PENDING_APPROVAL`), BLOCKED = RED (403 `POLICY_BLOCKED`).

## Shared setup

- Clock: Sat 2026-11-14 10:00+02:00, `closingTime` 14:00, Level 1 deadline Mon 2026-11-16T06:00+02:00, 3 hearts, approval deadline 20 s.
- Frozen catalog plus recorded `/api/price` and `/api/availability` responses, run in replay mode (no upstream calls). Prices below use the contract's example €1.29/l as a placeholder until real responses are recorded.
- Assert on HTTP status, `policy.light`, `policy.reasons`, order status and log event types. Never assert on agent prose.
- Money is integer cents. Every response carries `X-Request-Id`.

### Mandate presets (proposed; the contract only gives the balanced-like example)

| Preset | perOrderEur | perWeekEur | substitution | lateDelivery |
| --- | --- | --- | --- | --- |
| strict | 300 | 1,500 | none | none |
| balanced | 500 | 3,000 | same\_category | none |
| loose | 5,000 | 15,000 | any | one\_day |

### Real milk products (category 10400, from the catalog)

| productId | Product | salesUnit | Litres per sales unit | Reliability |
| --- | --- | --- | --- | --- |
| 464201 | Valio semi-skimmed 1 l UHT | ST | 1 | 1.0 |
| 464073 | Valio whole 1 l UHT | ST | 1 | 1.0 |
| 463335 | Valio Eila 3% 1 l | ST | 1 | 1.0 |
| 464398 | Valio Eila semi-skimmed 1 l UHT | ST | 1 | 1.0 |
| 464119 | Valio skimmed 1 l UHT | KI | 10 | 1.0 |
| 462921 | Valio Eila organic semi-skimmed 1 l (`EU_ORGANIC_FARMING`) | KI | 5 | 1.0 |
| 463038 | Valio Eila semi-skimmed 10 l Novobox | KI | 20 | none |

All seven are lactose-free and `CONTAINS` allergen `AM` (milk). They share one carbon category (1.1 kg CO₂-eq/kg).

## Level 1 – Weekly order

| ID | Setup | Expected |
| --- | --- | --- |
| L1-01 | Balanced, need 300 l, 464201 in stock (≈ €387) | Best plan GREEN `WITHIN_MANDATE`. `POST /v1/orders` → 201 `ORDERED`, then `CONFIRMED`. Log: `QUOTE_CREATED`, `ORDER_CREATED`. |
| L1-02 | Balanced, need 1,000 l by Mon 06:00 (≈ €1,290) | Best plan YELLOW `OVER_ORDER_LIMIT`. Order → 202 `PENDING_APPROVAL` with `approvalId`. Human approves within 20 s → `ORDERED`, `CONFIRMED`. This is the canonical demo. |
| L1-03 | Same 1,000 l request under strict, balanced and loose | strict and balanced: 202 YELLOW `OVER_ORDER_LIMIT`. loose: 201 GREEN. `GET /v1/game/levels/level1/compare` shows `approvalsAsked` 1, 1, 0. |
| L1-04 | Only 700 l of 464201 by Monday, 300 l from 464398 | Two lines, second has `isSubstitute: true`. Reasons `SPLIT_ORDER` and `SUBSTITUTION_ALLOWED` (BLUE). Balanced adds `OVER_ORDER_LIMIT` → YELLOW. Loose → BLUE, 201. |
| L1-05 | 700 l by Monday, remaining 300 l on Tue 2026-11-17 | `lateDelivery: none` → `LATE_DELIVERY` YELLOW. `one_day` → no late flag, `SPLIT_ORDER` BLUE. |
| L1-06 | Candidates 464201, 464073, 463335, 464398 all in stock, priorities `on_time, price, sustainability` | Up to 3 plans (best, better, good) sorted by `score.total` (weights 0.5 / 0.3 / 0.2). Sustainability is equal across milk, so price decides. Two runs give the identical plan order. |
| L1-07 | Need 1,000 l, candidates 464119, 462921, 463038, 464201 | `salesQuantity` = 100 KI, 200 KI, 50 KI, 1,000 ST. For each line `lineTotal` = `unitPrice` × `salesQuantity`; plan `total` = sum of lines. `comparisonPrice` is per l, so all four compare fairly. |
| L1-08 | Total exactly 50,000 cents, then 50,001 cents, balanced | Exactly at the limit: no `OVER_ORDER_LIMIT` (the contract says "above"). One cent over: YELLOW. |
| L1-09 | `/api/price` returns `netPriceFound: false` or `error: true` for one candidate | That product is left out of the plans and logged `PRICE_UNAVAILABLE` (no light). The other candidates are still quoted. |
| L1-10 | Upstream takes longer than 5 s | 502 `UPSTREAM_ERROR`. No quote, no order. A retry works. |
| L1-11 | Order placed after 14:00 | 409 `QUOTE_EXPIRED` (`expiresAt` = earliest of price `validTo` and `closingTime`). `POST /requote` → new quote plus `diff`. Requote on a live quote → 409 `INVALID_STATE`. |
| L1-12 | Two `POST /v1/orders` with the same `Idempotency-Key` | One order, identical response. Missing header → 400 `VALIDATION_ERROR`. |

## Level 3 – Stock-out and substitution

| ID | Setup | Expected |
| --- | --- | --- |
| L3-01 | 464201 has zero stock, balanced, candidates from category 10400 | Plan uses 464398: `isSubstitute: true`, `SUBSTITUTION_ALLOWED` BLUE. Adds YELLOW only if the limit is exceeded. |
| L3-02 | Same stock-out, strict (`substitution: none`) | Plan with the substitute gets `SUBSTITUTION_NOT_ALLOWED` YELLOW, not RED → 202 approval. The human may approve it or pick another plan. |
| L3-03 | Human picks `decision: alternative` with another `planId` | Order switches to that plan, policy re-check, then `ORDERED`. If the alternative is YELLOW for the same reason, the human's decision covers it. |
| L3-04 | Alternative plan's product became sales-blocked after the quote | Re-check turns it RED `SALES_BLOCKED`. The human cannot override: 403 `POLICY_BLOCKED`, order not `ORDERED`, log `POLICY_BLOCKED`. |

## Allergy and hard constraints

Milk products only contain `AM`, so the allergy cases use shrove bun `463989` (contains `AE`, `AM`, `AW`, `UW`; may contain `AN`, `SA`).

| ID | Setup | Expected |
| --- | --- | --- |
| A-01 | `excludeAllergens: ["AE"]`, search "shrove bun" | 463989 is listed with `excluded: { light: RED, reason: ALLERGEN_EXCLUDED }`. It never appears in a quote plan; the quote's `excludedProducts` repeats it. An order on a RED plan → 403 `POLICY_BLOCKED`, nothing created. |
| A-02 | `excludeAllergens: ["AN"]`, 463989 only *may contain* `AN` | The contract is silent. Proposed: `MAY_CONTAIN` counts as excluded → RED `ALLERGEN_EXCLUDED`. Test whichever rule you choose. |
| A-03 | Candidate has no allergen data (11 catalog products carry none) | Proposed: RED with a new code `ALLERGEN_DATA_MISSING`. Unknown is never treated as safe. |
| A-04 | `requireLabels: ["EU_ORGANIC_FARMING"]`, milk need | Only 462921 passes. The other milk products are RED `LABEL_REQUIRED` in search. 1,000 l = 200 KI. |
| A-05 | `excludeAllergens: ["AM"]`, need "lactose-free milk" | Lactose-free milk still contains `AM`: every candidate is RED `ALLERGEN_EXCLUDED`, no plans. Lactose-free must not pass a milk-allergy rule. |
| A-06 | Loose preset, `excludeAllergens` left empty, agent buys 463989 for a kitchen that needed egg-free | GREEN, `ORDERED`. `result.incident` = `{ type: SAFETY, productId: 463989 }` and the safety score drops. Teaches a missing guardrail. |

## Human approvals

| ID | Setup | Expected |
| --- | --- | --- |
| H-01 | Approve within 20 s | `ORDERED`, then `CONFIRMED`. Log: `APPROVAL_SHOWN`, `APPROVAL_DECIDED`, `ORDER_CREATED`. Agent explanation posted via `/explanation` is stored as `agentExplanation` with actor `agent`. |
| H-02 | Reject | Order `REJECTED`. The agent may requote. |
| H-03 | No decision for 20 s | Approval `EXPIRED`, order `EXPIRED`, log `APPROVAL_EXPIRED`. Deciding afterwards → 409 `INVALID_STATE`. |
| H-04 | Quote expires in 10 s | Approval `deadline` = earlier of +20 s and `expiresAt`, so 10 s. |
| H-05 | Double tap on Approve | One order. Second call → 409 `INVALID_STATE`. |
| H-06 | Three approvals shown, then a fourth | Hearts reach 0. The fourth approval is created already `EXPIRED` with `ATTENTION_EXHAUSTED`, and its order expires. |
| H-07 | Human token of another customer decides the approval | 404 `NOT_FOUND`, with no hint that the approval exists. |

## Mandate and data boundary

| ID | Setup | Expected |
| --- | --- | --- |
| M-01 | `validUntil` in the past | 403 `MANDATE_EXPIRED` on search and quotes. |
| M-02 | Mandate revoked, then `POST /v1/orders` | Status `REVOKED`, open quotes unusable, order → 403 `MANDATE_INVALID`. |
| M-03 | Unknown `mandateId` or bad signature | 403 `MANDATE_INVALID`. |
| M-04 | Custom mandate perOrder 500, perWeek 800: order 1 = €450, order 2 = €450 | Order 1 GREEN. Order 2 is under the per-order limit but YELLOW `OVER_WEEK_LIMIT`. Small orders cannot dodge the weekly cap. |
| M-05 | `customerId` in the body differs from the token's, or another customer's `quoteId` | Body mismatch → 403 `DATA_BOUNDARY`, log `DATA_BOUNDARY_BLOCKED`. Foreign id → 404 `NOT_FOUND`. |

## Integrity and scoring

| ID | Setup | Expected |
| --- | --- | --- |
| G-01 | Full Level 1 run, then `GET /v1/log/verify` | `valid: true`; `headHash` equals `result.logHeadHash`. |
| G-02 | Demo tamper: edit event seq 31 in storage | `valid: false, brokenAtSeq: 31`. The receipt badge turns red. |
| G-03 | Verify a quote with the Ed25519 key from `/.well-known/agent-commerce.json` over canonical JSON | Verifies. Change one cent and it fails. |
| G-04 | Buyer log view vs valio log view | Buyer view: only that customer's events, no `disclosure`. Valio view (operator token) adds `disclosure.returnedToAgent` and `withheld`. |
| G-05 | Scan every agent-facing response | No `purchasePrice`, `margin`, `listPrice` or other customers' data. |
| S-01 | Same level, preset and recording run 100 times | Identical `result` (kitchen, wallet, safety, stars, `logHeadHash`). |
| S-02 | `GET /v1/game/levels/level1/compare` | balanced scores the most stars. strict asks more often and drains hearts. loose asks nothing but carries the A-06 safety risk. |

## Gaps in the contract to settle

- **Example IDs are not milk.** In the catalog 460013 is tomatoes, 460063 an oven rinse, 460056 a tumbler, and 463989 a shrove bun with egg, milk and wheat, not peanut. Use the milk IDs above.
- **No milk product contains peanut (`AP`).** The contract's `excludeAllergens: ["peanut"]` example never fires in Level 1, so allergy scenarios need a non-milk need or an `AM` mandate.
- **Allergen rules:** decide how `MAY_CONTAIN` and missing allergen data are treated, and add a reason code for missing data.
- **Substitutes:** the contract has levels but not how the gateway finds substitutes. Vendor rules cover 189 products (about 1%) and are directional (464306 → 464398, not back). Keeping "lactose-free" is only possible through the search attribute filter, not a mandate field.
- **Undefined behaviour:** rounding when the need is not a multiple of the pack size, tie-break for equal `score.total`, response when no plans exist, a second order on the same quote with a new `Idempotency-Key`, a re-check on a plain `approved`, and error codes for wrong-role calls (agent token on human or operator endpoints).
- **Reliability:** only about 25% of products have a value. Define the `deliveryReliability: null` handling and the `reliabilityPenalty` rule.
- **Banquet and later levels:** `need` holds one quantity, so a multi-product banquet needs several needs per quote. Drift detection and proactive offers have no endpoints yet.
