import { DEMO_BEAT_MS, DEMO_RESULT_HOLD_MS, DEMO_WAIT_MS, type DemoDecision, type DemoScript } from './demo';

type Options = { root: ParentNode; script: DemoScript; signal: AbortSignal; levelTitle: string; presetLabel(key: string): string; beatMs?: number; resultHoldMs?: number; waitMs?: number; sleep?: (ms: number) => Promise<void> };
const defaultSleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
  const timer = setTimeout(resolve, ms);
  signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
});
function visible(el: HTMLElement) { return !el.closest('[hidden]') && !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true'; }
function label(el: HTMLElement) { return (el.getAttribute('aria-label') ?? el.textContent ?? '').trim(); }
function target(root: ParentNode, exact: string, selector = 'button'): HTMLElement | null {
  return [...root.querySelectorAll<HTMLElement>(selector)].find((el) => visible(el) && label(el) === exact) ?? null;
}
export async function runDemo(opts: Options): Promise<'done' | 'aborted' | 'stuck'> {
  const { root, signal, script } = opts;
  const beat = opts.beatMs ?? DEMO_BEAT_MS, wait = opts.waitMs ?? DEMO_WAIT_MS;
  const sleep = opts.sleep ?? ((ms: number) => defaultSleep(ms, signal));
  const stop = () => signal.aborted ? 'aborted' as const : [...root.querySelectorAll<HTMLElement>('[role="alert"]')].some((el) => !el.closest('[hidden]')) ? 'stuck' as const : null;
  async function find(get: () => HTMLElement | null): Promise<HTMLElement | null> {
    const until = Date.now() + wait;
    while (!stop() && Date.now() <= until) { const el = get(); if (el) return el; try { await sleep(50); } catch { return null; } }
    return null;
  }
  async function click(get: () => HTMLElement | null): Promise<boolean> {
    const el = await find(get);
    if (!el || stop()) return false;
    el.click();
    try { await sleep(beat); } catch { return false; }
    return !stop();
  }
  try {
    if (!await click(() => [...root.querySelectorAll<HTMLElement>('article')].find((a) => a.querySelector('h2')?.textContent?.trim() === opts.levelTitle)?.querySelector('button') ?? null)) return stop() ?? 'stuck';
    for (const action of ['Manager Desk', 'Write the mandate', opts.presetLabel(script.presetKey), 'Sign mandate', 'Order Terminal', 'Send to agent']) {
      if (!await click(() => target(root, action))) return stop() ?? 'stuck';
    }
    for (const decision of script.decisions as DemoDecision[]) {
      if (!await click(() => target(root, decision === 'approved' ? 'Approve' : 'Reject'))) return stop() ?? 'stuck';
    }
    if (!await click(() => target(root, 'See result'))) return stop() ?? 'stuck';
    try { await sleep(opts.resultHoldMs ?? DEMO_RESULT_HOLD_MS); } catch { return 'aborted'; }
    if (!await click(() => target(root, 'Compare presets'))) return stop() ?? 'stuck';
    return 'done';
  } catch { return signal.aborted ? 'aborted' : 'stuck'; }
}
