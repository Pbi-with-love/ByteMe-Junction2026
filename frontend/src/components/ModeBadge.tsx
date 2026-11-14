export default function ModeBadge({ mode }: { mode: 'replay' | 'live' }) {
  return <span className="mode-badge" data-mode={mode}>{mode === 'replay' ? 'Replay mode' : 'Live gateway'}</span>;
}
