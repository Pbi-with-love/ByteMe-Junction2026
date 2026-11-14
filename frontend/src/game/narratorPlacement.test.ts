import { describe, expect, it, vi } from 'vitest';
import { narratorBlockers, placeNarrator } from './narratorPlacement';

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
        const cardHeight = Math.min(cardWidth > 1000 ? 150 : cardWidth < 540 ? 330 : 260, Number.parseFloat(narrator.style.maxHeight) || Infinity);
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
      expect(narrator).not.toHaveClass('is-compact');
      const copy = document.createElement('p');
      copy.className = 'demo-copy';
      Object.defineProperties(copy, { scrollHeight: { value: 120 }, clientHeight: { value: 120 } });
      copy.getClientRects = () => [rect({ left: 1, top: 1, width: 10, height: 10 })] as unknown as DOMRectList;
      const speed = document.createElement('select');
      speed.setAttribute('aria-label', 'Demo speed');
      speed.getClientRects = () => [rect({ left: 1, top: 1, width: 10, height: 10 })] as unknown as DOMRectList;
      const controls = ['Pause', 'Next', 'Exit demo'].map((label) => {
        const button = document.createElement('button'); button.textContent = label;
        button.getClientRects = () => [rect({ left: 1, top: 1, width: 10, height: 10 })] as unknown as DOMRectList;
        return button;
      });
      narrator.append(copy, speed, ...controls);
      expect(copy.scrollHeight).toBeLessThanOrEqual(copy.clientHeight);
      expect(speed.getClientRects().length).toBeGreaterThan(0);
      controls.forEach((button) => expect(button.getClientRects().length).toBeGreaterThan(0));
      if (step === 14) expect(Number.parseFloat(narrator.style.width)).toBeGreaterThanOrEqual(width - 100);
      const narratorRect = narrator.getBoundingClientRect();
      expect(narratorRect.left).toBeGreaterThanOrEqual(0);
      expect(narratorRect.top).toBeGreaterThanOrEqual(0);
      expect(narratorRect.right).toBeLessThanOrEqual(width);
      expect(narratorRect.bottom).toBeLessThanOrEqual(height);
      blockers.forEach((node) => expect(intersects(narratorRect, node.getBoundingClientRect()), `step ${step}`).toBe(false));
    }
  });

  it('adds the thing a card explains to its protected rects', () => {
    document.body.innerHTML = '<section class="pixel-panel"></section><section class="pixel-panel" hidden></section><div class="valio-columns"><section class="valio-section"></section></div><section class="valio-boundary"></section><div class="hearts-meter"></div>';
    expect(narratorBlockers(5)).toHaveLength(2);
    expect(narratorBlockers(12)).toHaveLength(2);
    expect(narratorBlockers(13).map((node) => node.className)).toEqual(['valio-section', 'valio-boundary', 'hearts-meter']);
    expect(narratorBlockers(2)).toHaveLength(1);
    document.body.innerHTML = '';
  });

  it('docks clear of a centred result panel at 1920x1080 using the free side column', () => {
    const narrator = document.createElement('aside');
    narrator.getBoundingClientRect = () => rect({ left: Number.parseFloat(narrator.style.left) || 0, top: Number.parseFloat(narrator.style.top) || 0, width: Number.parseFloat(narrator.style.width) || 540, height: 400 });
    const panel = document.createElement('section');
    panel.getBoundingClientRect = () => rect({ left: 366, top: 130, width: 1190, height: 900 });
    expect(placeNarrator(narrator, 11, [panel], { width: 1920, height: 1080 })).toBe(true);
    expect(intersects(narrator.getBoundingClientRect(), panel.getBoundingClientRect())).toBe(false);
  });
});
