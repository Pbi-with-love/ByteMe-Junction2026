import { z } from 'zod';

const text = z.string();
const dateTime = z.string().datetime({ offset: true });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalText = text.optional();

export const MoneySchema = z.object({ cents: z.number().int(), currency: z.literal('EUR') });
export type Money = z.infer<typeof MoneySchema>;
export const ComparisonPriceSchema = MoneySchema.extend({ per: text });
export type ComparisonPrice = z.infer<typeof ComparisonPriceSchema>;
export const QuantitySchema = z.object({ amount: z.number(), unit: text });
export type Quantity = z.infer<typeof QuantitySchema>;
export const LightSchema = z.enum(['GREEN', 'BLUE', 'YELLOW', 'RED']);
export type Light = z.infer<typeof LightSchema>;
export const ReasonCodeSchema = z.enum([
  'WITHIN_MANDATE', 'SPLIT_ORDER', 'SUBSTITUTION_ALLOWED', 'OVER_ORDER_LIMIT', 'OVER_WEEK_LIMIT',
  'SUBSTITUTION_NOT_ALLOWED', 'LATE_DELIVERY', 'SALES_BLOCKED', 'ALLERGEN_EXCLUDED', 'LABEL_REQUIRED',
  'MANDATE_INVALID', 'MANDATE_EXPIRED', 'DATA_BOUNDARY', 'ATTENTION_EXHAUSTED', 'PRICE_UNAVAILABLE',
]);
export type ReasonCode = z.infer<typeof ReasonCodeSchema>;

const SignatureSchema = z.object({ alg: text, keyId: text, value: text });
export const MandateSchema = z.object({
  mandateId: text, customerId: text, agentId: text,
  issuedBy: z.object({ name: text, role: text }),
  limits: z.object({ perOrderEur: z.number(), perWeekEur: z.number() }),
  substitution: text, lateDelivery: text,
  hardConstraints: z.object({ excludeAllergens: z.array(text), requireLabels: z.array(text) }),
  priorities: z.array(text), validUntil: dateTime, issuedAt: dateTime,
  status: z.enum(['ACTIVE', 'REVOKED', 'EXPIRED']), signature: SignatureSchema, summaryText: text,
});
export type Mandate = z.infer<typeof MandateSchema>;

