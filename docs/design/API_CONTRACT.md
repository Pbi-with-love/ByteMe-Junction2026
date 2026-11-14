# API_CONTRACT.md: Valio Aimo Trust Gateway

> Contract between the **gateway** (backend), the **buyer agent runner**, and the **game frontend**.
> Companion to `CLAUDE.md`; where they disagree, raise it and fix one of them.
> Status: **v1 draft**. Fields marked `PROVISIONAL` depend on `docs/data-notes.md`.

---

## 0. Conventions

| Topic | Rule |
|---|---|
| Base path | All endpoints under `/v1`, except `/.well-known/agent-commerce.json` |
| Format | JSON, UTF-8, `camelCase` field names |
| Money | `{ "cents": 124000, "currency": "EUR" }`, integer cents, never floats |
| Time | ISO 8601 with offset, Europe/Helsinki (`2026-11-16T06:00:00+02:00`) |
| Quantities | `{ "amount": 700, "unit": "l" }`. `unit` is either the product `salesUnit` or the need unit; conversions are done by the gateway |
| IDs | Prefixed strings: `mdt_`, `qt_`, `pln_`, `ord_`, `apr_`, `evt_`, `ses_`, `req_` |
| Request ID | Every response has header `X-Request-Id` and the same value in the log |
| Idempotency | `POST /v1/orders` requires header `Idempotency-Key` (any unique string) |
| Lights | `GREEN` \| `BLUE` \| `YELLOW` \| `RED` (see CLAUDE.md §6.2) |

### 0.1 Callers and authentication

| Caller | Header | Scope |
|---|---|---|
| Buyer agent | `Authorization: Bearer <agentToken>` | Exactly one `customerId` + one `agentId` |
| Human / game UI | `Authorization: Bearer <humanToken>` | One customer; may sign mandates and decide approvals |
| Valio operator view | `Authorization: Bearer <operatorToken>` | Read-only, all customers, `view=valio` log |

Tokens are opaque strings issued by `POST /v1/auth/tokens` (demo helper, §9).
The gateway derives `customerId` from the token. **A `customerId` in a request body that
differs from the token's customer is rejected with `DATA_BOUNDARY`.**

### 0.2 Error format

```json
{
  "error": {
    "code": "QUOTE_EXPIRED",
    "message": "Quote qt_8f2 expired at 2026-11-14T14:00:00+02:00.",
    "requestId": "req_91ac",
    "details": { "quoteId": "qt_8f2" }
  }
}
```

| HTTP | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Malformed body |
| 401 | `UNAUTHENTICATED` | Missing or unknown token |
| 403 | `MANDATE_INVALID` | Mandate missing, bad signature, revoked |
| 403 | `MANDATE_EXPIRED` | Past `validUntil` |
| 403 | `DATA_BOUNDARY` | Access outside the token's customer or to never-exposed data |
| 403 | `POLICY_BLOCKED` | Chosen plan has a RED result |
| 404 | `NOT_FOUND` | Unknown id (or id belongs to another customer; never reveal which) |
| 409 | `QUOTE_EXPIRED` | Quote past `expiresAt` |
| 409 | `INVALID_STATE` | e.g. deciding an approval that is already closed |
| 502 | `UPSTREAM_ERROR` | Valio mock API failed or timed out |

### 0.3 Policy reason codes

Used in quotes, approvals and the log. Each has a fixed human-readable template.

