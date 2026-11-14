type Viewport = { width: number; height: number };
type Dock = { left: number; top: number };

const GAP = 24;
const ALWAYS = '[aria-label="Game clock"], .hearts-meter, .approval-card, .activity-dock, .compare-frame table';
// The card must also keep clear of whatever it is explaining (mandate form, result, receipt, Valio view).
export function narratorBlockers(step: number, root: ParentNode = document): Element[] {
  const subject = step >= 4 && step <= 7 ? '.pixel-panel:not([hidden])' : step === 11 || step === 12 ? '.pixel-panel:not([hidden])' : step === 13 ? '.valio-screen' : '';
  return [...root.querySelectorAll(subject ? `${ALWAYS}, ${subject}` : ALWAYS)];
}

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
  return false;
}
