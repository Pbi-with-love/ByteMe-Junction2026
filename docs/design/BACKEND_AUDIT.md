# Backend audit vs API_CONTRACT.md (v1) and GATEWAY_RULES.md

Audited 2026-11-14 on branch `setup` (includes `origin/main` up to `a00df3f`). Method: codegraph index +
full read of `backend/app/main.py`, `policy.py`, `planner.py`, `auth.py`, `valio_data.py`; spot checks of the
stores; `pytest` = 58 passed. Severity: **P0** breaks a golden rule / security, **P1** contract deviation that
breaks a caller, **P2** minor or cosmetic.

## Implemented and broadly correct
Request id header on every response; error envelope; opaque hashed tokens; mandate create/get/revoke with
signature; search with exclusion reasons; quote creation with signed document and expiry = min(price validTo,
closingTime); orders with Idempotency-Key, 201/202/403/409; approvals with deadline = min(+timeout, quote
expiry), 404 for other customers, 409 when closed; hash-chained event log + verify; week total includes pending
orders (small orders cannot dodge the weekly cap).

## P0
1. **`GET /v1/log` has no authentication, no `view`, no customer scoping** (`main.py:1330`). Anyone gets every
   customer's events. Contract §7: `buyer` view = human/agent token, own customer only; `valio` view = operator
   token, all customers, with `disclosure`. Violates golden rule 6. `GET /v1/log/verify` is also open.
2. **No `DATA_BOUNDARY` check anywhere.** Contract §0.1: a `customerId` in a body that differs from the token's
   customer → 403 `DATA_BOUNDARY` + log `DATA_BOUNDARY_BLOCKED`. `POST /v1/mandates` silently overwrites it.
3. **Allergen policy blocks everything for any code except peanut** (`policy.py:12-45`): `excludeAllergens:
   ["AE"]` (egg, scenario A-01 / Level 3) marks every product `ALLERGEN_EXCLUDED` because only `AP` is a
   "verified" code. Catalog codes (AE, AM, AW, AN, ...) must be accepted as-is. MAY_CONTAIN already counts
   (matches GATEWAY_RULES); missing data → RED already correct.

## P1
4. **Discovery is a 501 stub** (`main.py:424`). Contract §1: public, no auth. The frontend calls it at boot.
5. **`need.candidateProductIds` is read from the body root** (`main.py:660`), contract §4 puts it inside `need`.
6. **Mandate response lacks `summaryText`** (contract §2; the Valtakirja screen renders it) and the request is
   not validated (substitution / lateDelivery enums, priorities permutation, limits).
7. **Approval decision ignores GATEWAY_RULES**: (a) no re-fetch of price/availability on approval; (b) a RED
   re-check returns 403 but leaves the order `PENDING_APPROVAL` instead of `REJECTED` and logs nothing — rule:
   403 `POLICY_BLOCKED`, order `REJECTED`, event `POLICY_BLOCKED` actor `human`; (c) `alternative` is refused
   when its YELLOW reasons differ from the original (`main.py:1224`) — rule: choosing an option approves every
   YELLOW reason shown on that option.
8. **One quote, one order not enforced**: a second `POST /v1/orders` on the same quote with a new
   Idempotency-Key creates a second order; rule → 409 `INVALID_STATE`.
9. **Wrong-role token → 403 `MANDATE_INVALID`** (`main.py:154`); rule → 401 `UNAUTHENTICATED`.
10. **Event types outside the v1 list**: `TOKEN_ISSUED`; `APPROVAL_EXPIRED` is appended on *every* GET of an
    expired approval (duplicates) with a non-contract reason `APPROVAL_EXPIRED`.
11. **Quote `evidence` is always `[]`** (contract: source, requestId, at for price + availability calls).
12. **Planner is milk/litre only** (`build_milk_plans`, unit "l"): non-litre needs (Level 3 buns) cannot be
    quoted; exclusion reasons `DATA_BOUNDARY` (missing price row) and `UNIT_UNCONVERTIBLE` are not contract
    codes — contract §10: `PRICE_UNAVAILABLE`, logged, not a policy light. Plans can also be fewer/more odd:
    tiers are assigned per plan *kind* before scoring, so `tier` and `score.total` order can disagree with
    "sorted by score.total"; reliability penalty is `(1 - reliability) * 0.1`, null = no penalty — rule: fixed
    0.05 penalty for null; no tie-break rule (lower comparisonPrice, higher reliability, lower productId);
    lines lack `comparisonPrice`.
13. **Hearts off-by-one** (`main.py:1010`): an approval is created `EXPIRED` when the provider returns 0 hearts
    *after* consuming, so the 3rd approval is lost; CLAUDE.md §7.1: 3 approvals are shown, the 4th auto-expires.
    (`hearts_provider` does not exist yet, so approvals are currently unlimited.)
14. **Upstream timeout is 30 s** (`valio_client.py:26`); contract §10: > 5 s → 502 `UPSTREAM_ERROR`.

## Not implemented (501 stubs or missing)
`POST /v1/quotes/{id}/requote`, `GET /v1/events` (SSE), `POST /v1/game/levels/{id}/start`,
`POST /v1/game/sessions/{id}/run`, `GET /v1/game/sessions/{id}`; **missing entirely**:
`GET /v1/game/sessions/{id}/result`, `GET /v1/game/levels/{id}/compare`, scenario overlay, hearts provider,
scoring (§7.3), receipt text, the **buyer agent runner** (`/agent`, CLAUDE.md §3) and LLM explanations.

## What the frontend can switch to the real backend, and when
| Frontend call | Backend | Status |
|---|---|---|
| `discovery()` | `GET /.well-known/agent-commerce.json` | after fix 4 |
| `signMandate()` | `POST /v1/mandates` | after fix 6 (summaryText) |
| `getApproval()` / `decideApproval()` | `/v1/approvals/{id}` | after fix 7; response shape `{approval, order}` needs a frontend adapter |
| `getLog()` / `verifyLog()` | `/v1/log`, `/v1/log/verify` | after fix 1 (views, scoping, disclosure) |
| operator token | `POST /v1/auth/tokens` | works |
| `startLevel()`, `nextStep()`, `getResult()`, `compare()`, `presets()` | game layer | **blocked: not built** |

The game cannot run live until the **game layer + agent runner** exist: `start` (scenario, tokens, hearts,
overlay), `run` (agent: search → quote → order → explanation), session state, result/scoring, compare. That is
the place to build the "agent brain": `agent/` as a separate caller of the gateway (deterministic policy for
choosing the recommended plan; LLM only for parsing the request and writing explanations), started by
`POST /v1/game/sessions/{id}/run`.
