import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import LightBadge from './LightBadge';
import './HowToPlay.css';

type Props = { open: boolean; onClose(): void };

const titles = ['Your job', 'Four lights', 'Hearts and approvals', 'Scoring'] as const;

function HowToPlayCard({ index }: { index: number }) {
  if (index === 0) return <p>An AI agent buys ingredients for your kitchen. You do not shop. You decide how much authority it gets by signing a mandate at the Manager Desk, then send the request from the Order Terminal.</p>;
  if (index === 1) return <div className="how-to-lights">
    <p><LightBadge light="GREEN" /> Inside your mandate, the agent just does it.</p>
    <p><LightBadge light="BLUE" /> Inside your mandate but worth noting, you get a notice.</p>
    <p><LightBadge light="YELLOW" /> Outside your mandate but approvable, the phone rings and it costs one heart.</p>
    <p><LightBadge light="RED" /> Never allowed, blocked, no approve button.</p>
  </div>;
  if (index === 2) return <p>You have three hearts. Each yellow request costs one when it appears. You have 20 seconds to Approve, Choose other or Reject. From the fourth request on you are out of attention: it expires unseen. Read the card: approving a plan accepts everything it discloses.</p>;
  return <p>Kitchen = share delivered on time. Wallet = how close to the cheapest compliant plan. Safety = 100, an allergen incident makes it 0. Stars: three for a perfect run with a heart left; a safety incident means zero.</p>;
}

export default function HowToPlay({ open, onClose }: Props) {
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (open) {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setStep(0);
      requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('button')?.focus());
    } else {
      openerRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        openerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const trapFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const finish = () => { onClose(); openerRef.current?.focus(); };
  return <div className="how-to-backdrop">
    <div ref={dialogRef} className="how-to-dialog pixel-panel pixel-panel-terminal" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={trapFocus}>
      <header className="how-to-header">
        <div className="how-to-heading"><span className="how-to-eyebrow">HOW TO PLAY · {step + 1} OF 4</span><h2 id={titleId}>{titles[step]}</h2></div>
        <button type="button" className="button button-ghost how-to-close" aria-label="Close how to play" onClick={finish}>×</button>
      </header>
      <div className="how-to-content" aria-live="polite"><HowToPlayCard index={step} /></div>
      <div className="how-to-footer">
        <div className="how-to-dots" aria-label={`Step ${step + 1} of 4`}>
          {titles.map((title, index) => <span key={title} className={index === step ? 'is-current' : ''} aria-current={index === step ? 'step' : undefined} />)}
          <span className="how-to-step-label">{step + 1} of 4</span>
        </div>
        <nav aria-label="How to play navigation" className="how-to-actions">
          {step > 0 && <button type="button" className="button button-ghost" onClick={() => setStep(step - 1)}>Back</button>}
          {step < 3 ? <button type="button" className="button button-primary" onClick={() => setStep(step + 1)}>Next</button> : <button type="button" className="button button-primary" onClick={finish}>Start playing</button>}
        </nav>
      </div>
    </div>
  </div>;
}
