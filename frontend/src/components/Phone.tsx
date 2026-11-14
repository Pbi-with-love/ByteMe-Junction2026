import { useEffect, useRef } from 'react';
import type { Approval, ApprovalDecision, AgentStep } from '../api/schemas';
import type { GatewayClient } from '../api/gateway';
import ApprovalCard from './ApprovalCard';

export type PhoneProps={client:GatewayClient;approval:Approval|null;step:AgentStep|null;hidden:boolean;onHide():void;onSettled(value:Approval|ApprovalDecision):void};
export default function Phone({client,approval,step,hidden,onHide,onSettled}:PhoneProps){
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(hidden)return;root.current?.querySelector<HTMLElement>('#approval-reason-heading')?.focus();const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();onHide();}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[hidden,onHide]);
 return <div className="phone-frame" hidden={hidden} ref={root}><div className="phone-hardware" aria-hidden="true"><span/><i/></div><div className="phone-screen"><header className="phone-status"><strong><svg aria-hidden="true" className="phone-handset" viewBox="0 0 8 8"><path d="M1 1h2v2H2v2h1v2H1V6H0V2h1zm4 0h2v1h1v4H7v1H5V5h1V3H5z" fill="currentColor"/></svg> Approvals</strong><button type="button" className="button button-ghost" aria-label="Hide phone" onClick={onHide}>Hide</button></header>{approval&&step&&<ApprovalCard client={client} approval={approval} step={step} onSettled={onSettled}/>}</div></div>;
}
