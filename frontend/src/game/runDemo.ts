import { DEMO_APPROVAL_MARGIN_MS, DEMO_APPROVAL_PAUSE_THRESHOLD_MS, DEMO_AGENT_LOG_HOLD_MS, DEMO_BEAT_MS, DEMO_MIN_READ_MS, DEMO_POLL_MS, DEMO_RESULT_HOLD_MS, DEMO_SCREEN_HOLD_MS, DEMO_SPOTLIGHT_MS, DEMO_VALIO_BOARD_HOLD_MS, DEMO_VALIO_BOARD_MIN_HOLD_MS, DEMO_VALIO_BOARD_TOTAL_MS, DEMO_WAIT_MS, DEMO_WORD_MS, type DemoDecision, type DemoScript } from './demo';
import type { DemoCard } from './demoScript';

type Options = { root: ParentNode; script: DemoScript; signal: AbortSignal; levelTitle: string; presetLabel(key: string): string; speedFactor?: () => number; beatMs?: number; resultHoldMs?: number; waitMs?: number; sleep?: (ms: number) => Promise<void>; present?: (card: DemoCard, step: number, holdMs: number, waitUntil?: Promise<void>) => Promise<void>; spotlight?: (element: HTMLElement) => void; values?: () => Record<string, string | undefined>; isTrusted?: (event: Event) => boolean };
// remainingMs is measured in the gateway's own time base; gateway timestamps are never compared with Date.now().
export function computeApprovalHoldMs(remainingMs: number, wantedReadingMs: number): number {
  return Math.max(0, Math.min(wantedReadingMs, remainingMs - DEMO_APPROVAL_MARGIN_MS));
}
const DEFAULT_APPROVAL_WINDOW_MS = 20_000;
function approvalRemainingMs(v: Record<string, string | undefined>): number {
  const deadline = Date.parse(v.approvalDeadline ?? ''), created = Date.parse(v.approvalCreatedAt ?? ''), shown = Number(v.approvalShownAt);
  if (!Number.isFinite(deadline)) return Number.NaN;
  const window = Number.isFinite(created) ? deadline - created : DEFAULT_APPROVAL_WINDOW_MS;
  return window - (Number.isFinite(shown) ? Date.now() - shown : 0);
}
const defaultSleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
  const timer = setTimeout(resolve, ms);
  signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
});
const INTERACTIVE = 'button, a, input, select, textarea, summary, [role="button"], [role="link"]';
function visible(el: HTMLElement) { return !el.closest('[hidden]') && !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true'; }
function label(el: HTMLElement) { return (el.getAttribute('aria-label') ?? el.textContent ?? '').trim(); }
function target(root: ParentNode, exact: string, selector = 'button'): HTMLElement | null {
  return [...root.querySelectorAll<HTMLElement>(selector)].find((el) => visible(el) && label(el) === exact) ?? null;
}
export async function runDemo(opts: Options): Promise<'done' | 'aborted' | 'stuck' | 'interrupted'> {
  const { root, signal, script } = opts;
  const beat = opts.beatMs ?? DEMO_BEAT_MS, wait = opts.waitMs ?? DEMO_WAIT_MS;
  const rawSleep = opts.sleep ?? ((ms: number) => defaultSleep(ms, signal));
  const factor = () => Math.max(0, opts.speedFactor?.() ?? 1);
  const sleep = (ms: number) => rawSleep(ms * factor());
  let allowScriptClick = false, userInterrupted = false;
  const stop = () => signal.aborted ? 'aborted' as const : userInterrupted ? 'interrupted' as const : [...root.querySelectorAll<HTMLElement>('[role="alert"]')].some((el) => !el.closest('[hidden]')) ? 'stuck' as const : null;
  async function find(get: () => HTMLElement | null): Promise<HTMLElement | null> {
    const until = Date.now() + wait;
      while (!stop() && Date.now() <= until) { const el = get(); if (el) return el; try { await rawSleep(DEMO_POLL_MS); } catch { return null; } }
    return null;
  }
  async function waitForData(key: string): Promise<boolean> {
    const until = Date.now() + wait;
    while (!stop() && Date.now() <= until) { if (opts.values?.()[key] !== undefined) return true; try { await rawSleep(DEMO_POLL_MS); } catch { return false; } }
    return false;
  }
  async function waitForDataAll(keys: string[]): Promise<void> {
    const until = Date.now() + wait;
    while (!stop() && Date.now() <= until) {
      if (keys.every((key) => opts.values?.()[key] !== undefined)) return;
      await rawSleep(DEMO_POLL_MS);
    }
    throw new Error('Timed out waiting for agent activity rows.');
  }
  async function click(get: () => HTMLElement | null): Promise<boolean> {
    const el = await find(get);
    if (!el || stop()) return false;
    el.click();
    try { await sleep(beat); } catch { return false; }
    return !stop();
  }
  if (opts.present) {
    const trusted = opts.isTrusted ?? ((event: Event) => event.isTrusted);
    // Only a real user click on an interactive control counts; background/text clicks and script clicks never stop the demo.
    const detectUserClick = (event: Event) => { const t = event.target; if (!allowScriptClick && trusted(event) && t instanceof Element && t.closest(INTERACTIVE) && !t.closest('.demo-narrator, .demo-mode-badge')) userInterrupted = true; };
    root.addEventListener('click', detectUserClick, true);
    const cards = (await import('./demoScript')).narratorCopy;
    const show = async (index: number, holdOverride?: number, waitUntil?: Promise<void>) => {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const { demoCardText } = await import('./demoScript');
      const card = cards[index]!;
      const text = demoCardText(index, opts.values?.() ?? {});
      const words = text.split(/\s+/).filter(Boolean).length;
      const slowReadingTime = Math.max(DEMO_MIN_READ_MS, words * DEMO_WORD_MS);
      const wanted = slowReadingTime * factor();
      const remaining = approvalRemainingMs(opts.values?.() ?? {});
      const hold = card.pauseDisabled ? (Number.isFinite(remaining) ? computeApprovalHoldMs(remaining, slowReadingTime) : 0) : (holdOverride ?? wanted);
      const pauseDisabled = card.pauseDisabled && Number.isFinite(remaining) && remaining < DEMO_APPROVAL_PAUSE_THRESHOLD_MS;
      await opts.present!({ ...card, text, ...(card.pauseDisabled ? { pauseDisabled } : {}) }, index + 1, hold, waitUntil);
    };
    async function narratedClick(index: number, get: () => HTMLElement | null, approval = false) {
      if (signal.aborted) return false;
      const approvalTarget = approval ? await find(get) : null;
      if (approval && !approvalTarget) return false;
      // Approval: ring the button while the card is read; no extra spotlight wait, the countdown is real time.
      if (approvalTarget) opts.spotlight?.(approvalTarget);
      await show(index);
      const el = approvalTarget ?? await find(get);
      if (!el || stop()) return false;
      if (!approval) {
        opts.spotlight?.(el);
        try { await sleep(DEMO_SPOTLIGHT_MS); } catch { return false; }
      }
      if (signal.aborted || !el.isConnected) return false;
      allowScriptClick = true; el.click(); allowScriptClick = false;
      try { await sleep(beat); } catch { return false; }
      return !stop();
    }
    async function plainClick(get: () => HTMLElement | null) {
      const el = await find(get);
      if (!el || stop()) return false;
      opts.spotlight?.(el);
      try { await sleep(DEMO_SPOTLIGHT_MS); } catch { return false; }
      if (!el.isConnected || signal.aborted) return false;
      allowScriptClick = true; el.click(); allowScriptClick = false;
      try { await sleep(beat); } catch { return false; }
      return !stop();
    }
    const screenHold = () => sleep(opts.resultHoldMs ?? DEMO_SCREEN_HOLD_MS);
    try {
      await show(0);
      if (!await narratedClick(1, () => [...root.querySelectorAll<HTMLElement>('article')].find((a) => a.querySelector('h2')?.textContent?.trim() === opts.levelTitle)?.querySelector('button') ?? null)) return stop() ?? 'stuck';
      await screenHold();
      if (!await narratedClick(2, () => target(root, 'Go to the kitchen'))) return stop() ?? 'stuck';
      await screenHold();
      if (!await narratedClick(3, () => target(root, 'Manager Desk'))) return stop() ?? 'stuck';
      if (!await plainClick(() => target(root, 'Write the mandate'))) return stop() ?? 'stuck';
      // Act first, explain once the form really shows the preset's values.
      const preset = () => target(root, opts.presetLabel(script.presetKey));
      if (!await plainClick(preset)) return stop() ?? 'stuck';
      if (!await find(() => { const el = preset(); return el?.getAttribute('aria-pressed') === 'true' ? el : null; })) return stop() ?? 'stuck';
      await show(4);
      if (!await narratedClick(5, () => target(root, 'Sign mandate'))) return stop() ?? 'stuck';
      if (!await plainClick(() => target(root, 'Order Terminal'))) return stop() ?? 'stuck';
      if (!await narratedClick(6, () => target(root, 'Send to agent'))) return stop() ?? 'stuck';
      // Step 8 ends the moment the approval card is open (its countdown is real time); otherwise after the log rows plus a short hold.
      const approvalName = script.decisions[0] === 'rejected' ? 'Reject' : 'Approve';
      const approvalOpen = (async () => { const until = Date.now() + wait; while (!stop() && Date.now() <= until) { if (target(root, approvalName)) return; await rawSleep(DEMO_POLL_MS); } await new Promise<never>(() => {}); })();
      const logsThenHold = waitForDataAll(['activity_search', 'activity_quote', 'activity_order']).then(() => sleep(DEMO_AGENT_LOG_HOLD_MS));
      const approvalOrLogReady = Promise.race([approvalOpen, logsThenHold]);
      await show(7, 0, approvalOrLogReady);
      if (script.decisions[0] === 'approved') {
        if (!await narratedClick(8, () => target(root, 'Approve'), true)) return stop() ?? 'stuck';
      } else if (script.decisions[0] === 'rejected') {
        if (!await narratedClick(8, () => target(root, 'Reject'), true)) return stop() ?? 'stuck';
      }
      await show(9);
      if (!await plainClick(() => target(root, 'See result'))) return stop() ?? 'stuck';
      await screenHold();
      if (!await waitForData('stars')) return stop() ?? 'stuck';
      await show(10);
      await show(11);
      // Act first, explain once the board has loaded; then keep the board itself readable before leaving it.
      if (!await plainClick(() => target(root, 'See it from Valio Aimo’s side'))) return stop() ?? 'stuck';
      if (!await waitForData('valioLoaded')) return stop() ?? 'stuck';
      const boardLoadedAt = Date.now();
      await show(12);
      // Total board time = max(15 s, card + board hold): the extra hold also covers a short card.
      const extra = Math.max(DEMO_VALIO_BOARD_MIN_HOLD_MS, DEMO_VALIO_BOARD_HOLD_MS * factor(), DEMO_VALIO_BOARD_TOTAL_MS - (Date.now() - boardLoadedAt));
      try { await rawSleep(extra); } catch { return stop() ?? 'stuck'; }
      if (!await plainClick(() => target(root, 'Back to results'))) return stop() ?? 'stuck';
      await screenHold();
      if (!await plainClick(() => target(root, 'Compare presets'))) return stop() ?? 'stuck';
      await screenHold();
      if (!await waitForData('compareLoaded')) return stop() ?? 'stuck';
      await show(13);
      await show(14);
      return 'done';
    } catch { return signal.aborted ? 'aborted' : userInterrupted ? 'interrupted' : 'stuck'; }
    finally { root.removeEventListener('click', detectUserClick, true); }
  }
  try {
    if (!await click(() => [...root.querySelectorAll<HTMLElement>('article')].find((a) => a.querySelector('h2')?.textContent?.trim() === opts.levelTitle)?.querySelector('button') ?? null)) return stop() ?? 'stuck';
    for (const action of ['Go to the kitchen', 'Manager Desk', 'Write the mandate', opts.presetLabel(script.presetKey), 'Sign mandate', 'Order Terminal', 'Send to agent']) {
      if (!await click(() => target(root, action))) return stop() ?? 'stuck';
    }
    for (const decision of script.decisions as DemoDecision[]) {
      if (!await click(() => target(root, decision === 'approved' ? 'Approve' : 'Reject'))) return stop() ?? 'stuck';
    }
    if (!await click(() => target(root, 'See result'))) return stop() ?? 'stuck';
    try { await sleep(opts.resultHoldMs ?? DEMO_RESULT_HOLD_MS); } catch { return 'aborted'; }
    if (!await click(() => target(root, 'Compare presets'))) return stop() ?? 'stuck';
    return 'done';
  } catch { return signal.aborted ? 'aborted' : userInterrupted ? 'interrupted' : 'stuck'; }
}
