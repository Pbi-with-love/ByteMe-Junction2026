import { useEffect, useRef, useState } from 'react';
import { motion, MotionConfig, useReducedMotion } from 'motion/react';
import type { GatewayClient } from '../api/gateway';
import type { GameResult, Light, LogEvent, LogVerify } from '../api/schemas';
import { formatTime } from '../lib/format';
import PixelPanel from './PixelPanel';
import AgentWorking from './AgentWorking';

type Props = {
  client: GatewayClient;
  sessionId: string;
  startHearts: number;
  onLoaded?(result: GameResult): void;
  onPlayAgain(): void;
  onValioView?(): void;
  onCompare?(): void;
};

const ON = [
  '.......oo.......', '......ouuo......', '......owuo......', '.....oowuoo.....',
  '.ooooowuuunoooo.', 'owwwuuuuuuuuunno', '.owuuuuuuuuunno.', '..owuuuuuuuuno..',
  '...ouuuuuuuno...', '...ouuuuuuuno...', '..ouuuunonuuuo..', '..ouunno.onuuo..',
  '.ouuno.....onuo.', '.oono.......ono.', '.oo...........oo', '................',
];
const OFF = [
  '.......kk.......', '......k..k......', '......k..k......', '.....kk..kk.....',
  '.kkkkk....kkkkk.', 'k..............k', '.k............k.', '..k..........k..',
  '...k........k...', '...k........k...', '..k....kk....k..', '..k...k..k...k..',
  '.k..kk....kk..k.', '.kkk........kkk.', '.kk...........kk', '................',
];
const COLORS: Record<string, string> = { o: '#0B1B33', w: '#FFFFFF', u: '#D49B6A', n: '#9C663B', k: '#475569' };
const BADGE_GRIDS = {
  verified: ['...oooooo...', '..oGGGGGGoo.', '.oG111111Go.', 'oG111111w1Go', 'oG11111ww1Go', 'oG1w11ww11Go', 'oG1wwwww11Go', 'oG11www111Go', '.oG11w111Go.', '.oG111111Go.', '..oGGGGGGoo.', '...oooooo...'],
  tampered: ['...oooooo...', '..oRRRRRRoo.', '.oR444444Ro.', 'oR4ww44ww4Ro', 'oR4www4ww4Ro', 'oR44wwww44Ro', 'oR44wwww44Ro', 'oR4ww4www4Ro', 'oR4ww44ww4Ro', '.oR444444Ro.', '..oRRRRRRoo.', '...oooooo...'],
  mismatch: ['...oooooo...', '..oRRRRRRo..', '.oR44ww44Ro.', 'oR444ww444Ro', 'oR444ww444Ro', 'oR444ww444Ro', 'oR444ww444Ro', 'oR44444444Ro', 'oR444ww444Ro', '.oR44ww44Ro.', '..oRRRRRRo..', '...oooooo...'],
  error: ['.....oo.....', '....oeeo....', '....oeeo....', '...oewweo...', '...oewweo...', '..oeewweeo..', '..oeeaeeeo..', '.oeeewweeeo.', '.oeeeeeeeeo.', 'oeeeeeeeeeeo', 'oooooooooooo', '............'],
} as const;
const BADGE_COLORS: Record<string, string> = { o: '#0B1B33', w: '#FFFFFF', G: '#15803D', 1: '#DCFCE7', R: '#B91C1C', 4: '#FEE2E2', e: '#881337', a: '#FDF2F5' };

function PixelGrid({ rows, className = '' }: { rows: string[]; className?: string }) {
  return <svg aria-hidden="true" className={className} shapeRendering="crispEdges" viewBox="0 0 16 16">
    {rows.flatMap((row, y) => [...row].map((key, x) => key === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={COLORS[key]!} />))}
  </svg>;
}

export function Stars({ stars, animate = true }: { stars: number; animate?: boolean }) {
  const reducedMotion = useReducedMotion();
  return <div className="result-stars" role="img" aria-label={`${stars} of 3 stars`}>
    {[0, 1, 2].map((index) => <motion.span key={index} data-star={index < stars ? 'on' : 'off'} initial={animate ? (reducedMotion ? { opacity: 0 } : { opacity: 0, scale: .5 }) : false} animate={{ opacity: 1, scale: 1 }} transition={!animate ? { duration: 0 } : reducedMotion ? { duration: .12 } : { duration: .25, delay: .16 + index * .1 }}><PixelGrid rows={index < stars ? ON : OFF} className="result-star" /></motion.span>)}
  </div>;
}

function LightBadge({ light }: { light: Light }) {
  return <span className={`result-light result-light-${light.toLowerCase()}`}>{light}</span>;
}

