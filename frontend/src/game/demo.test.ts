import { describe, expect, it } from 'vitest';
import level1 from '../../mocks/level1.json';
import { LEVELS } from './levels';
import { DEMO } from './demo';

describe('demo script', () => {
  it('uses the Level 1 Balanced recorded path', () => {
    expect(DEMO.levelId).toBe(LEVELS[0].levelId);
    expect(DEMO.presetKey).toBe('balanced');
    expect(DEMO.presetKey in level1.compare.presets).toBe(true);
    const presets = level1.presets as Record<string, { demoPath: Record<string, string> }>;
    expect(DEMO.decisions).toEqual(Object.values(presets[DEMO.presetKey].demoPath));
    expect(DEMO.decisions.every((decision) => decision === 'approved' || decision === 'rejected')).toBe(true);
  });
});