const ExclusionSchema = z.object({ light: LightSchema, reason: ReasonCodeSchema });
const SearchProductSchema = z.object({
  productId: text, name: text.optional(), brand: text.optional(), category: text.optional(), salesUnit: text.optional(),
  packSize: QuantitySchema.optional(), labels: z.array(text).optional(), allergens: z.array(text).optional(),
  carbonCategory: z.object({ category: text, kgCo2ePerKg: z.object({ min: z.number(), max: z.number() }) }).optional(),
  deliveryReliability: z.number().nullable().optional(), excluded: ExclusionSchema.nullable(),
});
const MinimalSearchResultSchema = z.object({ productId: text, excluded: ExclusionSchema.nullable().optional() });
export const SearchResponseSchema = z.object({ results: z.array(z.union([SearchProductSchema, MinimalSearchResultSchema])), total: z.number().int() });
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
export const NeedSchema = z.object({ description: text, quantity: QuantitySchema, deadline: dateTime, candidateProductIds: z.array(text).optional() });
export type Need = z.infer<typeof NeedSchema>;
export const PlanLineSchema = z.object({
  productId: text, quantity: QuantitySchema, salesQuantity: QuantitySchema.optional(), unitPrice: MoneySchema,
  comparisonPrice: ComparisonPriceSchema.optional(), lineTotal: MoneySchema, availableDate: date, isSubstitute: z.boolean(),
});
export type PlanLine = z.infer<typeof PlanLineSchema>;
const ScoreSchema = z.object({ total: z.number(), onTime: z.number(), price: z.number(), sustainability: z.number(), reliabilityPenalty: z.number() });
export const PlanSchema = z.object({
  planId: text, tier: z.enum(['best', 'better', 'good']).optional(), recommended: z.boolean().optional(),
  lines: z.array(PlanLineSchema), total: MoneySchema, onTime: QuantitySchema,
  score: ScoreSchema.optional(), policy: z.object({ light: LightSchema, reasons: z.array(ReasonCodeSchema) }), summary: optionalText,
});
export type Plan = z.infer<typeof PlanSchema>;
export const QuoteSchema = z.object({
  quoteId: text, customerId: text, mandateId: text, status: text, createdAt: dateTime, expiresAt: dateTime,
  need: NeedSchema, plans: z.array(PlanSchema),
  excludedProducts: z.array(z.object({ productId: text, light: LightSchema, reason: ReasonCodeSchema })).optional(),
  evidence: z.array(z.object({ source: text, requestId: text, at: dateTime })).optional(), scenarioOverlay: z.boolean().optional(),
  signature: SignatureSchema.optional(),
});
export type Quote = z.infer<typeof QuoteSchema>;
export const OrderSchema = z.object({
  orderId: text, quoteId: text, planId: text, status: z.enum(['ORDERED', 'CONFIRMED']),
  lines: z.array(PlanLineSchema), total: MoneySchema, createdAt: dateTime,
});
export type Order = z.infer<typeof OrderSchema>;
export const PendingOrderSchema = z.object({ orderId: text, status: z.literal('PENDING_APPROVAL'), approvalId: text, reasons: z.array(ReasonCodeSchema) });
export type PendingOrder = z.infer<typeof PendingOrderSchema>;
export const RecordedOrderSchema = z.discriminatedUnion('httpStatus', [
  z.object({ httpStatus: z.literal(201), body: OrderSchema }), z.object({ httpStatus: z.literal(202), body: PendingOrderSchema }),
]);
export type RecordedOrder = z.infer<typeof RecordedOrderSchema>;
export const ApprovalSchema = z.object({
  approvalId: text, orderId: text, quoteId: text, status: text, reasons: z.array(ReasonCodeSchema), reasonText: text,
  options: z.array(z.object({ planId: text, tier: optionalText, recommended: z.boolean().optional(), summary: text })),
  agentExplanation: text.optional(), deadline: dateTime, createdAt: dateTime,
});
export type Approval = z.infer<typeof ApprovalSchema>;
export const LogEventSchema = z.object({
  seq: z.number().int(), eventId: text, at: dateTime, actor: z.enum(['agent', 'human', 'gateway', 'scenario']), type: text,
  customerId: text, agentId: text, requestId: text, light: LightSchema.nullable(), reasons: z.array(ReasonCodeSchema),
  summary: text, refs: z.object({
    mandateId: text.optional(), quoteId: text.optional(), orderId: text.optional(), approvalId: text.optional(),
  }).optional(),
  prevHash: text, hash: text, disclosure: z.object({ returnedToAgent: z.array(text), withheld: z.array(text) }).optional(),
});
export type LogEvent = z.infer<typeof LogEventSchema>;
export const LevelInfoSchema = z.object({
  levelId: text, title: text, customer: z.object({ customerId: text, name: text, type: text }), brief: text,
  deadline: dateTime, closingTime: dateTime,
});
export type LevelInfo = z.infer<typeof LevelInfoSchema>;
export const DiscoverySchema = z.object({
  provider: text, protocolVersion: text, baseUrl: text, capabilities: z.array(text),
  mandate: z.object({ schemaUrl: text, substitutionLevels: z.array(text), lateDeliveryLevels: z.array(text) }),
  signing: z.object({ alg: text, keys: z.array(z.object({ keyId: text, publicKey: text })), canonicalization: text }),
  policy: z.object({ lights: z.array(LightSchema), reasonCodesUrl: text }),
  dataDisclosure: z.object({ public: z.array(text), customerScoped: z.array(text), neverExposed: z.array(text) }),
});
export type Discovery = z.infer<typeof DiscoverySchema>;
export const GameStartSchema = z.object({
  sessionId: text, level: LevelInfoSchema, clock: z.object({ start: text, end: text, realSecondsPerGameMinute: z.number() }),
  hearts: z.number().int(), tokens: z.object({ human: text, agent: text }),
});
export type GameStart = z.infer<typeof GameStartSchema>;
export const GameResultSchema = z.object({
  kitchen: z.number(), wallet: z.number(), safety: z.number(), heartsLeft: z.number(), stars: z.number(),
  incident: z.object({ type: text, productId: text.optional(), reason: text }).nullable(), receiptText: text,
  logHeadHash: text, approvalsAsked: z.number().optional(), totalCost: MoneySchema.nullable().optional(),
  heartsUsed: z.number().int().nonnegative().optional(),
});
export type GameResult = z.infer<typeof GameResultSchema>;
export const CompareSchema = z.object({
  levelId: text,
  presets: z.record(text, GameResultSchema),
});
export type Compare = z.infer<typeof CompareSchema>;
export const ErrorEnvelopeSchema = z.object({
  error: z.object({ code: text, message: text, requestId: text.optional(), details: z.unknown().optional() }),
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;
export const AgentStepSchema = z.object({
  search: SearchResponseSchema, quote: QuoteSchema, order: RecordedOrderSchema, approval: ApprovalSchema.nullable(),
  approvalEvent: z.object({ approvalId: text, deadline: dateTime, heartsLeft: z.number().int() }).optional(),
});
export type AgentStep = z.infer<typeof AgentStepSchema>;
export const LevelMockSchema = z.object({
  start: GameStartSchema,
  presets: z.record(text, z.object({
    mandate: MandateSchema, steps: z.array(AgentStepSchema), result: GameResultSchema, log: z.array(LogEventSchema).optional(),
  })),
  compare: CompareSchema,
});
export type LevelMock = z.infer<typeof LevelMockSchema>;