| Code | Light | Meaning |
|---|---|---|
| `WITHIN_MANDATE` | GREEN | Nothing notable |
| `SPLIT_ORDER` | BLUE | Fulfilled across products or dates |
| `SUBSTITUTION_ALLOWED` | BLUE | Substitute within allowed level |
| `OVER_ORDER_LIMIT` | YELLOW | Total above `limits.perOrderEur`, summed over all orders from the same need/quote (splitting cannot bypass it) |
| `OVER_WEEK_LIMIT` | YELLOW | Week total above `limits.perWeekEur` |
| `SUBSTITUTION_NOT_ALLOWED` | YELLOW | Substitute beyond mandate level |
| `LATE_DELIVERY` | YELLOW | Some quantity arrives after deadline beyond tolerance |
| `SALES_BLOCKED` | RED | Product has `salesBlock` |
| `ALLERGEN_EXCLUDED` | RED | Product contains an excluded allergen |
| `LABEL_REQUIRED` | RED | Product lacks a required label |
| `MANDATE_INVALID` / `MANDATE_EXPIRED` | RED | Mandate problem |
| `DATA_BOUNDARY` | RED | Forbidden data or customer scope |

RED applies **per product** (product excluded from plans) or **per request** (whole call refused).
A plan's light is the worst light of its reasons.

---

## 1. Discovery

### `GET /.well-known/agent-commerce.json`
Public, no auth. Tells any external agent what this gateway supports.

```json
{
  "provider": "Valio Aimo (mock)",
  "protocolVersion": "1.0-draft",
  "baseUrl": "https://<host>/v1",
  "capabilities": ["search", "quote", "order", "mandate", "approval", "audit_log"],
  "mandate": {
    "schemaUrl": "https://<host>/v1/schemas/mandate.json",
    "substitutionLevels": ["none", "same_category", "any"],
    "lateDeliveryLevels": ["none", "one_day"]
  },
  "signing": {
    "alg": "Ed25519",
    "keys": [{ "keyId": "valio-aimo-2026-11", "publicKey": "base64..." }],
    "canonicalization": "JSON, sorted keys, no whitespace"
  },
  "policy": {
    "lights": ["GREEN", "BLUE", "YELLOW", "RED"],
    "reasonCodesUrl": "https://<host>/v1/schemas/reason-codes.json"
  },
  "dataDisclosure": {
    "public": ["catalog", "labels", "certificates", "categoryCarbon"],
    "customerScoped": ["netPrices", "quotes", "orders", "auditLog"],
    "neverExposed": ["purchasePrices", "margins", "otherCustomers", "supplierContracts"]
  }
}
```

---

## 2. Mandates

### `POST /v1/mandates`  (human token)
Creates and signs a mandate. The gateway signs on behalf of the human holding the token.

Request:
```json
{
  "agentId": "kitchenbuyer-hotel-kamp",
  "issuedBy": { "name": "Anna Virtanen", "role": "Kitchen manager" },
  "limits": { "perOrderEur": 500, "perWeekEur": 3000 },
  "substitution": "same_category",
  "lateDelivery": "none",
  "hardConstraints": { "excludeAllergens": ["peanut"], "requireLabels": [] },
  "priorities": ["on_time", "price", "sustainability"],
  "validUntil": "2026-12-31T23:59:59+02:00"
}
```
- `priorities`: permutation of `on_time`, `price`, `sustainability` (weights 0.5 / 0.3 / 0.2).
- `excludeAllergens` / `requireLabels` values: `PROVISIONAL`, from catalog field values.

Response `201`:
```json
{
  "mandateId": "mdt_01",
  "customerId": "123",
  "...": "all request fields echoed",
  "issuedAt": "2026-11-14T10:02:11+02:00",
  "status": "ACTIVE",
  "signature": { "alg": "Ed25519", "keyId": "valio-aimo-2026-11", "value": "base64..." },
  "summaryText": "Anna Virtanen authorises kitchenbuyer-hotel-kamp to order up to €500 per order..."
}
```
`summaryText` is a deterministic template used by the Valtakirja screen.

### `GET /v1/mandates/{mandateId}`
Agent or human of the same customer. Returns the mandate as above.

### `POST /v1/mandates/{mandateId}/revoke`  (human token)
Response `200` with `status: "REVOKED"`. All open quotes under it become unusable.

---

## 3. Search

### `POST /v1/search`  (agent token)
Searches the downloaded catalog. No prices here; prices only come through quotes.

