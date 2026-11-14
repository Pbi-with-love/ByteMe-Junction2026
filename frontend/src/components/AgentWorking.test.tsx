import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AgentWorking from './AgentWorking';

describe('AgentWorking', () => {
  it('announces the current activity as a polite status', () => {
    render(<AgentWorking activity="explaining" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Agent is working…')).toBeInTheDocument();
    expect(screen.getByText('Writing the explanation…')).toBeInTheDocument();
  });
});
