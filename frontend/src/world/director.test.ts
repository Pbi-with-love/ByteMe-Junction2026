import { describe, expect, it } from 'vitest';
import level1 from '../../mocks/level1.json';
import level2 from '../../mocks/level2.json';
import level3 from '../../mocks/level3.json';
import { BEAT_MS, directDecision, directStep, FINISH_COMMANDS } from './director';
import type { AgentStep } from '../api/schemas';

describe('step director',()=>{
 it('covers every recorded mock step with ordered marks and truthful speech',()=>{
  for(const mock of [level1,level2,level3]) for(const preset of Object.values(mock.presets)) for(const step of preset.steps){
   const commands=directStep(step as AgentStep);expect(commands[0]).toEqual({kind:'walk',to:'storage'});
   expect(commands.filter(c=>c.kind==='mark').map(c=>c.kind==='mark'?c.entry:null)).toEqual(['search','quote','order']);
   for(const c of commands)if(c.kind==='say'){expect(c.text?.trim()).toBeTruthy();expect(c.text).not.toMatch(/\b(?:PENDING_APPROVAL|ORDERED|CONFIRMED|OPEN|APPROVED|REJECTED|EXPIRED)\b|\b(?:ord|apr|qt)_[\w-]+/);}
   if(step.order.httpStatus===202)expect(commands.at(-1)).toEqual({kind:'awaitApproval'});
   if(step.order.httpStatus===201)expect(commands.at(-1)).toEqual({kind:'carry',on:false});
  }
 });
 it('includes the gateway RED state for level 3 search exclusions',()=>{const steps=Object.values(level3.presets as Record<string,{steps:AgentStep[]}>).flatMap(p=>p.steps);const red=steps.filter(step=>step.search.results.some(row=>row.excluded?.light==='RED'));expect(red.length).toBeGreaterThan(0);for(const step of red)expect(directStep(step).some(c=>c.kind==='state'&&c.state==='RED')).toBe(true);});
 it('handles gateway 403 and other error envelopes',()=>{const original=Object.values(level1.presets)[0]!.steps[0]!;const step=original as unknown as AgentStep;const error=(httpStatus:number,code:string,message:string)=>({...step,order:{httpStatus,body:{error:{code,message}}}});const forbidden=directStep(error(403,'POLICY_BLOCKED','Blocked'));expect(forbidden.slice(-4)).toEqual([{kind:'mark',entry:'order'},{kind:'state',state:'RED'},{kind:'say',text:'Blocked'},{kind:'hold',ms:1000}]);const expired=directStep(error(409,'QUOTE_EXPIRED','Expired'));expect(expired.slice(-4)).toEqual([{kind:'mark',entry:'order'},{kind:'state',state:'idle'},{kind:'say',text:'Expired'},{kind:'hold',ms:1000}]);});
 it('emits the fixed finish sequence',()=>expect(FINISH_COMMANDS.map(c=>c.kind)).toEqual(['walk','state','say']));
 it('routes confirmed approvals to delivery and closed approvals to idle',()=>{
  expect(directDecision({status:'APPROVED',orderStatus:'CONFIRMED'})).toEqual([{kind:'carry',on:true},{kind:'walk',to:'delivery'},{kind:'state',state:'idle'},{kind:'say',text:'Ordered!'},{kind:'burst',burst:'delivered'},{kind:'hold',ms:BEAT_MS},{kind:'carry',on:false}]);
  expect(directDecision({status:'REJECTED',orderStatus:'REJECTED'})).toEqual([{kind:'state',state:'idle'},{kind:'say',text:'Approval declined.'},{kind:'hold',ms:BEAT_MS}]);
 });
 it('speaks plainly while an approval is pending, without exposing identifiers or codes',()=>{
  const step=Object.values(level1.presets)[0]!.steps.find(candidate=>candidate.order.httpStatus===202)!;
  const say=directStep(step as unknown as AgentStep).filter(command=>command.kind==='say').map(command=>command.kind==='say'?command.text:'');
  expect(say.at(-1)).not.toMatch(/\b(?:PENDING_APPROVAL|OPEN)\b|\b(?:ord|apr|qt)_[\w-]+/i);
  const withoutReason=directStep({...step,approval:{...step.approval!,reasonText:''}} as unknown as AgentStep).filter(command=>command.kind==='say').map(command=>command.kind==='say'?command.text:'');
  expect(withoutReason.at(-1)).toBe('Waiting for your approval.');
 });
});
