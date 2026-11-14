# GATEWAY_RULES.md

Behaviour rules for the gateway. These use only fields, codes and event types that
already exist in API_CONTRACT.md v1. Nothing here changes the contract.

## Policy
- An excluded allergen at MAY_CONTAIN level counts as contained → RED ALLERGEN_EXCLUDED.
- If excludeAllergens is non-empty and a product has no allergen data → RED
  ALLERGEN_EXCLUDED. Missing data is never treated as safe.
- Choosing an option on an approval approves every YELLOW reason shown on that option.
  RED is never approvable: 403 POLICY_BLOCKED, logged as POLICY_BLOCKED, actor "human".
- On approval, re-fetch price and availability for the chosen plan; if it is now RED
  → 403 POLICY_BLOCKED and the order becomes REJECTED.
- One quote, one order: a second POST /v1/orders on the same quote, even with a new
  Idempotency-Key → 409 INVALID_STATE.
- Wrong token role for an endpoint → 401 UNAUTHENTICATED.

## Planner
- Substitutes: vendor substitute rules first (directional: A→B does not imply B→A),
  then same category with the same claims as the product being replaced
  (e.g. lactose-free stays lactose-free).
- Always round up to whole sales units; the excess is salesQuantity × pack size − quantity.
- Tie-break for equal score.total: lower comparisonPrice, then higher
  deliveryReliability, then lower productId.
- deliveryReliability null is never treated as 1.0: fixed 0.05 score penalty.
- No possible plan → 201 with plans: [] and excludedProducts filled; the agent reports
  back and never orders.
- Missing or ambiguous unit conversion leaves a product out of plans, not excludedProducts, and logs its productId in QUOTE_CREATED payload.unconvertible.
- Missing, errored, or netPriceFound:false price leaves a product out of plans, not excludedProducts, and logs its productId in QUOTE_CREATED payload.priceUnavailable with PRICE_UNAVAILABLE in reasons.
- Keep the best plan of each kind, sort by score.total descending, then quantity-weighted comparisonPrice ascending, minimum deliveryReliability descending (null lowest), and productId tuple ascending; assign best/better/good tiers and planIds after sorting.
- The first id in need.candidateProductIds is the requested product; every plan line with a different productId is a substitute, including single-product plans and each non-requested line in a split.

## Log
- Levels without an overlay emit no SCENARIO_OVERLAY event.
- No new event types; use the v1 list.

## Game layer
- `GET /v1/game/levels/{levelId}/presets` returns unsigned scenario mandate templates; only signed mandates can authorize gateway calls.
- Game session responses add `steps`, with each reported search, quote, order, approval snapshot and approval event.
- Starting a level resets quotes, orders, approvals, mandates and log events, while issued tokens remain valid.
- A session uses the newest ACTIVE mandate signed for its customer after that session starts.
- The gateway clock starts at the scenario `now` and advances by real elapsed time; approval deadlines remain 20 real seconds.
- Each session starts with three hearts; approvals one through three are shown and decrement hearts, while later approvals expire unseen with `ATTENTION_EXHAUSTED`.
- Exhausted approvals return HTTP 202 with an order body whose status is `EXPIRED`.
- Session payloads may add `explainSource` (`claude` or `template`), `explainFallbackReason` (`no_key`, `timeout`, `api_error`, `refusal`, `max_tokens`, `invalid_number`, or `missing_brand`; null when Claude supplied the explanation), and `explainElapsedMs` for the latest explanation call.
- Claude explanations use kitchen-manager language: 2–3 short sentences, UI-formatted amounts and quantities, a plain explanation of the mandate setting behind the outcome, and a named non-Valio brand when recommended; internal ids, field names and reason codes are rejected.
- Kitchen scores on-time delivered need quantity; Wallet scores against the cheapest compliant on-time quote plan; Safety scores allergens and low delivery reliability; stars follow the scoring thresholds in spec 016.
- Headless compare runs use replay upstream data, a template explainer and the scenario's simulated human decisions in isolated gateway instances.
- `GET /v1/events` remains unimplemented; clients poll `GET /v1/game/sessions/{sessionId}`.
