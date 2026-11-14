import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LEVEL_BRIEFS, LEVEL_MOCKS } from '../game/levels';
import { formatDateTime } from '../lib/format';
import Brief from './Brief';

describe('mission brief', () => {
  it.each(LEVEL_MOCKS)('renders the scenario for $start.level.levelId', (mock) => {
    const level = mock.start.level;
    render(<Brief level={level} onBack={() => {}} onContinue={() => {}} />);
    const copy = LEVEL_BRIEFS[level.levelId as keyof typeof LEVEL_BRIEFS];
    expect(screen.getByRole('heading', { name: copy.title })).toHaveFocus();
    expect(screen.getByText(level.customer.name)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'The situation' }).nextElementSibling).toHaveTextContent(copy.situation);
    expect(screen.getByRole('heading', { name: 'The surprise' }).nextElementSibling).toHaveTextContent(copy.surprise);
    expect(screen.getByRole('heading', { name: 'Your part' }).nextElementSibling).toHaveTextContent(copy.yourPart);
    expect(screen.getByText('Deliver by').nextElementSibling).toHaveTextContent(formatDateTime(level.deadline));
    expect(screen.getByText('Order cut-off').nextElementSibling).toHaveTextContent(formatDateTime(level.closingTime));
    expect(screen.getByRole('button', { name: 'Go to the kitchen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to levels' })).toBeInTheDocument();
  });

  it('falls back to the API brief for an unknown levelId', () => {
    const level = { ...LEVEL_MOCKS[0].start.level, levelId: 'future-level' };
    render(<Brief level={level} onBack={() => {}} onContinue={() => {}} />);
    expect(screen.getByText(level.brief)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'The situation' })).not.toBeInTheDocument();
  });
});
