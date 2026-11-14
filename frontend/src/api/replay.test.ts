import { describe, expect, it } from 'vitest';
import discovery from '../../mocks/discovery.json';
import level1 from '../../mocks/level1.json';
import level2 from '../../mocks/level2.json';
import level3 from '../../mocks/level3.json';
import { GatewayError } from './gateway';
import type { Mandate } from './schemas';
import { controlsOf, toDraft } from './mandate';
import { ReplayGatewayClient } from './replay';

const mocks = [level1, level2, level3];

describe('ReplayGatewayClient', () => {
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


  it('lists recorded mandates and signs every recorded preset by its four controls', async () => {
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
