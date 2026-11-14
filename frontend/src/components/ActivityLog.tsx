import { useEffect, useRef, useState } from 'react';
import type { Light, ReasonCode } from '../api/schemas';
import { formatMoney, formatQuantity, formatTime } from '../lib/format';
import { REASON_TEXT } from '../lib/reasons';
import { nonValioBrands, type TimelineEntry } from '../game/timeline';
import LightBadge from './LightBadge';

const labels = { search: 'Search', quote: 'Quote', order: 'Order' } as const;
function Exclusions({ rows, names }: { rows: { productId: string; reason: ReasonCode; light?: Light }[]; names: Map<string, string> }) {
  if (!rows.length) return null;
  return <section className="excluded-list"><strong>Excluded products</strong>{rows.map((row, i) => <div key={`${row.productId}-${i}`}><LightBadge light="RED" /><span>{names.get(row.productId) ?? row.productId}</span><span>{REASON_TEXT[row.reason]}</span></div>)}</section>;
}
export default function ActivityLog({ entries }: { entries: TimelineEntry[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView?.({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' }); }, [entries.length]);
  return <section className="activity-dock" aria-label="Activity log panel"><header className="activity-dock-header"><h2>Activity log</h2><span>{entries.length}</span></header><div className="activity-log" role="log" aria-label="Activity log" aria-live="polite">
    {!entries.length && <p className="activity-empty">No agent activity yet.</p>}
    {entries.map(entry => {
      const { step } = entry; const key = entry.id; const open = !!expanded[key];
      const names = new Map(step.search.results.map(p => [p.productId, ('name' in p && p.name) || p.productId]));
      const quote = step.quote; const recommended = quote.plans.find(p => p.recommended) ?? quote.plans[0];
      const order = step.order as { httpStatus: number; body: any };
      const exclusionRows = entry.kind === 'search'
        ? step.search.results.filter(p => p.excluded).map(p => ({ productId: p.productId, reason: p.excluded!.reason, light: p.excluded!.light }))
        : entry.kind === 'quote' ? (quote.excludedProducts ?? []).map(p => ({ productId: p.productId, reason: p.reason, light: p.light })) : [];
      const summary = entry.kind === 'quote' ? recommended?.summary ?? (recommended ? formatMoney(recommended.total) : null) : null;
      const errorOrder = order.httpStatus !== 201 && order.httpStatus !== 202;
      const approvalReasonText = order.httpStatus === 202 ? step.approval?.reasonText : undefined;
      return <article data-entry-id={entry.id} className={`activity-entry${entry.status === 'ERROR' ? ' is-error' : ''}`} key={key}>
        <button type="button" className="activity-entry-toggle" aria-expanded={open} aria-controls={`detail-${key}`} onClick={() => setExpanded(current => ({ ...current, [key]: !current[key] }))}>
          <span className="entry-meta"><time>{formatTime(entry.at)}</time><span className="kind-label">{labels[entry.kind]}</span>{entry.light && <LightBadge light={entry.light} />}<span className="entry-chevron" aria-hidden="true">⌄</span></span>
          <strong className="entry-title">{entry.title}</strong>
          {entry.reasons.map(reason => <span className="reason-chip" key={reason}>{REASON_TEXT[reason]}</span>)}
          {entry.kind === 'quote' && summary && <span className="entry-summary">{summary}</span>}
          {entry.kind === 'quote' && quote.scenarioOverlay && <span className="scenario-tag">Scenario adjustment</span>}
          {entry.kind === 'quote' && nonValioBrands(quote, step.search).length > 0 && <span>Recommended plan uses another brand: {nonValioBrands(quote, step.search).join(', ')}.</span>}
          {entry.status === 'PENDING_APPROVAL' && <span className="order-pending">Approval requested</span>}
          {entry.status === 'ORDERED' && <span>Ordered {order.body.orderId}</span>}
          {entry.status === 'BLOCKED' && <span className="order-blocked">Order blocked</span>}
          {errorOrder && <span className="order-error">{order.body.error.code}: {order.body.error.message}</span>}
        </button>
        {!!exclusionRows.length && <Exclusions rows={exclusionRows} names={names} />}
        {open && <div className="activity-detail" id={`detail-${key}`}>
          {entry.kind === 'quote' && <div className="plan-list">{quote.plans.map(plan => <section className={`plan-card${plan.recommended ? ' is-recommended' : ''}`} key={plan.planId}>
            <header><strong>{(plan.tier ?? 'best').replace(/^./, x => x.toUpperCase())}</strong>{plan.recommended && <span>Recommended</span>}</header>
            <LightBadge light={plan.policy.light} /><strong>{formatMoney(plan.total)}</strong>
            <span>{formatQuantity(plan.onTime)} of {formatQuantity(quote.need.quantity)} on time</span>
            {plan.score && <span>Score {plan.score.total.toFixed(2).replace('.', ',')}</span>}
            {plan.summary && <p>{plan.summary}</p>}
            <ul>{plan.lines.map((line, i) => <li key={`${line.productId}-${i}`}>{names.get(line.productId) ?? line.productId}: {formatQuantity(line.quantity)}</li>)}</ul>
          </section>)}</div>}
          <section><h3>Rule applied</h3>{(entry.reasons.length ? entry.reasons : order.httpStatus === 202 ? order.body.reasons as ReasonCode[] : []).map((reason: ReasonCode) => <p key={reason}><strong>{reason}</strong> — {REASON_TEXT[reason]}</p>)}{approvalReasonText && <p>{approvalReasonText}</p>}</section>
          <section><h3>Raw gateway data</h3><pre tabIndex={0}>{JSON.stringify(step, null, 2)}</pre></section>
        </div>}
      </article>;
    })}<div ref={bottom} />
  </div></section>;
}
