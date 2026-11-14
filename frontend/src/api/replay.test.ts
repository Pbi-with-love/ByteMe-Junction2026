import { describe, expect, it } from 'vitest';
import discovery from '../../mocks/discovery.json';
import level1 from '../../mocks/level1.json';
import level2 from '../../mocks/level2.json';
import level3 from '../../mocks/level3.json';
import { GatewayError } from './gateway';
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
