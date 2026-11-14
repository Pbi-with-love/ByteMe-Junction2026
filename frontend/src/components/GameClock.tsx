export default function GameClock({ time, running = false }: { time: string; running?: boolean }) {
  return <div role="timer" aria-label="Game clock" aria-live="off" className="game-clock"><span aria-hidden="true">◷</span><span className="game-clock-digits">{time}</span><span className={`clock-led${running ? ' is-running' : ''}`} aria-hidden="true" /></div>;
}
