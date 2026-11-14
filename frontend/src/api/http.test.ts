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
  it('gets buyer logs and verifies the current human session', async () => {
    const log = { events: level1.presets.balanced.log };
    const verify = level1.presets.balanced.verify;
    const fetchMock = vi.fn().mockResolvedValueOnce(response(level1.start)).mockResolvedValueOnce(response(log)).mockResolvedValueOnce(response(verify));
    vi.stubGlobal('fetch', fetchMock);
    const client = new HttpGatewayClient('http://gw.test', 'live');
    await client.startLevel(level1.start.level.levelId, 'balanced');
    expect(await client.getLog('buyer', { since: 3, limit: 10 })).toEqual(log);
    expect(fetchMock.mock.calls[1]![0]).toBe('http://gw.test/v1/log?view=buyer&since=3&limit=10');
    expect(fetchMock.mock.calls[1]![1]?.headers).toMatchObject({ Authorization: `Bearer ${level1.start.tokens.human}` });
    expect(await client.verifyLog()).toEqual(verify);
    expect(fetchMock.mock.calls[2]![0]).toBe('http://gw.test/v1/log/verify');
  });
  it('uses a cached operator token for Valio logs while buyer logs keep the human token', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response(level1.start))
      .mockResolvedValueOnce(response({ token: 'operator-secret' }))
      .mockResolvedValueOnce(response({ events: level1.presets.balanced.valioLog }))
      .mockResolvedValueOnce(response({ events: level1.presets.balanced.log }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new HttpGatewayClient('http://gw.test');
    await client.startLevel(level1.start.level.levelId, 'balanced');
    await client.getLog('valio'); await client.getLog('buyer');
    expect(fetchMock.mock.calls[1]![0]).toBe('http://gw.test/v1/auth/tokens');
    expect(fetchMock.mock.calls[1]![1]).toMatchObject({ method: 'POST', body: JSON.stringify({ role: 'operator' }) });
    expect(fetchMock.mock.calls[2]![1]?.headers).toMatchObject({ Authorization: 'Bearer operator-secret' });
    expect(fetchMock.mock.calls[3]![1]?.headers).toMatchObject({ Authorization: `Bearer ${level1.start.tokens.human}` });
  });
  it('does not request a Valio log when operator token creation fails', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ error: { code: 'UNAUTHENTICATED', message: 'operator unavailable' } }, 401));
    vi.stubGlobal('fetch', fetchMock);
    await expect(new HttpGatewayClient('http://gw.test').getLog('valio')).rejects.toMatchObject({ code: 'UNAUTHENTICATED', message: 'operator unavailable' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('uses discovery and start URLs, request method, body, and token behavior', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(discovery.response))
      .mockResolvedValueOnce(response(level1.start))
      .mockResolvedValueOnce(response(level1.presets.strict.result))
      .mockResolvedValueOnce(response(level1.compare));
    vi.stubGlobal('fetch', fetchMock);
    const client = new HttpGatewayClient('http://gw.test', 'live');

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


  it('posts the mandate draft with the human bearer token and gets presets without auth', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response(level1.start)).mockResolvedValueOnce(response(Object.values(level1.presets)[0].mandate, 201)).mockResolvedValueOnce(response({ balanced: Object.values(level1.presets)[0].mandate }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new HttpGatewayClient('http://gw.test');
    await client.startLevel(level1.start.level.levelId, Object.keys(level1.presets)[0]);
    const mandate = Object.values(level1.presets)[0].mandate as Mandate;
    const draft = toDraft(mandate, controlsOf(mandate));
    await client.signMandate(level1.start.sessionId, draft);
    expect(fetchMock.mock.calls[1][0]).toBe('http://gw.test/v1/mandates');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${level1.start.tokens.human}` }, body: JSON.stringify(draft) });
    expect(await client.presets(level1.start.level.levelId)).toHaveProperty('balanced');
    expect(fetchMock.mock.calls[2]?.[0]).toBe(`http://gw.test/v1/game/levels/${level1.start.level.levelId}/presets`);
    expect(fetchMock.mock.calls[2]?.[1]?.headers).not.toHaveProperty('Authorization');
  });

  it('posts and gets approval decisions with the human bearer token and validates alternatives', async () => {
    const approval = level1.presets.balanced.steps[0]!.approval!;
    const body = { ...approval, decision: 'approved', orderStatus: 'CONFIRMED' };
    const wrapped = { approval: { ...approval, decision: null }, order: { status: 'CONFIRMED' } };
    const fetchMock=vi.fn().mockResolvedValueOnce(response(level1.start)).mockResolvedValueOnce(response(wrapped)).mockResolvedValueOnce(response({ ...approval, order: { status: 'CONFIRMED' } }));
    vi.stubGlobal('fetch',fetchMock);const client=new HttpGatewayClient('http://gw.test');
    await client.startLevel('level1','balanced');
    expect(await client.decideApproval('apr_l1_balanced','approved')).toEqual(body);
    expect(fetchMock.mock.calls[1]![0]).toBe('http://gw.test/v1/approvals/apr_l1_balanced');
    expect(fetchMock.mock.calls[1]![1]).toMatchObject({method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${level1.start.tokens.human}`},body:'{"decision":"approved"}'});
    expect(await client.getApproval('apr_l1_balanced')).toMatchObject(approval);
    expect(fetchMock.mock.calls[2]![1]?.headers).toMatchObject({Authorization:`Bearer ${level1.start.tokens.human}`});
    const calls=fetchMock.mock.calls.length;
    await expect(client.decideApproval('apr_l1_balanced','alternative')).rejects.toMatchObject({code:'VALIDATION_ERROR'});
    expect(fetchMock).toHaveBeenCalledTimes(calls);
  });

  it('adapts wrapped approval decisions and accepts an extra order on approval reads', async () => {
    const approval = level1.presets.balanced.steps[0]!.approval!;
    const wrapped = { approval: { ...approval, decision: null }, order: { status: 'CONFIRMED' } };
    const fetchMock = vi.fn().mockResolvedValueOnce(response(level1.start)).mockResolvedValueOnce(response(wrapped)).mockResolvedValueOnce(response({ ...approval, order: { status: 'PENDING_APPROVAL' } }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new HttpGatewayClient('http://gw.test');
    await client.startLevel('level1', 'balanced');
    expect(await client.decideApproval(approval.approvalId, 'approved')).toMatchObject({ approvalId: approval.approvalId, decision: 'approved', orderStatus: 'CONFIRMED' });
    expect(await client.getApproval(approval.approvalId)).toMatchObject({ approvalId: approval.approvalId, order: { status: 'PENDING_APPROVAL' } });
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
    // nextStep requires a started session and is covered by the live polling tests.
  });

  it('times out discovery after five seconds with the gateway URL and startup hint', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));
    const discoveryRequest = new HttpGatewayClient('http://127.0.0.1:8000').discovery();
    const rejection = expect(discoveryRequest).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      message: 'The gateway at http://127.0.0.1:8000 did not respond in 5 seconds. Start the backend or set VITE_GATEWAY_MODE=replay.',
    });

    await vi.advanceTimersByTimeAsync(5_000);
    await rejection;
  });

  it('does not time out a fast request', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(discovery.response)));

    await expect(new HttpGatewayClient('http://gw.test').discovery()).resolves.toEqual(discovery.response);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses the 15-second constructor default for ordinary requests', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>(() => new Promise<Response>(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    const request = new HttpGatewayClient('http://gw.test').compare('level1');
    const rejection = expect(request).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      message: 'The gateway at http://gw.test did not respond in 15 seconds. Start the backend or set VITE_GATEWAY_MODE=replay.',
    });

    await vi.advanceTimersByTimeAsync(15_000);
    await rejection;
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });
});
