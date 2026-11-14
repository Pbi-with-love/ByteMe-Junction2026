import { act, render,screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HeartsMeter from './HeartsMeter';

const reducedMotion = vi.hoisted(() => ({ value: false }));
vi.mock('motion/react', () => ({ useReducedMotion: () => reducedMotion.value }));

describe('HeartsMeter',()=>{
  afterEach(() => { vi.useRealTimers(); reducedMotion.value = false; });

  it('shows gateway attention as a filled and empty heart count',()=>{render(<HeartsMeter hearts={2} max={3}/>);expect(screen.getByRole('img',{name:'Attention: 2 of 3 hearts left'})).toBeInTheDocument();expect(document.querySelectorAll('[data-heart="full"]')).toHaveLength(2);expect(document.querySelectorAll('[data-heart="empty"]')).toHaveLength(1);});

  it('splits the heart at the new gateway count for 650ms after a decrease', () => {
    vi.useFakeTimers();
    const { rerender } = render(<HeartsMeter hearts={3} max={3} />);
    expect(document.querySelector('[data-heart-break]')).not.toBeInTheDocument();

    rerender(<HeartsMeter hearts={2} max={3} />);
    const split = document.querySelector('[data-heart-break]');
    expect(split).toHaveAttribute('aria-hidden', 'true');
    expect(split).toHaveAttribute('data-heart-break', '2');
    expect(split?.querySelectorAll('svg')).toHaveLength(2);

    act(() => { vi.advanceTimersByTime(649); });
    expect(document.querySelector('[data-heart-break]')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1); });
    expect(document.querySelector('[data-heart-break]')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Attention: 2 of 3 hearts left' })).toBeInTheDocument();
  });

  it('does not split on equal or increased values', () => {
    const { rerender } = render(<HeartsMeter hearts={2} max={3} />);
    rerender(<HeartsMeter hearts={2} max={3} />);
    expect(document.querySelector('[data-heart-break]')).not.toBeInTheDocument();
    rerender(<HeartsMeter hearts={3} max={3} />);
    expect(document.querySelector('[data-heart-break]')).not.toBeInTheDocument();
  });

  it('does not split under reduced motion', () => {
    reducedMotion.value = true;
    const { rerender } = render(<HeartsMeter hearts={3} max={3} />);
    rerender(<HeartsMeter hearts={2} max={3} />);
    expect(document.querySelector('[data-heart-break]')).not.toBeInTheDocument();
  });
});