Request:
```json
{
  "mandateId": "mdt_01",
  "query": "lactose-free milk",
  "filters": {
    "category": null,
    "attributes": ["lactose_free"],
    "labels": []
  },
  "limit": 20
}
```
`filters.attributes` / `labels` values are `PROVISIONAL`.

Response `200`:
```json
{
  "results": [
    {
      "productId": "460013",
      "name": "PROVISIONAL",
      "brand": "PROVISIONAL",
      "category": "PROVISIONAL",
      "salesUnit": "PROVISIONAL",
      "packSize": { "amount": 1, "unit": "l" },
      "labels": [],
      "allergens": [],
      "carbonCategory": { "category": "milk", "kgCo2ePerKg": { "min": 0.0, "max": 0.0 } },
      "deliveryReliability": 0.97,
      "excluded": null
    },
    {
      "productId": "463989",
      "excluded": { "light": "RED", "reason": "ALLERGEN_EXCLUDED" }
    }
  ],
  "total": 2
}
```
Products that are RED for this mandate are still listed with `excluded` set, so the agent
and the UI can show *why* they were left out. They never appear in quote plans.

---

## 4. Quotes

### `POST /v1/quotes`  (agent token)
Builds plans from live price + availability, ranks them, policy-checks them, signs the quote.

Request:
```json
{
  "mandateId": "mdt_01",
  "need": {
    "description": "Lactose-free milk for the hotel",
    "quantity": { "amount": 1000, "unit": "l" },
    "deadline": "2026-11-16T06:00:00+02:00",
    "candidateProductIds": ["460013", "460063", "460056"]
  }
}
```
If `candidateProductIds` is omitted the gateway uses the top search results for `description`.

Upstream calls (one batch each): `POST /api/price` and `POST /api/availability` with
`requestedDate` = date part of `deadline`.

Response `201`:
```json
{
  "quoteId": "qt_8f2",
  "customerId": "123",
  "mandateId": "mdt_01",
  "status": "QUOTED",
  "createdAt": "2026-11-14T10:05:00+02:00",
  "expiresAt": "2026-11-14T14:00:00+02:00",
  "need": { "...": "echoed" },
  "plans": [
    {
      "planId": "pln_a",
      "tier": "best",
      "recommended": true,
      "lines": [
        {
          "productId": "460013",
          "quantity": { "amount": 700, "unit": "l" },
          "salesQuantity": { "amount": 70, "unit": "PROVISIONAL" },
          "unitPrice": { "cents": 129, "currency": "EUR" },
          "comparisonPrice": { "cents": 129, "currency": "EUR", "per": "l" },
          "lineTotal": { "cents": 90300, "currency": "EUR" },
          "availableDate": "2026-11-16",
          "isSubstitute": false
        },
        {
          "productId": "460063",
          "quantity": { "amount": 300, "unit": "l" },
          "unitPrice": { "cents": 135, "currency": "EUR" },
          "lineTotal": { "cents": 40500, "currency": "EUR" },
          "availableDate": "2026-11-16",
          "isSubstitute": true
        }
      ],
      "total": { "cents": 130800, "currency": "EUR" },
      "onTime": { "amount": 1000, "unit": "l" },
      "score": {
        "total": 0.94,
        "onTime": 1.0,
        "price": 0.97,
        "sustainability": 0.6,
        "reliabilityPenalty": 0.0
      },
      "policy": {
        "light": "YELLOW",
        "reasons": ["OVER_ORDER_LIMIT", "SPLIT_ORDER", "SUBSTITUTION_ALLOWED"]
      }
    }
  ],
  "excludedProducts": [
    { "productId": "463989", "light": "RED", "reason": "ALLERGEN_EXCLUDED" }
  ],
  "evidence": [
    { "source": "valio:/api/price", "requestId": "req_77a", "at": "2026-11-14T10:04:58+02:00" },
    { "source": "valio:/api/availability", "requestId": "req_77b", "at": "2026-11-14T10:04:58+02:00" }
  ],
  "scenarioOverlay": false,
  "signature": { "alg": "Ed25519", "keyId": "valio-aimo-2026-11", "value": "base64..." }
}
```
Rules:
- Up to 3 plans, tiers `best` / `better` / `good`, sorted by `score.total`.
- `expiresAt` = earliest of every line's price `validTo` and the product's `closingTime`.
- The signature covers the whole quote object minus `signature`, canonicalised.
- The response never contains `listPrice` margins, purchase prices, or other customers' data.

