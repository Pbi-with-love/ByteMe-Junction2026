import type { Approval, AgentStep } from '../api/schemas';
import type { GatewayClient } from '../api/gateway';
import type { WorldController } from './controller';
import { directDecision, directStep, FINISH_COMMANDS, type DirectorStep, type WorldCommand } from './director';
export type ApprovalHandoff=(approval:Approval,step:AgentStep)=>Promise<void>;
export async function playCommands(world:WorldController,commands:WorldCommand[],opts:{holdMs?:(ms:number)=>Promise<void>;signal?:AbortSignal}={}):Promise<void>{
 const hold=opts.holdMs??(ms=>new Promise<void>(resolve=>setTimeout(resolve,ms)));
 for(const command of commands){if(opts.signal?.aborted)return;switch(command.kind){case'walk':await world.walkTo(command.to);break;case'state':world.setRobotState(command.state);break;case'carry':world.carry(command.on);break;case'say':world.say(command.text);break;case'burst':world.burst(command.burst);break;case'hold':await hold(command.ms);break;case'mark':case'awaitApproval':break;}}
}
export async function runAgent(opts:{client:GatewayClient;sessionId:string;world:WorldController;signal:AbortSignal;onApprovalNeeded?:ApprovalHandoff;onMark?:(stepIndex:number,entry:'search'|'quote'|'order',step:AgentStep)=>void;onWaiting?:(waiting:boolean)=>void;holdMs?:(ms:number)=>Promise<void>}):Promise<'finished'|'aborted'>{
 const {client,sessionId,world,signal}=opts;const wait=opts.holdMs??(ms=>new Promise<void>(resolve=>setTimeout(resolve,ms)));
 const aborted=new Promise<'aborted'>(resolve=>{if(signal.aborted)resolve('aborted');else signal.addEventListener('abort',()=>resolve('aborted'),{once:true});});
 const check=()=>signal.aborted;
 const play=async(command:WorldCommand,step?:AgentStep,index=0)=>{
  if(command.kind==='mark'){if(step)opts.onMark?.(index,command.entry,step);return;}if(command.kind==='awaitApproval'){if(step?.approval){const handoff=opts.onApprovalNeeded??(async()=>{});await Promise.race([handoff(step.approval,step),aborted]);}return;}await playCommands(world,[command],{holdMs:wait,signal});
 };
 let index=0;
 while(!check()){
  opts.onWaiting?.(true);let result:AgentStep|null|'aborted';try{result=await Promise.race([client.nextStep(sessionId),aborted]);}finally{opts.onWaiting?.(false);}if(result==='aborted'||check())return'aborted';if(result===null)break;
  for(const command of directStep(result as DirectorStep)){if(check())return'aborted';await play(command,result,index);if(check())return'aborted';}
  index++;
 }
 if(check())return'aborted';for(const command of FINISH_COMMANDS){if(check())return'aborted';await play(command);}return check()?'aborted':'finished';
}
