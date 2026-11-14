import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import level1 from '../../mocks/level1.json';
import discovery from '../../mocks/discovery.json';
import type { AgentStep, LevelMock, Discovery, Mandate } from '../api/schemas';
import { ReplayGatewayClient } from '../api/replay';
import { toTimelineEntries } from '../game/timeline';
import KitchenScreen from './KitchenScreen';

const capture = vi.hoisted(() => ({ opts: undefined as any }));
vi.mock('../world/runAgent', () => ({ runAgent: vi.fn(async (opts: any) => { capture.opts = opts; return new Promise(() => {}); }) }));
const data = level1 as LevelMock;
describe('KitchenScreen activity wiring', () => {
  beforeEach(() => { capture.opts = undefined; });
  it('reveals only on onMark and appends each beat in order', async () => {
    const client = new ReplayGatewayClient(); const [preset, recording] = Object.entries(data.presets)[0]!;
    await client.startLevel(data.start.level.levelId, preset);
    const presets = Object.fromEntries(Object.entries(data.presets).map(([key, value]) => [key, value.mandate])) as Record<string, Mandate>;
    render(<KitchenScreen client={client} start={data.start} presets={presets} discovery={discovery.response as Discovery} onExit={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Manager Desk' }));
    fireEvent.click(screen.getByRole('button', { name: 'Write the mandate' }));
    fireEvent.click(screen.getByRole('button', { name: preset.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase()) }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign mandate' }));
    await screen.findByText(recording.mandate.summaryText);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Order Terminal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send to agent' }));
    vi.useFakeTimers();
    expect(screen.getByRole('log')).toHaveTextContent('No agent activity yet.');
    const step = recording.steps[0]!; const mark = capture.opts.onMark as (i: number, kind: 'search' | 'quote' | 'order', step: AgentStep) => void;
    act(() => mark(0, 'search', step)); expect(screen.getAllByRole('button').filter(button => button.hasAttribute('aria-expanded'))).toHaveLength(1);
    act(() => vi.advanceTimersByTime(60000)); expect(screen.getAllByRole('button').filter(button => button.hasAttribute('aria-expanded'))).toHaveLength(1);
    act(() => mark(0, 'quote', step)); act(() => mark(0, 'order', step));
    expect(screen.getAllByRole('button').filter(button => button.hasAttribute('aria-expanded'))).toHaveLength(3);
    vi.useRealTimers();
  });
});
