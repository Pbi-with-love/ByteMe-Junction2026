# Valio upstream data notes

Status: **verified from Valio responses and downloads on 2026-11-14**. The probe's negotiated
header was `X-API-Key`; the key itself is stored only in root `.env` and is never recorded here.
The three full files are kept in gitignored `data/valio/`. The committed catalog contains only
rows referenced by the Level 1–3 scenarios.

## Downloaded files and verified keys

| Dataset | Format and rows | File keys / columns | Keying |
|---|---|---|---|
| Products | JSON array, 17,546 rows | `id`, `salesUnitGtin`, `salesUnit`, `baseUnit`, `category`, `allowedLotSize`, `deleted`, `temperatureCondition`, `vendorName`, `countryOfOrigin`, `synkkaData`, `units`, `deposits`, `substitutions` | `id` is the product identifier |
| Delivery reliability | CSV, 4,425 rows | `productId`, `deliveryReliability` | `productId` |
| Carbon footprint | CSV, 11,033 rows | `productId`, `AVG kg CO2-eq/kg` | `productId` |

The reliability and carbon files do not key on supplier or category. A missing row means the
upstream file did not provide a value for that product. The catalog's `synkkaData` object has
these keys: `gtin`, `lastUpdated`, `mediasLastUpdated`, `countriesOfOrigin`, `names`,
`materialAdditionalDescriptions`, `marketingTexts`, `keyIngredients`, `storageInstructions`,
`preparationInstructions`, `disposalInformations`, `usageInstructions`, `classifications`,
`nutritionalContent`, `unitConversions`, `producers`, `medias`, `minTemperature`,
`maxTemperature`, `variableUnit`, `vatCode`, `brand`, `ingredients`, `fishingReports`, and
`safetyData`. Not every product populates every optional key. Each `unitConversions[]` row has
`synkkaPackagingType` and may have `width`, `length`, `height`, `volume`, `netWeight`, and
`grossWeight`; measurements use nested `{unit, value}` objects. Classification rows use
`type`, `name`, and `values`; values use `id`, `unit`, `value`, and/or `synkkaId`.

## Product attributes and units

The English display name is `synkkaData.names[]` where `language` is `en`. `vendorName` gives
the supplier and `category` is the source's category code. The product's `salesUnit` is the
unit charged and returned in availability. `baseUnit` identifies the each/base product unit;
`units[]` maps `unitId` to `sizeInBaseUnits` (and often a GTIN). For example, product `464306`
has `salesUnit: ST`, `baseUnit: ST`, a one-base-unit `ST` each, plus 20 eaches in a `KI` case.
Its `synkkaData.unitConversions[]` says that each base item has `volume: {unit: LTR, value: 1}`
and `netWeight: {unit: GRM, value: 1025}`. Product `462635` has a 5 L each with 3,000 g net
weight; `473623` has a 2.5 L each with 1,950 g net weight.

Use `units[]` to understand case/each pack relationships and use a conversion matching the
requested measurement from `synkkaData.unitConversions[]` to convert the base item: `volume`
with `unit: LTR` for litres, `netWeight` with `unit: GRM` divided by 1,000 for kg, and the
base each (`baseUnit`/matching `units[]` entry) for piece counts when the catalog identifies
one each. Availability `availableAmount` and price `quantity` are in the returned/requested
sales unit, so multiply by `sizeInBaseUnits` before interpreting a case quantity. These paths
must be present and unambiguous; do not infer a pack amount from the display name.

## Allergens, labels, and certificates

Allergen classes live at `synkkaData.classifications[]` with `name: allergen`; values use an
allergen code such as `AE` and a `unit` such as `CONTAINS`, `MAY_CONTAIN`, or `UNDECLARED`.
`nonAllergen` values under the same classifications array carry `unit: FREE_FROM`. A
`MAY_CONTAIN` value is a risk just like `CONTAINS`; absence of a code is not a verified
free-from claim. Product labels live under `name: packagingMarkedLabel`; nutrition or dietary
claims such as `FREE_FROM_LACTOSE` live under `name: nutritionalClaim`. The downloaded catalog
has no separate `certificate` classification. Some packaging label values are certification-like
(for example `EU_ECO_LABEL`, `RAINFOREST_ALLIANCE`, and `UTZ_CERTIFIED`), but remain source labels
and are not relabeled as certificates.

