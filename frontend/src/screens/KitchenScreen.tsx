import { useCallback, useEffect, useRef, useState } from 'react';
import type { GatewayClient } from '../api/gateway';
import type { Discovery, GameStart, Mandate } from '../api/schemas';
import GameWorld from '../components/GameWorld';
import PixelPanel from '../components/PixelPanel';
import ActivityLog from '../components/ActivityLog';
import GameClock from '../components/GameClock';
import { toTimelineEntries, type TimelineEntry } from '../game/timeline';
import { useGameClock } from '../game/useGameClock';
import { formatDateTime } from '../lib/format';
import MandateScreen from './MandateScreen';
import { runAgent } from '../world/runAgent';
import type { WorldController } from '../world/controller';
import type { StationId } from '../world/map';

type Props = { client: GatewayClient; start: GameStart; presets: Record<string, Mandate>; discovery: Discovery; onExit: () => void };
export default function KitchenScreen({ client, start, presets, discovery, onExit }: Props) {
  const [panel, setPanel] = useState<'closed' | 'brief' | 'mandate' | 'terminal' | 'done' | 'error'>('closed');
  const [signed, setSigned] = useState<Mandate | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [world, setWorld] = useState<WorldController | null>(null);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const clock = useGameClock(start.clock);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const hint = running ? 'The agent is working.' : signed ? 'Click the Order Terminal to send the request.' : 'Click the Manager Desk to read the brief and sign the mandate.';
  function closePanel() { const prior = panel; setPanel('closed'); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`button[aria-label="${prior === 'terminal' ? 'Order Terminal' : 'Manager Desk'}"]`)?.focus()); }
  function station(id: StationId) { if (id === 'desk') setPanel('brief'); if (id === 'terminal' && signed && !running) setPanel('terminal'); }
  const onMark = useCallback((stepIndex: number, kind: 'search' | 'quote' | 'order', step: Parameters<typeof toTimelineEntries>[0]) => {
    const entry = toTimelineEntries(step, stepIndex).find(item => item.kind === kind);
    if (entry) { setEntries(current => [...current, entry]); clock.raiseTo(entry.at); }
  }, [clock.raiseTo]);
  async function send() {
    if (!world || running) return;
    setPanel('closed'); setRunning(true); clock.start();
    const controller = new AbortController(); abort.current = controller;
    try { const result = await runAgent({ client, sessionId: start.sessionId, world, signal: controller.signal, onMark }); if (result === 'finished') { clock.stop(); setRunning(false); setPanel('done'); } }
    catch (reason) { clock.stop(); setRunning(false); setError(reason instanceof Error ? reason.message : String(reason)); setPanel('error'); }
  }
  useEffect(() => () => clock.stop(), [clock.stop]);
  return <GameWorld panelOpen={panel !== 'closed'} stations={[{ id: 'desk' }, { id: 'terminal', disabledReason: !signed ? 'Sign the mandate at the Manager Desk first.' : running ? 'The agent is working.' : undefined }]} onStation={station} onReady={setWorld} onExit={onExit} hud={<header className="kitchen-hud"><div><h1>{start.level.title}</h1><span>{start.level.customer.name}</span></div><p role="status">{hint}</p><GameClock time={clock.time} running={clock.running} /><button className="button button-ghost" onClick={onExit}>Back to levels</button></header>} side={<ActivityLog entries={entries} />}>
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
      <p>“{start.level.brief}”</p><p>{start.level.customer.name}</p><p><strong>Deliver by</strong> {formatDateTime(start.level.deadline)}</p><button className="button button-primary" onClick={() => void send()}>Send to agent</button>
    </PixelPanel>
    <PixelPanel variant="notice" title="The agent is done." hidden={panel !== 'done'}><button className="button button-primary" onClick={onExit}>Back to levels</button></PixelPanel>
    <PixelPanel variant="alert" title="Gateway error" hidden={panel !== 'error'}><p>{error}</p><button className="button button-primary" onClick={onExit}>Back to levels</button></PixelPanel>
  </GameWorld>;
}
