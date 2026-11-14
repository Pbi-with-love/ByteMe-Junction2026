import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('shows discovery errors without cards', async () => {
    render(<App client={makeClient(async () => { throw new Error('offline'); })} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
    expect(screen.queryByRole('article')).toBeNull();
  });
});
