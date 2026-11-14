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

## Replay fixtures

Small live price and availability responses are stored in
`backend/fixtures/valio/`. The complete downloaded files remain under `data/valio/`,
which is gitignored because of size and environment-specific data.
