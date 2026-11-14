import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DemoNarrator from './DemoNarrator';

describe('DemoNarrator', () => {
  it('shows the narrator card and exposes controls and keyboard shortcuts', () => {
    const onPause = vi.fn(), onNext = vi.fn(), onExit = vi.fn(), onSpeedChange = vi.fn();
    render(<DemoNarrator step={3} total={15} title="Manager Desk" text="Authority is given here." paused={false} speed="slow" onPause={onPause} onSpeedChange={onSpeedChange} onNext={onNext} onExit={onExit} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('3 of 15')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Demo speed' }), { target: { value: 'normal' } });
    fireEvent.keyDown(document, { key: 'p' });
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onPause).toHaveBeenCalledTimes(2); expect(onNext).toHaveBeenCalledTimes(2); expect(onExit).toHaveBeenCalledOnce();
    expect(onSpeedChange).toHaveBeenCalledWith('normal');
  });
  it('shows replay and exit actions for a stopped demo', () => {
    const onReplay = vi.fn(), onExit = vi.fn();
    render(<DemoNarrator step={0} total={15} title="The demo stopped" text="The gateway did not respond." paused={false} speed="slow" final failed onPause={() => {}} onSpeedChange={() => {}} onNext={() => {}} onExit={onExit} onReplay={onReplay} />);
    fireEvent.click(screen.getByRole('button', { name: 'Replay demo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exit demo' }));
    expect(onReplay).toHaveBeenCalledOnce(); expect(onExit).toHaveBeenCalledOnce();
  });
  it('Space advances Next without activating a focused page button', () => {
    const onNext = vi.fn(), pageClick = vi.fn();
    const page = document.createElement('button'); page.onclick = pageClick; document.body.append(page); page.focus();
    render(<DemoNarrator step={2} total={15} title="t" text="x" paused={false} speed="slow" onPause={vi.fn()} onSpeedChange={vi.fn()} onNext={onNext} onExit={vi.fn()} />);
    expect(fireEvent.keyDown(page, { key: ' ' })).toBe(false);
    expect(fireEvent.keyUp(page, { key: ' ' })).toBe(false);
    expect(onNext).toHaveBeenCalledOnce(); expect(pageClick).not.toHaveBeenCalled();
    page.remove();
  });
  it('shows N of N on the outro card, and no counter on the stop card', () => {
    const { rerender } = render(<DemoNarrator step={15} total={15} title="o" text="x" paused={false} speed="slow" final onPause={() => {}} onSpeedChange={() => {}} onNext={() => {}} onExit={() => {}} onReplay={() => {}} onBack={() => {}} />);
    expect(screen.getByText('15 of 15')).toBeInTheDocument();
    rerender(<DemoNarrator step={0} total={15} title="s" text="x" paused={false} speed="slow" final failed onPause={() => {}} onSpeedChange={() => {}} onNext={() => {}} onExit={() => {}} onReplay={() => {}} />);
    expect(screen.queryByText(/of 15/)).toBeNull();
  });
});
