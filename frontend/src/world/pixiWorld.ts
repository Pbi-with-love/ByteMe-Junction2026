import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { ART } from './art';
import { MAP, MAP_ORIGIN, ROBOT_START, STATIONS, accessPoint, stationRect, type Point, type StationId } from './map';
import { PALETTE } from './palette';
import { LOGICAL_H, LOGICAL_W, TILE } from './scale';
import { bobOffset, frameAt, robotLook, robotSprite, type Anim, type RobotState } from './robot';
import { MANAGER_TILE, COURIER_TILE, PLANT_TILES, CRATE_TILE, SHELF_TILES, managerAnim, courierAnim } from './actors';
import { particlesAt, type Particle } from './effects';
import type { BurstKind, WorldController } from './controller';
import { tweenAt, tweenMs } from './tween';
import { pathAt, stationPath } from './path';

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
const sameTile=(a:{x:number;y:number},b:{x:number;y:number})=>a.x===b.x&&a.y===b.y;

export async function createPixiWorld(host: HTMLElement, opts: { reducedMotion: boolean; onProgress?: (p: number) => void }): Promise<PixiWorld> {
  const app = new Application();
  await app.init({ width: LOGICAL_W, height: LOGICAL_H, backgroundColor: colour('o'), antialias: false, resolution: 1, autoDensity: false });
  const canvas = app.canvas as HTMLCanvasElement; canvas.style.width='320px'; canvas.style.height='180px'; canvas.style.imageRendering='pixelated';
  host.appendChild(canvas); opts.onProgress?.(0.25);
  const textures = new Map<string,Texture>();
  for (const [name, grid] of Object.entries(ART)) { const graphic = new Graphics(); drawGrid(graphic,grid,0,0); textures.set(name,app.renderer.generateTexture(graphic)); graphic.destroy(); }
  const texture = (name:string) => {const found=textures.get(name);if(!found)throw new Error(`Missing pixel art texture: ${name}`);return found;};
  const world = new Container(); app.stage.addChild(world);
  const floor = new Container(), propsStations = new Container(), actors = new Container(), robot = new Container(), particles = new Container(), overlay = new Container();
  world.addChild(floor,propsStations,actors,robot,overlay,particles);
  const tile = (layer:Container,name:string,x:number,y:number) => {const sprite=new Sprite(texture(name));sprite.x=x;sprite.y=y;layer.addChild(sprite);return sprite;};
  for(let y=0;y<MAP.length;y++) for(let x=0;x<MAP[y]!.length;x++) {
    const cell=MAP[y]![x]!, px=x*TILE, py=MAP_ORIGIN.y+y*TILE;
    if(cell==='#') tile(floor,SHELF_TILES.some(p=>sameTile(p,{x,y}))?'wall_shelf':'wall',px,py);
    else if(cell==='C') tile(floor,'counter',px,py);
    else tile(floor,(x+y)%2===0?'floor_a':'floor_b',px,py);
  }
  for(const p of PLANT_TILES)tile(propsStations,'plant',p.x*TILE,MAP_ORIGIN.y+p.y*TILE);
  tile(propsStations,'crate_stack',CRATE_TILE.x*TILE,MAP_ORIGIN.y+CRATE_TILE.y*TILE);
  const phoneRect=stationRect('phone');
  const phoneStation=tile(propsStations,'phone',phoneRect.x,phoneRect.y);
  for(const id of (Object.keys(STATIONS) as StationId[]).filter(id=>id!=='phone')){const r=stationRect(id);tile(propsStations,id,r.x,r.y);}

  const manager=tile(actors,'manager_idle_0',0,0), courier=tile(actors,'courier_idle_0',0,0);
  manager.x=MANAGER_TILE.x*TILE;manager.y=MAP_ORIGIN.y+MANAGER_TILE.y*TILE;
  courier.x=COURIER_TILE.x*TILE;courier.y=MAP_ORIGIN.y+COURIER_TILE.y*TILE;courier.visible=false;
  const body = tile(robot,'idle_0',0,0), emote = tile(robot,'calm',4,-10), box = tile(robot,'box',4,5);
  const highlightGraphic=new Graphics(); overlay.addChild(highlightGraphic);
  type Burst={kind:BurstKind;started:number;sprites:Sprite[]};
  const bursts=new Set<Burst>();
  let position={...ROBOT_START}, target={...ROBOT_START}, start={...ROBOT_START}, elapsed=0, moving=false, state:RobotState='idle', hasBox=false, selected:StationId|null=null, ringing=false, time=0, currentStation:StationId='terminal', segmentStep:{dx:-1|0|1;dy:-1|0|1}|null=null, anim:Anim='idle', animStarted=0, lastDelivered:number|null=null, destroyed=false;
  const moveListeners=new Set<(p:Point)=>void>(), arrivalListeners=new Set<(s:StationId)=>void>();
  const emitMove=()=>moveListeners.forEach(cb=>cb({x:position.x+8,y:position.y}));
  const updateRobot=()=>{
    const visual=robotSprite({state,carry:hasBox,step:moving?segmentStep:null,ms:Math.max(0,time-animStarted),reducedMotion:opts.reducedMotion});
    const currentAnim=visual.frame.slice(0,visual.frame.lastIndexOf('_')) as Anim;
    if(currentAnim!==anim){anim=currentAnim;animStarted=time;}
    const frame=robotSprite({state,carry:hasBox,step:moving?segmentStep:null,ms:Math.max(0,time-animStarted),reducedMotion:opts.reducedMotion});
    body.texture=texture(frame.frame);body.scale.x=frame.mirror?-1:1;body.x=frame.mirror?16:0;body.y=0;
    emote.visible=robotLook(state).emote!==null;if(robotLook(state).emote)emote.texture=texture(robotLook(state).emote!);emote.x=4;emote.y=-10;
    box.visible=frame.box!==null;if(frame.box){box.x=frame.box.x;box.y=frame.box.y;}
    robot.x=position.x;robot.y=position.y+bobOffset(time,opts.reducedMotion);
  };
  const updateParticles=()=>{for(const burst of bursts){const active=particlesAt(burst.kind,time-burst.started);active.forEach((p,i)=>{const sprite=burst.sprites[i]!;sprite.visible=true;if('sprite'in p){sprite.texture=texture(p.sprite);sprite.x=p.x-(ART[p.sprite as keyof typeof ART][0]!.length/2);sprite.y=p.y-(ART[p.sprite as keyof typeof ART].length/2);}else{sprite.texture=Texture.WHITE;sprite.x=p.x-p.size/2;sprite.y=p.y-p.size/2;sprite.width=p.size;sprite.height=p.size;sprite.tint=colour(paletteKey(p.colour));}});for(let i=active.length;i<burst.sprites.length;i++)burst.sprites[i]!.visible=false;if(!active.length){particles.removeChild(...burst.sprites);burst.sprites.forEach(s=>s.destroy());bursts.delete(burst);}}};
  const redraw=()=>{
    updateRobot();
    const managerSet=managerAnim(state,currentStation);manager.texture=texture(frameAt(managerSet,Math.max(0,time-animStarted),opts.reducedMotion));
    if(lastDelivered!==null){courier.visible=true;const courierSet=courierAnim(time-lastDelivered)!;courier.texture=texture(frameAt(courierSet,time-lastDelivered,opts.reducedMotion));}
    highlightGraphic.clear();if(selected){const r=stationRect(selected);highlightGraphic.rect(r.x,r.y,r.w,r.h).stroke({color:colour('s'),width:1});}if(ringing&&opts.reducedMotion)highlightGraphic.rect(phoneRect.x-1,phoneRect.y-1,phoneRect.w+2,phoneRect.h+2).stroke({color:colour('Y'),width:1});
    updateParticles();
  };
  const ticker=()=>{time+=app.ticker.deltaMS;phoneStation.x=phoneRect.x+(ringing&&!opts.reducedMotion&&Math.floor(time/100)%2===0?1:ringing&&!opts.reducedMotion?-1:0);if(moving){elapsed+=app.ticker.deltaMS;if(route){const at=pathAt(route,elapsed);position=at.p;segmentStep={dx:at.dx,dy:at.dy};emitMove();if(elapsed>=routeDuration)finishWalk();}else{position=tweenAt(start,target,elapsed);segmentStep={dx:Math.sign(target.x-start.x) as -1|0|1,dy:Math.sign(target.y-start.y) as -1|0|1};emitMove();if(elapsed>=tweenMs(start,target))finishWalk();}}redraw();};
  let route:Point[]|null=null,routeDuration=0,walkResolve:(()=>void)|null=null,walkTarget:StationId|null=null;
  const finishWalk=()=>{if(!walkTarget)return;const id=walkTarget;moving=false;position={...target};segmentStep=null;currentStation=id;walkTarget=null;const resolve=walkResolve;walkResolve=null;emitMove();arrivalListeners.forEach(cb=>cb(id));resolve?.();};
  app.ticker.add(ticker);
  const controller:PixiWorld={
    walkTo(id){if(destroyed)return Promise.resolve();if(walkResolve){walkResolve();walkResolve=null;}const next=accessPoint(id);const points=stationPath(currentStation,id);route=points.length?points:null;routeDuration=route?route.slice(1).length*125:0;start={...position};target=next;elapsed=0;walkTarget=id;if(opts.reducedMotion||sameTile(position,next)){position={...next};moving=false;segmentStep=null;currentStation=id;emitMove();arrivalListeners.forEach(cb=>cb(id));redraw();return Promise.resolve();}if(!route){routeDuration=tweenMs(start,target);}moving=true;return new Promise<void>(resolve=>{walkResolve=resolve;});},
    setRobotState(s){state=s;animStarted=time;redraw();},carry(on){hasBox=on;animStarted=time;redraw();},burst(kind){if(opts.reducedMotion)return;if(kind==='delivered')lastDelivered=time;const count=kind==='stamp'?10:12;const sprites=Array.from({length:count},()=>new Sprite(Texture.EMPTY));particles.addChild(...sprites);bursts.add({kind,started:time,sprites});},highlight(id){selected=id;redraw();},ring(on){ringing=on;if(!on)phoneStation.x=phoneRect.x;redraw();},
    onRobotMove(cb){moveListeners.add(cb);cb({x:position.x+8,y:position.y});return()=>moveListeners.delete(cb);},
    onArrived(cb){arrivalListeners.add(cb);return()=>arrivalListeners.delete(cb);},destroy(){destroyed=true;app.ticker.remove(ticker);if(walkResolve){walkResolve();walkResolve=null;}bursts.clear();app.destroy(true,{children:true,texture:true,textureSource:true});host.replaceChildren();},
  };
  emitMove();redraw();opts.onProgress?.(1);return controller;
}
function paletteKey(value:string):string{return Object.keys(PALETTE).find(key=>PALETTE[key as keyof typeof PALETTE]===value)??'w';}
