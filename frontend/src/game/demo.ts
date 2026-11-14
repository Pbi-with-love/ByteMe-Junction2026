import level1 from '../../mocks/level1.json';
import { LEVELS } from './levels';

export type DemoDecision = 'approved' | 'rejected';
export type DemoScript = { levelId: string; presetKey: string; decisions: DemoDecision[] };
export type DemoSpeed = 'slow' | 'normal' | 'fast';
export const DEMO_SPEED_FACTORS: Record<DemoSpeed, number> = { slow: 1, normal: 0.6, fast: 0.3 };
const presetKey = 'balanced';
export const DEMO: DemoScript = {
  levelId: LEVELS[0].levelId,
  presetKey,
  decisions: Object.keys(level1.presets[presetKey].demoPath).map((id) => (level1.presets[presetKey].demoPath as Record<string, string>)[id]).filter((decision): decision is DemoDecision => decision === 'approved' || decision === 'rejected'),
};
export const DEMO_BEAT_MS = 1200;
export const DEMO_SPOTLIGHT_MS = 2000;
export const DEMO_MIN_READ_MS = 8000;
export const DEMO_WORD_MS = 600;
export const DEMO_POLL_MS = 50;
export const DEMO_PAUSE_POLL_MS = 50;
export const DEMO_APPROVAL_MARGIN_MS = 6000;
export const DEMO_AGENT_LOG_HOLD_MS = 4000;
export const DEMO_SCREEN_HOLD_MS = 3000;
export const DEMO_RESULT_HOLD_MS = DEMO_SCREEN_HOLD_MS;
export const DEMO_WAIT_MS = 60_000;
