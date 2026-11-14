import { useCallback, useEffect, useRef, useState } from 'react';
import type { GatewayClient } from '../api/gateway';
import type { Approval, ApprovalDecision, Discovery, GameStart, Mandate } from '../api/schemas';
import GameWorld from '../components/GameWorld';
import PixelPanel from '../components/PixelPanel';
import AgentWorking, { type AgentActivity } from '../components/AgentWorking';
import ActivityLog from '../components/ActivityLog';
import GameClock from '../components/GameClock';
import { toTimelineEntries, type TimelineEntry } from '../game/timeline';
import { useGameClock } from '../game/useGameClock';
import { formatDateTime } from '../lib/format';
import MandateScreen from './MandateScreen';
import { runAgent } from '../world/runAgent';
import { playCommands } from '../world/runAgent';
import { directDecision } from '../world/director';
import Phone from '../components/Phone';
import HeartsMeter from '../components/HeartsMeter';
import ResultPanel from '../components/ResultPanel';
import type { GameResult } from '../api/schemas';
import type { WorldController } from '../world/controller';
import type { StationId } from '../world/map';

type Props = { client: GatewayClient; start: GameStart; presets: Record<string, Mandate>; discovery: Discovery; onExit: () => void; onPlayAgain?:()=>void; onValioView?:()=>void; onCompare?:()=>void; holdMs?:(milliseconds:number)=>Promise<void> };
export default function KitchenScreen({ client, start, presets, discovery, onExit, onPlayAgain,onValioView,onCompare,holdMs }: Props) {
  const [panel, setPanel] = useState<'closed' | 'brief' | 'mandate' | 'terminal' | 'done' | 'error' | 'phone' | 'result'>('closed');
  const [signed, setSigned] = useState<Mandate | null>(null);
  const [running, setRunning] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [activity, setActivity] = useState<AgentActivity>('idle');
  const [error, setError] = useState('');
  const [world, setWorld] = useState<WorldController | null>(null);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [activeApproval,setActiveApproval]=useState<Approval|null>(null),[approvalStep,setApprovalStep]=useState<import('../api/schemas').AgentStep|null>(null),[phoneHidden,setPhoneHidden]=useState(false),[hearts,setHearts]=useState(start.hearts);
  const settledIds=useRef(new Set<string>()),settleWaiters=useRef(new Map<string,(value:Approval|ApprovalDecision)=>void>());
  const clock = useGameClock(start.clock);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    if (!running || waiting) return;
    const timer = window.setInterval(() => setActivity(client.activity?.(start.sessionId) ?? 'idle'), 150);
    return () => window.clearInterval(timer);
  }, [client, running, start.sessionId, waiting]);
  const hint = running ? 'The agent is working.' : signed ? 'Click the Order Terminal to send the request.' : 'Click the Manager Desk to read the brief and sign the mandate.';
  function closePanel() { const prior = panel; setPanel('closed'); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`button[aria-label="${prior === 'terminal' ? 'Order Terminal' : 'Manager Desk'}"]`)?.focus()); }
  function station(id: StationId) { if (id === 'desk') setPanel('brief'); if (id === 'terminal' && signed && !running) setPanel('terminal'); }
  const onMark = useCallback((stepIndex: number, kind: 'search' | 'quote' | 'order', step: Parameters<typeof toTimelineEntries>[0]) => {
    if(step.approvalEvent)setHearts(step.approvalEvent.heartsLeft);
    const entry = toTimelineEntries(step, stepIndex).find(item => item.kind === kind);
    if (entry) { setEntries(current => [...current, entry]); clock.raiseTo(entry.at); }
  }, [clock.raiseTo]);
  const onSettled=useCallback((value:Approval|ApprovalDecision)=>{const id=value.approvalId;if(settledIds.current.has(id))return;settledIds.current.add(id);world?.ring(false);setActiveApproval(value);setPanel('phone');const resolve=settleWaiters.current.get(id);void (async()=>{if(world)await playCommands(world,directDecision(value),{signal:abort.current?.signal,holdMs});resolve?.(value);settleWaiters.current.delete(id);})();},[world,holdMs]);
  const onApprovalNeeded=useCallback((approval:Approval,step:import('../api/schemas').AgentStep)=>new Promise<void>(resolve=>{setActiveApproval(approval);setApprovalStep(step);setPhoneHidden(false);setPanel('phone');settledIds.current.delete(approval.approvalId);settleWaiters.current.set(approval.approvalId,()=>{resolve();});world?.ring(approval.status==='OPEN');}),[world]);
  async function send() {
    if (!world || running) return;
    setPanel('closed'); setRunning(true); setActivity('idle'); clock.start();
    const controller = new AbortController(); abort.current = controller;
    try { const result = await runAgent({ client, sessionId: start.sessionId, world, signal: controller.signal, onMark,onApprovalNeeded,onWaiting:(value)=>{setWaiting(value);const current=client.activity?.(start.sessionId) ?? 'idle';setActivity(value&&current==='idle'?'searching':current);},holdMs }); if (result === 'finished') { clock.stop(); setRunning(false); setPanel('done'); } }
    catch (reason) { clock.stop(); setRunning(false); setError(reason instanceof Error ? reason.message : String(reason)); setPanel('error'); }
  }
  useEffect(() => () => clock.stop(), [clock.stop]);
  return <GameWorld panelOpen={panel !== 'closed'} stations={[{ id: 'desk' }, { id: 'terminal', disabledReason: !signed ? 'Sign the mandate at the Manager Desk first.' : running ? 'The agent is working.' : undefined },{id:'phone',disabledReason:!activeApproval||settledIds.current.has(activeApproval.approvalId)?'No approval request right now.':undefined}]} onStation={id=>{if(id==='phone'){setPhoneHidden(false);setPanel('phone');return;}station(id);}} onReady={setWorld} onExit={onExit} hud={<header className="kitchen-hud"><div><h1>{start.level.title}</h1><span>{start.level.customer.name}</span></div><p role="status">{hint}</p><GameClock time={clock.time} running={clock.running} /><HeartsMeter hearts={hearts} max={start.hearts}/><button className="button button-ghost" onClick={onExit}>Back to levels</button></header>} side={<ActivityLog entries={entries} />}>
    {running && (waiting || activity !== 'idle') && panel === 'closed' && <AgentWorking activity={activity === 'idle' ? 'searching' : activity} />}
    {activeApproval&&approvalStep&&<Phone key={activeApproval.approvalId} client={client} approval={activeApproval} step={approvalStep} hidden={panel!=='phone'||phoneHidden} onHide={()=>{setPhoneHidden(true);requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('button[aria-label="Phone Station"]')?.focus());}} onSettled={onSettled}/>}
    <PixelPanel variant="clipboard" title={panel === 'mandate' ? 'Valtakirja' : 'Brief'} hidden={panel !== 'brief' && panel !== 'mandate'} onClose={closePanel}>
      <div className="clipboard-paper">
        <section className="clipboard-brief" hidden={panel !== 'brief'}>
          <header className="clipboard-brief-header"><h3>{start.level.title}</h3><span className="customer-pill">{start.level.customer.name}</span></header>
          <p className="brief-copy">{start.level.brief}</p>
          <div className="schedule"><p><span>Deliver by</span><strong>{formatDateTime(start.level.deadline)}</strong></p><p><span>Order cut-off</span><strong>{formatDateTime(start.level.closingTime)}</strong></p></div>
          <button className="button button-primary" onClick={() => setPanel('mandate')}>Write the mandate</button>
        </section>
      <MandateScreen client={client} sessionId={start.sessionId} presets={presets} discovery={discovery} level={start.level} onBack={closePanel} hidden={panel !== 'mandate'} onSigned={(mandate) => { setSigned(mandate); world?.burst('stamp'); }} />
      </div>
    </PixelPanel>
    <PixelPanel variant="terminal" title="Request" hidden={panel !== 'terminal'} onClose={closePanel}>
      <p>“{start.level.brief}”</p><p>{start.level.customer.name}</p><p><strong>Deliver by</strong> {formatDateTime(start.level.deadline)}</p><button className="button button-primary" disabled={running} aria-busy={running} onClick={() => void send()}>{running ? 'Sending…' : 'Send to agent'}</button>
    </PixelPanel>
    <PixelPanel variant="notice" title="The agent is done." hidden={panel !== 'done'}><button className="button button-primary" onClick={()=>setPanel('result')}>See result</button><button className="button button-ghost" onClick={onExit}>Back to levels</button></PixelPanel>
    {panel==='result'&&<ResultPanel client={client} sessionId={start.sessionId} startHearts={start.hearts} onLoaded={(result:GameResult)=>{if(result.incident)world?.setRobotState('RED');}} onPlayAgain={onPlayAgain??onExit} onValioView={onValioView} onCompare={onCompare}/>}
    <PixelPanel variant="alert" title="Gateway error" hidden={panel !== 'error'}><p>{error}</p><button className="button button-primary" onClick={onExit}>Back to levels</button></PixelPanel>
  </GameWorld>;
}
