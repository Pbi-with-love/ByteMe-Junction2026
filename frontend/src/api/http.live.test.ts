import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  AgentStepSchema, ApprovalDecisionSchema, ApprovalSchema, CompareSchema, GameResultSchema,
  GameStartSchema, LogResponseSchema, LogVerifySchema, MandateSchema,
} from './schemas';
import { GatewayError } from './gateway';
import { HttpGatewayClient } from './http';

const fixture = JSON.parse(readFileSync(`${process.cwd()}/../tests/fixtures/live/level1-balanced.json`, 'utf8')) as Record<string, any>;
const ok = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe('live gateway contract fixture', () => {
  it('parses the gateway fixture with the frontend schemas', () => {
    expect(Object.fromEntries(Object.entries(fixture.presets).map(([key, value]) => [key, MandateSchema.parse(value)]))).toBeTruthy();
    expect(GameStartSchema.parse(fixture.start)).toBeTruthy();
    expect(fixture.session.steps.map((step: unknown) => AgentStepSchema.parse(step))).toHaveLength(fixture.session.steps.length);
    expect(ApprovalSchema.parse(fixture.approvalGet)).toBeTruthy();
    expect(ApprovalDecisionSchema.parse({ ...fixture.approvalDecision.approval, decision: 'approved', orderStatus: fixture.approvalDecision.order.status })).toBeTruthy();
    expect(GameResultSchema.parse(fixture.result)).toBeTruthy();
    expect(CompareSchema.parse(fixture.compare)).toBeTruthy();
    expect(LogResponseSchema.parse(fixture.buyerLog)).toBeTruthy();
    expect(LogResponseSchema.parse(fixture.valioLog)).toBeTruthy();
    expect(LogVerifySchema.parse(fixture.verify)).toBeTruthy();
  });
});

describe('HttpGatewayClient live game flow', () => {
  it('posts upstream mode, resets auth and cursor state, and polls steps after starting the run', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ok(fixture.start))
      .mockResolvedValueOnce(ok({ status: 'RUNNING' }))
      .mockResolvedValueOnce(ok({ status: 'RUNNING', steps: [] }))
      .mockResolvedValueOnce(ok({ status: 'RUNNING', steps: [fixture.session.steps[0]], activity: 'searching' }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new HttpGatewayClient('http://gw.test', 'replay', 0);
    await client.startLevel('level1', 'balanced');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', body: '{"preset":"balanced","mode":"replay"}' });
    await expect(client.nextStep(fixture.start.sessionId)).resolves.toEqual(AgentStepSchema.parse(fixture.session.steps[0]));
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`http://gw.test/v1/game/sessions/${fixture.start.sessionId}/run`);
    expect(fetchMock.mock.calls[2]?.[0]).toBe(`http://gw.test/v1/game/sessions/${fixture.start.sessionId}`);
    expect(fetchMock.mock.calls[2]?.[1]?.method).toBeUndefined();
    expect(fetchMock.mock.calls[2]?.[1]?.headers).toMatchObject({ Authorization: `Bearer ${fixture.start.tokens.human}` });
  });

  it('returns null once a finished session has no unconsumed steps and reports failed sessions', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ok(fixture.start)).mockResolvedValueOnce(ok({ status: 'RUNNING' })).mockResolvedValueOnce(ok({ status: 'FINISHED', steps: [] }))
      .mockResolvedValueOnce(ok(fixture.start)).mockResolvedValueOnce(ok({ status: 'RUNNING' })).mockResolvedValueOnce(ok({ status: 'FAILED', error: 'agent exploded', steps: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new HttpGatewayClient('http://gw.test', 'replay', 0);
    await client.startLevel('level1', 'balanced');
    await expect(client.nextStep(fixture.start.sessionId)).resolves.toBeNull();
    await client.startLevel('level1', 'balanced');
    await expect(client.nextStep(fixture.start.sessionId)).rejects.toMatchObject({ code: 'AGENT_FAILED', message: 'agent exploded' });
  });

  it('reuses the run and advances the per-session step cursor', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ok(fixture.start)).mockResolvedValueOnce(ok({ status: 'RUNNING' }))
      .mockResolvedValueOnce(ok({ status: 'RUNNING', steps: [fixture.session.steps[0]], activity: 'searching' }))
      .mockResolvedValueOnce(ok({ status: 'FINISHED', steps: fixture.session.steps, activity: 'idle' }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new HttpGatewayClient('http://gw.test', 'replay', 0);
    await client.startLevel('level1', 'balanced');
    await expect(client.nextStep(fixture.start.sessionId)).resolves.toEqual(AgentStepSchema.parse(fixture.session.steps[0]));
    await expect(client.nextStep(fixture.start.sessionId)).resolves.toEqual(AgentStepSchema.parse(fixture.session.steps[1]));
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/run'))).toHaveLength(1);
  });

  it('ignores INVALID_STATE on run only if the current session is already running or finished', async () => {
    const conflict = { error: { code: 'INVALID_STATE', message: 'already started' } };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ok(fixture.start)).mockResolvedValueOnce(ok(conflict, 409))
      .mockResolvedValueOnce(ok({ status: 'FINISHED', steps: [] })).mockResolvedValueOnce(ok({ status: 'FINISHED', steps: [] }))
      .mockResolvedValueOnce(ok(fixture.start)).mockResolvedValueOnce(ok(conflict, 409))
      .mockResolvedValueOnce(ok({ status: 'CREATED', steps: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new HttpGatewayClient('http://gw.test', 'replay', 0);
    await client.startLevel('level1', 'balanced');
    await expect(client.nextStep(fixture.start.sessionId)).resolves.toBeNull();
    await client.startLevel('level1', 'balanced');
    await expect(client.nextStep(fixture.start.sessionId)).rejects.toMatchObject({ code: 'INVALID_STATE', httpStatus: 409 });
  });

  it('names the gateway URL when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(new HttpGatewayClient('http://localhost:8000').discovery()).rejects.toMatchObject({
      code: 'NETWORK_ERROR', message: 'Cannot reach the gateway at http://localhost:8000. Start the backend or set VITE_GATEWAY_MODE=replay.',
    });
  });
});
