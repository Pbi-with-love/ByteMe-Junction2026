import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Root from './Root';

const appState = vi.hoisted(() => ({ shouldCrash: false, renders: 0 }));
vi.mock('./App', () => ({ default: () => {
  appState.renders += 1;
  if (appState.shouldCrash) throw new Error('test render crash');
  return <div>Test app</div>;
} }));

describe('Root', () => {
  it.each([
    [{}, 'Live gateway', 'live'],
    [{ VITE_GATEWAY_MODE: 'live' }, 'Live gateway', 'live'],
  ] as const)('shows the %s mode badge', (env, label, mode) => {
    render(<Root env={env} />);
    expect(screen.getByText(label)).toHaveAttribute('data-mode', mode);
  });

  it('reports unknown gateway mode in an alert', () => {
    render(<Root env={{ VITE_GATEWAY_MODE: 'other' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Unknown VITE_GATEWAY_MODE: other');
  });

  it('keeps the badge outside the boundary and remounts the app after reset', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    appState.shouldCrash = true;
    appState.renders = 0;
    render(<Root env={{ VITE_GATEWAY_MODE: 'replay' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('test render crash');
    expect(screen.getByText('Replay mode')).toBeInTheDocument();
    const rendersBeforeReset = appState.renders;
    appState.shouldCrash = false;
    fireEvent.click(screen.getByRole('button', { name: 'Back to levels' }));
    expect(screen.getByText('Test app')).toBeInTheDocument();
    expect(appState.renders).toBeGreaterThan(rendersBeforeReset);
    consoleError.mockRestore();
  });
});
