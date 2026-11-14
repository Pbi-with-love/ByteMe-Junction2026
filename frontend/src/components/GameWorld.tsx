import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPixiWorld, type PixiWorld } from '../world/pixiWorld';
import type { WorldController } from '../world/controller';
import { stationRect, STATIONS, type StationId, type Point } from '../world/map';
import { fitScale, LOGICAL_H, LOGICAL_W } from '../world/scale';

type GameWorldProps={stations:{id:StationId;disabledReason?:string}[];onStation(id:StationId):void;onReady(controller:WorldController):void;onExit():void;children?:ReactNode};
export default function GameWorld({stations,onStation,onReady,onExit,children}:GameWorldProps){
 const host=useRef<HTMLDivElement>(null), onReadyRef=useRef(onReady), worldRef=useRef<PixiWorld|null>(null), mounted=useRef(true), [scale,setScale]=useState(()=>fitScale(window.innerWidth,window.innerHeight)),[status,setStatus]=useState<'loading'|'ready'|'error'>('loading'),[error,setError]=useState(''),[speech,setSpeech]=useState<string|null>(null),[robot,setRobot]=useState<Point>({x:160,y:90}),[robotStation,setRobotStation]=useState<string>('')
 useEffect(()=>{onReadyRef.current=onReady;},[onReady]);
 useEffect(()=>{const resize=()=>setScale(fitScale(window.innerWidth,window.innerHeight));window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
 useEffect(()=>{mounted.current=true;let cancelled=false;let created:PixiWorld|null=null;
  createPixiWorld(host.current!,{reducedMotion:window.matchMedia('(prefers-reduced-motion: reduce)').matches}).then(w=>{created=w;worldRef.current=w;if(cancelled){w.destroy();return;}const unsub=w.onRobotMove(setRobot);const controller:WorldController={walkTo:async(id)=>{await w.walkTo(id);setRobotStation(id)},setRobotState:(s)=>{w.setRobotState(s);setRobotState(s);},carry:(on)=>{w.carry(on);setCarry(on);},say:(text)=>setSpeech(text),burst:(kind)=>{w.burst(kind);setBurst(kind)}}; (controller as WorldController & {__unsubscribe?:()=>void}).__unsubscribe=unsub;onReadyRef.current(controller);setStatus('ready');}).catch(e=>{if(!cancelled){setError(e instanceof Error?e.message:String(e));setStatus('error');}});
  return()=>{cancelled=true;mounted.current=false;if(created){created.destroy();worldRef.current=null;}};
 },[]);
 const [robotState,setRobotState]=useState('idle'),[carry,setCarry]=useState(false),[burst,setBurst]=useState('');const px=`${scale}px`;const rootStyle={'--px':px} as CSSProperties;
 return <section className="game-world" aria-label="Kitchen" data-scale={scale} data-robot-state={robotState} data-carry={String(carry)} data-last-burst={burst} data-robot-station={robotStation} style={rootStyle}>
   <div className="world-frame" style={{width:LOGICAL_W*scale,height:LOGICAL_H*scale}}>
     <div ref={host} className="pixi-host" style={{width:LOGICAL_W,height:LOGICAL_H,transform:`scale(${scale})`,transformOrigin:'top left'}} />
     <div className="world-overlay" style={{width:LOGICAL_W*scale,height:LOGICAL_H*scale}}>
       {stations.map(({id,disabledReason})=>{const r=stationRect(id);return <button key={id} className="station-hotspot" aria-label={STATIONS[id].label} aria-disabled={disabledReason?'true':undefined} aria-describedby={disabledReason?`${id}-disabled`:undefined} onMouseEnter={()=>worldRef.current?.highlight(id)} onMouseLeave={()=>worldRef.current?.highlight(null)} onFocus={()=>worldRef.current?.highlight(id)} onBlur={()=>worldRef.current?.highlight(null)} onClick={()=>{if(!disabledReason)onStation(id);}} style={{left:r.x*scale,top:r.y*scale,width:r.w*scale,height:r.h*scale}}><span className="station-label">{STATIONS[id].label}</span>{disabledReason&&<span id={`${id}-disabled`} className="sr-only">{disabledReason}</span>}</button>;})}
       <div className="world-children">{children}</div>
       {speech&&<div role="status" className="speech-bubble" style={{left:`clamp(calc(8 * var(--px)), ${robot.x*scale}px, calc(312 * var(--px)))`,top:(robot.y-12)*scale}}>{speech}</div>}
     </div>
   </div>
   {status==='loading'&&<div className="world-loading" role="progressbar">Loading kitchen…</div>}
   {status==='error'&&<div className="world-error" role="alert">The kitchen could not be drawn: {error}<button onClick={onExit}>Back to levels</button></div>}
 </section>;
}
