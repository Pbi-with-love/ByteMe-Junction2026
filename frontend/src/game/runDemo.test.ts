import { afterEach, describe, expect, it, vi } from 'vitest';
import { runDemo } from './runDemo';
import { DEMO_AGENT_LOG_HOLD_MS, DEMO_APPROVAL_MARGIN_MS, DEMO_BEAT_MS, DEMO_MIN_READ_MS, DEMO_POLL_MS, DEMO_SCREEN_HOLD_MS, DEMO_SPOTLIGHT_MS, DEMO_SPEED_FACTORS, DEMO_WORD_MS } from './demo';
import { computeApprovalHoldMs } from './runDemo';

describe('runDemo', () => {
  afterEach(() => vi.useRealTimers());
  it('clicks controls in order, waits between beats, and ignores hidden error panels', async () => {
    vi.useFakeTimers();
    const root = document.createElement('div'); document.body.append(root);
    const hiddenAlert = document.createElement('div'); hiddenAlert.setAttribute('role', 'alert'); hiddenAlert.hidden = true; root.append(hiddenAlert);
    const article = document.createElement('article'); const heading = document.createElement('h2'); heading.textContent = 'Level One'; article.append(heading); root.append(article);
    const clicked: string[] = [];
    const button = (name: string, parent: HTMLElement = root) => { const el = document.createElement('button'); el.textContent = name; el.onclick = () => clicked.push(name); parent.append(el); return el; };
    button('Start level', article);
    for (const name of ['Go to the kitchen', 'Manager Desk', 'Write the mandate', 'Balanced', 'Sign mandate', 'Order Terminal', 'Send to agent']) button(name);
    const controller = new AbortController();
    const promise = runDemo({ root, script: { levelId: 'level1', presetKey: 'balanced', decisions: ['approved'] }, signal: controller.signal, levelTitle: 'Level One', presetLabel: () => 'Balanced', beatMs: 10, resultHoldMs: 20, waitMs: 100 });
    await vi.advanceTimersByTimeAsync(100);
    button('Approve'); button('See result'); button('Compare presets');
    await vi.advanceTimersByTimeAsync(1000);
    expect(await promise).toBe('done');
    expect(clicked).toEqual(['Start level', 'Go to the kitchen', 'Manager Desk', 'Write the mandate', 'Balanced', 'Sign mandate', 'Order Terminal', 'Send to agent', 'Approve', 'See result', 'Compare presets']);
    root.remove();
  });
  it('stops on a visible error panel without clicking further', async () => {
    const root = document.createElement('div'); document.body.append(root);
    const alert = document.createElement('div'); alert.setAttribute('role', 'alert'); root.append(alert);
    const controller = new AbortController();
    await expect(runDemo({ root, script: { levelId: 'level1', presetKey: 'balanced', decisions: [] }, signal: controller.signal, levelTitle: 'Level One', presetLabel: () => 'Balanced', beatMs: 0, waitMs: 1 })).resolves.toBe('stuck');
    root.remove();
  });
  it('spotlights before each click and clicks approval within its real-time window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-14T10:00:00Z'));
    const root = document.createElement('div'); document.body.append(root);
    const article = document.createElement('article'), heading = document.createElement('h2'); heading.textContent = 'Level One'; article.append(heading); root.append(article);
    const clickedAt = new Map<string, number>();
    const button = (name: string, parent: HTMLElement = root) => { const element = document.createElement('button'); element.textContent = name; element.onclick = () => { expect(element).toHaveClass('demo-spotlight'); clickedAt.set(name, Date.now()); }; parent.append(element); return element; };
    button('Start level', article);
    for (const name of ['Go to the kitchen', 'Manager Desk', 'Write the mandate', 'Balanced', 'Sign mandate', 'Order Terminal', 'Send to agent', 'Approve', 'See result', 'See it from Valio Aimo’s side', 'Back to results', 'Compare presets']) button(name);
    let approvalAt = 0; let firstSpotlightAt = 0;
    const controller = new AbortController();
    const promise = runDemo({ root, script: { levelId: 'level1', presetKey: 'balanced', decisions: ['approved'] }, signal: controller.signal, levelTitle: 'Level One', presetLabel: () => 'Balanced', beatMs: 10, waitMs: 100, values: () => ({ stars: '3', compareLoaded: 'true', activity_search: 'true', activity_quote: 'true', activity_order: 'true', approvalDeadline: new Date(Date.now() + 20_000).toISOString() }), spotlight: (element) => { if (element.textContent === 'Start level') firstSpotlightAt = Date.now(); element.classList.add('demo-spotlight'); }, present: (card, step, holdMs) => {
      if (step === 9) { approvalAt = Date.now(); expect(card.pauseDisabled).toBe(true); expect(holdMs).toBe(20_000 - DEMO_APPROVAL_MARGIN_MS); return new Promise<void>((resolve) => setTimeout(resolve, holdMs)); }
      return Promise.resolve();
    } });
    let outcome: Awaited<typeof promise> | undefined;
    void promise.then((value) => { outcome = value; });
    for (let elapsed = 0; elapsed < 200_000 && outcome === undefined; elapsed += 250) await vi.advanceTimersByTimeAsync(250);
    expect(outcome).toBe('done');
    expect(clickedAt.get('Approve')! - approvalAt).toBeLessThanOrEqual(20_000);
    expect(clickedAt.get('Start level')! - firstSpotlightAt).toBeGreaterThanOrEqual(DEMO_SPOTLIGHT_MS);
    root.remove();
  });
  it('limits the approval narration using its gateway deadline at both 20 and 60 seconds', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-14T10:00:00Z'));
    const now = Date.now(), wanted = 30_000;
    expect(computeApprovalHoldMs(now + 20_000, wanted)).toBe(14_000);
    expect(computeApprovalHoldMs(now + 60_000, wanted)).toBe(30_000);
    expect(computeApprovalHoldMs(now - 1, wanted)).toBe(0);
  });
  it('defines slow, normal, and fast timing scales over the complete timing profile', () => {
    expect([DEMO_MIN_READ_MS, DEMO_WORD_MS, DEMO_SPOTLIGHT_MS, DEMO_BEAT_MS, DEMO_SCREEN_HOLD_MS]).toEqual([8000, 600, 2000, 1200, 3000]);
    expect(DEMO_SPEED_FACTORS).toEqual({ slow: 1, normal: 0.6, fast: 0.3 });
  });
  it('keeps the working narration until search, quote, and order rows appear, then holds four seconds', async () => {
    vi.useFakeTimers();
    const root = document.createElement('div'); document.body.append(root);
    const article = document.createElement('article'), heading = document.createElement('h2'); heading.textContent = 'Level One'; article.append(heading); root.append(article);
    const names = ['Go to the kitchen', 'Manager Desk', 'Write the mandate', 'Balanced', 'Sign mandate', 'Order Terminal', 'Send to agent', 'Approve', 'See result', 'See it from Valio Aimo’s side', 'Back to results', 'Compare presets'];
    const addButton = (name: string, parent: HTMLElement = root) => { const button = document.createElement('button'); button.textContent = name; parent.append(button); return button; };
    addButton('Start level', article); names.forEach((name) => addButton(name));
    const values: Record<string, string | undefined> = { stars: '3', compareLoaded: 'true', approvalDeadline: new Date(Date.now() + 20_000).toISOString() };
    const presented: number[] = []; let workingGate: Promise<void> | undefined;
    const controller = new AbortController();
    const promise = runDemo({ root, script: { levelId: 'level1', presetKey: 'balanced', decisions: ['approved'] }, signal: controller.signal, levelTitle: 'Level One', presetLabel: () => 'Balanced', values: () => values, present: (_card, step, holdMs, waitUntil) => {
      presented.push(step);
      if (step === 8) { expect(holdMs).toBe(DEMO_AGENT_LOG_HOLD_MS); workingGate = waitUntil; return new Promise<void>((resolve) => { void waitUntil?.then(() => setTimeout(resolve, holdMs)); }); }
      return Promise.resolve();
    } });
    let gateReady = false;
    for (let elapsed = 0; elapsed < 180_000 && !workingGate; elapsed += 250) await vi.advanceTimersByTimeAsync(250);
    expect(workingGate).toBeDefined();
    await vi.advanceTimersByTimeAsync(8_000);
    expect(presented).not.toContain(9);
    values.activity_search = 'true'; values.activity_quote = 'true'; values.activity_order = 'true';
    void workingGate!.then(() => { gateReady = true; });
    await vi.advanceTimersByTimeAsync(DEMO_POLL_MS);
    await vi.advanceTimersByTimeAsync(DEMO_AGENT_LOG_HOLD_MS - 1);
    expect(gateReady).toBe(true);
    expect(presented).not.toContain(9);
    await vi.advanceTimersByTimeAsync(1);
    expect(presented).toContain(9);
    let outcome: Awaited<typeof promise> | undefined; void promise.then((result) => { outcome = result; });
    for (let elapsed = 0; elapsed < 180_000 && outcome === undefined; elapsed += 250) await vi.advanceTimersByTimeAsync(250);
    expect(outcome).toBe('done');
    root.remove();
  });
  it('stops when a player clicks a game control during narration', async () => {
    const root = document.createElement('div'); document.body.append(root);
    const article = document.createElement('article'), heading = document.createElement('h2'); heading.textContent = 'Level One'; article.append(heading); root.append(article);
    const manual = document.createElement('button'); manual.textContent = 'Go to the kitchen'; root.append(manual);
    const controller = new AbortController();
    const result = runDemo({ root, script: { levelId: 'level1', presetKey: 'balanced', decisions: [] }, signal: controller.signal, levelTitle: 'Level One', presetLabel: () => 'Balanced', waitMs: 50, present: () => new Promise<void>((resolve) => window.setTimeout(() => { manual.click(); resolve(); }, 1)) });
    await expect(result).resolves.toBe('interrupted');
    root.remove();
  });
  it('does not present another card after Exit aborts the current wait', async () => {
    const root = document.createElement('div'); document.body.append(root);
    const controller = new AbortController(); const presented: number[] = [];
    const result = runDemo({ root, script: { levelId: 'level1', presetKey: 'balanced', decisions: [] }, signal: controller.signal, levelTitle: 'Level One', presetLabel: () => 'Balanced', present: (_card, step) => { presented.push(step); controller.abort(); return Promise.resolve(); } });
    await expect(result).resolves.toBe('aborted');
    expect(presented).toEqual([1]);
    root.remove();
  });
});
