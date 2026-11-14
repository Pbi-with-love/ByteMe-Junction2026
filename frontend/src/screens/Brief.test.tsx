import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import level1 from '../../mocks/level1.json';
import Brief from './Brief';

describe('mission brief', () => {
  it('renders returned level details and navigational actions', () => {
    render(<Brief level={level1.start.level} onBack={() => {}} onContinue={() => {}} />);
    expect(screen.getByRole('heading', { name: level1.start.level.title })).toBeInTheDocument();
    expect(screen.getByText(level1.start.level.brief)).toBeInTheDocument();
    expect(screen.getByText('Deliver by')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Write the mandate' })).toBeInTheDocument();
  });
});
