import { useEffect } from 'react';
import type { DemoSpeed } from '../game/demo';

type Props = { step: number; total: number; title: string; text: string; paused: boolean; speed: DemoSpeed; pauseDisabled?: boolean; final?: boolean; failed?: boolean; onPause(): void; onSpeedChange(speed: DemoSpeed): void; onNext(): void; onExit(): void; onReplay?: () => void; onBack?: () => void };
export default function DemoNarrator({ step, total, title, text, paused, speed, pauseDisabled, final, failed, onPause, onSpeedChange, onNext, onExit, onReplay, onBack }: Props) {
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
      if (event.key === ' ' || event.key === 'ArrowRight') { event.preventDefault(); onNext(); }
      else if (event.key.toLowerCase() === 'p' && !pauseDisabled) onPause();
      else if (event.key === 'Escape') onExit();
    };
    // Space on a focused button clicks it on keyup; stop that so the narrator's Next never activates a page control.
    const keyup = (event: KeyboardEvent) => { if (event.key === ' ' && !(event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(event.target.tagName))) event.preventDefault(); };
    document.addEventListener('keydown', keydown);
    document.addEventListener('keyup', keyup);
    return () => { document.removeEventListener('keydown', keydown); document.removeEventListener('keyup', keyup); };
  }, [onExit, onNext, onPause, pauseDisabled]);
  return <aside className="demo-narrator" role="status" aria-live="polite" aria-atomic="true">
    {!failed && <p className="demo-counter">{step} of {total}</p>}<h2>{title}</h2><p className="demo-copy">{text}</p>
    {!final && <div className="demo-speed-control"><label htmlFor="demo-speed">Speed</label><select id="demo-speed" aria-label="Demo speed" value={speed} onChange={(event) => onSpeedChange(event.currentTarget.value as DemoSpeed)}><option value="slow">Slow · default</option><option value="normal">Normal</option><option value="fast">Fast</option></select></div>}
    <div className="demo-controls">{final ? <><button onClick={onReplay}>Replay demo</button>{failed ? <button onClick={onExit}>Exit demo</button> : <button onClick={onBack}>Back to levels</button>}</> : <><button onClick={onPause} disabled={pauseDisabled}>{paused ? 'Resume' : 'Pause'}</button><button onClick={onNext}>Next</button><button onClick={onExit}>Exit demo</button></>}</div>
  </aside>;
}
