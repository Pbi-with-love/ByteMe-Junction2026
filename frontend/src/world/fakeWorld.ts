import { vi } from 'vitest';
import type { PixiWorld } from './pixiWorld';
import type { StationId, Point } from './map';
const arrivals = new Set<(s: StationId) => void>();
const positions = new Set<(p: Point) => void>();
export const fakeWorld = {
  walkTo: vi.fn(async (id: StationId) => { arrivals.forEach(cb=>cb(id)); }),
  setRobotState: vi.fn(), carry: vi.fn(), burst: vi.fn(), ring: vi.fn(), highlight: vi.fn(),
  onRobotMove: vi.fn((cb: (p:Point)=>void) => { positions.add(cb); cb({x:152,y:34}); return ()=>positions.delete(cb); }),
  onArrived: vi.fn((cb:(s:StationId)=>void) => { arrivals.add(cb); return ()=>arrivals.delete(cb); }),
  destroy: vi.fn(),
} satisfies PixiWorld;
export function resetFakeWorld(){vi.clearAllMocks();}
