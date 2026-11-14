import { ART } from '../world/art';
import { PALETTE } from '../world/palette';
export default function PixelSprite({name}:{name:keyof typeof ART}){const grid=ART[name];return <svg aria-hidden="true" shapeRendering="crispEdges" width={`calc(${grid[0]!.length} * var(--px))`} height={`calc(${grid.length} * var(--px))`} viewBox={`0 0 ${grid[0]!.length} ${grid.length}`}>{grid.flatMap((row,y)=>[...row].map((key,x)=>key==='.'?null:<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={PALETTE[key as keyof typeof PALETTE]}/>))}</svg>;}
