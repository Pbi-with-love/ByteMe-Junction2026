type Viewport = { width: number; height: number };
type Dock = { left: number; top: number };

const GAP = 24;
const WIDTHS = [540, 420, 360, 320];

function overlaps(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function docks(width: number, height: number, viewport: Viewport, step: number): Dock[] {
  const left = GAP;
  const right = viewport.width - GAP - width;
  const top = GAP;
  const bottom = viewport.height - GAP - height;
  const centerLeft = Math.max(GAP, (viewport.width - width) / 2);
  const centerTop = Math.max(GAP, (viewport.height - height) / 2);
  const corners = [{ left, top }, { left: right, top }, { left, top: bottom }, { left: right, top: bottom }];
  if (step === 14) return [{ left: centerLeft, top: bottom }, ...corners, { left, top: centerTop }, { left: right, top: centerTop }];
  if (step === 8 || step === 9) return [corners[2]!, corners[0]!, corners[1]!, corners[3]!, { left, top: centerTop }, { left: right, top: centerTop }];
  return [corners[0]!, corners[1]!, corners[2]!, corners[3]!, { left, top: centerTop }, { left: right, top: centerTop }];
}

export function placeNarrator(element: HTMLElement, step: number, blockers: Element[], viewport: Viewport): boolean {
  const protectedRects = blockers.map((blocker) => blocker.getBoundingClientRect());
  element.classList.remove('is-compact');
  element.style.maxHeight = 'none';
  element.style.overflowY = 'visible';
  for (const width of WIDTHS) {
    element.style.width = `${Math.min(width, viewport.width - GAP * 2)}px`;
    const initial = element.getBoundingClientRect();
    for (const dock of docks(initial.width, initial.height, viewport, step)) {
      element.style.left = `${dock.left}px`;
      element.style.top = `${dock.top}px`;
      element.style.right = 'auto';
      element.style.bottom = 'auto';
      const candidate = element.getBoundingClientRect();
      if (candidate.left >= 0 && candidate.top >= 0 && candidate.right <= viewport.width && candidate.bottom <= viewport.height && protectedRects.every((blocker) => !overlaps(candidate, blocker))) return true;
    }
  }
  if (step === 14) {
    const tableIndex = blockers.findIndex((blocker) => blocker.tagName === 'TABLE');
    const table = tableIndex < 0 ? undefined : protectedRects[tableIndex];
    if (table) {
      const maxHeight = viewport.height - table.bottom - GAP * 2;
      if (maxHeight > 0) {
        element.classList.add('is-compact');
        element.style.width = `${Math.min(420, viewport.width - GAP * 2)}px`;
        element.style.maxHeight = `${maxHeight}px`;
        element.style.overflowY = 'auto';
        element.style.left = `${Math.max(GAP, (viewport.width - Math.min(420, viewport.width - GAP * 2)) / 2)}px`;
        element.style.top = `${table.bottom + GAP}px`;
        element.style.right = 'auto';
        element.style.bottom = 'auto';
        const candidate = element.getBoundingClientRect();
        if (candidate.left >= 0 && candidate.top >= table.bottom && candidate.right <= viewport.width && candidate.bottom <= viewport.height && protectedRects.every((blocker, index) => index === tableIndex || !overlaps(candidate, blocker))) return true;
      }
    }
  }
  return false;
}
