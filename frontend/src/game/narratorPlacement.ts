type Viewport = { width: number; height: number };
type Dock = { left: number; top: number };

const GAP = 24;
const ALWAYS = '[aria-label="Game clock"], .hearts-meter, .approval-card, .activity-dock, .compare-frame table';
// The card must also keep clear of whatever it is explaining (mandate form, result, receipt, Valio view).
export function narratorBlockers(step: number, root: ParentNode = document): Element[] {
  const subject = step >= 4 && step <= 7 ? '.pixel-panel:not([hidden])' : step === 11 || step === 12 ? '.pixel-panel:not([hidden])' : step === 13 ? '.valio-header, .valio-boundary, .valio-section' : '';
  return [...root.querySelectorAll(subject ? `${ALWAYS}, ${subject}` : ALWAYS)];
}

const WIDTHS = [390, 310, 270, 250];
const WIDE_WIDTHS = [760, 600, 520, 450];

type Layout = { wide: boolean; width: number };
type Where = 'bottom-right' | 'bottom-left' | 'right' | 'left' | 'below' | 'top-right' | 'top-left';

function overlaps(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function overlapArea(a: DOMRect, b: DOMRect): number {
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

function order(step: number): Where[] {
  if (step === 14) return ['bottom-left', 'bottom-right', 'top-left', 'top-right', 'left', 'right'];
  if (step === 8 || step === 9) return ['bottom-left', 'top-left', 'top-right', 'bottom-right', 'left', 'right', 'below'];
  if (step === 11 || step === 12) return ['left', 'right', 'bottom-right', 'bottom-left', 'top-right', 'top-left', 'below'];
  return ['bottom-right', 'bottom-left', 'right', 'left', 'below', 'top-right', 'top-left'];
}

function dockFor(where: Where, width: number, height: number, viewport: Viewport, rects: DOMRect[]): Dock {
  const right = viewport.width - GAP - width;
  const bottom = viewport.height - GAP - height;
  const middle = Math.max(GAP, (viewport.height - height) / 2);
  const below = Math.max(GAP, ...rects.filter((rect) => rect.width > 0 && rect.bottom < viewport.height).map((rect) => rect.bottom + GAP));
  switch (where) {
    case 'bottom-right': return { left: right, top: bottom };
    case 'bottom-left': return { left: GAP, top: bottom };
    case 'right': return { left: right, top: middle };
    case 'left': return { left: GAP, top: middle };
    case 'below': return { left: Math.max(GAP, (viewport.width - width) / 2), top: below };
    case 'top-right': return { left: right, top: GAP };
    default: return { left: GAP, top: GAP };
  }
}

export function placeNarrator(element: HTMLElement, step: number, blockers: Element[], viewport: Viewport): boolean {
  const protectedRects = blockers.map((blocker) => blocker.getBoundingClientRect());
  element.classList.remove('is-compact');
  element.classList.remove('is-wide');
  element.style.maxHeight = 'none';
  element.style.overflowY = 'visible';
  if (step === 14) {
    const tableIndex = blockers.findIndex((blocker) => blocker.tagName === 'TABLE');
    const table = tableIndex < 0 ? undefined : protectedRects[tableIndex];
    if (table) {
      element.style.width = `${Math.max(0, viewport.width - GAP * 2)}px`;
      const candidate = element.getBoundingClientRect();
      const dock = { left: GAP, top: Math.max(table.bottom + GAP, viewport.height - GAP - candidate.height) };
      element.style.left = `${dock.left}px`;
      element.style.top = `${dock.top}px`;
      element.style.right = 'auto';
      element.style.bottom = 'auto';
      const placed = element.getBoundingClientRect();
      if (placed.left >= 0 && placed.top >= table.bottom && placed.right <= viewport.width && placed.bottom <= viewport.height && protectedRects.every((blocker, index) => index === tableIndex || !overlaps(placed, blocker))) {
        element.classList.add('is-wide');
        return true;
      }
      element.style.top = `${Math.max(GAP, viewport.height - GAP - candidate.height)}px`;
      const bottomDock = element.getBoundingClientRect();
      if (bottomDock.left >= 0 && bottomDock.top >= GAP && bottomDock.right <= viewport.width && bottomDock.bottom <= viewport.height && protectedRects.every((blocker, index) => index === tableIndex || !overlaps(bottomDock, blocker))) {
        element.classList.add('is-wide');
        return true;
      }
    }
  }
  const normal: Layout[] = WIDTHS.map((width) => ({ wide: false, width }));
  const wide: Layout[] = WIDE_WIDTHS.map((width) => ({ wide: true, width }));
  const layouts = step === 13 || step === 14 ? [...wide, ...normal] : [...normal, ...wide];
  let best: { layout: Layout; dock: Dock; area: number } | undefined;
  for (const where of order(step)) {
    for (const layout of layouts) {
      element.classList.toggle('is-wide', layout.wide);
      element.style.width = `${Math.min(layout.width, viewport.width - GAP * 2)}px`;
      const size = element.getBoundingClientRect();
      const dock = dockFor(where, size.width, size.height, viewport, protectedRects);
      element.style.left = `${dock.left}px`;
      element.style.top = `${dock.top}px`;
      element.style.right = 'auto';
      element.style.bottom = 'auto';
      const candidate = element.getBoundingClientRect();
      if (candidate.left < 0 || candidate.top < 0 || candidate.right > viewport.width || candidate.bottom > viewport.height) continue;
      const area = protectedRects.reduce((sum, blocker) => sum + overlapArea(candidate, blocker), 0);
      if (area === 0) return true;
      if (!best || area < best.area) best = { layout, dock, area };
    }
  }
  if (best) {
    element.classList.toggle('is-wide', best.layout.wide);
    element.style.width = `${Math.min(best.layout.width, viewport.width - GAP * 2)}px`;
    element.style.left = `${best.dock.left}px`;
    element.style.top = `${best.dock.top}px`;
  }
  return false;
}
