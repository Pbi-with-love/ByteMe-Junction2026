import { useEffect, useRef } from 'react';
import type { LevelInfo } from '../api/schemas';
import { formatDateTime } from '../lib/format';

export default function Brief({ level, onBack, onContinue }: { level: LevelInfo; onBack: () => void; onContinue: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <section className="page brief-page"><button className="button button-ghost" onClick={onBack}>Back to levels</button><article className="brief-card"><header><h1 ref={heading} tabIndex={-1}>{level.title}</h1><span className="customer-pill">{level.customer.name}</span></header><p className="brief-copy">{level.brief}</p><div className="schedule"><p><span>Deliver by</span><strong>{formatDateTime(level.deadline)}</strong></p><p><span>Order cut-off</span><strong>{formatDateTime(level.closingTime)}</strong></p></div><footer><button className="button button-primary" onClick={onContinue}>Write the mandate</button></footer></article></section>;
}
