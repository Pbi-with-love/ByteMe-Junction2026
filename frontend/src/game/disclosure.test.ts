import { describe, expect, it } from 'vitest';
import level1 from '../../mocks/level1.json';
import { LevelMockSchema } from '../api/schemas';
import { optionDisclosure } from './disclosure';

describe('optionDisclosure', () => {
 it('shows gateway plan lines arriving after the Helsinki deadline and option allergens', () => {
  const mock=LevelMockSchema.parse(level1);
  const step = Object.values(mock.presets).flatMap(p => p.steps).find(s => s.approval?.status === 'OPEN' && s.quote.plans.some(p => p.lines.some(l => l.availableDate > s.quote.need.deadline.slice(0, 10))))!;
  const latePlan = step.quote.plans.find(p => p.lines.some(l => l.availableDate > step.quote.need.deadline.slice(0, 10)))!;
  expect(optionDisclosure(latePlan.planId, step).lateLines.length).toBeGreaterThan(0);
  expect(optionDisclosure(latePlan.planId, step).allergens).toEqual(expect.any(Array));
 });
});
