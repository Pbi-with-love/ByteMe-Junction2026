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

## Log
- Levels without an overlay emit no SCENARIO_OVERLAY event.
- No new event types; use the v1 list.