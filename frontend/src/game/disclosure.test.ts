import { describe, expect, it } from 'vitest';
import type { AgentStep } from '../api/schemas';
import { optionDisclosure } from './disclosure';

describe('optionDisclosure', () => {
  it('discloses allergens carried on a quote plan when search results are empty', () => {
    const step = {
      search: { results: [] },
      quote: {
        need: { deadline: '2026-11-19T06:00:00+02:00' },
        plans: [{ planId: 'egg-trap', lines: [{ productId: '462635', availableDate: '2026-11-19', allergens: ['AE'], mayContain: [] }] }],
      },
    } as unknown as AgentStep;

    expect(optionDisclosure('egg-trap', step).allergens).toEqual(['AE']);
  });
});
