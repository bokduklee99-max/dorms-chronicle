import {useEffect,useId,useMemo,useRef,useState,type ReactNode} from 'react';
import {mapAsset} from '../event-map-links.js';
import {registeredSvgFrame,renderSpaceMap} from '../assets/space-preview-map.js';
import {geographicSvgLines,mapCamera,projectedPath} from './map-view.js';
import {historicalMapPath,readBasemap} from './map-layers';
import {fetchMapShapes,fetchMapViews,fetchWorkspaceGeography,type WorkspaceSpace} from './package-content';
import type {CategoryMetadata} from './package-catalog';
import type {EventRecord} from './metro-model';
import '../assets/space-preview.css';

type Shapes = Awaited<ReturnType<typeof fetchMapShapes>>;
type Geography = Awaited<ReturnType<typeof fetchWorkspaceGeography>>;
export function useLessonMaps(){
 const [shapes,setShapes]=useState<Shapes|null>();
 const [geography,setGeography]=useState<Geography|null>();
 const [views,setViews]=useState<Awaited<ReturnType<typeof fetchMapViews>>>();
 useEffect(()=>{
  let active=true;
  const {config,SheetData}=window.HistorySource;
  fetchMapShapes(config,SheetData.parseCSV).then(v=>{if(active)setShapes(v);},()=>{if(active)setShapes(null);});
  fetchWorkspaceGeography(config,SheetData.parseCSV).then(v=>{if(active)setGeography(v);},()=>{if(active)setGeography(null);});
  fetchMapViews(config,SheetData.parseCSV).then(v=>{if(active)setViews(v);},()=>{if(active)setViews(new Map());});
  return ()=>{active=false;};
 },[]);
 return {shapes,geography,views};
}
export type LessonMaps = ReturnType<typeof useLessonMaps>;

function categoryExtent(spaces:WorkspaceSpace[],maps:LessonMaps){
 const bounds:number[][]=[];
 const points:{name:string;x:number;y:number}[]=[];
 for(const space of spaces){
  const shape=maps.shapes?.get(space.mapKey);
  if(!shape)continue;
  try{
   const url=shape.지도데이터URL;
   if(shape.도형유형==='point'){
    const [x,lat]=shape.경도&&shape.위도
     ?[Number(shape.경도),Number(shape.위도)]
     :JSON.parse(decodeURIComponent(url.slice(url.indexOf(',')+1))).coordinates;
    if(!Number.isFinite(x)||!Number.isFinite(lat))continue;
    points.push({name:space.name,x,y:-lat});
    bounds.push([x-8,-lat-5,16,10]);
   }else if(shape.도형유형==='svg-area'||(shape.도형유형==='area'&&shape.데이터형식==='svg_legacy')){
    const {box,geographic}=registeredSvgFrame(url);
    if(geographic)bounds.push(box);
   }
  }catch{continue;}
 }
 if(!bounds.length)return;
 const west=Math.min(...bounds.map(b=>b[0])), east=Math.max(...bounds.map(b=>b[0]+b[2]));
 const north=Math.min(...bounds.map(b=>b[1])), south=Math.max(...bounds.map(b=>b[1]+b[3]));
 const pad=Math.max(east-west,south-north)*.22;
 return {box:[west-pad,north-pad,east-west+2*pad,south-north+2*pad],points};
}
const flatProject=(x:number,y:number):[number,number]=>[x,-y];
type Drawing = (project:typeof flatProject,box:number[])=>ReactNode;

