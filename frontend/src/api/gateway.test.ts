import { describe, expect, it } from 'vitest';
import { createGatewayClient, gatewayMode } from './gateway';
import { HttpGatewayClient } from './http';
import { ReplayGatewayClient } from './replay';

describe('createGatewayClient', () => {
  it('reports replay/live mode and rejects unknown modes with the established message', () => {
    expect(gatewayMode({})).toBe('live');
    expect(gatewayMode({ VITE_GATEWAY_MODE: 'replay' })).toBe('replay');
    expect(gatewayMode({ VITE_GATEWAY_MODE: 'live' })).toBe('live');
    expect(() => gatewayMode({ VITE_GATEWAY_MODE: 'other' })).toThrow('Unknown VITE_GATEWAY_MODE: other');
  });
  it('defaults to live and accepts replay explicitly', () => {
    expect(createGatewayClient({})).toBeInstanceOf(HttpGatewayClient);
    expect(createGatewayClient({ VITE_GATEWAY_MODE: 'replay' })).toBeInstanceOf(ReplayGatewayClient);
  });

  it('selects live HTTP with the configured or default URL and rejects unknown modes', () => {
    expect(createGatewayClient({ VITE_GATEWAY_MODE: 'live' }))
      .toEqual(new HttpGatewayClient('http://127.0.0.1:8000'));
    expect(createGatewayClient({ VITE_GATEWAY_MODE: 'live', VITE_GATEWAY_URL: 'http://gw.test' }))
      .toEqual(new HttpGatewayClient('http://gw.test'));
    expect(() => createGatewayClient({ VITE_GATEWAY_MODE: 'other' })).toThrow();
  });
});
