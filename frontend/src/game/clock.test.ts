import { describe, expect, it } from 'vitest';
import { gameOffsetMs, gameTimeAt } from './clock';
const clock = { start: '10:00', end: '14:00', realSecondsPerGameMinute: 0.25 };
describe('game clock conversion', () => {
  it('maps gateway Helsinki times to a clamped elapsed offset', () => {
    expect(gameOffsetMs('2026-11-14T10:05:00+02:00', clock)).toBe(1250);
    expect(gameOffsetMs('2026-11-14T09:00:00+02:00', clock)).toBe(0);
    expect(gameOffsetMs('2026-11-14T15:00:00+02:00', clock)).toBe(60000);
    expect(gameOffsetMs('2026-11-14T08:05:00Z', clock)).toBe(1250);
  });
  it('formats elapsed real time as game time', () => {
    expect(gameTimeAt(clock, 0)).toBe('10:00');
    expect(gameTimeAt(clock, 1000)).toBe('10:04');
    expect(gameTimeAt(clock, 60000)).toBe('14:00');
    expect(gameTimeAt(clock, 1_000_000 - 1)).toBe('14:00');
  });
});
