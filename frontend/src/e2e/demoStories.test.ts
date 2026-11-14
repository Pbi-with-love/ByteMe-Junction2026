import { describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { createElement } from 'react';
import App from '../App';
import { ReplayGatewayClient } from '../api/replay';
import { formatPresetLabel } from '../lib/format';
import level1 from '../../mocks/level1.json';
import level2 from '../../mocks/level2.json';
import level3 from '../../mocks/level3.json';
import { decisionKey } from '../api/replay';
import { optionDisclosure } from '../game/disclosure';
import { LEVELS } from '../game/levels';
import type { AgentStep } from '../api/schemas';
// These story assertions intentionally read raw mock-only metadata omitted by runtime Zod schemas.
const levels = [level1, level2, level3] as unknown as Array<{ start: { level: { levelId: string; title: string }; hearts: number }; presets: Record<string, any>; compare: any }>;
const resultFields = ['stars', 'kitchen', 'wallet', 'safety', 'heartsLeft', 'receiptText'] as const;

describe('recorded demo stories', () => {
  afterEach(() => { cleanup(); vi.useRealTimers(); });
  it('validates the seven preset paths and their recorded outcomes', () => {
    let presetCount = 0;
    for (const mock of levels) for (const [presetKey, presetValue] of Object.entries(mock.presets)) {
      const preset: any = presetValue;
      presetCount++;
      const open: string[] = preset.steps.flatMap((step: any) => step.approval?.status === 'OPEN' ? [step.approval.approvalId] : []);
      expect(Object.keys(preset.demoPath).sort(), `${mock.start.level.levelId}/${presetKey}`).toEqual([...open].sort());
      for (const [approvalId, decision] of Object.entries(preset.demoPath) as [string, string][]) {
        const recorded = preset.decisions[approvalId];
        expect(recorded, `${mock.start.level.levelId}/${presetKey}/${approvalId}`).toBeDefined();
        expect(decision.startsWith('alternative:') ? recorded?.alternative?.[decision.slice('alternative:'.length)] : recorded?.[decision]).toBeDefined();
      }
      const decisions = open.map((approvalId) => preset.demoPath[approvalId]!);
      const outcome = decisions.length ? preset.outcomes?.[decisionKey(decisions)] : preset;
      expect(outcome, `${mock.start.level.levelId}/${presetKey}`).toBeDefined();
      for (const field of resultFields) expect(outcome?.result[field], `${mock.start.level.levelId}/${presetKey}/${field}`).toEqual(preset.result[field]);
    }
    expect(presetCount).toBe(7);
  });

  it('plays every preset through the UI and checks its recorded result and comparison', async () => {
    vi.useFakeTimers();
    let stage = 'starting';
    const advanceUntil = async (predicate: () => boolean, limit = 180_000) => {
      for (let elapsed = 0; elapsed < limit; elapsed += 250) {
        if (predicate()) return;
        await act(async () => { await vi.advanceTimersByTimeAsync(250); });
      }
      throw new Error(`Story timed out at ${stage} after ${limit} virtual milliseconds`);
    };
    const clickWhenReady = async (name: string) => {
      const target = () => screen.queryAllByRole('button', { name }).find((button) => {
        const element = button as HTMLButtonElement;
        return !element.disabled && element.getAttribute('aria-disabled') !== 'true' && !element.closest('[hidden]');
      });
      await advanceUntil(() => Boolean(target()));
      fireEvent.click(target()!);
      await act(async () => {});
    };
    render(createElement(App, { client: new ReplayGatewayClient() }));
    for (const mock of levels) for (const [presetKey, preset] of Object.entries(mock.presets) as [string, any][]) {
      const levelId = mock.start.level.levelId;
      stage = `${levelId}/${presetKey}: selecting level`;
      const title = LEVELS.find((level) => level.levelId === levelId)!.title;
      const article = () => screen.queryAllByRole('article').find((item) => item.querySelector('h2')?.textContent === title);
      await advanceUntil(() => Boolean(article()?.querySelector('button')));
      fireEvent.click(article()!.querySelector('button')!);
      await clickWhenReady('Go to the kitchen');
      await clickWhenReady('Manager Desk');
      await clickWhenReady('Write the mandate');
      await clickWhenReady(formatPresetLabel(presetKey));
      await clickWhenReady('Sign mandate');
      await advanceUntil(() => Boolean(screen.queryByText(preset.mandate.summaryText)));
      fireEvent.keyDown(document, { key: 'Escape' });
      await clickWhenReady('Order Terminal');
      await clickWhenReady('Send to agent');
      stage = `${levelId}/${presetKey}: handling approvals`;
      const openApprovals = preset.steps.filter((step: any) => step.approval?.status === 'OPEN');
      for (const step of openApprovals) {
        const decision = preset.demoPath[step.approval.approvalId];
        if (decision === 'approved') await clickWhenReady('Approve');
        else if (decision === 'rejected') await clickWhenReady('Reject');
        else if (decision?.startsWith('alternative:')) {
          await clickWhenReady('Choose other');
          const summary = step.approval.options.find((option: any) => option.planId === decision.slice('alternative:'.length)).summary;
          const alternative = () => screen.queryAllByRole('button').find((button) => button.textContent?.includes(summary) && !button.closest('[hidden]'));
          await advanceUntil(() => Boolean(alternative()));
          fireEvent.click(alternative()!);
        } else if (decision !== 'expired') throw new Error(`${levelId}/${presetKey}: missing scripted choice`);
      }
      await clickWhenReady('See result');
      stage = `${levelId}/${presetKey}: waiting for result`;
      const outcome = openApprovals.length ? preset.outcomes[decisionKey(openApprovals.map((step: any) => preset.demoPath[step.approval.approvalId]))] : preset;
      await advanceUntil(() => Boolean(screen.queryByRole('dialog', { name: outcome.result.incident ? 'Safety incident' : 'Result' })));
      const resultDialog = screen.getByRole('dialog', { name: outcome.result.incident ? 'Safety incident' : 'Result' });
      for (const [name, value] of [['Kitchen', outcome.result.kitchen], ['Wallet', outcome.result.wallet], ['Safety', outcome.result.safety]] as const) {
        expect(resultDialog.querySelector(`[role="meter"][aria-label="${name}"]`)?.getAttribute('aria-valuenow'), `${levelId}/${presetKey} ${name}`).toBe(String(value));
      }
      expect(resultDialog).toHaveTextContent(`${outcome.result.stars} of 3 stars`);
      expect(resultDialog).toHaveTextContent(`${outcome.result.heartsLeft} of ${mock.start.hearts} hearts left`);
      expect(resultDialog.querySelector('.result-receipt-copy')?.textContent).toBe(outcome.result.receiptText);
      expect(Boolean(screen.queryByRole('heading', { name: 'Safety incident' }))).toBe(outcome.result.incident !== null);
      expect(screen.getAllByRole('status').some((status) => status.textContent?.includes(`Log verified · ${preset.verify.headHash}`))).toBe(true);

      await clickWhenReady('Compare presets');
      stage = `${levelId}/${presetKey}: compare`;
      await advanceUntil(() => Boolean(screen.queryByRole('heading', { name: 'Agents don’t need a chatbot. They need a mandate.' })));
      const headers = screen.getAllByRole('columnheader').slice(1).map((item) => (item.textContent ?? '').replace(/\s+/g, ' ').trim());
      const compareKeys = Object.keys(mock.compare.presets);
      expect(headers).toHaveLength(compareKeys.length);
      compareKeys.forEach((key: string, index: number) => expect(headers[index]).toContain(formatPresetLabel(key)));
      await clickWhenReady('Back to levels');
      stage = `${levelId}/${presetKey}: returning to levels`;
    }
  }, 60_000);

  it('records the disclosed Level 1 late trap choice and its Kitchen penalty', () => {
    const preset: any = level1.presets.balanced;
    const step = preset.steps.find((candidate: any) => candidate.approval?.status === 'OPEN')!;
    const trapPlan = Object.entries(preset.traps[step.approval!.approvalId]!)[0]![0];
    const disclosure = optionDisclosure(trapPlan, step as unknown as AgentStep);
    expect(disclosure.lateLines.length).toBeGreaterThan(0);
    const decision = trapPlan === step.order.planId ? 'approved' : `alternative:${trapPlan}`;
    const path = [decision];
    const outcome = preset.outcomes[decisionKey(path)];
    expect(outcome).toBeDefined();
    expect(outcome!.result.kitchen).toBeLessThan(preset.result.kitchen);
    expect(outcome!.result.receiptText).toContain('did not arrive on time');
  });
});
