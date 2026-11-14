import { MAP, MAP_COLS, MAP_ROWS, MAP_ORIGIN, STATIONS, type Point, type StationId } from './map';
import { TILE } from './scale';
import { PROP_TILES } from './actors';
import { tweenAt, tweenMs } from './tween';
export type Tile = { x: number; y: number };
export function isWalkable(x: number,y: number): boolean { return x>=0&&y>=0&&x<MAP_COLS&&y<MAP_ROWS&&MAP[y]?.[x]==='.'&&!PROP_TILES.some(t=>t.x===x&&t.y===y); }
export function findPath(from: Tile,to: Tile,walkable=isWalkable): Tile[]|null {
 if(!walkable(from.x,from.y)||!walkable(to.x,to.y)) return null;
 const key=(t:Tile)=>`${t.x},${t.y}`, queue:Tile[]=[from], prev=new Map<string,string|null>([[key(from),null]]);
 for(let i=0;i<queue.length;i++){const t=queue[i]!;if(key(t)===key(to))break;for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){const n={x:t.x+dx!,y:t.y+dy!};if(!prev.has(key(n))&&walkable(n.x,n.y)){prev.set(key(n),key(t));queue.push(n);}}}
 if(!prev.has(key(to)))return null;const out:Tile[]=[];let k:string|null=key(to);while(k){const [x,y]=k.split(',').map(Number);out.unshift({x:x!,y:y!});k=prev.get(k)??null;}return out;
}
export function tilePoint(t:Tile):Point{return{x:MAP_ORIGIN.x+t.x*TILE,y:MAP_ORIGIN.y+t.y*TILE};}
export function stationPath(from:StationId,to:StationId):Point[]{return(findPath(STATIONS[from].access,STATIONS[to].access)??[]).map(tilePoint);}
export function pathMs(path:Point[]):number{return path.slice(1).reduce((n,p,i)=>n+tweenMs(path[i]!,p),0);}
export function pathAt(path:Point[],elapsedMs:number):{p:Point;dx:-1|0|1;dy:-1|0|1}{if(path.length<2||elapsedMs>=pathMs(path))return{p:{...path.at(-1)!},dx:0,dy:0};if(elapsedMs<=0)return{p:{...path[0]!},dx:Math.sign(path[1]!.x-path[0]!.x) as -1|0|1,dy:Math.sign(path[1]!.y-path[0]!.y) as -1|0|1};let elapsed=elapsedMs;for(let i=0;i<path.length-1;i++){const d=tweenMs(path[i]!,path[i+1]!);if(elapsed<=d){const a=path[i]!,b=path[i+1]!;return{p:tweenAt(a,b,elapsed),dx:Math.sign(b.x-a.x) as -1|0|1,dy:Math.sign(b.y-a.y) as -1|0|1};}elapsed-=d;}return{p:{...path.at(-1)!},dx:0,dy:0};}
export const MAX_WALK_MS=2500;
