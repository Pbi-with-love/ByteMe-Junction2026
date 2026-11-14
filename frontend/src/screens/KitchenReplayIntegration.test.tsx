import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import level1 from '../../mocks/level1.json';
import level2 from '../../mocks/level2.json';
import level3 from '../../mocks/level3.json';
import discovery from '../../mocks/discovery.json';
import type { LevelMock, Discovery, Mandate } from '../api/schemas';
import { ReplayGatewayClient } from '../api/replay';
import { toTimelineEntries } from '../game/timeline';
import { fakeWorld, resetFakeWorld } from '../world/fakeWorld';
import KitchenScreen from './KitchenScreen';

const levels = [level1, level2, level3] as LevelMock[];
const cases = levels.flatMap(level => Object.entries(level.presets).map(([preset, recording]) => ({ level, preset, recording })));
const labelFor = (preset: string) => preset.replaceAll('_', ' ').replace(/^./, value => value.toUpperCase());

describe('KitchenScreen replay integration', () => {
  afterEach(() => vi.useRealTimers());
  it.each(cases)('$level.start.level.levelId / $preset reveals mock steps at director marks', async ({ level, preset, recording }) => {
    resetFakeWorld();
    const client = new ReplayGatewayClient();
    const startLevel = vi.spyOn(client, 'startLevel');
    const start = await client.startLevel(level.start.level.levelId, preset);
    const presets = Object.fromEntries(Object.entries(level.presets).map(([key, value]) => [key, value.mandate])) as Record<string, Mandate>;
    render(<KitchenScreen client={client} start={start} presets={presets} discovery={discovery.response as Discovery} onExit={() => {}} onPlayAgain={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Manager Desk' }));
    fireEvent.click(screen.getByRole('button', { name: 'Write the mandate' }));
    fireEvent.click(screen.getByRole('button', { name: labelFor(preset) }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign mandate' }));
    await screen.findByText(recording.mandate.summaryText);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Order Terminal' }));
    expect(screen.getByRole('timer', { name: 'Game clock' })).toHaveTextContent(start.clock.start);
    expect(screen.getByRole('log', { name: 'Activity log' })).toHaveTextContent('No agent activity yet.');
    fireEvent.click(screen.getByRole('button', { name: 'Send to agent' }));
    expect(startLevel).toHaveBeenCalledOnce();
    for (const step of recording.steps) if(step.approval?.status==='OPEN') fireEvent.click(await screen.findByRole('button',{name:'Approve'}, {timeout:15000}));
    expect(await screen.findByRole('dialog', { name: 'The agent is done.' }, {timeout:15000})).toBeInTheDocument();

    const expected = recording.steps.flatMap((step, index) => toTimelineEntries(step, index));
    const log = screen.getByRole('log', { name: 'Activity log' });
    const cards = within(log).getAllByRole('article');
    expect(cards).toHaveLength(expected.length);
    expect(cards.map(card => card.getAttribute('data-entry-id'))).toEqual(expected.map(entry => entry.id));
    for (const [index, entry] of expected.entries()) {
      const badge = cards[index]!.querySelector('button [data-light]');
      expect(badge?.getAttribute('data-light') ?? null).toBe(entry.light);
    }
    vi.useFakeTimers();
    const finalTime = screen.getByRole('timer', { name: 'Game clock' }).textContent;
    expect(finalTime).not.toBe(start.clock.start);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(screen.getByRole('timer', { name: 'Game clock' })).toHaveTextContent(finalTime ?? '');
    if (level.start.level.levelId === 'level2' && recording.steps.length === 2) {
      expect(cards[2]!.getAttribute('data-entry-id')).toBe('0-order');
      expect(cards[3]!.getAttribute('data-entry-id')).toBe('1-search');
    }
    vi.useRealTimers();
  },30000);
});
