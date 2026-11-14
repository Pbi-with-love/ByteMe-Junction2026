import { useEffect, useState } from 'react';
import type { GatewayClient } from './api/gateway';
import type { Discovery, GameStart, LevelInfo, Mandate } from './api/schemas';
import { LEVELS } from './game/levels';
import Brief from './screens/Brief';
import MandateScreen from './screens/MandateScreen';

type Screen = 'levels' | 'brief' | 'mandate';
export default function App({ client }: { client: GatewayClient }) {
  const [provider, setProvider] = useState('');
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [screen, setScreen] = useState<Screen>('levels');
  const [start, setStart] = useState<GameStart | null>(null);
  const [presets, setPresets] = useState<Record<string, Mandate>>({});
  useEffect(() => {
    let active = true;
    client.discovery().then((value) => { if (active) { setDiscovery(value); setProvider(value.provider); } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : String(reason)); });
    return () => { active = false; };
  }, [client]);
  async function startLevel(levelId: string) {
    setLoading(true); setError('');
    try {
      const values = await client.presets(levelId);
      const key = Object.keys(values)[0];
      if (!key) throw new Error('No presets available for this level.');
      const game = await client.startLevel(levelId, key);
      setPresets(values); setStart(game); setScreen('brief');
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setLoading(false); }
  }
  if (error && !provider) return <main><p role="alert">{error}</p></main>;
  if (!provider) return <main>Connecting…</main>;
  if (error && !loading) return <main className="page start-error-page"><div className="alert" role="alert"><svg className="alert-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 21H2L12 3Z" /><path d="M12 9v5m0 3h.01" /></svg> <strong>Error:</strong> {error}</div><button className="button button-ghost" onClick={() => { setError(''); setScreen('levels'); }}>Back to levels</button></main>;
  if (loading) return <main className="page"><p>Loading level…</p>{error && <p role="alert">{error}</p>}<button className="button button-ghost" onClick={() => { setError(''); setScreen('levels'); }}>Back to levels</button></main>;
  if (screen === 'brief' && start) return <>{error && <div className="page"><p role="alert">{error}</p></div>}<Brief level={start.level} onBack={() => { setError(''); setScreen('levels'); }} onContinue={() => { setError(''); setScreen('mandate'); }} /></>;
  if (screen === 'mandate' && start && discovery) return <MandateScreen client={client} sessionId={start.sessionId} presets={presets} discovery={discovery} level={start.level} onBack={() => setScreen('levels')} />;
  return <main className="page levels-page"><h1>{provider}</h1><section className="level-list">{LEVELS.map((level) => <article key={level.levelId}><h2>{level.title}</h2><button className="button button-primary" onClick={() => void startLevel(level.levelId)}>Start level</button></article>)}</section>{error && <div className="alert" role="alert"><svg className="alert-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 21H2L12 3Z" /><path d="M12 9v5m0 3h.01" /></svg> <strong>Error:</strong> {error}</div>}</main>;
}
