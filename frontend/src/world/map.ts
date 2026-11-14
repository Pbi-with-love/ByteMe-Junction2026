import { TILE } from './scale';
export type StationId = 'desk' | 'terminal' | 'storage' | 'phone' | 'delivery';
export type Point = { x: number; y: number };
export const MAP_COLS = 20;
export const MAP_ROWS = 11;
export const MAP_ORIGIN = { x: 0, y: 2 };
export const MAP = [
  '####################', '#SSS....TTT....PP..#', '#SSS...............#', '#..................#',
  '#....CC......CC....#', '#....CC......CC....D', '#..................D', '#..................#',
  '#MMM...............#', '#MMM...............#', '####################',
];
export const STATIONS: Record<StationId, { label: string; tiles: { x: number; y: number; w: number; h: number }; access: { x: number; y: number } }> = {
  storage: { label: 'Storage', tiles: { x: 1, y: 1, w: 3, h: 2 }, access: { x: 4, y: 2 } },
  terminal: { label: 'Order Terminal', tiles: { x: 8, y: 1, w: 3, h: 1 }, access: { x: 9, y: 2 } },
  phone: { label: 'Phone Station', tiles: { x: 15, y: 1, w: 2, h: 1 }, access: { x: 15, y: 2 } },
  delivery: { label: 'Delivery Entrance', tiles: { x: 19, y: 5, w: 1, h: 2 }, access: { x: 18, y: 5 } },
  desk: { label: 'Manager Desk', tiles: { x: 1, y: 8, w: 3, h: 2 }, access: { x: 4, y: 8 } },
};
export function stationRect(id: StationId) {
  const { tiles } = STATIONS[id];
  return { x: MAP_ORIGIN.x + tiles.x * TILE, y: MAP_ORIGIN.y + tiles.y * TILE, w: tiles.w * TILE, h: tiles.h * TILE };
}
export function accessPoint(id: StationId): Point {
  const { access } = STATIONS[id];
  return { x: MAP_ORIGIN.x + access.x * TILE, y: MAP_ORIGIN.y + access.y * TILE };
}
export const ROBOT_START = accessPoint('terminal');
