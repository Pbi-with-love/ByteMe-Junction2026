import { render } from '@testing-library/react';
import { expect,it } from 'vitest';
import PixelSprite from './PixelSprite';
import { ART } from '../world/art';
it('renders one crisp rect per visible pixel',()=>{const {container}=render(<PixelSprite name="heart_left"/>);const rects=container.querySelectorAll('rect');expect(rects.length).toBe([...ART.heart_left.join('')].filter(c=>c!=='.').length);expect([...rects].every(r=>r.getAttribute('fill'))).toBe(true);});
