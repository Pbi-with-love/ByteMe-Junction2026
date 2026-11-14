import PixelSprite from './PixelSprite';

export type AgentActivity = 'idle' | 'searching' | 'quoting' | 'ordering' | 'explaining';
const labels: Record<AgentActivity, string> = {
  idle: 'Waiting for the agent…',
  searching: 'Checking the catalog…',
  quoting: 'Building a quote…',
  ordering: 'Placing the order…',
  explaining: 'Writing the explanation…',
};
export default function AgentWorking({ activity = 'searching', message }: { activity?: AgentActivity; message?: string }) {
  return <div className="agent-working" role="status" aria-live="polite"><PixelSprite name="work_0" /><span><strong>Agent is working…</strong><small>{message ?? labels[activity]}</small></span></div>;
}
