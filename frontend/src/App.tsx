import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { GatewayClient } from './api/gateway';
import type { Discovery, GameStart, Mandate } from './api/schemas';
import { LEVELS } from './game/levels';
import KitchenScreen from './screens/KitchenScreen';
import Brief from './screens/Brief';
import ValioView from './screens/ValioView';
import Compare from './screens/Compare';
import { fitScale } from './world/scale';
import { DEMO, DEMO_BEAT_MS, DEMO_PAUSE_POLL_MS, DEMO_RESULT_HOLD_MS, DEMO_SPEED_FACTORS, DEMO_SPOTLIGHT_MS, DEMO_WAIT_MS, type DemoSpeed } from './game/demo';
import { runDemo } from './game/runDemo';
import { formatEuroLimit, formatPresetLabel } from './lib/format';
import AgentWorking from './components/AgentWorking';
import DemoNarrator from './components/DemoNarrator';
import type { DemoCard } from './game/demoScript';
import HowToPlay from './components/HowToPlay';
import { markHowToPlaySeen, shouldShowHowToPlay } from './game/firstVisit';
import { narratorBlockers, placeNarrator } from './game/narratorPlacement';

type Screen = 'levels' | 'brief' | 'kitchen' | 'valio' | 'compare';
export default function App({ client }: { client: GatewayClient }) {
  const [provider, setProvider] = useState('');
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoCard, setDemoCard] = useState<{ card: DemoCard; step: number } | null>(null);
  const [demoPaused, setDemoPaused] = useState(false);
  const [demoSpeed, setDemoSpeed] = useState<DemoSpeed>('slow');
  const [howToOpen, setHowToOpen] = useState(() => shouldShowHowToPlay());
  const demoPausedRef = useRef(false);
  const demoSpeedRef = useRef<DemoSpeed>('slow');
  const [screen, setScreen] = useState<Screen>('levels');
  const [compareLevelId, setCompareLevelId] = useState<string | null>(null);
  const [compareReady, setCompareReady] = useState(false);
  const [start, setStart] = useState<GameStart | null>(null);
  const [presets, setPresets] = useState<Record<string, Mandate>>({});
  const [runId, setRunId] = useState(0);
  const demoAbort = useRef<AbortController | null>(null);
  const demoValues = useRef<Record<string, string>>({});
  const demoWaiter = useRef<(() => void) | null>(null);
  const demoTimer = useRef<number | null>(null);
  const demoRemaining = useRef(0);
  const demoCurrentFactor = useRef(1);
  const demoStarted = useRef(0);
  const demoGatePending = useRef(false);
  const demoCardRef = useRef<{ card: DemoCard; step: number } | null>(null);
  const demoSpotlightTimer = useRef<number | null>(null);
  const [scale, setScale] = useState(() => fitScale(window.innerWidth, window.innerHeight));
  useEffect(() => () => demoAbort.current?.abort(), []);
  useEffect(() => {
    let active = true;
    client.discovery().then((value) => { if (active) { setDiscovery(value); setProvider(value.provider); } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : String(reason)); });
    return () => { active = false; };
  }, [client]);
  useEffect(() => {
    const resize = () => setScale(fitScale(window.innerWidth, window.innerHeight));
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const closeHowToPlay = useCallback(() => { setHowToOpen(false); markHowToPlaySeen(); }, []);
  useLayoutEffect(() => {
    if (!demoCard) return;
    const card = document.querySelector<HTMLElement>('.demo-narrator');
    if (!card) return;
    const blockers = narratorBlockers(demoCard.step);
    placeNarrator(card, demoCard.step, [...blockers], { width: window.innerWidth, height: window.innerHeight });
  }, [demoCard, compareReady]);
  async function startLevel(levelId: string, presetKey?: string, showBrief = true) {
    setLoading(true); setError('');
    try {
      const values = await client.presets(levelId);
      const key = presetKey ?? Object.keys(values)[0];
      if (!key) throw new Error('No presets available for this level.');
      if (demoLoading && values.balanced) demoValues.current.perOrderLimit = formatEuroLimit(values.balanced.limits.perOrderEur);
      const game = await client.startLevel(levelId, key);
      const title = LEVELS.find((level) => level.levelId === levelId)?.title ?? game.level.title;
      setPresets(values); setStart({ ...game, level: { ...game.level, title } }); setRunId((id) => id + 1); setScreen(showBrief ? 'brief' : 'kitchen');
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setLoading(false); }
  }
  const advanceDemo = useCallback(() => { if (demoTimer.current !== null) window.clearTimeout(demoTimer.current); demoTimer.current = null; demoRemaining.current = 0; const resolve = demoWaiter.current; demoWaiter.current = null; resolve?.(); }, []);
  const scheduleDemoAdvance = useCallback((resolve: () => void, delay = demoRemaining.current) => {
    if (demoPausedRef.current || demoGatePending.current || demoWaiter.current !== resolve) return;
    demoStarted.current = Date.now();
    demoTimer.current = window.setTimeout(() => { demoTimer.current = null; demoWaiter.current = null; demoGatePending.current = false; resolve(); }, delay);
  }, []);
  const toggleDemoPause = useCallback(() => {
    if (demoCard?.card.pauseDisabled) return;
    if (demoPaused) { demoPausedRef.current = false; setDemoPaused(false); if (demoWaiter.current && !demoGatePending.current) scheduleDemoAdvance(demoWaiter.current); }
    else { demoPausedRef.current = true; setDemoPaused(true); if (demoTimer.current !== null) window.clearTimeout(demoTimer.current); demoTimer.current = null; demoRemaining.current = Math.max(0, demoRemaining.current - (Date.now() - demoStarted.current)); }
  }, [demoCard, demoPaused, scheduleDemoAdvance]);
  const presentDemoCard = useCallback((card: DemoCard, step: number, holdMs: number, waitUntil?: Promise<void>) => {
    demoPausedRef.current = false; demoCardRef.current = { card, step }; setDemoCard({ card, step }); setDemoPaused(false);
    if (step === 15) { demoWaiter.current = null; return Promise.resolve(); }
    demoRemaining.current = holdMs; demoCurrentFactor.current = DEMO_SPEED_FACTORS[demoSpeedRef.current];
    demoGatePending.current = Boolean(waitUntil);
    return new Promise<void>((resolve, reject) => {
      demoWaiter.current = resolve;
      const startTimer = () => { demoGatePending.current = false; scheduleDemoAdvance(resolve, demoRemaining.current); };
      if (waitUntil) void waitUntil.then(startTimer).catch(reject);
      else startTimer();
    });
  }, [scheduleDemoAdvance]);
  const changeDemoSpeed = useCallback((speed: DemoSpeed) => {
    const oldFactor = demoCurrentFactor.current, nextFactor = DEMO_SPEED_FACTORS[speed];
    demoSpeedRef.current = speed; setDemoSpeed(speed);
    if (demoCardRef.current?.card.pauseDisabled || !demoWaiter.current) return;
    if (demoTimer.current !== null) {
      demoRemaining.current = Math.max(0, demoRemaining.current - (Date.now() - demoStarted.current)) * nextFactor / oldFactor;
      window.clearTimeout(demoTimer.current); demoTimer.current = null;
      scheduleDemoAdvance(demoWaiter.current, demoRemaining.current);
    } else if (!demoGatePending.current) {
      demoRemaining.current *= nextFactor / oldFactor;
    } else {
      demoRemaining.current *= nextFactor / oldFactor;
    }
    demoCurrentFactor.current = nextFactor;
  }, [scheduleDemoAdvance]);
  const onCompareLoaded = useCallback((data: import('./api/schemas').Compare) => {
    const strictApprovals = data.presets.strict?.approvalsAsked;
    if (strictApprovals !== undefined) demoValues.current.strictApprovals = String(strictApprovals);
    demoValues.current.compareLoaded = 'true';
    setCompareReady(true);
  }, []);
  function startDemo() {
    closeHowToPlay();
    demoAbort.current?.abort();
    const controller = new AbortController(); demoAbort.current = controller;
    const title = LEVELS.find((level) => level.levelId === DEMO.levelId)?.title ?? '';
    setDemoLoading(true); demoValues.current = {}; demoPausedRef.current = false; demoSpeedRef.current = 'slow'; setDemoSpeed('slow'); demoGatePending.current = false; demoCardRef.current = null; setDemoCard(null); void runDemo({ root: document.body, script: DEMO, signal: controller.signal, levelTitle: title, presetLabel: formatPresetLabel, speedFactor: () => DEMO_SPEED_FACTORS[demoSpeedRef.current], beatMs: DEMO_BEAT_MS, resultHoldMs: DEMO_RESULT_HOLD_MS, waitMs: DEMO_WAIT_MS, present: presentDemoCard, values: () => demoValues.current, sleep: async (duration) => { let remaining = duration; while (remaining > 0) { const slice = demoPausedRef.current ? DEMO_PAUSE_POLL_MS : Math.min(DEMO_PAUSE_POLL_MS, remaining); await new Promise<void>((resolve) => window.setTimeout(resolve, slice)); if (!demoPausedRef.current) remaining -= slice; } }, spotlight: (element) => { element.classList.add('demo-spotlight'); const card = document.querySelector<HTMLElement>('.demo-narrator'); if (card) { const blockers = narratorBlockers(demoCardRef.current?.step ?? 1); placeNarrator(card, demoCardRef.current?.step ?? 1, [...blockers], { width: window.innerWidth, height: window.innerHeight }); } if (demoSpotlightTimer.current !== null) window.clearTimeout(demoSpotlightTimer.current); const clearRing = () => { if (demoPausedRef.current) demoSpotlightTimer.current = window.setTimeout(clearRing, DEMO_PAUSE_POLL_MS); else { element.classList.remove('demo-spotlight'); demoSpotlightTimer.current = null; } }; demoSpotlightTimer.current = window.setTimeout(clearRing, DEMO_SPOTLIGHT_MS * DEMO_SPEED_FACTORS[demoSpeedRef.current]); } }).then(async (result) => { if (result === 'stuck' || result === 'interrupted') await presentDemoCard({ title: 'The demo stopped', text: result === 'interrupted' ? 'The demo stopped because a player clicked a control while the guided run was in progress.' : 'The demo stopped because a screen or gateway response did not arrive in time.', automatic: false }, 0, 0); }).finally(() => { if (demoAbort.current === controller) demoAbort.current = null; setDemoLoading(false); if (demoCardRef.current?.step !== 15 && demoCardRef.current?.step !== 0) { demoCardRef.current = null; setDemoCard(null); } });
  }
  const narrator = demoCard && <><span className="demo-mode-badge">DEMO</span><DemoNarrator step={demoCard.step} total={15} title={demoCard.card.title} text={demoCard.card.text} paused={demoPaused} speed={demoSpeed} pauseDisabled={demoCard.card.pauseDisabled} final={demoCard.step === 15 || demoCard.step === 0} failed={demoCard.step === 0} onPause={toggleDemoPause} onSpeedChange={changeDemoSpeed} onNext={advanceDemo} onExit={() => { demoAbort.current?.abort(); demoAbort.current = null; advanceDemo(); document.querySelectorAll('.demo-spotlight').forEach((element) => element.classList.remove('demo-spotlight')); if (demoSpotlightTimer.current !== null) window.clearTimeout(demoSpotlightTimer.current); demoCardRef.current = null; setDemoCard(null); setDemoLoading(false); }} onReplay={() => { demoAbort.current?.abort(); demoAbort.current = null; demoCardRef.current = null; setDemoCard(null); setDemoLoading(false); setError(''); setStart(null); setCompareLevelId(null); setScreen('levels'); window.setTimeout(startDemo, 0); }} onBack={() => { demoAbort.current?.abort(); demoCardRef.current = null; setDemoCard(null); setDemoLoading(false); setError(''); setScreen('levels'); setStart(null); }} /></>;
  function openCompare(levelId: string) {
    setCompareReady(false);
    setCompareLevelId(levelId);
    setScreen('compare');
  }
  const pixelStyle = { '--px': `${scale}px` } as CSSProperties;
  if (error && !provider) return <><main className="title-screen" style={pixelStyle}><section className="title-card"><p className="pixel-alert" role="alert">{error}</p></section></main>{narrator}</>;
  if (!provider) return <><main className="title-screen" style={pixelStyle}><section className="title-card title-state">Connecting…</section></main>{narrator}</>;
  if (error && !loading) return <><main className="title-screen" style={pixelStyle}><section className="title-card title-state"><div className="pixel-alert" role="alert"><svg className="alert-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 21H2L12 3Z" /><path d="M12 9v5m0 3h.01" /></svg> <strong>Error:</strong> {error}</div><button className="button button-ghost" onClick={() => { demoAbort.current?.abort(); demoAbort.current = null; setError(''); setScreen('levels'); }}>Back to levels</button></section></main>{narrator}</>;
  if (loading) return <><main className="title-screen" style={pixelStyle}><section className="title-card title-state"><AgentWorking message="Starting the level…" />{error && <p role="alert">{error}</p>}<button className="button button-ghost" onClick={() => { demoAbort.current?.abort(); demoAbort.current = null; setError(''); setScreen('levels'); }}>Back to levels</button></section></main>{narrator}</>;
  if (screen === 'brief' && start) return <><main className="title-screen" style={pixelStyle}>
    <Brief level={start.level} onBack={() => { setStart(null); setScreen('levels'); }} onContinue={() => setScreen('kitchen')} />
  </main>{narrator}</>;
  if ((screen === 'kitchen' || screen === 'valio') && start && discovery) return <>
    <div hidden={screen === 'valio'}>
      <KitchenScreen key={runId} client={client} start={start} presets={presets} discovery={discovery} onDemoData={(values) => Object.assign(demoValues.current, values)}
        onPlayAgain={() => { demoAbort.current?.abort(); demoAbort.current = null; void startLevel(start.level.levelId, undefined, false); }}
        onValioView={() => setScreen('valio')}
        onCompare={() => openCompare(start.level.levelId)}
        onExit={() => { demoAbort.current?.abort(); demoAbort.current = null; setError(''); setScreen('levels'); setStart(null); }} />
    </div>
    {screen === 'valio' && <ValioView client={client} onBack={() => setScreen('kitchen')} />}
    {narrator}
  </>;
  if (screen === 'compare' && compareLevelId) return <><Compare client={client} levelId={compareLevelId} onLoaded={onCompareLoaded} onBack={() => { demoAbort.current?.abort(); demoAbort.current = null; setScreen('levels'); }} />{narrator}</>;
  return <><main className="title-screen" style={pixelStyle} data-scale={scale}><section className="title-card">
    <header className="title-header"><h1>Agent Kitchen</h1><p className="title-tagline">Agents don’t need a chatbot. They need a mandate.</p><p className="provider-badge">{provider}</p><button className="button button-ghost" disabled={demoLoading} aria-busy={demoLoading} onClick={startDemo}>{demoLoading ? 'Running demo…' : 'Run demo'}</button><button className="button button-ghost" type="button" onClick={() => setHowToOpen(true)}>How to play</button><p className="text-ink-muted">Plays Level 1 with a Balanced mandate, then the comparison.</p></header>
    <section className="level-list" aria-label="Levels">{LEVELS.map((level, index) => <article className="level-card" key={level.levelId}><span className="level-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><h2>{level.title}</h2><button className="button button-primary" onClick={() => void startLevel(level.levelId)}>Start level</button></article>)}</section>
    {error && <div className="pixel-alert" role="alert"><svg className="alert-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 21H2L12 3Z" /><path d="M12 9v5m0 3h.01" /></svg> <strong>Error:</strong> {error}</div>}
  </section></main><HowToPlay open={howToOpen && !demoLoading} onClose={closeHowToPlay} />{narrator}</>;
}
