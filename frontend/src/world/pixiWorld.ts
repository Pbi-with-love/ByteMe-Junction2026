import { Application, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { ART } from './art';
import { MAP, MAP_ORIGIN, ROBOT_START, STATIONS, accessPoint, stationRect, type Point, type StationId } from './map';
import { PALETTE } from './palette';
import { LOGICAL_H, LOGICAL_W, TILE } from './scale';
import { bobOffset, robotLook, type RobotState } from './robot';
import type { BurstKind, WorldController } from './controller';
import { tweenAt, tweenMs } from './tween';
export interface PixiWorld extends Omit<WorldController,'say'> {
  highlight(station: StationId | null): void;
  onRobotMove(cb: (p: Point) => void): () => void;
  onArrived(cb: (s: StationId) => void): () => void;
  destroy(): void;
}
const colour = (key: string) => parseInt(PALETTE[key as keyof typeof PALETTE].slice(1),16);
function drawGrid(g: Graphics, grid: readonly string[], x: number, y: number, scale=1) {
  grid.forEach((row, ry) => [...row].forEach((key, rx) => { if(key!=='.') g.rect(x+rx*scale,y+ry*scale,scale,scale).fill(colour(key)); }));
}
export async function createPixiWorld(host: HTMLElement, opts: { reducedMotion: boolean; onProgress?: (p: number) => void }): Promise<PixiWorld> {
  const app = new Application();
  await app.init({ width: LOGICAL_W, height: LOGICAL_H, backgroundColor: colour('o'), antialias: false, resolution: 1, autoDensity: false });
  const canvas = app.canvas as HTMLCanvasElement; canvas.style.width='320px'; canvas.style.height='180px'; canvas.style.imageRendering='pixelated';
  host.appendChild(canvas); opts.onProgress?.(0.25);
  const textures = new Map<string,Texture>();
  for (const [name, grid] of Object.entries(ART)) {
    const graphic = new Graphics(); drawGrid(graphic,grid,0,0);
    textures.set(name,app.renderer.generateTexture(graphic)); graphic.destroy();
  }
  const texture = (name:string) => textures.get(name)!;
  const world = new Container(); app.stage.addChild(world);
  const floor = new Container();
  const tile = (name:string,x:number,y:number) => {const sprite=new Sprite(texture(name));sprite.x=x;sprite.y=y;floor.addChild(sprite);};
  for(let y=0;y<MAP.length;y++) for(let x=0;x<MAP[y]!.length;x++) {
    const cell=MAP[y]![x]!; const px=x*TILE, py=MAP_ORIGIN.y+y*TILE;
    if(cell==='#') tile('wall',px,py);
    else if(cell==='C') tile('counter',px,py);
    else tile((x+y)%2===0?'floor_a':'floor_b',px,py);
  }
  world.addChild(floor);
  const stationLayer=new Container();
  for(const id of Object.keys(STATIONS) as StationId[]){const r=stationRect(id);const sprite=new Sprite(texture(id));sprite.x=r.x;sprite.y=r.y;stationLayer.addChild(sprite);}
  world.addChild(stationLayer);
  const robot = new Container(); world.addChild(robot);
  const body = new Sprite(texture('idle_0')), emote = new Sprite(texture('calm')), box = new Sprite(texture('box'));
  robot.addChild(body,emote,box);
  const highlightGraphic=new Graphics(); world.addChild(highlightGraphic);
  let position={...ROBOT_START}, target=position, start=position, elapsed=0, moving=false, left=false, state:RobotState='idle', hasBox=false, selected:StationId|null=null, time=0;
  const moveListeners=new Set<(p:Point)=>void>(), arrivalListeners=new Set<(s:StationId)=>void>();
  const emitMove=()=>moveListeners.forEach(cb=>cb({x:position.x+8,y:position.y}));
  const redraw=()=>{
    const look=robotLook(state), frame=moving?'walk_0':`${look.anim}_0`;
    body.texture=texture(frame);body.scale.x=left?-1:1;body.x=left?16:0;body.y=0;
    emote.visible=look.emote!==null;if(look.emote)emote.texture=texture(look.emote);emote.x=4;emote.y=-10;
    box.visible=hasBox;box.x=4;box.y=6;
    robot.x=position.x;robot.y=position.y+bobOffset(time,opts.reducedMotion);
    highlightGraphic.clear();if(selected){const r=stationRect(selected);highlightGraphic.rect(r.x,r.y,r.w,r.h).stroke({color:colour('s'),width:1});}
  };
  const ticker=()=>{time=app.ticker.lastTime;if(moving){elapsed+=app.ticker.deltaMS;position=tweenAt(start,target,elapsed);emitMove();if(elapsed>=tweenMs(start,target)){moving=false;position={...target};emitMove();const id=(Object.keys(STATIONS) as StationId[]).find(s=>accessPoint(s).x===target.x&&accessPoint(s).y===target.y);if(id)arrivalListeners.forEach(cb=>cb(id));}}redraw();};
  app.ticker.add(ticker);
  const controller:PixiWorld={
    walkTo(id){const next=accessPoint(id);start={...position};target=next;left=next.x<position.x;elapsed=0;if(opts.reducedMotion||tweenMs(position,next)===0){position={...next};moving=false;emitMove();arrivalListeners.forEach(cb=>cb(id));return Promise.resolve();}moving=true;return new Promise(resolve=>{const off=controller.onArrived(s=>{if(s===id){off();resolve();}});});},
    setRobotState(s){state=s;redraw();},carry(on){hasBox=on;redraw();},burst(_kind: BurstKind){/* Visual bursts are part of spec 011. */},highlight(id){selected=id;redraw();},
    onRobotMove(cb){moveListeners.add(cb);cb({x:position.x+8,y:position.y});return()=>moveListeners.delete(cb);},
    onArrived(cb){arrivalListeners.add(cb);return()=>arrivalListeners.delete(cb);},destroy(){app.ticker.remove(ticker);app.destroy(true,{children:true,texture:true,textureSource:true});host.replaceChildren();},
  };
  emitMove();redraw();opts.onProgress?.(1);return controller;
}
