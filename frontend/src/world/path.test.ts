import { describe, expect, it } from 'vitest';
import { MAP, STATIONS } from './map';
import { isWalkable, findPath, tilePoint, stationPath, pathMs, pathAt } from './path';
import { LEVEL_MOCKS } from '../game/levels';
import { directStep, FINISH_COMMANDS, type DirectorStep } from './director';
import { MAX_WALK_MS } from './path';

describe('world paths', () => {
  it('only treats open, non-prop map tiles as walkable', () => {
    for (const { access } of Object.values(STATIONS)) expect(isWalkable(access.x, access.y)).toBe(true);
    for (let y=0;y<MAP.length;y++) for(let x=0;x<MAP[y]!.length;x++) if(MAP[y]![x] !== '.') expect(isWalkable(x,y)).toBe(false);
    for(const [x,y] of [[-1,0],[20,0],[0,11]]) expect(isWalkable(x,y)).toBe(false);
  });
  it('finds deterministic shortest paths and rejects blocked destinations', () => {
    const rows=['.....','####.','.....','.####','...#.'];
    const walk=(x:number,y:number)=>rows[y]?.[x]==='.';
    expect(findPath({x:0,y:0},{x:0,y:2},walk)).toHaveLength(11);
    expect(findPath({x:0,y:0},{x:0,y:4},walk)).toHaveLength(13);
    expect(findPath({x:0,y:0},{x:2,y:4},walk)).toHaveLength(15);
    expect(findPath({x:0,y:0},{x:4,y:4},walk)).toBeNull();
    expect(findPath({x:0,y:0},{x:1,y:1},walk)).toBeNull();
    expect(findPath({x:0,y:0},{x:5,y:0},walk)).toBeNull();
    expect(findPath({x:0,y:0},{x:0,y:0},walk)).toEqual([{x:0,y:0}]);
  });
  it('maps station routes to logical px and times progress', () => {
    expect(tilePoint(STATIONS.storage.access)).toEqual({x:64,y:34});
    expect(pathMs(stationPath('storage','terminal'))).toBe(625);
    const path=stationPath('storage','terminal');
    expect(pathAt(path,0).p).toEqual(path[0]);
    expect(pathAt(path,125)).toEqual({p:path[1],dx:1,dy:0});
    expect(pathAt(path,62).dx).toBe(1);
    expect(pathAt(path,pathMs(path)+1).p).toEqual(path.at(-1));
  });
  it('routes every station pair over the shortest walkable tile path',()=>{const ids=Object.keys(STATIONS) as (keyof typeof STATIONS)[];for(const from of ids)for(const to of ids){const path=findPath(STATIONS[from].access,STATIONS[to].access);expect(path,`${from} -> ${to}`).not.toBeNull();if(!path)continue;expect(path.every(t=>isWalkable(t.x,t.y))).toBe(true);const a=STATIONS[from].access,b=STATIONS[to].access;expect(path.length-1).toBe(Math.abs(a.x-b.x)+Math.abs(a.y-b.y));expect(stationPath(from,to).map(p=>p)).toHaveLength(path.length);}});
  it('keeps every station route and mock preset within the walk-time budget',()=>{const ids=Object.keys(STATIONS) as (keyof typeof STATIONS)[];const longest=Math.max(...ids.flatMap(from=>ids.map(to=>pathMs(stationPath(from,to)))));expect(longest).toBe(2125);expect(longest).toBeLessThanOrEqual(MAX_WALK_MS);for(const mock of LEVEL_MOCKS){for(const [presetName,preset] of Object.entries(mock.presets)){let current:keyof typeof STATIONS='terminal',total=0;for(const [stepIndex,step] of preset.steps.entries()){let stepMs=0;for(const command of directStep(step as DirectorStep)){if(command.kind==='walk'){stepMs+=pathMs(stationPath(current,command.to));current=command.to;}}if(step.order.httpStatus===202){stepMs+=pathMs(stationPath('phone','delivery'));current='delivery';}expect(stepMs,`${mock.start.level.levelId}/${presetName}/step ${stepIndex+1}`).toBeLessThanOrEqual(4500);total+=stepMs;}for(const command of FINISH_COMMANDS)if(command.kind==='walk'){total+=pathMs(stationPath(current,command.to));current=command.to;}expect(total,`${mock.start.level.levelId}/${presetName}/total`).toBeLessThanOrEqual(30_000);}}});
});
