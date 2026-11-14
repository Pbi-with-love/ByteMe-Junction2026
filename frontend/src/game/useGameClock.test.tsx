import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGameClock } from './useGameClock';
const clock = { start: '10:00', end: '14:00', realSecondsPerGameMinute: 0.25 };
describe('useGameClock', () => {
  afterEach(() => vi.useRealTimers());
  it('ticks, raises monotonically, stops at the end, and freezes when stopped', () => {
    vi.useFakeTimers(); const { result, unmount } = renderHook(() => useGameClock(clock));
    expect(result.current.time).toBe('10:00');
    act(() => result.current.start()); act(() => vi.advanceTimersByTime(1000)); expect(result.current.time).toBe('10:04');
    act(() => result.current.raiseTo('2026-11-14T10:10:00+02:00')); expect(result.current.time).toBe('10:10');
    act(() => result.current.raiseTo('2026-11-14T10:01:00+02:00')); expect(result.current.time).toBe('10:10');
    act(() => vi.advanceTimersByTime(60000)); expect(result.current.time).toBe('14:00'); expect(result.current.running).toBe(false);
    act(() => result.current.stop()); const frozen = result.current.time; act(() => vi.advanceTimersByTime(5000)); expect(result.current.time).toBe(frozen);
    unmount(); expect(vi.getTimerCount()).toBe(0);
  });
});
