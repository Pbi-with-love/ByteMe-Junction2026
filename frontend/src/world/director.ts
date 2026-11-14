import type { AgentStep, ErrorEnvelope } from '../api/schemas';
import type { StationId } from './map';
import type { RobotState } from './robot';
import { formatMoney } from '../lib/format';
export type WorldCommand =
 | {kind:'walk';to:StationId}|{kind:'state';state:RobotState}|{kind:'carry';on:boolean}|{kind:'say';text:string|null}
 | {kind:'burst';burst:'stamp'|'delivered'}|{kind:'hold';ms:number}|{kind:'mark';entry:'search'|'quote'|'order'}|{kind:'awaitApproval'};
export type DirectorStep=Omit<AgentStep,'order'>&{order:AgentStep['order']|{httpStatus:number;body:ErrorEnvelope}};
export const BEAT_MS=1000;
export const FINISH_COMMANDS:WorldCommand[]=[{kind:'walk',to:'terminal'},{kind:'state',state:'idle'},{kind:'say',text:null}];
const hold=():WorldCommand=>({kind:'hold',ms:BEAT_MS});
export function directStep(step:DirectorStep):WorldCommand[]{
 const commands:WorldCommand[]=[{kind:'walk',to:'storage'},{kind:'state',state:'working'},{kind:'mark',entry:'search'},{kind:'say',text:`Checked ${step.search.total} products`},hold()];
 const blocked=step.search.results.filter(r=>r.excluded?.light==='RED');
 if(blocked.length){commands.push({kind:'state',state:'RED'},{kind:'say',text:'The gateway blocked products that do not meet the mandate.'},hold());}
 const rec=step.quote.plans.find(p=>p.recommended)??step.quote.plans[0];
 commands.push({kind:'walk',to:'terminal'},{kind:'state',state:'working'},{kind:'mark',entry:'quote'});
 if(rec)commands.push({kind:'say',text:`Valio quoted ${formatMoney(rec.total)}.`},{kind:'state',state:rec.policy.light});
 commands.push(hold());
 const order=step.order;
 if(order.httpStatus===201){const b=order.body as Extract<AgentStep['order'],{httpStatus:201}>['body'];const plan=step.quote.plans.find(p=>p.planId===b.planId);commands.push({kind:'carry',on:true},{kind:'walk',to:'delivery'},{kind:'mark',entry:'order'});if(plan)commands.push({kind:'state',state:plan.policy.light});commands.push({kind:'say',text:'Ordered!'},{kind:'burst',burst:'delivered'},hold(),{kind:'carry',on:false});}
 else if(order.httpStatus===202){commands.push({kind:'walk',to:'phone'},{kind:'mark',entry:'order'},{kind:'state',state:'YELLOW'},{kind:'say',text:step.approval?.reasonText||'Waiting for your approval.'},{kind:'awaitApproval'});}
 else if(order.httpStatus===403){commands.push({kind:'mark',entry:'order'},{kind:'state',state:'RED'},{kind:'say',text:order.body.error.message},hold());}
 else {const err=order.body as ErrorEnvelope;commands.push({kind:'mark',entry:'order'},{kind:'state',state:'idle'},{kind:'say',text:err.error.message},hold());}
 return commands;
}

export function directDecision(settled: { status: string; orderStatus?: string }): WorldCommand[] {
 if (settled.orderStatus === 'ORDERED' || settled.orderStatus === 'CONFIRMED') return [
  {kind:'carry',on:true},{kind:'walk',to:'delivery'},{kind:'state',state:'idle'},
  {kind:'say',text:'Ordered!'},{kind:'burst',burst:'delivered'},hold(),{kind:'carry',on:false},
 ];
 return [{kind:'state',state:'idle'},{kind:'say',text:settled.status==='APPROVED'?'Approved!':settled.status==='EXPIRED'?'Approval expired.':'Approval declined.'},hold()];
}
