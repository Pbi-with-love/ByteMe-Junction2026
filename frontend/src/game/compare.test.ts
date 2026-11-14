import { describe, expect, it } from 'vitest';
import { bestIndexes } from './compare';

describe('bestIndexes', () => {
  it('returns indexes for the lowest or highest defined values, excluding ties', () => {
    expect(bestIndexes([5, 2, 2, 8], 'lower')).toEqual([1, 2]);
    expect(bestIndexes([5, 2, 2, 8], 'higher')).toEqual([3]);
  });

  it('skips missing values and returns no best for fewer than two values or all-equal values', () => {
    expect(bestIndexes([null, undefined, 4], 'higher')).toEqual([]);
    expect(bestIndexes([null, 4, 7], 'higher')).toEqual([2]);
    expect(bestIndexes([4, 4, null], 'lower')).toEqual([]);
  });
});
