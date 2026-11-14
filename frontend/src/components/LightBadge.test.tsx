import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LightBadge from './LightBadge';
describe('LightBadge', () => { it.each([['GREEN','Green'],['BLUE','Blue'],['YELLOW','Yellow'],['RED','Red']] as const)('labels %s accessibly', (light, word) => { const { container } = render(<LightBadge light={light} />); expect(container.querySelector(`[data-light="${light}"]`)).toHaveTextContent(word); expect(screen.getByText(word)).toBeVisible(); expect(container.querySelector('svg')).toBeInTheDocument(); }); });