### `GET /v1/quotes/{quoteId}`
Returns the quote with its current `status`.

### `POST /v1/quotes/{quoteId}/requote`  (agent token)
Only for `EXPIRED` quotes. Returns a **new** quote plus a diff:
```json
{
  "quote": { "...": "new quote" },
  "previousQuoteId": "qt_8f2",
  "priceChanged": true,
  "diff": [{ "planTier": "best", "oldTotalCents": 130800, "newTotalCents": 133200 }]
}
```

---

## 5. Orders

### `POST /v1/orders`  (agent token, header `Idempotency-Key`)

Request:
```json
{ "quoteId": "qt_8f2", "planId": "pln_a" }
```

Responses by policy light of the chosen plan:

| Light | HTTP | Result |
|---|---|---|
| GREEN / BLUE | `201` | Order created, `status: "ORDERED"` |
| YELLOW | `202` | Approval created, `status: "PENDING_APPROVAL"`, includes `approvalId` |
| RED | `403` | `POLICY_BLOCKED`, nothing created |
| Expired quote | `409` | `QUOTE_EXPIRED` |

`201` body:
```json
{
  "orderId": "ord_31",
  "quoteId": "qt_8f2",
  "planId": "pln_a",
  "status": "ORDERED",
  "lines": [],
  "total": { "cents": 130800, "currency": "EUR" },
  "createdAt": "2026-11-14T10:06:00+02:00"
}
```

`202` body:
```json
{
  "orderId": "ord_31",
  "status": "PENDING_APPROVAL",
  "approvalId": "apr_12",
  "reasons": ["OVER_ORDER_LIMIT"]
}
```
When the approval is decided, the gateway updates the order itself:
- `approved` → `ORDERED`, then `CONFIRMED`
- `alternative:<planId>` → order switched to that plan, re-checked by policy, then `ORDERED`
  (if the alternative is also YELLOW for the same reason, the human's decision covers it;
  RED is never overridable)
- `rejected` / `expired` → `REJECTED` / `EXPIRED`

The mock API has no order endpoint; orders are stored only in the gateway.
`CONFIRMED` is set immediately after `ORDERED` in this prototype.

### `GET /v1/orders/{orderId}`
Current order state. Agents poll this or listen to events (§8).

---

## 6. Approvals

### `GET /v1/approvals/{approvalId}`  (human token)
```json
{
  "approvalId": "apr_12",
  "orderId": "ord_31",
  "quoteId": "qt_8f2",
  "status": "OPEN",
  "reasons": ["OVER_ORDER_LIMIT"],
  "reasonText": "Total €1,308.00 is above your €500.00 per-order limit.",
  "options": [
    { "planId": "pln_a", "tier": "best", "recommended": true, "summary": "700 l Valio + 300 l other brand, all Monday, €1,308.00" },
    { "planId": "pln_b", "tier": "better", "summary": "1,000 l Valio, 300 l on Tuesday, €1,290.00" },
    { "planId": "pln_c", "tier": "good", "summary": "..." }
  ],
  "agentExplanation": "PROVISIONAL text written by the agent runner",
  "deadline": "2026-11-14T10:06:20+02:00",
  "createdAt": "2026-11-14T10:06:00+02:00"
}
```
`deadline` is real time (20 s in the game, CLAUDE.md §7.2) and never later than the quote's `expiresAt`.

### `POST /v1/approvals/{approvalId}`  (human token)
```json
{ "decision": "approved" }
```
`decision`: `approved` | `rejected` | `alternative`, with `"planId"` when `alternative`.
Response `200` with the updated approval and order status.
After `deadline` the gateway closes it as `EXPIRED`; deciding afterwards → `409 INVALID_STATE`.

