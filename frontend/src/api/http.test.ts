import { afterEach, describe, expect, it, vi } from 'vitest';
import discovery from '../../mocks/discovery.json';
import level1 from '../../mocks/level1.json';
import { GatewayError } from './gateway';
import type { Mandate } from './schemas';
import { HttpGatewayClient } from './http';
import { controlsOf, toDraft } from './mandate';

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('HttpGatewayClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses discovery and start URLs, request method, body, and token behavior', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(discovery.response))
      .mockResolvedValueOnce(response(level1.start))
      .mockResolvedValueOnce(response(level1.presets.strict.result))
      .mockResolvedValueOnce(response(level1.compare));
    vi.stubGlobal('fetch', fetchMock);
    const client = new HttpGatewayClient('http://gw.test');

    await client.discovery();
    expect(fetchMock.mock.calls[0][0]).toBe('http://gw.test/.well-known/agent-commerce.json');
    expect(fetchMock.mock.calls[0][1]?.headers).not.toHaveProperty('Authorization');
    await client.startLevel(level1.start.level.levelId, Object.keys(level1.presets)[0]);
    expect(fetchMock.mock.calls[1][0]).toBe(`http://gw.test/v1/game/levels/${level1.start.level.levelId}/start`);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset: Object.keys(level1.presets)[0], mode: 'live' }),
    });

    await client.getResult(level1.start.sessionId);
    expect(fetchMock.mock.calls[2][0]).toBe(`http://gw.test/v1/game/sessions/${level1.start.sessionId}/result`);
    await client.compare(level1.start.level.levelId);
    expect(fetchMock.mock.calls[3][0]).toBe(`http://gw.test/v1/game/levels/${level1.start.level.levelId}/compare`);
    expect(fetchMock.mock.calls[2][1]?.headers).toMatchObject({ Authorization: `Bearer ${level1.start.tokens.human}` });
    expect(fetchMock.mock.calls[3][1]?.headers).toMatchObject({ Authorization: `Bearer ${level1.start.tokens.human}` });
  });


  it('posts only the mandate draft with the human bearer token and rejects presets without fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response(level1.start)).mockResolvedValueOnce(response(Object.values(level1.presets)[0].mandate, 201));
    vi.stubGlobal('fetch', fetchMock);
    const client = new HttpGatewayClient('http://gw.test');
    await client.startLevel(level1.start.level.levelId, Object.keys(level1.presets)[0]);
    const mandate = Object.values(level1.presets)[0].mandate as Mandate;
    const draft = toDraft(mandate, controlsOf(mandate));
    await client.signMandate(level1.start.sessionId, draft);
    expect(fetchMock.mock.calls[1][0]).toBe('http://gw.test/v1/mandates');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${level1.start.tokens.human}` }, body: JSON.stringify(draft) });
    const count = fetchMock.mock.calls.length;
    await expect(client.presets(level1.start.level.levelId)).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
    expect(fetchMock).toHaveBeenCalledTimes(count);
  });

  it('maps error envelopes, bare HTTP errors, network failures, and invalid responses', async () => {
    const client = new HttpGatewayClient('http://gw.test');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ error: { code: 'NOT_FOUND', message: 'missing', requestId: 'r1', details: { id: 'x' } } }, 404))
      .mockResolvedValueOnce(response({}, 503))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(response({ nope: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(client.discovery()).rejects.toMatchObject({
      code: 'NOT_FOUND', message: 'missing', requestId: 'r1', details: { id: 'x' }, httpStatus: 404,
    });
    await expect(client.discovery()).rejects.toMatchObject({ code: 'HTTP_ERROR', httpStatus: 503 });
    await expect(client.discovery()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    await expect(client.discovery()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(client.nextStep('s')).rejects.toBeInstanceOf(GatewayError);
    await expect(client.nextStep('s')).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
  });
});
