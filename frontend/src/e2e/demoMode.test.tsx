import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { GatewayClient } from '../api/gateway';
import { ReplayGatewayClient } from '../api/replay';
import level1 from '../../mocks/level1.json';
import { DEMO, DEMO_BEAT_MS, DEMO_RESULT_HOLD_MS } from '../game/demo';

type Call = [string, unknown[]];
function recordingClient() {
  const calls: Call[] = [];
  const source = new ReplayGatewayClient();
  const client = new Proxy(source, {
    get(target, property) {
      const value = Reflect.get(target, property, target);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => { calls.push([String(property), args]); return value.apply(target, args); };
    },
  }) as GatewayClient;
  return { client, calls };
}

async function pumpUntil(predicate: () => boolean, limit = 600_000) {
  for (let elapsed = 0; elapsed < limit; elapsed += 250) {
    if (predicate()) return;
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
  }
  throw new Error(`Timed out after ${limit} virtual milliseconds`);
}

function visibleButton(name: string) {
  return screen.queryAllByRole('button', { name }).find((element) => { const button = element as HTMLButtonElement; return !button.disabled && button.getAttribute('aria-disabled') !== 'true' && !button.closest('[hidden]'); }) as HTMLButtonElement | undefined;
}

async function clickWhenReady(name: string) {
  await pumpUntil(() => Boolean(visibleButton(name)));
  fireEvent.click(visibleButton(name)!);
  await act(async () => {});
}

async function playDemoByHand() {
  const title = level1.start.level.title;
  const article = screen.getAllByRole('article').find((item) => item.querySelector('h2')?.textContent === title)!;
  fireEvent.click(article.querySelector('button')!);
  await clickWhenReady('Go to the kitchen');
  await clickWhenReady('Manager Desk');
  await clickWhenReady('Write the mandate');
  await clickWhenReady('Balanced');
  await clickWhenReady('Sign mandate');
  await pumpUntil(() => Boolean(screen.queryByText(level1.presets.balanced.mandate.summaryText)));
  fireEvent.keyDown(document, { key: 'Escape' });
  await clickWhenReady('Order Terminal');
  await clickWhenReady('Send to agent');
  for (const step of level1.presets.balanced.steps) {
    if (step.approval?.status === 'OPEN') await clickWhenReady((level1.presets.balanced.demoPath as Record<string, string>)[step.approval.approvalId] === 'approved' ? 'Approve' : 'Reject');
  }
  await clickWhenReady('See result');
  await clickWhenReady('See it from Valio Aimo’s side');
  await clickWhenReady('Back to results');
  await clickWhenReady('Compare presets');
  await pumpUntil(() => Boolean(screen.queryByRole('heading', { name: 'Agents don’t need a chatbot. They need a mandate.' })));
}

describe('Run demo App flow', () => {
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('makes the same recorded gateway calls as the manual Level 1 Balanced path', async () => {
    vi.useFakeTimers();
    const automated = recordingClient();
    render(<App client={automated.client} />);
    await pumpUntil(() => Boolean(screen.queryByRole('button', { name: 'Run demo' })));
    fireEvent.click(screen.getByRole('button', { name: 'Run demo' }));
    await pumpUntil(() => Boolean(screen.queryByRole('heading', { name: 'Agents don’t need a chatbot. They need a mandate.' })));
    await pumpUntil(() => automated.calls.some(([method]) => method === 'compare'));

    cleanup();
    const manual = recordingClient();
    render(<App client={manual.client} />);
    await pumpUntil(() => Boolean(screen.queryByRole('button', { name: 'Run demo' })));
    await playDemoByHand();
    expect(automated.calls).toEqual(manual.calls);
    expect(automated.calls.filter(([method]) => method === 'decideApproval')).toHaveLength(DEMO.decisions.length);
    expect(DEMO_BEAT_MS).toBeGreaterThan(0);
    expect(DEMO_RESULT_HOLD_MS).toBe(3000);
  }, 30_000);

  it('aborts on Back to levels and can run again afterward', async () => {
    vi.useFakeTimers();
    const recorded = recordingClient();
    render(<App client={recorded.client} />);
    await pumpUntil(() => Boolean(screen.queryByRole('button', { name: 'Run demo' })));
    fireEvent.click(screen.getByRole('button', { name: 'Run demo' }));
    await pumpUntil(() => Boolean(visibleButton('Approve')));
    const clicks = vi.spyOn(HTMLElement.prototype, 'click');
    fireEvent.click(screen.getByRole('button', { name: 'Back to levels' }));
    await pumpUntil(() => Boolean(screen.queryByRole('heading', { name: 'Agent Kitchen' })));
    const callCount = recorded.calls.length;
    const clickCount = clicks.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(recorded.calls).toHaveLength(callCount);
    expect(clicks).toHaveBeenCalledTimes(clickCount);
    clicks.mockRestore();

    fireEvent.click(screen.getByRole('button', { name: 'Run demo' }));
    await pumpUntil(() => Boolean(screen.queryByRole('heading', { name: 'Agents don’t need a chatbot. They need a mandate.' })));
  }, 30_000);

  it('pauses the narrator clock and exits without leaving demo UI behind', async () => {
    vi.useFakeTimers();
    const recorded = recordingClient();
    render(<App client={recorded.client} />);
    await pumpUntil(() => Boolean(screen.queryByRole('button', { name: 'Run demo' })));
    fireEvent.click(screen.getByRole('button', { name: 'Run demo' }));
    await pumpUntil(() => Boolean(screen.queryByText('1 of 15')));
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(12_000); });
    expect(screen.getByText('1 of 15')).toBeInTheDocument();
    expect(recorded.calls.some(([method]) => method === 'presets')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await pumpUntil(() => Boolean(screen.queryByText('2 of 15')));
    fireEvent.click(screen.getByRole('button', { name: 'Exit demo' }));
    expect(screen.queryByText('DEMO')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    expect(screen.queryByText('DEMO')).not.toBeInTheDocument();
  }, 30_000);
});