### `POST /v1/approvals/{approvalId}/explanation`  (agent token)
Lets the agent attach its natural-language explanation (stored as `agentExplanation`, logged with `actor: "agent"`).
```json
{ "text": "I split the order because only 700 l of Valio milk can arrive by Monday..." }
```

---

## 7. Audit log

### `GET /v1/log?view=buyer|valio&since=<seq>&limit=<n>`
- `buyer` view: human or agent token; only that customer's events.
- `valio` view: operator token; all customers, includes disclosure data.

Event:
```json
{
  "seq": 42,
  "eventId": "evt_42",
  "at": "2026-11-14T10:06:00+02:00",
  "actor": "gateway",
  "type": "ORDER_PENDING_APPROVAL",
  "customerId": "123",
  "agentId": "kitchenbuyer-hotel-kamp",
  "requestId": "req_91ac",
  "light": "YELLOW",
  "reasons": ["OVER_ORDER_LIMIT"],
  "summary": "Order ord_31 needs approval: total above €500 limit.",
  "refs": { "quoteId": "qt_8f2", "orderId": "ord_31", "approvalId": "apr_12" },
  "prevHash": "sha256:ab12...",
  "hash": "sha256:cd34..."
}
```
`valio` view adds:
```json
"disclosure": {
  "returnedToAgent": ["netPrice", "availability", "closingTime"],
  "withheld": ["purchasePrice", "margin"]
}
```

`actor`: `agent` | `human` | `gateway` | `scenario`.
`type` values: `MANDATE_SIGNED`, `MANDATE_REVOKED`, `SEARCH`, `QUOTE_CREATED`, `QUOTE_EXPIRED`,
`REQUOTE`, `ORDER_CREATED`, `ORDER_PENDING_APPROVAL`, `APPROVAL_SHOWN`, `APPROVAL_DECIDED`,
`APPROVAL_EXPIRED`, `POLICY_BLOCKED`, `DATA_BOUNDARY_BLOCKED`, `SCENARIO_OVERLAY`, `AGENT_NOTE`.

### `GET /v1/log/verify`
Recomputes the hash chain.
```json
{ "valid": true, "events": 57, "headHash": "sha256:ef56..." }
```
If invalid: `{ "valid": false, "brokenAtSeq": 31 }`. The receipt screen shows this as a badge.

---

## 8. Live events

### `GET /v1/events?sessionId=<id>`  (Server-Sent Events)
Pushes every new log event for the session's customer, so the timeline and phone update live.
```
event: log
data: { ...log event... }

event: approval
data: { "approvalId": "apr_12", "deadline": "...", "heartsLeft": 2 }
```

---

## 9. Game endpoints (demo layer only)

These exist for the simulation. An external agent never needs them.

### `POST /v1/auth/tokens`  (no auth, demo only, disabled in production)
```json
{ "role": "human", "customerId": "123" }
```
`role`: `human` | `agent` (also needs `agentId`) | `operator`. Returns `{ "token": "..." }`.

### `POST /v1/game/levels/{levelId}/start`
```json
{ "preset": "balanced", "mode": "live" }
```
- `levelId`: `level1` | `level2` | `level3` (stretch: `level4`-`level6`)
- `preset`: `strict` | `balanced` | `loose` | `custom` (with `mandate` object in body)
- `mode`: `live` | `replay`

Resets the customer's state, loads the scenario (and overlay, logged as `SCENARIO_OVERLAY`),
returns:
```json
{
  "sessionId": "ses_5",
  "level": {
    "levelId": "level1",
    "title": "The Weekly Order",
    "customer": { "customerId": "123", "name": "Hotel Kämp (fictional)", "type": "hotel" },
    "brief": "1,000 l lactose-free milk by Monday 06:00.",
    "deadline": "2026-11-16T06:00:00+02:00",
    "closingTime": "2026-11-14T14:00:00+02:00"
  },
  "clock": { "start": "10:00", "end": "14:00", "realSecondsPerGameMinute": 0.25 },
  "hearts": 3,
  "tokens": { "human": "...", "agent": "..." }
}
```

