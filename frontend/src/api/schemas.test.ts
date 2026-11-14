import { describe, expect, it } from 'vitest';
import {
  DiscoverySchema,
  ApprovalSchema,
  ApprovalDecisionSchema,
  AgentStepSchema,
  GameResultSchema,
  LevelMockSchema,
  LightSchema,
  MoneySchema,
  PlanSchema,
  QuoteSchema,
  ReasonCodeSchema,
  LogResponseSchema,
  LogVerifySchema,
} from './schemas';

const mocks = import.meta.glob('../../mocks/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

describe('gateway schemas', () => {
  it('validates gateway approval states and decision response fields',()=>{
    const raw=(mocks['../../mocks/level1.json'] as {presets:Record<string,{decisions:Record<string,{approved:{body:unknown}}>} >}).presets.balanced.decisions.apr_l1_balanced.approved.body;
    expect(ApprovalDecisionSchema.parse(raw)).toHaveProperty('orderStatus','CONFIRMED');
    expect(ApprovalSchema.safeParse({...raw as object,status:'CLOSED'}).success).toBe(false);
    expect(ApprovalSchema.parse(raw)).toHaveProperty('status','APPROVED');
  });
  it('validates log envelopes and both verification states', () => {
    expect(LogResponseSchema.safeParse({ events: [] }).success).toBe(true);
    expect(LogResponseSchema.safeParse({ events: 'x' }).success).toBe(false);
    expect(LogVerifySchema.safeParse({ valid: true, events: 0, headHash: 'h' }).success).toBe(true);
    expect(LogVerifySchema.safeParse({ valid: false, brokenAtSeq: 2 }).success).toBe(true);
    expect(LogVerifySchema.safeParse({ valid: false }).success).toBe(false);
  });
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

  it('parses an optional approval event on an agent step', () => {
    const level1 = mocks['../../mocks/level1.json'] as { presets: Record<string, { steps: unknown[] }> };
    const step = level1.presets.strict.steps[0] as Record<string, unknown>;
    expect(AgentStepSchema.parse(step)).toHaveProperty('approvalEvent', {
      approvalId: 'apr_l1_strict_1', deadline: '2026-11-14T10:06:20+02:00', heartsLeft: 2,
    });
    const { approvalEvent: _approvalEvent, ...withoutEvent } = step;
    expect(AgentStepSchema.parse(withoutEvent)).not.toHaveProperty('approvalEvent');
    expect(AgentStepSchema.safeParse({ ...step, approvalEvent: { approvalId: 3, deadline: 'soon', heartsLeft: '2' } }).success)
      .toBe(false);
  });

  it('parses optional result cost and non-negative hearts used', () => {
    const level1 = mocks['../../mocks/level1.json'] as { presets: Record<string, { result: Record<string, unknown> }> };
    const result = level1.presets.strict.result;
    expect(GameResultSchema.parse(result)).toMatchObject({
      totalCost: { cents: 90300, currency: 'EUR' }, heartsUsed: 3,
    });
    expect(GameResultSchema.parse({ ...result, totalCost: null, heartsUsed: 0 })).toMatchObject({
      totalCost: null, heartsUsed: 0,
    });
    expect(GameResultSchema.safeParse({ ...result, heartsUsed: -1 }).success).toBe(false);
    const { totalCost: _totalCost, heartsUsed: _heartsUsed, ...legacyResult } = result;
    expect(GameResultSchema.parse(legacyResult)).not.toHaveProperty('totalCost');
    expect(GameResultSchema.parse(legacyResult)).not.toHaveProperty('heartsUsed');
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
