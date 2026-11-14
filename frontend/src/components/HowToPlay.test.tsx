import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import HowToPlay from './HowToPlay';

describe('HowToPlay', () => {
  it('shows each card and navigates through the four steps', () => {
    render(<HowToPlay open onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Your job' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(/An AI agent buys ingredients/)).toBeVisible();
    expect(screen.getByText('1 of 4')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('dialog', { name: 'Four lights' })).toBeInTheDocument();
    expect(screen.getAllByText(/Green/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('dialog', { name: 'Hearts and approvals' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('dialog', { name: 'Scoring' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start playing' })).toBeVisible();
  });

  it('supports Back, closes with Escape and returns focus to the opener', () => {
    const close = vi.fn();
    function Harness() {
      const [open, setOpen] = useState(false);
      return <><button onClick={() => setOpen(true)}>Open guide</button><HowToPlay open={open} onClose={() => { close(); setOpen(false); }} /></>;
    }
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open guide' });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('dialog', { name: 'Your job' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(close).toHaveBeenCalledOnce();
    expect(opener).toHaveFocus();
  });

  it('traps focus within the open dialog and is absent when closed', () => {
    const { rerender } = render(<HowToPlay open onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    const lastButton = screen.getByRole('button', { name: 'Next' });
    lastButton.focus();
    fireEvent.keyDown(lastButton, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Close how to play' })).toHaveFocus();
    rerender(<HowToPlay open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-labelledby');
  });
});
