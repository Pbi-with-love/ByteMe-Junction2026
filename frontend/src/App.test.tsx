import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import { LEVELS, LEVEL_MOCKS } from './game/levels';
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
});
