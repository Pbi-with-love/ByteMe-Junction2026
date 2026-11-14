import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import GameClock from './GameClock';
describe('GameClock', () => { it('shows a named timer', () => { render(<GameClock time="10:04" />); expect(screen.getByRole('timer', { name: 'Game clock' })).toHaveTextContent('10:04'); }); });
