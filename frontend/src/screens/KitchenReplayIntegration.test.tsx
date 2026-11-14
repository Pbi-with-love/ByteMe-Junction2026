import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import level1 from '../../mocks/level1.json';
import level2 from '../../mocks/level2.json';
import level3 from '../../mocks/level3.json';
import discovery from '../../mocks/discovery.json';
import type { LevelMock, Discovery, Mandate } from '../api/schemas';
import { decisionKey, ReplayGatewayClient } from '../api/replay';
import { toTimelineEntries } from '../game/timeline';
import { fakeWorld, resetFakeWorld } from '../world/fakeWorld';
import KitchenScreen from './KitchenScreen';

const levels = [level1, level2, level3] as LevelMock[];
const cases = levels.flatMap(level => Object.entries(level.presets).map(([preset, recording]) => ({ level, preset, recording })));
const labelFor = (preset: string) => preset.replaceAll('_', ' ').replace(/^./, value => value.toUpperCase());

describe('KitchenScreen replay integration', () => {
  it.each(cases)('$level.start.level.levelId / $preset reveals mock steps at director marks', async ({ level, preset, recording }) => {
    resetFakeWorld();
    const client = new ReplayGatewayClient();
    const startLevel = vi.spyOn(client, 'startLevel');
    const start = await client.startLevel(level.start.level.levelId, preset);
    const presets = Object.fromEntries(Object.entries(level.presets).map(([key, value]) => [key, value.mandate])) as Record<string, Mandate>;
    const holdMs = vi.fn(async () => {});
    render(<KitchenScreen client={client} start={start} presets={presets} discovery={discovery.response as Discovery} onExit={() => {}} onPlayAgain={() => {}} holdMs={holdMs} />);
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
    const finalTime = screen.getByRole('timer', { name: 'Game clock' }).textContent;
    expect(finalTime).not.toBe(start.clock.start);
    expect(holdMs).toHaveBeenCalled();
    expect(screen.getByRole('timer', { name: 'Game clock' })).toHaveTextContent(finalTime ?? '');
    if (level.start.level.levelId === 'level2' && recording.steps.length === 2) {
      expect(cards[2]!.getAttribute('data-entry-id')).toBe('0-order');
      expect(cards[3]!.getAttribute('data-entry-id')).toBe('1-search');
    }
  }, 30_000);

  it('replays the disclosed late delivery trap and records its penalty outcome', async () => {
    resetFakeWorld();
    const preset = level1.presets.balanced as unknown as LevelMock['presets'][string] & { traps: Record<string, Record<string, string>> };
    const approval = preset.steps.find((step) => step.approval?.status === 'OPEN')!.approval!;
    const planId = Object.keys(preset.traps[approval.approvalId]!)[0]!;
    const path = `alternative:${planId}`;
    const expected = (preset.outcomes as Record<string, { result: typeof preset.result }>)[decisionKey([path])]!;
    expect(preset.traps[approval.approvalId]![planId]).toBe('late');
    expect(expected.result.kitchen).toBe(70);
    expect(expected.result.kitchen).toBeLessThan(preset.result.kitchen);

    const client = new ReplayGatewayClient();
    const start = await client.startLevel('level1', 'balanced');
    const presets = Object.fromEntries(Object.entries(level1.presets).map(([key, value]) => [key, value.mandate])) as Record<string, Mandate>;
    render(<KitchenScreen client={client} start={start} presets={presets} discovery={discovery.response as Discovery} onExit={() => {}} holdMs={async () => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Manager Desk' }));
    fireEvent.click(screen.getByRole('button', { name: 'Write the mandate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Balanced' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign mandate' }));
    await screen.findByText(preset.mandate.summaryText);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Order Terminal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send to agent' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Choose other' }));
    expect((await screen.findAllByText(/arrives .* after the deadline/)).length).toBeGreaterThan(0);
    const summary = approval.options.find((item) => item.planId === planId)!.summary;
    const option = await screen.findByRole('button', { name: (_, element) => element?.textContent?.includes(summary) ?? false });
    fireEvent.click(option);
    fireEvent.click(await screen.findByRole('button', { name: 'See result' }, { timeout: 15000 }));
    expect(await screen.findByRole('meter', { name: 'Kitchen' })).toHaveAttribute('aria-valuenow', String(expected.result.kitchen));
    expect(screen.getByText(`${expected.result.stars} of 3 stars`)).toBeInTheDocument();
    expect(screen.getByLabelText('Receipt').querySelector('.result-receipt-copy')?.textContent).toBe(expected.result.receiptText);
  }, 30000);
});