export function CategoryMap({meta,maps,box,focus,label,children}:{meta?:CategoryMetadata;maps:LessonMaps;box?:number[];focus?:number[];label?:string;children?:Drawing}){
 const clipId=useId();
 const shape=maps.shapes?.get(meta?.mapKey??'');
 const spaces=useMemo(()=>{
  const legacyNames=meta?.places?.split(',').map(name=>name.trim())??[];
  return (maps.geography?.spaces??[]).filter(space=>meta?.spaceIds?meta.spaceIds.includes(space.id):legacyNames.includes(space.name));
 },[meta,maps.geography]);
 const extent=useMemo(()=>categoryExtent(spaces,maps),[spaces,maps.shapes]);
 const places=spaces.map(space=>space.name).join(', ')||meta?.places;
 const path=mapAsset(shape?.파일경로??'','svg');
 const view=meta?.viewId&&maps.views?.get(meta.viewId);
 const [base,setBase]=useState<Awaited<ReturnType<typeof readBasemap>>|null>();
 useEffect(()=>{
  let active=true;
  setBase(undefined);
  if(path)readBasemap(path).then(v=>{if(active)setBase(v);},()=>{if(active)setBase(null);});
  return ()=>{active=false;};
 },[path]);
 const camera=useMemo(()=>{
  if(!view||!historicalMapPath(path)) return;
  const [west,y,width,height]=focus??[];
  return mapCamera(view,focus?{west,east:west+width,north:-y,south:-y-height,lon:west+width/2,lat:-y-height/2}:undefined);
 },[view,path,focus]);
 const projectedBase=useMemo(()=>camera&&base?.paths.map(d=>projectedPath(geographicSvgLines(d),camera.project,true)),[camera,base]);
 if(!path||!base)return <p className="lesson-empty-map">{maps.shapes===null||base===null?'지도를 불러오지 못했습니다.':maps.shapes===undefined||path?'지도를 읽는 중…':'연결된 카테고리 지도가 없습니다.'}</p>;
 const frame=camera?.box??box??extent?.box??base.box.split(/[\s,]+/).map(Number);
 const project=camera?.project??flatProject;
 return <figure className="lesson-basemap"><svg role="img" aria-label={label??(shape?.기준시점||'카테고리 지도')} viewBox={frame.join(' ')} data-projection={camera&&view?view.projection:undefined}>
  <defs><clipPath id={clipId}><rect x={frame[0]} y={frame[1]} width={frame[2]} height={frame[3]}/></clipPath></defs>
  <g clipPath={`url(#${clipId})`}>
  {(projectedBase??base.paths).map((d,i)=><path key={i} d={d} fillRule="evenodd" vectorEffect="non-scaling-stroke"/>)}
  {!children&&extent?.points.map(p=>{
   const [x,y]=project(p.x,-p.y);
   return <circle key={p.name} cx={x} cy={y} r={Math.min(frame[2],frame[3])/54} fill="#a93824"><title>{p.name}</title></circle>;
  })}
  {children?.(project,frame)}
  </g>
 </svg><figcaption>{[camera&&view&&view.name,shape?.기준시점,!label&&places].filter(Boolean).join(' · ')}</figcaption></figure>;
}

export function SpaceDrawing({space,shape,date,nearbyKeys}:{space:WorkspaceSpace;shape?:Record<string,string>;date:string;nearbyKeys:string[]}){
 const host=useRef<HTMLDivElement>(null);
 const keys=JSON.stringify(nearbyKeys);
 useEffect(()=>{
  if(!host.current)return;
  const canvas=document.createElement('div');
  canvas.className='space-map';
  canvas.textContent='지도를 읽는 중…';
  host.current.replaceChildren(canvas);
  void renderSpaceMap(canvas,{공간명:space.name,지도참조키:space.mapKey,상위공간ID:space.parentId},shape,{date,nearbyKeys:JSON.parse(keys)});
  return ()=>canvas.remove();
 },[space,shape,date,keys]);
 return <div ref={host}/>;
}
export function EventMap({event,maps}:{event:EventRecord;maps:LessonMaps}){
 const direct=maps.geography?.directByEvent;
 const ids=new Set([...(direct?.get(event.id)??[]),...(direct?.get(event.legacyId??'')??[])]);
 return <PlacePicker maps={maps} ids={[...ids]} date={event.date}/>;
}
export function PlacePicker({maps,ids,date}:{maps:LessonMaps;ids:string[];date:string}){
 const [chosen,setChosen]=useState('');
 const spaces=maps.geography?.spaces.filter(s=>ids.includes(s.id))??[];
 const space=spaces.find(s=>s.id===chosen)??spaces.find(s=>s.type==='point')??spaces[0];
 if(!maps.geography||!maps.shapes||!space)return <p className="lesson-empty-map">{maps.geography===null||maps.shapes===null?'공간 지도를 불러오지 못했습니다.':!maps.geography||!maps.shapes?'지도를 읽는 중…':'연결된 장소가 없습니다.'}</p>;
 return <><div className="lesson-spaces" role="group" aria-label="지도에 표시할 장소">{spaces.map(s=><button type="button" key={s.id} aria-pressed={s===space} onClick={()=>setChosen(s.id)}>{s.name}</button>)}</div>
  <SpaceDrawing space={space} shape={maps.shapes.get(space.mapKey)} date={date} nearbyKeys={spaces.map(s=>s.mapKey)}/>
 </>;
}
