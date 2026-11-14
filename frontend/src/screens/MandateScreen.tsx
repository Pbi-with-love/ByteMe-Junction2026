import { useEffect, useMemo, useRef, useState } from 'react';
import type { GatewayClient } from '../api/gateway';
import type { Discovery, LevelInfo, Mandate } from '../api/schemas';
import { allergenRuleCodes, controlsOf, limitOptions, sameControls, toDraft, type Controls } from '../api/mandate';
import { formatAllergen, formatDateTime, formatEuroLimit } from '../lib/format';
import Stamp from '../components/Stamp';

const labels: Record<string, string> = { none: 'no substitutes', same_category: 'same-category substitutes', any: 'any substitute', one_day: 'up to one day late' };
function displaySubstitution(value: string) { return labels[value] ?? value; }
function displayLate(value: string) { return value === 'none' ? 'never late' : labels[value] ?? value; }
function presetLabel(key: string) { return key.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase()); }

export default function MandateScreen({ client, sessionId, presets, discovery, level, onBack }: { client: GatewayClient; sessionId: string; presets: Record<string, Mandate>; discovery: Discovery; level: LevelInfo; onBack: () => void }) {
  const entries = Object.entries(presets);
  const [base, setBase] = useState(entries[0][1]);
  const [controls, setControls] = useState<Controls>(() => controlsOf(entries[0][1]));
  const [signed, setSigned] = useState<Mandate | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const title = useRef<HTMLHeadingElement>(null);
  const signedHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus(); }, []);
  useEffect(() => { if (signed) signedHeading.current?.focus(); }, [signed]);
  const limitChoices = useMemo(() => limitOptions(presets), [presets]);
  const allergens = useMemo(() => allergenRuleCodes(presets), [presets]);
  const displayed = signed ?? base;
  const pressed = (mandate: Mandate) => sameControls(controls, controlsOf(mandate));
  const locked = pending || !!signed;
  const set = (patch: Partial<Controls>) => { setControls((current) => ({ ...current, ...patch })); setError(''); };
  async function sign() {
    setPending(true); setError('');
    try { const result = await client.signMandate(sessionId, toDraft(base, controls)); setControls(controlsOf(result)); setSigned(result); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setPending(false); }
  }
  return <main className="page mandate-page"><button className="button button-ghost" onClick={onBack}>Back to levels</button><nav className="preset-strip" aria-label="Presets"><strong>Presets</strong>{entries.map(([key, mandate]) => <button key={key} type="button" aria-pressed={pressed(mandate)} disabled={locked} className="chip" onClick={() => { setBase(mandate); setControls(controlsOf(mandate)); setError(''); }}>{presetLabel(key)}</button>)}{!entries.some(([, mandate]) => pressed(mandate)) && <span className="custom-note">Custom</span>}</nav>
    <article className="mandate-doc"><header className="doc-header"><div><h1 ref={title} tabIndex={-1}>Valtakirja</h1><span className="subtitle">Mandate</span></div><div className="metadata"><p><span>Customer</span><strong>{level.customer.name}</strong></p><p><span>Issued by</span><strong>{displayed.issuedBy.name}, {displayed.issuedBy.role}</strong></p><p><span>Agent</span><strong>{displayed.agentId}</strong></p></div></header>
    <section className="doc-body"><p>I authorise {displayed.agentId} to place orders up to <label className="inline-control"><span className="sr-only">Per-order limit</span><select aria-label="Per-order limit" disabled={locked} value={controls.perOrderEur} onChange={(event) => set({ perOrderEur: Number(event.target.value) })}>{limitChoices.map((value) => <option key={value} value={value}>{formatEuroLimit(value)}</option>)}</select></label> per order, with <label className="inline-control"><span className="sr-only">Substitution</span><select aria-label="Substitution" disabled={locked} value={controls.substitution} onChange={(event) => set({ substitution: event.target.value })}>{discovery.mandate.substitutionLevels.map((value) => <option key={value} value={value}>{displaySubstitution(value)}</option>)}</select></label> and <label className="inline-control"><span className="sr-only">Late delivery</span><select aria-label="Late delivery" disabled={locked} value={controls.lateDelivery} onChange={(event) => set({ lateDelivery: event.target.value })}>{discovery.mandate.lateDeliveryLevels.map((value) => <option key={value} value={value}>{displayLate(value)}</option>)}</select></label>.</p>
    <label className="allergen-line"><input type="checkbox" checked={allergens.length > 0 && allergens.every((code) => controls.excludeAllergens.includes(code))} disabled={locked || !allergens.length} onChange={(event) => set({ excludeAllergens: event.target.checked ? allergens : [] })} />{allergens.length ? <>Never buy products containing <strong>{allergens.map(formatAllergen).join(', ')}.</strong></> : 'No allergen rule in this level'}</label></section>
    <footer className="signature-row"><span>Signature: _______________________</span>{signed ? <Stamp mandateId={signed.mandateId} /> : null}<button className="button button-primary" type="button" disabled={locked} aria-busy={pending} onClick={sign}>{pending ? 'Signing…' : 'Sign mandate'}</button></footer>
    {error && <p className="alert" role="alert"><svg className="alert-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 21H2L12 3Z" /><path d="M12 9v5m0 3h.01" /></svg> <strong>Error:</strong> {error}</p>}
    {signed && <section className="signed-panel"><h2 ref={signedHeading} tabIndex={-1}>Mandate signed</h2><blockquote>{signed.summaryText}</blockquote><div className="signed-meta"><span>{signed.mandateId}</span><span>{formatDateTime(signed.issuedAt)}</span><span>{signed.status}</span></div><p className="signature-badge">Signed by gateway · {signed.signature.alg} · key {signed.signature.keyId}</p></section>}
    </article></main>;
}