## Scenario customers, prices, and timestamps

The all-catalog price scan on 2026-11-19 for customer `123` returned 231 products with
`netPriceFound: true` and `error: false` out of 17,546 products; 17,315 had no net price and one
row had an error. Customer `123` returns verified net prices for every selected scenario
product/date, and all committed scenario price rows are checked for both `netPriceFound: true`
and `error: false`. A small earlier probe of customers `123`, `456`, and `789` with products
`464201`, `464398`, `463038`, and `463989` found a net price only for `464398` for each of those
customers; scenario rows therefore use customer `123`, which has the required coverage. The
chosen price values (`catalogPrice.value` and `priceWithTax.value`) plus comparison values are:

| Level | Product | `catalogPrice.value` | `priceWithTax.value` | `comparisonPrice.valueWithTax` | Basis |
|---|---|---:|---:|---:|---|
| 1 and 2 | `464306` Valio Hyvä suomalainen Arki® Eila® semi-skimmed milk drink, 1 l lactose-free | €1.01 | €1.15 | €1.15 | per L |
| 1 and 2 | `464401` Valio Hyvä suomalainen Arki® Eila® skimmed milk drink, 1 l lactose-free | €1.10 | €1.25 | €1.25 | per L |
| 1 | `463335` Valio Eila® 3% milk drink, 1 l lactose-free | €1.40 | €1.59 | €1.59 | per L |
| 3 | `468855` GelatoLAB-Espoo 5 L Pistachio lactose-free ice cream | €36.21 | €41.10 | €8.22 | per L |
| 3 | `462635` GelatoLAB-Espoo 5 L Cookies Cream ice cream | €28.29 | €32.11 | €6.42 | per L |
| 3 | `473726` GelatoLAB-Espoo 2.5 L Pistachio lactose-free ice cream | €18.58 | €21.09 | €8.43 | per L |

The response includes both pre-tax/catalog values and customer `priceWithTax`; the existing
scenario convention and game budget use the tax-inclusive `priceWithTax` amount. Prices are
never overlaid. Requested and upstream timestamps use ISO 8601 offsets without a colon in
Valio's raw responses, for example `2026-11-19T00:00:00+0200` and
`2026-11-14T11:26:56+0200`.

## Scenario products and twists

| Level | Primary, substitutes, and trap | Verified reason and overlay |
|---|---|---|
| 1 | Primary `464306`; substitutes `464401`, `463335` | All are category `10400` and have `FREE_FROM_LACTOSE`. Both substitutes have at least 300 L recorded on-time schedule capacity. The primary is €1.15/L: buying 1,000 L with 300 L arriving Tuesday costs €1,150, while 700 L primary plus the cheapest 300 L substitute on Monday costs €1,180. The availability overlay sets Monday stock to 700 L and adds the 300 L Tuesday line. |
| 2 | Primary `464306`; substitute `464401` on Wednesday and Friday | Both products are category `10400` and lactose-free. On each need date, the availability overlay blocks the primary and supplies 120 L of the substitute on time. Recorded price rows are unchanged. |
| 3 | Usual primary `468855`; AE trap `462635`; safe option `473726` | Category `41820` has verified allergen rows for all three. `462635` contains `AE` and has the lowest selected-candidate comparison price (€6.42/L); `473726` has no AE risk, costs €8.43/L, and shares the primary's category and `FREE_FROM_GLUTEN` / `FREE_FROM_LACTOSE` claims. The usual product is verified AE-free but is sales-blocked by the availability overlay. The need is 20 L of school-kitchen pistachio ice cream; the safe product's 2.5 L each and the trap's 5 L each cover that quantity. |

Scenario recordings are raw `/api/price` and `/api/availability` response objects grouped by
customer and `requestedDate` in `backend/fixtures/valio/recorded/`. Their product values are not
rewritten. Only the scenario overlay changes `salesBlock`, `scheduleLines`, or `closingTime` in
availability; those overlay values are explicit scenario data, not upstream claims.
