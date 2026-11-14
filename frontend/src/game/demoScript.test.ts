import { describe, expect, it } from 'vitest';
import { narratorCopy, demoCardText, interpolateDemoText } from './demoScript';

describe('narrated demo script', () => {
  it('contains a narrator card for each of the fifteen beats', () => {
    const expectedTitles = ['Welcome to Agent Kitchen', 'The level', 'The briefing', 'Manager Desk', 'Balanced mandate', 'Sign the mandate', 'Send to agent', 'The agent is working', 'Approval needed', 'You approve', 'The result', 'Receipt and log', 'Valio Aimo’s view', 'Compare mandates', 'The mandate is the guardrail'];
    expect(narratorCopy).toHaveLength(15);
    expect(narratorCopy.map(({ title }) => title)).toEqual(expectedTitles);
    const sentenceCounts = narratorCopy.map(({ text }) => text.split(/[.!?]+/).filter(Boolean).length);
    expect(sentenceCounts.every((count) => count >= 1 && count <= 3), JSON.stringify(sentenceCounts)).toBe(true);
  });

  it('interpolates supplied values and removes missing-value clauses cleanly', () => {
    expect(interpolateDemoText('The limit is {perOrderLimit}.', { perOrderLimit: '€1 000,00' })).toBe('The limit is €1 000,00.');
    expect(interpolateDemoText('The best plan costs {planTotal}, above your {perOrderLimit} limit.', {})).toBe('The best plan costs above your limit.');
    expect(demoCardText(4, {})).toContain('orders within the mandate’s limit');
    expect(demoCardText(8, {})).toContain('best plan is above the mandate limit');
    expect(demoCardText(13, {})).not.toContain('{strictApprovals}');
  });
});
