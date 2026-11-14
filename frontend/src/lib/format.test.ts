import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatMoney, formatQuantity, formatTime } from './format';

describe('Finnish formatters', () => {
  it('formats integer-cent money and quantities', () => {
    expect(formatMoney({ cents: 13 * 10000 + 800, currency: 'EUR' })).toBe('€1 308,00');
    expect(formatMoney({ cents: -50, currency: 'EUR' })).toBe('-€0,50');
    expect(formatQuantity({ amount: 1000, unit: 'l' })).toBe('1 000 l');
    expect(formatQuantity({ amount: 2.5, unit: 'kg' })).toBe('2,5 kg');
  });

  it('uses Helsinki date and time parts', () => {
    expect(formatTime('2026-11-16T04:00:00Z')).toBe('06:00');
    expect(formatTime('2026-07-01T09:00:00Z')).toBe('12:00');
    expect(formatDateTime('2026-11-16T06:00:00+02:00')).toBe('Mon 16 Nov, 06:00');
    expect(formatDate('2026-11-16')).toBe('Mon 16 Nov');
  });
});
