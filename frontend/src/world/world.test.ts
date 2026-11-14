import { describe, expect, it } from 'vitest';
import { fitScale, LOGICAL_H, LOGICAL_W, TILE } from './scale';
import { MAP, MAP_COLS, MAP_ORIGIN, MAP_ROWS, ROBOT_START, STATIONS, accessPoint, stationRect } from './map';
import { tweenAt, tweenMs } from './tween';
import { bobOffset, robotLook } from './robot';
import { PALETTE, LIGHT_COLOURS } from './palette';
import { ART } from './art';
import { readFileSync } from 'node:fs';

describe('world primitives', () => {
  it('fits the logical canvas at integer scales', () => {expect([LOGICAL_W, LOGICAL_H, TILE]).toEqual([320, 180, 16]);expect([[1920,1080],[1366,768],[1280,720],[2560,1440],[800,600],[200,100]].map(([w,h])=>fitScale(w!,h!))).toEqual([6,4,4,8,2,1]);});
  it('matches the station map, labels, geometry and walk-up tiles', () => {
    expect(MAP).toHaveLength(MAP_ROWS);expect(MAP_ORIGIN).toEqual({x:0,y:2});expect(MAP.every(row=>row.length===MAP_COLS)).toBe(true);expect(Object.keys(STATIONS).sort()).toEqual(['delivery','desk','phone','storage','terminal']);expect(ROBOT_START).toEqual({x:144,y:34});
    const expected:Record<string,number[]>={storage:[16,18,48,32],terminal:[128,18,48,16],phone:[240,18,32,16],delivery:[304,82,16,32],desk:[16,130,48,32]};
    const letters:Record<string,string>={storage:'S',terminal:'T',phone:'P',delivery:'D',desk:'M'};
    for(const [id,station] of Object.entries(STATIONS)){const r=stationRect(id as keyof typeof STATIONS);expect([r.x,r.y,r.w,r.h]).toEqual(expected[id]);expect(station.label).toBe(({storage:'Storage',terminal:'Order Terminal',phone:'Phone Station',delivery:'Delivery Entrance',desk:'Manager Desk'} as Record<string,string>)[id]);for(let y=station.tiles.y;y<station.tiles.y+station.tiles.h;y++)for(let x=station.tiles.x;x<station.tiles.x+station.tiles.w;x++)expect(MAP[y]![x]).toBe(letters[id]);const a=station.access;expect(MAP[a.y]![a.x]).toBe('.');expect(a.x===station.tiles.x-1||a.x===station.tiles.x+station.tiles.w||a.y===station.tiles.y-1||a.y===station.tiles.y+station.tiles.h).toBe(true);}
    expect(accessPoint('delivery')).toEqual({x:288,y:82});
  });
  it('tweens in a rounded straight line', () => {expect(tweenMs({x:0,y:0},{x:128,y:0})).toBe(1000);expect(tweenAt({x:0,y:0},{x:128,y:0},500)).toEqual({x:64,y:0});expect(tweenAt({x:0,y:0},{x:128,y:0},9000)).toEqual({x:128,y:0});expect(tweenAt({x:7,y:8},{x:7,y:8},0)).toEqual({x:7,y:8});});
  it('maps robot states and bob timing', () => {expect(robotLook('RED')).toEqual({anim:'blocked',emote:'stop'});expect(robotLook('YELLOW')).toEqual({anim:'wait',emote:'puzzled'});expect(robotLook('working')).toEqual({anim:'work',emote:null});expect(robotLook('waiting')).toEqual({anim:'wait',emote:null});expect([bobOffset(0,false),bobOffset(500,false),bobOffset(1000,false),bobOffset(500,true)]).toEqual([0,-1,0,0]);});
  it('has correctly sized palette-indexed art grids', () => {
    expect(Object.keys(PALETTE)).toHaveLength(24);expect(LIGHT_COLOURS).toEqual({GREEN:PALETTE.G,BLUE:PALETTE.B,YELLOW:PALETTE.Y,RED:PALETTE.R});
    const sizes:Record<string,[number,number]>={floor_a:[16,16],floor_b:[16,16],wall:[16,16],counter:[16,16],storage:[48,32],terminal:[48,16],phone:[32,16],delivery:[16,32],desk:[48,32],idle_0:[16,16],walk_0:[16,16],work_0:[16,16],wait_0:[16,16],blocked_0:[16,16],box:[8,8],calm:[8,8],info:[8,8],puzzled:[8,8],stop:[8,8]};
    for (const [name, rows] of Object.entries(ART)) {expect([rows[0]!.length,rows.length],name).toEqual(sizes[name]);expect(rows.every(row=>row.length===rows[0]!.length),name).toBe(true);expect(rows.join('').split('').every(c=>c==='.'||c in PALETTE),name).toBe(true);}
  });
  it('keeps policy light CSS colours aligned with the palette',()=>{const css=readFileSync(`${process.cwd()}/src/index.css`,'utf8');for(const [key,name] of [['GREEN','green'],['BLUE','blue'],['YELLOW','yellow'],['RED','red']])expect(css).toMatch(new RegExp(`--color-light-${name}:\\s*${LIGHT_COLOURS[key as keyof typeof LIGHT_COLOURS]}`,'i'));});
});
