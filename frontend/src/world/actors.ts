import type { RobotState } from './robot';
import type { StationId } from './map';
import type { Tile } from './path';
export const MANAGER_TILE: Tile = { x: 2, y: 7 };
export const COURIER_TILE: Tile = { x: 18, y: 6 };
export const PLANT_TILES: Tile[] = [{ x: 18, y: 1 }, { x: 18, y: 9 }];
export const CRATE_TILE: Tile = { x: 1, y: 3 };
export const SHELF_TILES: Tile[] = [{ x: 5, y: 0 }, { x: 6, y: 0 }, { x: 12, y: 0 }, { x: 13, y: 0 }];
export const PROP_TILES = [MANAGER_TILE, COURIER_TILE, ...PLANT_TILES, CRATE_TILE];
export function managerAnim(state: RobotState, station: StationId | null): 'manager_phone' | 'manager_idle' { return state === 'YELLOW' && station === 'phone' ? 'manager_phone' : 'manager_idle'; }
export const COURIER_DELIVER_MS = 600;
export function courierAnim(ms: number | null): 'courier_deliver' | 'courier_idle' | null { return ms === null ? null : ms < COURIER_DELIVER_MS ? 'courier_deliver' : 'courier_idle'; }
