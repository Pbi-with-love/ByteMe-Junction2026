import type { Light } from '../api/schemas';
export type RobotState = 'idle' | 'working' | 'waiting' | Light;
export type RobotLook = { anim: 'idle' | 'work' | 'wait' | 'blocked'; emote: 'calm' | 'info' | 'puzzled' | 'stop' | null };
export function robotLook(state: RobotState): RobotLook {
  switch (state) {
    case 'working': return { anim: 'work', emote: null };
    case 'waiting': return { anim: 'wait', emote: null };
    case 'GREEN': return { anim: 'idle', emote: 'calm' };
    case 'BLUE': return { anim: 'idle', emote: 'info' };
    case 'YELLOW': return { anim: 'wait', emote: 'puzzled' };
    case 'RED': return { anim: 'blocked', emote: 'stop' };
    default: return { anim: 'idle', emote: null };
  }
}
export function bobOffset(ms: number, reducedMotion: boolean): number {
  return reducedMotion ? 0 : Math.floor(ms / 500) % 2 === 0 ? 0 : -1;
}
