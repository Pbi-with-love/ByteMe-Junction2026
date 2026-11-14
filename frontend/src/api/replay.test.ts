import { describe, expect, it } from 'vitest';
import discovery from '../../mocks/discovery.json';
import level1 from '../../mocks/level1.json';
import level2 from '../../mocks/level2.json';
import level3 from '../../mocks/level3.json';
import { createGatewayClient, GatewayError } from './gateway';
import type { LevelMock, Mandate } from './schemas';
import { controlsOf, toDraft } from './mandate';
import { ReplayGatewayClient } from './replay';

const mocks = [level1, level2, level3] as unknown as LevelMock[];

describe('ReplayGatewayClient', () => {
  it('returns each recording’s log and verification with exclusive since and limit', async () => {
    const client = new ReplayGatewayClient();
    for (const mock of mocks) for (const [preset, recording] of Object.entries(mock.presets)) {
      const start = await client.startLevel(mock.start.level.levelId, preset);
      expect(await client.getLog('buyer')).toEqual({ events: recording.log });
      expect(await client.verifyLog()).toEqual(recording.verify);
      expect(await client.getLog('buyer', { since: recording.log![0]!.seq, limit: 1 })).toEqual({ events: recording.log!.slice(1, 2) });
    }
  });

  it('checks every mock preset log integrity and serves the configured tamper demonstration', async () => {
    for (const mock of mocks) for (const [preset, recording] of Object.entries(mock.presets)) {
      if (!recording.log || !recording.verify) continue;
      expect(recording.verify).toMatchObject({ valid: true, events: recording.log.length, headHash: recording.log.at(-1)?.hash });
      if (recording.verify.valid) expect(recording.verify.headHash).toBe(recording.result.logHeadHash);
    }
    const client = createGatewayClient({ VITE_GATEWAY_MODE: 'replay', VITE_REPLAY_TAMPER: '1' }) as ReplayGatewayClient;
    const mock = mocks.find((item) => item.tamperedDemo)!;
    const start = await client.startLevel(mock.start.level.levelId, mock.tamperedDemo!.preset);
    expect(await client.getLog('buyer')).toEqual({ events: mock.tamperedDemo!.log });
    expect(await client.verifyLog()).toEqual(mock.tamperedDemo!.verify);
    expect(await client.getLog('buyer', { since: 1, limit: 1 })).toEqual({ events: mock.tamperedDemo!.log.filter((event) => event.seq > 1).slice(0, 1) });
  });

  it('returns NOT_FOUND before a session or for absent log data', async () => {
    const client = new ReplayGatewayClient();
    await expect(client.getLog('buyer')).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 });
    await expect(client.verifyLog()).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 });
    const start = await client.startLevel('level1', 'balanced');
    expect(await client.getLog('valio')).toEqual({ events: level1.presets.balanced.valioLog });
    expect(start.sessionId).toBeTruthy();
  });

  it('returns the recorded Valio log and probe without deriving it from buyer events', async () => {
    const client = new ReplayGatewayClient();
    for (const mock of mocks) for (const [preset, recording] of Object.entries(mock.presets)) {
      await client.startLevel(mock.start.level.levelId, preset);
      expect(await client.getLog('valio')).toEqual({ events: recording.valioLog });
    }
    const probeClient = createGatewayClient({ VITE_GATEWAY_MODE: 'replay', VITE_REPLAY_PROBE: '1' });
    await probeClient.startLevel(level1.start.level.levelId, level1.dataBoundaryDemo!.preset);
    expect(await probeClient.getLog('valio')).toEqual({ events: level1.dataBoundaryDemo!.valioLog });
    expect(await probeClient.getLog('buyer')).toEqual({ events: level1.presets.balanced.log });
  });
  it('looks up starts, steps, results, comparisons, and discovery directly from mocks', async () => {
    const client = new ReplayGatewayClient();
    expect(await client.discovery()).toEqual(discovery.response);

    for (const mock of mocks) {
      for (const [preset, recording] of Object.entries(mock.presets)) {
        const start = await client.startLevel(mock.start.level.levelId, preset);
        expect(start).toEqual(mock.start);
        const steps = await Promise.all(recording.steps.map(() => client.nextStep(start.sessionId)));
        expect(steps).toEqual(recording.steps);
        expect(await client.nextStep(start.sessionId)).toBeNull();
        expect(await client.getResult(start.sessionId)).toEqual(recording.result);
        expect(await client.startLevel(mock.start.level.levelId, preset)).toEqual(mock.start);
        expect(await client.nextStep(start.sessionId)).toEqual(recording.steps[0] ?? null);
      }
      expect(await client.compare(mock.start.level.levelId)).toEqual(mock.compare);
    }
  });


  it('lists recorded mandates and signs every recorded preset by its five controls', async () => {
    const client = new ReplayGatewayClient();
    for (const mock of mocks) {
      const levelId = mock.start.level.levelId;
      const listed = await client.presets(levelId);
      expect(Object.keys(listed)).toEqual(Object.keys(mock.presets));
      expect(listed).toEqual(Object.fromEntries(Object.entries(mock.presets).map(([key, recording]) => [key, recording.mandate])));
      for (const [key, recording] of Object.entries(mock.presets)) {
        const start = await client.startLevel(levelId, Object.keys(mock.presets)[0]);
        expect(await client.signMandate(start.sessionId, toDraft(recording.mandate, controlsOf(recording.mandate)))).toEqual(recording.mandate);
        expect(await client.nextStep(start.sessionId)).toEqual(recording.steps[0] ?? null);
      }
    }
  });

  it('rejects unknown levels, sessions, and unmatched control combinations', async () => {
    const client = new ReplayGatewayClient();
    await expect(client.presets('unknown')).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 });
    await expect(client.signMandate('unknown', {} as never)).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 });
    const start = await client.startLevel(level1.start.level.levelId, Object.keys(level1.presets)[0]);
    const base = Object.values(level1.presets)[0].mandate as Mandate;
    const draft = toDraft(base, { ...controlsOf(base), perOrderEur: Number.MAX_SAFE_INTEGER });
    await expect(client.signMandate(start.sessionId, draft)).rejects.toMatchObject({ code: 'NO_RECORDING', httpStatus: 404, message: 'Replay has no recorded mandate for these values. Pick a preset, or use a live gateway.' });
  });

  it('includes priority when matching a replay mandate', async () => {
    const client = new ReplayGatewayClient();
    const key = Object.keys(level1.presets)[0];
    const start = await client.startLevel(level1.start.level.levelId, key);
    const mandate = Object.values(level1.presets)[0].mandate as Mandate;
    const controls = controlsOf(mandate);
    const altered = controls.priority === 'price' ? 'on_time' : 'price';
    await expect(client.signMandate(start.sessionId, toDraft(mandate, { ...controls, priority: altered }))).rejects.toMatchObject({ code: 'NO_RECORDING' });
  });

  it('rejects unknown levels, presets, and sessions with NOT_FOUND', async () => {
    const client = new ReplayGatewayClient();
    const actions = [
      client.startLevel('missing', 'x'),
      client.startLevel(level1.start.level.levelId, 'missing'),
      client.nextStep('missing'),
      client.getResult('missing'),
      client.compare('missing'),
    ];
    for (const action of actions) {
      await expect(action).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 });
      await expect(action).rejects.toBeInstanceOf(GatewayError);
    }
  });
});
