import { describe, expect, it } from 'vitest';
import {
  DiscoverySchema,
  LevelMockSchema,
  LightSchema,
  MoneySchema,
  PlanSchema,
  QuoteSchema,
  ReasonCodeSchema,
} from './schemas';

const mocks = import.meta.glob('../../mocks/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

describe('gateway schemas', () => {
  it('parses every bundled mock', () => {
    for (const [path, value] of Object.entries(mocks)) {
      if (path.endsWith('discovery.json')) {
        expect(DiscoverySchema.parse((value as { response: unknown }).response)).toBeTruthy();
      } else {
        expect(LevelMockSchema.parse(value)).toBeTruthy();
      }
    }
  });

  it('rejects invalid primitive values', () => {
    expect(LightSchema.safeParse('PURPLE').success).toBe(false);
    expect(MoneySchema.safeParse({ cents: 12.5, currency: 'EUR' }).success).toBe(false);
    expect(MoneySchema.safeParse({ cents: 12, currency: 'USD' }).success).toBe(false);
    expect(ReasonCodeSchema.safeParse('UNKNOWN_REASON').success).toBe(false);
  });

  it('rejects invalid plan lights and quotes without quoteId', () => {
    const invalidPlan = {
      planId: 'p',
      lines: [],
      total: { cents: 0, currency: 'EUR' },
      onTime: { amount: 0, unit: 'l' },
      policy: { light: 'PURPLE', reasons: [] },
    };
    expect(PlanSchema.safeParse(invalidPlan).success).toBe(false);
    expect(QuoteSchema.safeParse({ status: 'QUOTED', plans: [] }).success).toBe(false);
  });
});
