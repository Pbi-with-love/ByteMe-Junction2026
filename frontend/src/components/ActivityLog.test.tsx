import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import level1 from '../../mocks/level1.json';
import type { LevelMock } from '../api/schemas';
import { toTimelineEntries } from '../game/timeline';
import type { DirectorStep } from '../world/director';
import ActivityLog from './ActivityLog';
const step = (level1 as LevelMock).presets.balanced!.steps[0]!;
describe('ActivityLog', () => {
  it('is present when empty and lists marked entries in order', () => {
    const { rerender } = render(<ActivityLog entries={[]} />);
    expect(screen.getByRole('log', { name: 'Activity log' })).toHaveTextContent('No agent activity yet.');
    rerender(<ActivityLog entries={toTimelineEntries(step, 0)} />);
    expect(screen.getAllByRole('button').map(button => button.textContent)).toHaveLength(3);
    expect(screen.getByText(/Searched the catalog/)).toBeInTheDocument();
  });
  it('expands an entry to show rule and raw gateway data', () => {
    render(<ActivityLog entries={toTimelineEntries(step, 0)} />);
    fireEvent.click(screen.getAllByRole('button')[1]!);
    expect(screen.getByText('Rule applied')).toBeInTheDocument();
    expect(screen.getByText('Raw gateway data')).toBeInTheDocument();
    expect(screen.getByText(/quoteId/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
  });
  it('renders an empty quote without inventing a recommended plan', () => {
    const emptyQuoteStep = structuredClone(step);
    emptyQuoteStep.quote.plans = [];
    render(<ActivityLog entries={[toTimelineEntries(emptyQuoteStep, 0)[1]!]} />);
    expect(screen.getByRole('button', { name: /Quote created/ })).toBeInTheDocument();
  });
  it.each([
    [403, 'POLICY_BLOCKED', 'Chosen plan is blocked by policy.', 'RED'],
    [409, 'QUOTE_EXPIRED', 'The quote expired before ordering.', null],
  ] as const)('renders a %s gateway order error without an approval control', (httpStatus, code, message, light) => {
    const errorStep = structuredClone(step) as unknown as DirectorStep;
    errorStep.order = { httpStatus, body: { error: { code, message } } } as never;
    const entry = toTimelineEntries(errorStep, 4)[2]!;
    render(<ActivityLog entries={[entry]} />);
    const card = screen.getByRole('article');
    expect(card).toHaveTextContent(message);
    expect(card).toHaveTextContent(code);
    expect(card.querySelector('button [data-light]')?.getAttribute('data-light') ?? null).toBe(light);
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
  });
});
