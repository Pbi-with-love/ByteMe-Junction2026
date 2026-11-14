import level1 from '../../mocks/level1.json';
import { LEVELS } from './levels';

export type DemoDecision = 'approved' | 'rejected';
export type DemoScript = { levelId: string; presetKey: string; decisions: DemoDecision[] };
const presetKey = 'balanced';
export const DEMO: DemoScript = {
  levelId: LEVELS[0].levelId,
  presetKey,
  decisions: Object.keys(level1.presets[presetKey].demoPath).map((id) => (level1.presets[presetKey].demoPath as Record<string, string>)[id]).filter((decision): decision is DemoDecision => decision === 'approved' || decision === 'rejected'),
};
export const DEMO_BEAT_MS = 250;
export const DEMO_RESULT_HOLD_MS = 1000;
export const DEMO_WAIT_MS = 60_000;
