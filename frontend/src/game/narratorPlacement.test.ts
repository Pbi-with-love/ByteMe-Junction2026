import { describe, expect, it, vi } from 'vitest';
import { placeNarrator } from './narratorPlacement';

type Box = { left: number; top: number; width: number; height: number };
const rect = ({ left, top, width, height }: Box) => ({ x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON: () => ({}) }) as DOMRect;
const intersects = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

describe('narrator placement', () => {
  it.each([{ width: 1920, height: 1080 }, { width: 1280, height: 720 }])('keeps all 15 demo cards clear of protected UI at $width×$height', ({ width, height }) => {
    for (let step = 1; step <= 15; step += 1) {
      const narrator = document.createElement('aside');
      narrator.style.width = '540px';
      narrator.getBoundingClientRect = vi.fn(() => {
        const cardWidth = Number.parseFloat(narrator.style.width) || 540;
        const cardHeight = Math.min(cardWidth < 540 ? 330 : 260, Number.parseFloat(narrator.style.maxHeight) || Infinity);
        const left = Number.parseFloat(narrator.style.left) || 0;
        const top = Number.parseFloat(narrator.style.top) || 0;
        return rect({ left, top, width: cardWidth, height: cardHeight });
      });
      const blockers = [
        document.createElement('div'), document.createElement('div'), document.createElement('div'),
        document.createElement('div'), document.createElement('table'),
      ];
      const boxes: Box[] = [
        step === 14 ? { left: 0, top: 0, width: 0, height: 0 } : { left: width - 330, top: 0, width: 300, height: 90 },
        step === 14 ? { left: 0, top: 0, width: 0, height: 0 } : { left: width - 370, top: 95, width: 340, height: 70 },
        step === 14 ? { left: 0, top: 0, width: 0, height: 0 } : { left: width - 720, top: height - 440, width: 600, height: 360 },
        step === 14 ? { left: 0, top: 0, width: 0, height: 0 } : { left: width - 640, top: height - 250, width: 610, height: 220 },
        step === 14 ? { left: 90, top: 180, width: width - 180, height: height - 360 } : { left: 0, top: 0, width: 0, height: 0 },
      ];
      blockers.forEach((node, index) => { node.getBoundingClientRect = vi.fn(() => rect(boxes[index]!)); });
      const result = placeNarrator(narrator, step, blockers, { width, height });
      expect(result, `step ${step}`).toBe(true);
      if (step === 14) expect(narrator).toHaveClass('is-compact');
      const narratorRect = narrator.getBoundingClientRect();
      blockers.forEach((node) => expect(intersects(narratorRect, node.getBoundingClientRect()), `step ${step}`).toBe(false));
    }
  });
});
