import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameStart } from '../api/schemas';
import { gameOffsetMs, gameTimeAt } from './clock';
export function useGameClock(clock: GameStart['clock']) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const elapsedRef = useRef(0);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const clear = useCallback(() => { if (interval.current) clearInterval(interval.current); interval.current = null; }, []);
  const stop = useCallback(() => { clear(); setRunning(false); }, [clear]);
  const start = useCallback(() => {
    if (interval.current) return;
    setRunning(true);
    interval.current = setInterval(() => {
      const startMinutes = Number(clock.start.slice(0, 2)) * 60 + Number(clock.start.slice(3, 5));
      const endMinutes = Number(clock.end.slice(0, 2)) * 60 + Number(clock.end.slice(3, 5));
      const max = (endMinutes - startMinutes) * clock.realSecondsPerGameMinute * 1000;
      const next = Math.min(max, elapsedRef.current + clock.realSecondsPerGameMinute * 1000);
      elapsedRef.current = next; setElapsed(next);
      if (next >= max) { clear(); setRunning(false); }
    }, clock.realSecondsPerGameMinute * 1000);
  }, [clock, clear]);
  const raiseTo = useCallback((iso: string) => { const next = Math.max(elapsedRef.current, gameOffsetMs(iso, clock)); elapsedRef.current = next; setElapsed(next); }, [clock]);
  useEffect(() => () => clear(), [clear]);
  return { time: gameTimeAt(clock, elapsed), running, start, stop, raiseTo };
}
