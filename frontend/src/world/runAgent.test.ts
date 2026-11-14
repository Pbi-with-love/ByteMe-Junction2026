import { describe, expect, it, vi } from 'vitest';
import level1 from '../../mocks/level1.json';
import { runAgent } from './runAgent';
import type { GatewayClient } from '../api/gateway';
import type { WorldController } from './controller';
import type { AgentStep } from '../api/schemas';

describe('runAgent',()=>{
 it('plays each step then the finish sequence and waits for approval',async()=>{
  const step=Object.values(level1.presets as Record<string,{steps:AgentStep[]}>).flatMap(p=>p.steps).find(s=>s.order.httpStatus===202)!;
  const nextStep=vi.fn().mockResolvedValueOnce(step).mockResolvedValueOnce(null);
  const client={nextStep} as unknown as GatewayClient;const calls:string[]=[];
  const world={walkTo:vi.fn(async(s)=>{calls.push(`walk:${s}`)}),setRobotState:vi.fn(s=>calls.push(`state:${s}`)),carry:vi.fn(v=>calls.push(`carry:${v}`)),say:vi.fn(t=>calls.push(`say:${t}`)),burst:vi.fn(k=>calls.push(`burst:${k}`))} as unknown as WorldController;
  let resolve!:()=>void;const handoff=vi.fn(()=>new Promise<void>(r=>resolve=r));const run=runAgent({client,sessionId:level1.start.sessionId,world,signal:new AbortController().signal,onApprovalNeeded:handoff,holdMs:async()=>{}});
  await vi.waitFor(()=>expect(handoff).toHaveBeenCalledOnce());expect(nextStep).toHaveBeenCalledTimes(1);resolve();expect(await run).toBe('finished');expect(nextStep).toHaveBeenCalledTimes(2);expect(world.walkTo).toHaveBeenCalled();
 });
 it('uses an immediate default approval handoff and finishes at the terminal',async()=>{const nextStep=vi.fn().mockResolvedValueOnce(null);const client={nextStep} as unknown as GatewayClient;const world={walkTo:vi.fn(async()=>{}),setRobotState:vi.fn(),carry:vi.fn(),say:vi.fn(),burst:vi.fn()} as unknown as WorldController;expect(await runAgent({client,sessionId:'s',world,signal:new AbortController().signal,holdMs:async()=>{}})).toBe('finished');expect(world.walkTo).toHaveBeenCalledWith('terminal');expect(world.setRobotState).toHaveBeenCalledWith('idle');expect(world.say).toHaveBeenCalledWith(null);});
 it('propagates the original gateway error',async()=>{const error=new Error('gateway down');const client={nextStep:vi.fn().mockRejectedValue(error)} as unknown as GatewayClient;const world={walkTo:vi.fn(),setRobotState:vi.fn(),carry:vi.fn(),say:vi.fn(),burst:vi.fn()} as unknown as WorldController;await expect(runAgent({client,sessionId:'session',world,signal:new AbortController().signal})).rejects.toBe(error);});
 it('stops after aborting a pending approval handoff',async()=>{
  const step=Object.values(level1.presets as Record<string,{steps:AgentStep[]}>).flatMap(p=>p.steps).find(s=>s.order.httpStatus===202)!;const nextStep=vi.fn().mockResolvedValue(step);const client={nextStep} as unknown as GatewayClient;
  const world={walkTo:vi.fn(async()=>{}),setRobotState:vi.fn(),carry:vi.fn(),say:vi.fn(),burst:vi.fn()} as unknown as WorldController;const abort=new AbortController();
  const run=runAgent({client,sessionId:level1.start.sessionId,world,signal:abort.signal,onApprovalNeeded:()=>new Promise<void>(()=>{}),holdMs:async()=>{}});await vi.waitFor(()=>expect(world.walkTo).toHaveBeenCalled());await vi.waitFor(()=>expect(nextStep).toHaveBeenCalled());abort.abort();expect(await run).toBe('aborted');expect(nextStep).toHaveBeenCalledTimes(1);
 });
});