function BadgeIcon({ state }: { state: keyof typeof BADGE_GRIDS }) {
  const rows = BADGE_GRIDS[state];
  return <svg aria-hidden="true" className="result-badge-icon" shapeRendering="crispEdges" viewBox="0 0 12 12">{rows.flatMap((row, y) => [...row].map((key, x) => key === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={BADGE_COLORS[key]!} />))}</svg>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function HashBadge({ result, verify, error }: { result: GameResult; verify: LogVerify | null; error: string | null }) {
  if (error) return <div className="result-hash result-hash-error" role="alert"><BadgeIcon state="error" />Could not verify log</div>;
  if (!verify) return <div className="result-hash" role="status">Verifying log…</div>;
  if (!verify.valid) return <div className="result-hash result-hash-bad" role="status"><BadgeIcon state="tampered" />Log tampered: chain broken at event #{verify.brokenAtSeq}</div>;
  if (verify.headHash !== result.logHeadHash) return <div className="result-hash result-hash-bad" role="status"><BadgeIcon state="mismatch" />Log does not match this result</div>;
  return <div className="result-hash result-hash-good" role="status"><BadgeIcon state="verified" />Log verified · <code className="result-hash-code" data-testid="result-hash-value">{verify.headHash}</code> · {verify.events} events</div>;
}

function Score({ name, value, incident }: { name: string; value: number; incident: boolean }) {
  const reducedMotion = useReducedMotion();
  return <div className="result-score-row"><span>{name}</span><div className="result-meter" role="meter" aria-label={name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><motion.span initial={{ width: reducedMotion ? `${value}%` : '0%' }} animate={{ width: `${value}%` }} transition={reducedMotion ? { duration: 0 } : { duration: .5, delay: ['Kitchen', 'Wallet', 'Safety'].indexOf(name) * .08 }} className={incident && value > 0 ? 'result-meter-fill result-meter-incident' : 'result-meter-fill'} /></div><strong>{value}</strong></div>;
}

export default function ResultPanel({ client, sessionId, startHearts, onLoaded, onPlayAgain, onValioView, onCompare }: Props) {
  const [result, setResult] = useState<GameResult | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);
  const [events, setEvents] = useState<LogEvent[] | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  const [verify, setVerify] = useState<LogVerify | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  useEffect(() => {
    let active = true;
    setResult(null);
    setResultError(null);
    setEvents(null);
    setLogError(null);
    setVerify(null);
    setVerifyError(null);
    client.getResult(sessionId).then((loaded) => {
      if (!active) return;
      setResult(loaded);
      onLoadedRef.current?.(loaded);
    }).catch((error: unknown) => { if (active) setResultError(errorMessage(error)); });
    client.getLog('buyer').then(({ events: loaded }) => { if (active) setEvents([...loaded].sort((a, b) => a.seq - b.seq)); })
      .catch((error: unknown) => { if (active) setLogError(errorMessage(error)); });
    client.verifyLog().then((loaded) => { if (active) setVerify(loaded); })
      .catch((error: unknown) => { if (active) setVerifyError(errorMessage(error)); });
    return () => { active = false; };
  }, [client, sessionId]);

  const incident = result?.incident !== null && result?.incident !== undefined;
  return <MotionConfig reducedMotion="user"><PixelPanel variant={incident ? 'incident' : 'notice'} title={incident ? 'Safety incident' : 'Result'}>
    {!result && !resultError && <AgentWorking activity="explaining" message="Loading result…" />}
    {resultError && <><div className="result-error" role="alert">{resultError}</div><footer className="result-actions"><button className="button button-primary" type="button" onClick={onPlayAgain}>Play again</button></footer></>}
    {result && <>
      {incident && <div className="result-incident-detail"><p>{result.incident!.reason}</p><span>Product ID</span> <strong>{result.incident!.productId}</strong></div>}
      <header className="result-summary"><div><Stars stars={result.stars} /><span className="result-stars-copy">{result.stars} of 3 stars</span></div><p>{result.heartsLeft} of {startHearts} hearts left</p></header>
      <section className="result-scores" aria-label="Scores">
        <Score name="Kitchen" value={result.kitchen} incident={incident} />
        <Score name="Wallet" value={result.wallet} incident={incident} />
        <Score name="Safety" value={result.safety} incident={incident} />
      </section>
      <HashBadge result={result} verify={verify} error={verifyError} />
      <section className="result-receipt" aria-label="Receipt" tabIndex={0}>
        <strong className="result-overline">Receipt</strong><p className="result-receipt-copy">{result.receiptText}</p>
        {logError && <div className="result-error" role="alert">{logError}</div>}
        {!logError && <><h3>Audit log</h3>{events?.length ? <ol>{events.map((event) => <li key={`${event.seq}-${event.eventId}`}><time>{formatTime(event.at)}</time> <span>{event.actor}</span> {event.light && <LightBadge light={event.light} />} <span>{event.summary}</span></li>)}</ol> : events && <p>No audit events recorded.</p>}</>}
      </section>
      <footer className="result-actions"><button className="button button-primary" type="button" onClick={onPlayAgain}>Play again</button>{onValioView && <button className="button button-ghost" type="button" onClick={onValioView}>See it from Valio Aimo’s side</button>}{onCompare && <button className="button button-ghost" type="button" onClick={onCompare}>Compare presets</button>}</footer>
    </>}
  </PixelPanel></MotionConfig>;
}
