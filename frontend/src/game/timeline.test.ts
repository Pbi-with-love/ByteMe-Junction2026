import { describe, expect, it } from 'vitest';
import { toTimelineEntries, nonValioBrands } from './timeline';
import level1 from '../../mocks/level1.json';
import level2 from '../../mocks/level2.json';
import level3 from '../../mocks/level3.json';
import type { LevelMock } from '../api/schemas';
import type { DirectorStep } from '../world/director';
describe('timeline projection', () => {
  it('projects each mocked gateway step to three entries in beat order', () => {
    for (const data of [level1, level2, level3] as LevelMock[]) for (const preset of Object.values(data.presets)) preset.steps.forEach((step, i) => {
      const entries = toTimelineEntries(step, i);
      expect(entries.map(e => e.kind)).toEqual(['search', 'quote', 'order']);
      expect(entries.map(e => e.id)).toEqual([`${i}-search`, `${i}-quote`, `${i}-order`]);
      expect(entries[0]?.title).toContain(`${step.search.total} products`);
    });
  });
  it('finds distinct recommended plan brands other than Valio', () => {
    const step = (level1 as LevelMock).presets.balanced!.steps[0]!;
    expect(nonValioBrands(step.quote, step.search)).toEqual([]);
    const plan = step.quote.plans.find(p => p.recommended) ?? step.quote.plans[0]!;
    const fixture = structuredClone(step);
    const productId = plan.lines[0]!.productId;
    (fixture.search.results.find(p => p.productId === productId) as { productId: string; brand?: string }).brand = 'Arla';
    expect(nonValioBrands(fixture.quote, fixture.search)).toEqual(['Arla']);
  });
  it('uses gateway status and timestamps for order entries', () => {
    for (const data of [level1, level2, level3] as LevelMock[]) for (const preset of Object.values(data.presets)) for (const step of preset.steps) {
      const order = toTimelineEntries(step, 0)[2]!;
      if (step.order.httpStatus === 201) {
        const body = step.order.body;
        expect(order.status).toBe('ORDERED'); expect(order.at).toBe(body.createdAt);
        expect(order.light).toBe(step.quote.plans.find(p => p.planId === body.planId)?.policy.light);
      } else if (step.order.httpStatus === 202) {
        expect(order.status).toBe('PENDING_APPROVAL'); expect(order.light).toBe('YELLOW');
        expect(order.at).toBe(step.approval?.createdAt ?? step.quote.createdAt);
      }
    }
  });
  it.each([
    [403, 'POLICY_BLOCKED', 'Chosen plan is blocked by the mandate.', 'BLOCKED', 'RED'],
    [409, 'QUOTE_EXPIRED', 'Quote expired before the order was placed.', 'ERROR', null],
  ] as const)('maps %s error orders to the matching log state', (httpStatus, code, message, status, light) => {
    const base = (level1 as LevelMock).presets.balanced!.steps[0]!;
    const fixture = structuredClone(base) as unknown as DirectorStep;
    fixture.order = { httpStatus, body: { error: { code, message, requestId: 'req_fixture' } } } as never;
    const order = toTimelineEntries(fixture, 3)[2]!;
    expect(order.status).toBe(status);
    expect(order.light).toBe(light);
    expect(order.at).toBe(base.quote.createdAt);
    expect(order.title).toContain(message);
  });
});
