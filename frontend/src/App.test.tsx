import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import { LEVELS, LEVEL_MOCKS } from './game/levels';
import discoveryData from '../mocks/discovery.json';
import type { GatewayClient } from './api/gateway';
import type { Discovery } from './api/schemas';

function makeClient(discovery: () => Promise<Discovery>): GatewayClient {
  return {
    discovery,
    startLevel: async () => { throw new Error('unused'); },
    nextStep: async () => null,
    getResult: async () => { throw new Error('unused'); },
    compare: async () => { throw new Error('unused'); },
    presets: async () => ({}),
    signMandate: async () => { throw new Error('unused'); },
  };
}

describe('level shell', () => {
  it('keeps static headings aligned with mock levels and loads the provider', async () => {
    LEVELS.forEach((level, index) => {
      expect(level).toEqual({ levelId: LEVEL_MOCKS[index].start.level.levelId, title: LEVEL_MOCKS[index].start.level.title });
    });
    render(<App client={makeClient(async () => ({ provider: 'Mock Gateway' } as Discovery))} />);
    await screen.findByText('Mock Gateway');
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });

  it('shows start errors without the brief and returns to levels on Back to levels', async () => {
    const client = makeClient(async () => ({ provider: 'Mock Gateway' } as Discovery));
    client.presets = async () => { throw new Error('presets offline'); };
    render(<App client={client} />);
    fireEvent.click(await screen.findAllByRole('button', { name: 'Start level' }).then((buttons) => buttons[0]));
    expect(await screen.findByRole('alert')).toHaveTextContent('presets offline');
    expect(screen.queryByRole('article')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back to levels' }));
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });

  it('shows discovery errors without cards', async () => {
    render(<App client={makeClient(async () => { throw new Error('offline'); })} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('keeps the title heading and opens a kitchen after preset and level start', async () => {
    const client = makeClient(async () => discoveryData.response as Discovery);
    client.presets = vi.fn(async () => ({ balanced: Object.values(LEVEL_MOCKS[0].presets)[1].mandate }));
    client.startLevel = async () => ({ sessionId: 'session-1', level: LEVEL_MOCKS[0].start.level, clock: LEVEL_MOCKS[0].start.clock, hearts: 3, tokens: LEVEL_MOCKS[0].start.tokens });
    render(<App client={client} />);
    expect(await screen.findByRole('heading', { name: 'Agent Kitchen' })).toBeTruthy();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Start level' }))[0]);
    await waitFor(() => expect(screen.getByRole('region', { name: 'Kitchen' })).toBeTruthy());
    expect(client.presets).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Manager Desk' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Write the mandate' }));
    const clipboard = await screen.findByRole('dialog', { name: 'Valtakirja' });
    expect(within(clipboard).getAllByRole('heading', { name: 'Valtakirja' })).toHaveLength(1);
    expect(clipboard.querySelector('.mandate-doc')).toBeNull();
  });
});
