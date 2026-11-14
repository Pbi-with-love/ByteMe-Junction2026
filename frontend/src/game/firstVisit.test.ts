import { beforeEach, describe, expect, it, vi } from 'vitest';
import { markHowToPlaySeen, shouldShowHowToPlay } from './firstVisit';

describe('first visit How to Play preference', () => {
  beforeEach(() => localStorage.clear());
  it('shows by default and hides after marking seen', () => {
    expect(shouldShowHowToPlay()).toBe(true);
    markHowToPlaySeen();
    expect(localStorage.getItem('agentKitchen.howToPlaySeen')).toBe('true');
    expect(shouldShowHowToPlay()).toBe(false);
  });
  it('defaults to showing when storage reads or writes throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(shouldShowHowToPlay()).toBe(true);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => markHowToPlaySeen()).not.toThrow();
    vi.restoreAllMocks();
  });
});
