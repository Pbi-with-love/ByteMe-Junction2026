import { afterEach, describe, expect, it, vi } from 'vitest';
import { runDemo } from './runDemo';

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
});
