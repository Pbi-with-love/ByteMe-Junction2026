import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import level1 from '../../mocks/level1.json';
import discovery from '../../mocks/discovery.json';
import MandateScreen from './MandateScreen';
import type { Discovery, Mandate } from '../api/schemas';
import { ReplayGatewayClient } from '../api/replay';

describe('mandate screen', () => {
  it('uses the reduced motion stamp when the preference matches', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({ matches: true, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false }));
    const client = new ReplayGatewayClient();
    const presetEntries = Object.entries(level1.presets).map(([key, recording]) => [key, recording.mandate] as const);
    const presets = Object.fromEntries(presetEntries) as Record<string, Mandate>;
    await client.startLevel(level1.start.level.levelId, presetEntries[0][0]);
    render(<MandateScreen client={client} sessionId={level1.start.sessionId} presets={presets} discovery={discovery.response as Discovery} level={level1.start.level} onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign mandate' }));
    expect(await screen.findByLabelText('Gateway signed')).toHaveAttribute('data-motion', 'reduced');
    vi.restoreAllMocks();
  });

  it('renders native controls and signs using the returned mandate summary', async () => {
    const client = new ReplayGatewayClient();
    const presetEntries = Object.entries(level1.presets).map(([key, recording]) => [key, recording.mandate] as const);
    const presets = Object.fromEntries(presetEntries) as Record<string, Mandate>;
    await client.startLevel(level1.start.level.levelId, presetEntries[0][0]);
    render(<MandateScreen client={client} sessionId={level1.start.sessionId} presets={presets} discovery={discovery.response as Discovery} level={level1.start.level} onBack={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Mandate terms' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /per-order limit/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /priority/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'on-time delivery' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'lowest price' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign mandate' }));
    await screen.findByText(presetEntries[0][1].summaryText);
  });

  it('treats a priority-only replay mismatch as custom and reports the sign error', async () => {
    const client = new ReplayGatewayClient();
    const entries = Object.entries(level1.presets);
    const presets = Object.fromEntries(entries.map(([key, recording]) => [key, recording.mandate])) as Record<string, Mandate>;
    await client.startLevel(level1.start.level.levelId, entries[0][0]);
    render(<MandateScreen client={client} sessionId={level1.start.sessionId} presets={presets} discovery={discovery.response as Discovery} level={level1.start.level} onBack={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Balanced' }));
    fireEvent.change(screen.getByRole('combobox', { name: /priority/i }), { target: { value: 'price' } });
    expect(screen.getByText('Custom')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign mandate' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Replay has no recorded mandate');
  });




  it('shows unmatched replay values as custom and restores controls after a sign error', async () => {
    const client = new ReplayGatewayClient();
    const entries = Object.entries(level1.presets);
    const presets = Object.fromEntries(entries.map(([key, recording]) => [key, recording.mandate])) as Record<string, Mandate>;
    await client.startLevel(level1.start.level.levelId, entries[0][0]);
    render(<MandateScreen client={client} sessionId={level1.start.sessionId} presets={presets} discovery={discovery.response as Discovery} level={level1.start.level} onBack={() => {}} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByText('Custom')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign mandate' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Replay has no recorded mandate for these values. Pick a preset, or use a live gateway.');
    expect(screen.queryByLabelText('Gateway signed')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign mandate' })).toBeEnabled();
    expect(screen.getByRole('checkbox')).toBeEnabled();
  });

  it('renders the exact recorded summary after signing every level one preset', async () => {
    const client = new ReplayGatewayClient();
    for (const [key, recording] of Object.entries(level1.presets)) {
      await client.startLevel(level1.start.level.levelId, key);
      const presets = Object.fromEntries(Object.entries(level1.presets).map(([name, value]) => [name, value.mandate])) as Record<string, Mandate>;
      const { unmount } = render(<MandateScreen client={client} sessionId={level1.start.sessionId} presets={presets} discovery={discovery.response as Discovery} level={level1.start.level} onBack={() => {}} />);
      const label = key.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
      fireEvent.click(screen.getByRole('button', { name: label }));
      fireEvent.click(screen.getByRole('button', { name: 'Sign mandate' }));
      expect(await screen.findByText(recording.mandate.summaryText)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Mandate signed' })).toHaveFocus();
      unmount(); cleanup();
    }
  });
});
