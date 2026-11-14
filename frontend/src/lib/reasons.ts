import type { ReasonCode } from '../api/schemas';

export const REASON_TEXT: Record<ReasonCode, string> = {
  WITHIN_MANDATE: 'Within your mandate.',
  SPLIT_ORDER: 'Split across products or delivery dates.',
  SUBSTITUTION_ALLOWED: 'Uses a substitute your mandate allows.',
  OVER_ORDER_LIMIT: 'Total is above your per-order limit.',
  OVER_WEEK_LIMIT: 'Week total is above your weekly limit.',
  SUBSTITUTION_NOT_ALLOWED: 'Uses a substitute your mandate doesn’t allow.',
  LATE_DELIVERY: 'Some quantity arrives after the deadline.',
  SALES_BLOCKED: 'Product is blocked from sale.',
  ALLERGEN_EXCLUDED: 'Contains an allergen your mandate excludes.',
  LABEL_REQUIRED: 'Lacks a label your mandate requires.',
  MANDATE_INVALID: 'Mandate is missing, unsigned or revoked.',
  MANDATE_EXPIRED: 'Mandate has expired.',
  DATA_BOUNDARY: 'Outside this customer’s data.',
  ATTENTION_EXHAUSTED: 'No hearts left: the manager was too busy to answer.',
  PRICE_UNAVAILABLE: 'No price available for this customer.',
};
