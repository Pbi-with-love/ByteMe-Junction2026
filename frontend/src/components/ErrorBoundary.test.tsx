import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ErrorBoundary from './ErrorBoundary';

function RecoverableChild({ broken }: { broken: boolean }) {
  if (broken) throw new Error('render failed');
  return <p>Recovered child</p>;
}

function Harness({ onReset }: { onReset: () => void }) {
  const [broken, setBroken] = useState(true);
  return <ErrorBoundary onReset={() => { setBroken(false); onReset(); }}><RecoverableChild broken={broken} /></ErrorBoundary>;
}

describe('ErrorBoundary', () => {
  it('shows the render error and resets to render children again', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onReset = vi.fn();
    render(<Harness onReset={onReset} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('alert')).toHaveTextContent('render failed');
    fireEvent.click(screen.getByRole('button', { name: 'Back to levels' }));
    expect(onReset).toHaveBeenCalledOnce();
    expect(screen.getByText('Recovered child')).toBeInTheDocument();
  });
});

afterEach(() => vi.restoreAllMocks());
