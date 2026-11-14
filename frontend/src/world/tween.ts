import type { Point } from './map';
export const WALK_PX_PER_SEC = 128;
export function tweenMs(from: Point, to: Point): number {
  return Math.round(Math.hypot(to.x - from.x, to.y - from.y) / WALK_PX_PER_SEC * 1000);
}
export function tweenAt(from: Point, to: Point, elapsedMs: number): Point {
  const duration = tweenMs(from, to);
  if (!duration || elapsedMs >= duration) return { ...to };
  if (elapsedMs <= 0) return { ...from };
  const t = elapsedMs / duration;
  return { x: Math.round(from.x + (to.x - from.x) * t), y: Math.round(from.y + (to.y - from.y) * t) };
}
