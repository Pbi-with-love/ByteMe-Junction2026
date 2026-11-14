export const LOGICAL_W = 320;
export const LOGICAL_H = 180;
export const TILE = 16;
export function fitScale(viewW: number, viewH: number): number {
  return Math.max(1, Math.floor(Math.min(viewW / LOGICAL_W, viewH / LOGICAL_H)));
}
