import type { RobotState } from './robot';
import type { StationId } from './map';
import type { Tile } from './path';
import { ART } from './art';
import { MAP_ORIGIN, type Point } from './map';
import { TILE } from './scale';
export const MANAGER_TILE: Tile = { x: 2, y: 7 };
export const COURIER_TILE: Tile = { x: 18, y: 6 };
export const PLANT_TILES: Tile[] = [{ x: 18, y: 1 }, { x: 18, y: 9 }];
export const CRATE_TILE: Tile = { x: 1, y: 3 };
export const SHELF_TILES: Tile[] = [{ x: 5, y: 0 }, { x: 6, y: 0 }, { x: 12, y: 0 }, { x: 13, y: 0 }];
export const MENU_BOARD_TILES: Tile[] = [{x:5,y:1},{x:6,y:1}];
export const CLOCK_TILE: Tile = {x:7,y:1};
export const UTENSIL_RACK_TILES: Tile[] = [{x:12,y:1},{x:13,y:1}];
export const ROLLING_CART_TILES: Tile[] = [{x:9,y:4},{x:10,y:4}];
export const SINK_TILES: Tile[] = [{x:1,y:5},{x:2,y:5}];
export const PASS_COUNTER_TILES: Tile[] = [{x:9,y:8},{x:10,y:8}];
export const FLOOR_MAT_TILES: Tile[] = [{x:5,y:6},{x:13,y:6},{x:9,y:7}];
export const FLOOR_DRAIN_TILES: Tile[] = [{x:3,y:5},{x:11,y:5}];
export const HANGING_LAMP_TILES: Tile[] = [{x:5,y:3},{x:6,y:3},{x:13,y:3},{x:14,y:3}];
export const STEAM_POINTS: Point[] = [{x:84,y:58},{x:156,y:122}];
export const BURNER_POINT: Point = {x:84,y:78};
export const PROP_TILES = [MANAGER_TILE, COURIER_TILE, ...PLANT_TILES, CRATE_TILE, ...MENU_BOARD_TILES, CLOCK_TILE, ...UTENSIL_RACK_TILES, ...ROLLING_CART_TILES, ...SINK_TILES, ...PASS_COUNTER_TILES];
export type DecorLayer = 'floor'|'props'|'overhead';
export type Decor = {sprite:keyof typeof ART; at:Point; layer:DecorLayer; anim?:'steam'|'burner'};
const point=(t:Tile):Point=>({x:MAP_ORIGIN.x+t.x*TILE,y:MAP_ORIGIN.y+t.y*TILE});
export const DECOR:Decor[]=[{sprite:'cooking_range',at:{x:80,y:66},layer:'props'},{sprite:'prep_island',at:{x:208,y:66},layer:'props'},
 {sprite:'rolling_cart',at:point(ROLLING_CART_TILES[0]!),layer:'props'},{sprite:'sink_station',at:point(SINK_TILES[0]!),layer:'props'},{sprite:'pass_counter',at:point(PASS_COUNTER_TILES[0]!),layer:'props'},{sprite:'menu_board',at:point(MENU_BOARD_TILES[0]!),layer:'props'},{sprite:'wall_clock',at:point(CLOCK_TILE),layer:'props'},{sprite:'utensil_rack',at:point(UTENSIL_RACK_TILES[0]!),layer:'props'},
 ...FLOOR_MAT_TILES.map(t=>({sprite:'floor_mat' as const,at:point(t),layer:'floor' as const})),...FLOOR_DRAIN_TILES.map(t=>({sprite:'floor_drain' as const,at:point(t),layer:'floor' as const})),...HANGING_LAMP_TILES.map(t=>({sprite:'hanging_lamp' as const,at:point(t),layer:'overhead' as const})),...STEAM_POINTS.map(at=>({sprite:'steam_0' as const,at,layer:'overhead' as const,anim:'steam' as const})),{sprite:'burner_0',at:BURNER_POINT,layer:'props',anim:'burner'}];
export function managerAnim(state: RobotState, station: StationId | null): 'manager_phone' | 'manager_idle' { return state === 'YELLOW' && station === 'phone' ? 'manager_phone' : 'manager_idle'; }
export const COURIER_DELIVER_MS = 600;
export function courierAnim(ms: number | null): 'courier_deliver' | 'courier_idle' | null { return ms === null ? null : ms < COURIER_DELIVER_MS ? 'courier_deliver' : 'courier_idle'; }
