import { useEffect, useRef } from 'react';
import type { LevelInfo } from '../api/schemas';
import { formatDateTime } from '../lib/format';
import { LEVEL_BRIEFS } from '../game/levels';

export default function Brief({ level, onBack, onContinue }: { level: LevelInfo; onBack: () => void; onContinue: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const story = LEVEL_BRIEFS[level.levelId as keyof typeof LEVEL_BRIEFS];
  return <section className="brief-page">
    <button className="button button-ghost" onClick={onBack}>Back to levels</button>
    <article className="brief-card">
      <header><h1 ref={heading} tabIndex={-1}>{story?.title ?? level.title}</h1><span className="customer-pill">{level.customer.name}</span></header>
      {story ? <div className="brief-story">
        <section><h2>The situation</h2><p>{story.situation}</p></section>
        <section><h2>The surprise</h2><p>{story.surprise}</p></section>
        <section><h2>Your part</h2><p>{story.yourPart}</p></section>
      </div> : <p className="brief-copy">{level.brief}</p>}
      <div className="schedule"><p><span>Deliver by</span><strong>{formatDateTime(level.deadline)}</strong></p><p><span>Order cut-off</span><strong>{formatDateTime(level.closingTime)}</strong></p></div>
      <footer><button className="button button-primary" onClick={onContinue}>Go to the kitchen</button></footer>
    </article>
  </section>;
}
