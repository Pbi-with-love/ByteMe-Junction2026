import { describe, expect, it } from 'vitest';
import discovery from '../../mocks/discovery.json';
import level1 from '../../mocks/level1.json';
import level2 from '../../mocks/level2.json';
import level3 from '../../mocks/level3.json';
import { createGatewayClient, GatewayError } from './gateway';
import type { LevelMock, Mandate } from './schemas';
import { controlsOf, toDraft } from './mandate';
import { decisionKey, ReplayGatewayClient } from './replay';

const mocks = [level1, level2, level3] as unknown as LevelMock[];

async function playRecordedPath(client: ReplayGatewayClient, sessionId: string, recording: LevelMock['presets'][string]) {
 const expectedKey=Object.entries(recording.outcomes??{}).find(([,outcome])=>JSON.stringify(outcome.result)===JSON.stringify(recording.result))?.[0]??'';
 const choices=expectedKey?expectedKey.split(','):[];let index=0;
 for(const expected of recording.steps){const step=await client.nextStep(sessionId);if(step?.approval?.status==='OPEN'){const choice=choices[index++]??'approved';if(choice==='rejected'||choice==='approved')await client.decideApproval(step.approval.approvalId,choice);else if(choice.startsWith('alternative:'))await client.decideApproval(step.approval.approvalId,'alternative',choice.slice('alternative:'.length));}}
}

describe('ReplayGatewayClient', () => {
  it('replays approval decisions once and keys results by the decision path',async()=>{
    expect(decisionKey(['approved','alternative:pln_b'])).toBe('approved,alternative:pln_b');expect(decisionKey([])).toBe('');
    const client=new ReplayGatewayClient();const start=await client.startLevel('level1','balanced');
    const decision=await client.decideApproval('apr_l1_balanced','approved');
    expect(decision).toEqual(level1.presets.balanced.decisions.apr_l1_balanced.approved.body);
    await expect(client.decideApproval('apr_l1_balanced','approved')).rejects.toMatchObject({code:'INVALID_STATE',httpStatus:409});
    expect(await client.getApproval('apr_l1_balanced')).toMatchObject(decision);
    expect(start.sessionId).toBeTruthy();
  });
  it('returns each recording’s log and verification with exclusive since and limit', async () => {
    const client = new ReplayGatewayClient();
    for (const mock of mocks) for (const [preset, recording] of Object.entries(mock.presets)) {
      const start = await client.startLevel(mock.start.level.levelId, preset);
      await playRecordedPath(client,start.sessionId,recording);
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
    const recording=mock.presets[mock.tamperedDemo!.preset]!;
    await playRecordedPath(client,start.sessionId,recording);
    expect(await client.getLog('buyer')).toEqual({ events: mock.tamperedDemo!.log });
    expect(await client.verifyLog()).toEqual(mock.tamperedDemo!.verify);
    expect(await client.getLog('buyer', { since: 1, limit: 1 })).toEqual({ events: mock.tamperedDemo!.log.filter((event) => event.seq > 1).slice(0, 1) });
  });

  it('returns NOT_FOUND before a session, for absent log data, and for Valio view', async () => {
    const client = new ReplayGatewayClient();
    await expect(client.getLog('buyer')).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 });
    await expect(client.verifyLog()).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 });
    await expect(client.getLog('valio')).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 });
    const start = await client.startLevel('level1', 'balanced');
    await playRecordedPath(client,start.sessionId,level1.presets.balanced as unknown as LevelMock['presets'][string]);
    await expect(client.getLog('valio')).resolves.toEqual({events:level1.presets.balanced.outcomes.approved.valioLog});
    expect(start.sessionId).toBeTruthy();
  });
  it('looks up starts, steps, results, comparisons, and discovery directly from mocks', async () => {
    const client = new ReplayGatewayClient();
    expect(await client.discovery()).toEqual(discovery.response);

    for (const mock of mocks) {
      for (const [preset, recording] of Object.entries(mock.presets)) {
        const start = await client.startLevel(mock.start.level.levelId, preset);
        expect(start).toEqual(mock.start);
        const steps = [];
        for (const expected of recording.steps) {
          const step = await client.nextStep(start.sessionId); steps.push(step);
          if (step?.approval?.status === 'OPEN') { const choice=Object.keys(recording.outcomes??{}).find(key=>JSON.stringify(recording.outcomes![key]!.result)===JSON.stringify(recording.result))?.split(',')[steps.filter(s=>s?.approval?.status==='OPEN').length-1]??'approved'; if(choice==='approved'||choice==='rejected')await client.decideApproval(step.approval.approvalId,choice);else if(choice.startsWith('alternative:'))await client.decideApproval(step.approval.approvalId,'alternative',choice.slice(12)); }
        }
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
