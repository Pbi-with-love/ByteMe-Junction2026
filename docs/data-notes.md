# Valio upstream data notes

Status: **verified from live mock API on 2026-11-14**

The probe uses `X-API-Key`, follows the API's redirects, and stores the raw downloads
under the gitignored `data/valio/` directory. The configured sample customer is `123`.

## Downloads

| Dataset | Format | Rows | Columns |
|---|---:|---:|---|
| Products | JSON array | 17,546 | `id`, `salesUnitGtin`, `salesUnit`, `baseUnit`, `category`, `allowedLotSize`, `deleted`, `temperatureCondition`, `vendorName`, `countryOfOrigin`, `synkkaData`, `units`, `deposits` |
| Delivery reliability | CSV | 17,545 | `productId`, `deliveryReliability` |
| Carbon footprint | CSV | 17,545 | `productId`, `AVG kg CO2-eq/kg` |

The reliability and carbon files are keyed by `productId`, not supplier or category.

## Product attributes

The product display name is in `synkkaData.names[]`, selected by `language` (English
values are available). Supplier information is in `vendorName`; product category is a
numeric code in `category`.

Pack and unit information is represented by:

- `salesUnit` and `baseUnit` on the product.
- `units[]`, with `unitId`, `gtin`, and `sizeInBaseUnits`.
- `synkkaData.unitConversions[]`, which can contain net/gross weight and volume.

There is no top-level `packSize` field in the downloaded catalog.
For litre needs, the safe conversion path is one `units[]` entry matching
`salesUnit` plus one `synkkaData.unitConversions[]` volume in `LTR`. The sales
quantity is rounded up to a whole unit. Product `463038` has no verified litre
volume in its conversion data and must be excluded as `UNIT_UNCONVERTIBLE`; the
other inspected milk candidates have an unambiguous volume path.

## Allergens, lactose, labels, and certificates

`synkkaData.classifications[]` contains these verified classification names:

- `allergen`, with values such as `id: AE` and `unit: CONTAINS`.
- `nonAllergen`, with values such as `unit: FREE_FROM`.
- `packagingMarkedLabel`, including values such as `GOODS_FROM_FINLAND_BLUE_SWAN`.
- `nutritionalClaim`, including `FREE_FROM_LACTOSE` and `LOW_LACTOSE`.

No separate `certificate` classification was found in the inspected catalog. Some
certification-like values exist under `packagingMarkedLabel`, including
`EU_ECO_LABEL`, `RAINFOREST_ALLIANCE`, and `UTZ_CERTIFIED`; the gateway must preserve
the source classification rather than treating every label as a certificate.

Allergen values use source codes and a `unit` such as `CONTAINS`, `MAY_CONTAIN`, or
`UNDECLARED`. The code `AP` is verified as peanut: product `460428` is named
“Taffel Pähkinä salted peanuts 300g” and has `AP: CONTAINS`. The policy maps the
mandate value `peanut` to `AP`; any other unmapped human allergen name is treated as
unknown and produces `RED` rather than being guessed.

## Price response

`POST /api/price` returns a customer-scoped object with `customerId`, `currency`,
`pricingDate`, and `products[]`. Each product includes `productId`, `quantity`,
`catalogPrice`, `priceWithTax`, `comparisonPrice`, `comparisonUnit`, `tax`,
`listPrice`, `netPriceFound`, and `error`.

Price values are decimal euros in the upstream response and include `validFrom`,
`validTo`, and `currency`. Gateway code must convert money to integer cents and must
not expose `listPrice` as a margin or purchase-price field.

## Availability response

`POST /api/availability` returns `timeNow`, `requestedDate`, and `products[]`. Each
product includes `productId`, `closingTime`, `salesBlock`, `logisticModel`, and
`scheduleLines[]`.

Each schedule line contains `salesBlock`, `availableAmount`, `availableDate`, and
`salesUnit`. Availability amounts are expressed in the returned sales unit.

## Level 1 candidates

The catalog contains real lactose-free milk products in category `10400`, including:

| Product | Supplier | Sales/base unit |
|---|---|---|
| `463038` Valio Eila semi skimmed milk drink 10 l novobox lactose free | VALIO OY TUORE | `KI` / `ST` |
| `463335` Valio Eila 3% milk drink 1 l lactose free | VALIO OY TUORE | `ST` / `ST` |
| `464073` Valio whole milk 1 l lactose free UHT | VALIO OY TUORE | `ST` / `ST` |
| `462775` Arla Milkdrink 1L lactose free fat free UHT Suomesta | ARLA OY | `ST` / `ST` |
| `464179` Arla 10 L Novobox semi skimmed lactose free milk drink | ARLA OY | `ST` / `ST` |

The sample availability request for 2026-11-16 returned all five products as
available and not sales-blocked. It did not produce the Level 1 partial-availability
twist, so that twist will require a scenario overlay or a later requested date.

For the peanut exclusion used by the Allergy level, one of the five Level 1 milk
candidates (`464179`) has `AP: FREE_FROM`; the other four have neither `AP` in
`allergen` nor `nonAllergen` and therefore produce `RED` as missing data. Across all
91 non-deleted products in category `10400`, 15 have `AP: FREE_FROM`, none list `AP`
as a risk, and 76 have no `AP` classification. The demo must use the verified
`464179` product as its safe candidate rather than treating missing data as safe.

## Replay fixtures

Small live price and availability responses are stored in
`backend/fixtures/valio/`. The complete downloaded files remain under `data/valio/`,
which is gitignored because of size and environment-specific data.

## Policy decisions

- Spending limits use the tax-inclusive total the kitchen pays.
- The per-order limit applies to the complete plan total, not individual lines.
- `same_category` substitution requires an exact match on the catalog `category` field.
- `PENDING_APPROVAL`, `ORDERED`, and `CONFIRMED` totals are reserved against the weekly
  limit. `REJECTED` and `EXPIRED` orders are not counted.
- Allergen exclusions use verified catalog classification codes. A missing, empty, or
  unmapped allergen classification is treated as unknown and produces `RED` when the
  mandate excludes allergens.
- A product with missing or unverified required-label data produces `RED`.
- A late delivery within the mandate's `one_day` tolerance is allowed; later delivery
  produces `YELLOW`.
- An alternative approval is accepted only when its re-check has the same reason set
  shown on the original approval. A new or different `YELLOW` reason is refused and
  the approval remains `OPEN`, because the human has not approved that new condition.
- Approval heart accounting is a no-op until game sessions exist; the approval
  interface already carries `heartsLeft` and supports `ATTENTION_EXHAUSTED`.

## Live events

`GET /v1/events` accepts the contract's `sessionId` query parameter for forward
compatibility, but currently scopes replay and live delivery by the authenticated
customer because game sessions are not implemented yet. Clients should send
`since` or use the `Last-Event-ID` header when reconnecting; the latter replays
only events with a newer log sequence.
