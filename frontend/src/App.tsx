import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { GatewayClient } from './api/gateway';
import type { Discovery, GameStart, Mandate } from './api/schemas';
import { LEVELS } from './game/levels';
import KitchenScreen from './screens/KitchenScreen';
import ValioView from './screens/ValioView';
import Compare from './screens/Compare';
import { fitScale } from './world/scale';
import { DEMO, DEMO_BEAT_MS, DEMO_RESULT_HOLD_MS, DEMO_WAIT_MS } from './game/demo';
import { runDemo } from './game/runDemo';
import { formatPresetLabel } from './lib/format';
import AgentWorking from './components/AgentWorking';

type Screen = 'levels' | 'kitchen' | 'valio' | 'compare';
export default function App({ client }: { client: GatewayClient }) {
  const [provider, setProvider] = useState('');
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [screen, setScreen] = useState<Screen>('levels');
  const [compareLevelId, setCompareLevelId] = useState<string | null>(null);
  const [start, setStart] = useState<GameStart | null>(null);
  const [presets, setPresets] = useState<Record<string, Mandate>>({});
  const [runId, setRunId] = useState(0);
  const demoAbort = useRef<AbortController | null>(null);
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
  async function startLevel(levelId: string, presetKey?: string) {
    setLoading(true); setError('');
    try {
      const values = await client.presets(levelId);
      const key = presetKey ?? Object.keys(values)[0];
      if (!key) throw new Error('No presets available for this level.');
      const game = await client.startLevel(levelId, key);
      setPresets(values); setStart(game); setRunId((id) => id + 1); setScreen('kitchen');
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setLoading(false); }
  }
  function startDemo() {
    demoAbort.current?.abort();
    const controller = new AbortController(); demoAbort.current = controller;
    const title = LEVELS.find((level) => level.levelId === DEMO.levelId)?.title ?? '';
    setDemoLoading(true); void runDemo({ root: document.body, script: DEMO, signal: controller.signal, levelTitle: title, presetLabel: formatPresetLabel, beatMs: DEMO_BEAT_MS, resultHoldMs: DEMO_RESULT_HOLD_MS, waitMs: DEMO_WAIT_MS }).finally(() => { if (demoAbort.current === controller) demoAbort.current = null; setDemoLoading(false); });
  }
  function openCompare(levelId: string) {
    setCompareLevelId(levelId);
    setScreen('compare');
  }
  const pixelStyle = { '--px': `${scale}px` } as CSSProperties;
  if (error && !provider) return <main className="title-screen" style={pixelStyle}><section className="title-card"><p className="pixel-alert" role="alert">{error}</p></section></main>;
  if (!provider) return <main className="title-screen" style={pixelStyle}><section className="title-card title-state">Connecting…</section></main>;
  if (error && !loading) return <main className="title-screen" style={pixelStyle}><section className="title-card title-state"><div className="pixel-alert" role="alert"><svg className="alert-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 21H2L12 3Z" /><path d="M12 9v5m0 3h.01" /></svg> <strong>Error:</strong> {error}</div><button className="button button-ghost" onClick={() => { demoAbort.current?.abort(); demoAbort.current = null; setError(''); setScreen('levels'); }}>Back to levels</button></section></main>;
  if (loading) return <main className="title-screen" style={pixelStyle}><section className="title-card title-state"><AgentWorking message="Starting the level…" />{error && <p role="alert">{error}</p>}<button className="button button-ghost" onClick={() => { demoAbort.current?.abort(); demoAbort.current = null; setError(''); setScreen('levels'); }}>Back to levels</button></section></main>;
  if ((screen === 'kitchen' || screen === 'valio') && start && discovery) return <>
    <div hidden={screen === 'valio'}>
      <KitchenScreen key={runId} client={client} start={start} presets={presets} discovery={discovery}
        onPlayAgain={() => { demoAbort.current?.abort(); demoAbort.current = null; void startLevel(start.level.levelId); }}
        onValioView={() => setScreen('valio')}
        onCompare={() => openCompare(start.level.levelId)}
        onExit={() => { demoAbort.current?.abort(); demoAbort.current = null; setError(''); setScreen('levels'); setStart(null); }} />
    </div>
    {screen === 'valio' && <ValioView client={client} onBack={() => setScreen('kitchen')} />}
  </>;
  if (screen === 'compare' && compareLevelId) return <Compare client={client} levelId={compareLevelId} onBack={() => { demoAbort.current?.abort(); demoAbort.current = null; setScreen('levels'); }} />;
  return <main className="title-screen" style={pixelStyle} data-scale={scale}><section className="title-card">
    <header className="title-header"><h1>Agent Kitchen</h1><p className="title-tagline">Agents don’t need a chatbot. They need a mandate.</p><p className="provider-badge">{provider}</p><button className="button button-ghost" disabled={demoLoading} aria-busy={demoLoading} onClick={startDemo}>{demoLoading ? 'Running demo…' : 'Run demo'}</button>{demoLoading && <AgentWorking />}<p className="text-ink-muted">Plays Level 1 with a Balanced mandate, then the comparison.</p></header>
    <section className="level-list" aria-label="Levels">{LEVELS.map((level, index) => <article className="level-card" key={level.levelId}><span className="level-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><h2>{level.title}</h2><button className="button button-primary" onClick={() => void startLevel(level.levelId)}>Start level</button></article>)}</section>
    {error && <div className="pixel-alert" role="alert"><svg className="alert-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 21H2L12 3Z" /><path d="M12 9v5m0 3h.01" /></svg> <strong>Error:</strong> {error}</div>}
  </section></main>;
}
