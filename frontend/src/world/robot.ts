import type { Light } from '../api/schemas';
import type { Point } from './map';
export type RobotState = 'idle' | 'working' | 'waiting' | Light;
export type RobotLook = { anim: 'idle' | 'work' | 'wait' | 'blocked'; emote: 'calm' | 'info' | 'puzzled' | 'stop' | null };
export type Anim = 'idle'|'walk_down'|'walk_up'|'walk_side'|'work'|'wait'|'blocked'|'carry_idle'|'carry_walk_down'|'carry_walk_up'|'carry_walk_side'|'manager_idle'|'manager_phone'|'courier_idle'|'courier_deliver';
export const FRAMES: Record<Anim,{count:number;ms:number}> = {idle:{count:2,ms:500},walk_down:{count:4,ms:125},walk_up:{count:4,ms:125},walk_side:{count:4,ms:125},work:{count:2,ms:250},wait:{count:2,ms:500},blocked:{count:1,ms:0},carry_idle:{count:2,ms:500},carry_walk_down:{count:4,ms:125},carry_walk_up:{count:4,ms:125},carry_walk_side:{count:4,ms:125},manager_idle:{count:2,ms:500},manager_phone:{count:2,ms:250},courier_idle:{count:2,ms:500},courier_deliver:{count:2,ms:250}};
export function frameAt(anim:Anim,ms:number,reducedMotion=false):string{const f=FRAMES[anim];return `${anim}_${f.count===1||reducedMotion?0:Math.floor(ms/f.ms)%f.count}`;}
export function robotSprite({state,carry,step,ms,reducedMotion}:{state:RobotState;carry:boolean;step:{dx:number;dy:number}|null;ms:number;reducedMotion:boolean}):{frame:string;mirror:boolean;box:Point|null}{const look=robotLook(state);let anim:Anim=look.anim;if(step){anim=step.dy>0?'walk_down':step.dy<0?'walk_up':'walk_side';if(carry)anim=`carry_${anim}` as Anim;}else if(carry&&anim==='idle')anim='carry_idle';const mirror=!!step&&step.dy===0&&step.dx<0;const box:Point|null=!carry?null:anim==='carry_walk_side'?{x:mirror?1:7,y:5}:{x:4,y:5};return{frame:frameAt(anim,ms,reducedMotion),mirror,box};}
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
