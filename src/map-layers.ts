import {loadShape,mapAsset,shapePaths} from '../event-map-links.js';
import {geographicSvgLines} from './map-view.js';
import {registeredSvgFrame} from '../assets/space-preview-map.js';

export type MapLayer={box:number[];point?:number[];paths?:number[][][];line?:boolean};
type Basemap={box:string;paths:string[]};
const basemaps=new Map<string,Promise<Basemap>>();

export function historicalMapPath(path:string){
 return mapAsset(path,'svg')&&/^assets\/event-geometry\/world-\d+\.svg$/.test(path);
}

export function readBasemap(path:string){
 const cached=basemaps.get(path);
 if(cached)return cached;
 const request=fetch('/'+path).then(async response=>{
  if(!response.ok)throw Error();
  const doc=new DOMParser().parseFromString(await response.text(),'image/svg+xml');
  const box=doc.documentElement.getAttribute('viewBox');
  const paths=Array.from(doc.querySelectorAll('path'),p=>p.getAttribute('d')||'').filter(Boolean);
  if(!box||!paths.length)throw Error();
  return {box,paths};
 }).catch(err=>{basemaps.delete(path);throw err;});
 basemaps.set(path,request);
 return request;
}

export async function placeLayer(shape:Record<string,string>):Promise<MapLayer|undefined>{
 if(shape.좌표상태==='needs_digitize')return;
 let paths:number[][][];
 const line=['line','svg-line'].includes(shape.도형유형);
 if(shape.도형유형.startsWith('svg-')||shape.데이터형식==='svg_legacy'){
  const index=/^g > path:nth-of-type\(([1-9]\d*)\)$/.exec(shape.외부도형ID);
  if(index&&historicalMapPath(shape.파일경로)){
   const base=await readBasemap(shape.파일경로);
   paths=geographicSvgLines(base.paths[Number(index[1])-1]);
  }else{
   const {geographic,root}=registeredSvgFrame(shape.지도데이터URL);
   if(!geographic)return;
   paths=Array.from(root.querySelectorAll('path')).flatMap(p=>geographicSvgLines(p.getAttribute('d')));
  }
 }else{
  const geometry=await loadShape(shape);
  if(geometry.type==='Point'){
   const [x,lat]=geometry.coordinates;
   return {point:[x,lat],box:[x-4,-lat-3,8,6]};
  }
  paths=shapePaths(geometry);
 }
 if(!paths.length)return;
 let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
 for(const path of paths)for(const [x,lat] of path){
  left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,-lat);bottom=Math.max(bottom,-lat);
 }
 return {paths,line,box:[left,top,right-left,bottom-top]};
}
