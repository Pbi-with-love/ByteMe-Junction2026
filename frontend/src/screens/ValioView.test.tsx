import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import level1 from '../../mocks/level1.json';
import level2 from '../../mocks/level2.json';
import discovery from '../../mocks/discovery.json';
import { ReplayGatewayClient } from '../api/replay';
import ValioView from './ValioView';

describe('ValioView', () => {
  it('loads boundary, agents, blocked events, scenarios and disclosure rows from the client', async () => {
    const client = new ReplayGatewayClient();
    await client.startLevel('level2', 'balanced');
    const onBack = vi.fn();
    render(<ValioView client={client} onBack={onBack} />);
    expect(screen.getByText('Loading Valio view…')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Valio Aimo view' })).toBeInTheDocument();
    for (const title of ['Data boundary', 'Active agents', 'Blocked attempts', 'Scenario adjustments', 'Returned to agent vs withheld'])
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByText('Never exposed')).toBeInTheDocument();
    expect(screen.getAllByText(/never exposed/).length).toBeGreaterThan(0);
    const blockedEvent = level2.presets.balanced.valioLog.find((event) => event.light === 'RED' || event.type === 'POLICY_BLOCKED' || event.type === 'DATA_BOUNDARY_BLOCKED');
    expect(blockedEvent).toBeDefined();
    expect(screen.getAllByText(blockedEvent!.type).length).toBeGreaterThan(0);
    expect(screen.getByText('Scenario adjustment')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to results' })).toBeInTheDocument();
    expect(client).toBeTruthy(); expect(discovery.response.dataDisclosure.neverExposed).toContain('purchasePrices');
  });

  it('renders level one empty states from its recorded Valio events', async () => {
    const client = new ReplayGatewayClient();
    await client.startLevel('level1', 'balanced');
    render(<ValioView client={client} onBack={() => undefined} />);
    expect(await screen.findByText('No blocked attempts.')).toBeInTheDocument();
    expect(screen.getByText('No scenario adjustments.')).toBeInTheDocument();
  });

  it('shows no panels on load error and keeps Back to results available', async () => {
    const client = new ReplayGatewayClient();
    vi.spyOn(client, 'discovery').mockRejectedValueOnce(new Error('gateway unavailable'));
    render(<ValioView client={client} onBack={() => undefined} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('gateway unavailable');
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Data boundary' })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Back to results' })).toBeInTheDocument();
    expect(level1).toBeTruthy();
  });
});
