import { describe, expect, it } from 'vitest';
import { createGatewayClient } from './gateway';
import { HttpGatewayClient } from './http';
import { ReplayGatewayClient } from './replay';

describe('createGatewayClient', () => {
  it('defaults to replay and accepts replay explicitly', () => {
    expect(createGatewayClient({})).toBeInstanceOf(ReplayGatewayClient);
    expect(createGatewayClient({ VITE_GATEWAY_MODE: 'replay' })).toBeInstanceOf(ReplayGatewayClient);
  });

  it('selects live HTTP with the configured or default URL and rejects unknown modes', () => {
    expect(createGatewayClient({ VITE_GATEWAY_MODE: 'live' }))
      .toEqual(new HttpGatewayClient('http://localhost:8000'));
    expect(createGatewayClient({ VITE_GATEWAY_MODE: 'live', VITE_GATEWAY_URL: 'http://gw.test' }))
      .toEqual(new HttpGatewayClient('http://gw.test'));
    expect(() => createGatewayClient({ VITE_GATEWAY_MODE: 'other' })).toThrow();
  });
});