### `POST /v1/game/sessions/{sessionId}/run`
Starts the agent runner for this session (it then calls the agent endpoints like any external agent).
Response `202 { "status": "RUNNING" }`.

### `GET /v1/game/sessions/{sessionId}`
```json
{ "sessionId": "ses_5", "status": "RUNNING", "hearts": 2, "gameTime": "11:40", "orders": ["ord_31"] }
```
Hearts: decremented when an approval is created (`APPROVAL_SHOWN`). At 0 hearts, new approvals
are created already `EXPIRED` with reason `ATTENTION_EXHAUSTED` (game-only code).

### `GET /v1/game/sessions/{sessionId}/result`
```json
{
  "kitchen": 100,
  "wallet": 97,
  "safety": 100,
  "heartsLeft": 2,
  "stars": 3,
  "incident": null,
  "receiptText": "Your agent bought 700 l of Valio lactose-free milk and 300 l of ...",
  "logHeadHash": "sha256:ef56..."
}
```
Scoring formulas: CLAUDE.md §7.3. `incident` example: `{ "type": "SAFETY", "productId": "463989", "reason": "Contains peanut" }`.

### `GET /v1/game/levels/{levelId}/compare`
Runs (or reads recordings of) `strict`, `balanced`, `loose` and returns the three result
objects side by side, plus `approvalsAsked` per preset. Feeds the replay comparison screen.

---

## 10. Upstream mapping (Valio mock API)

| Gateway need | Upstream call | Fields used |
|---|---|---|
| Catalog for search | `GET /api/products/download` (cached at startup) | `PROVISIONAL` |
| Reliability | `GET /api/delivery-reliability/download` (cached) | `PROVISIONAL` |
| Carbon | `GET /api/carbon-footprint/download` (cached) | `PROVISIONAL` |
| Prices | `POST /api/price` | `catalogPrice`, `priceWithTax`, `comparisonPrice`, `comparisonUnit`, `validTo`, `netPriceFound`, `error` |
| Availability | `POST /api/availability` | `closingTime`, `salesBlock`, `logisticModel`, `scheduleLines[].availableAmount/availableDate/salesUnit/salesBlock` |

Upstream request body: `{ "customer": "<customerId>", "requestedDate": "YYYY-MM-DD", "products": [...] }`.
Base URL and auth header: from resource portal docs, via `.env` (`VALIO_API_BASE_URL`, `VALIO_API_KEY`).

Handling:
- `error: true` or `netPriceFound: false` → product excluded from plans with reason `PRICE_UNAVAILABLE` (logged, not a policy light).
- Upstream timeout > 5 s → `502 UPSTREAM_ERROR`; in `replay` mode upstream is never called.
- Never forward upstream `listPrice` to agents unless needed for display; never forward anything not in the disclosure lists.

---

## 11. Typical agent flow (Level 1)

```
GET  /.well-known/agent-commerce.json
POST /v1/search            { query: "lactose-free milk" }
POST /v1/quotes            { need: 1000 l by Mon 06:00 }      → plans, best = YELLOW
POST /v1/orders            { quoteId, planId: best }          → 202 PENDING_APPROVAL, apr_12
POST /v1/approvals/apr_12/explanation  { text }
      ... human taps Approve in the game ...
GET  /v1/orders/ord_31                                         → CONFIRMED
GET  /v1/log?view=buyer                                        → receipt
```

---

## 12. Open items

- Replace every `PROVISIONAL` field after `docs/data-notes.md` exists.
- Confirm unit conversion data (pack size vs `salesUnit`).
- Confirm how reliability is keyed (product vs supplier).
- Decide whether week totals (`perWeekEur`) reset per level (default: yes, per session).