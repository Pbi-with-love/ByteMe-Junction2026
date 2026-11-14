import { describe, expect, it } from 'vitest';
import level1 from '../../mocks/level1.json';
import level2 from '../../mocks/level2.json';
import level3 from '../../mocks/level3.json';
import type { Mandate } from './schemas';
import { allergenRuleCodes, controlsOf, limitOptions, sameControls, toDraft } from './mandate';

const all = [level1, level2, level3];

describe('mandate draft helpers', () => {
  it('extracts and compares the four controls without depending on allergen order', () => {
    const mandate = Object.values(level1.presets)[0].mandate as Mandate;
    const controls = controlsOf(mandate);
    expect(sameControls(controls, { ...controls, excludeAllergens: [...controls.excludeAllergens].reverse() })).toBe(true);
  });

  it('copies only draft base fields and applies controls', () => {
    const mandate = Object.values(level1.presets)[0].mandate as Mandate;
    const controls = controlsOf(mandate);
    const draft = toDraft(mandate, controls);
    expect(draft).toMatchObject({ agentId: mandate.agentId, issuedBy: mandate.issuedBy, limits: mandate.limits, hardConstraints: mandate.hardConstraints, priorities: mandate.priorities, validUntil: mandate.validUntil });
    for (const key of ['mandateId', 'customerId', 'issuedAt', 'status', 'signature', 'summaryText']) expect(draft).not.toHaveProperty(key);
  });

  it('derives sorted unique option sets from presets and the allowed limit choices', () => {
    const values = Object.fromEntries(all.map((mock) => [mock.start.level.levelId, Object.fromEntries(Object.entries(mock.presets).map(([key, value]) => [key, value.mandate as Mandate]))]));
    for (const mock of all) {
      const mandates = Object.values(mock.presets).map((entry) => entry.mandate as Mandate);
      expect(limitOptions(values[mock.start.level.levelId])).toEqual([...new Set([200, 500, 2000, ...mandates.map((mandate) => mandate.limits.perOrderEur)])].sort((a, b) => a - b));
      expect(allergenRuleCodes(values[mock.start.level.levelId])).toEqual([...new Set(mandates.flatMap((mandate) => mandate.hardConstraints.excludeAllergens))].sort());
    }
  });
});
