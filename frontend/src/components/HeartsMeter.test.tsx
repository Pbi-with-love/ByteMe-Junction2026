import { render,screen } from '@testing-library/react';
import { describe,expect,it } from 'vitest';
import HeartsMeter from './HeartsMeter';

describe('HeartsMeter',()=>{it('shows gateway attention as a filled and empty heart count',()=>{render(<HeartsMeter hearts={2} max={3}/>);expect(screen.getByRole('img',{name:'Attention: 2 of 3 hearts left'})).toBeInTheDocument();expect(document.querySelectorAll('[data-heart="full"]')).toHaveLength(2);expect(document.querySelectorAll('[data-heart="empty"]')).toHaveLength(1);});});
