import {Fragment,useEffect,useId,useMemo,useRef,useState,type ReactNode} from 'react';
import {loadShape,mapAsset} from '../event-map-links.js';
import {naturalEarthCredit,registeredSvgFrame,renderSpaceMap,shapeSourceCredit,uniqueMapCredits} from '../assets/space-preview-map.js';
import {geographicSvgLines,mapCamera,projectedPath} from './map-view.js';
import {historicalMapPath,mapLayerFrame,placeLayer,readBasemap,type MapLayer} from './map-layers';
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

type CategoryExtent = {box:number[];points:{name:string;x:number;y:number}[]};

async function loadCategoryExtent(spaces:WorkspaceSpace[],shapes?:Shapes|null):Promise<CategoryExtent|undefined>{
 if(!shapes||!spaces.length)return;
 const bounds:number[][]=[];
 const points:{name:string;x:number;y:number}[]=[];
 await Promise.all(spaces.map(async space=>{
  const shape=shapes.get(space.mapKey);
  if(!shape)return;
  try{
   if(shape.도형유형==='point'){
    const geometry=await loadShape(shape);
    const [x,lat]=geometry.coordinates as [number,number];
    if(!Number.isFinite(x)||!Number.isFinite(lat))return;
    points.push({name:space.name,x,y:-lat});
    bounds.push([x-8,-lat-5,16,10]);
   }else if(shape.도형유형==='svg-area'||(shape.도형유형==='area'&&shape.데이터형식==='svg_legacy')){
    const {box,geographic}=registeredSvgFrame(shape.지도데이터URL);
    if(geographic)bounds.push(box);
   }
  }catch{/* Skip shapes that cannot be projected into the category frame. */}
 }));
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
 const [extent,setExtent]=useState<CategoryExtent>();
 useEffect(()=>{
  let active=true;
  setExtent(undefined);
  void loadCategoryExtent(spaces,maps.shapes).then(v=>{if(active)setExtent(v);});
  return ()=>{active=false;};
 },[spaces,maps.shapes]);
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
 const ids=useMemo(()=>new Set([...(direct?.get(event.id)??[]),...(direct?.get(event.legacyId??'')??[])]),
  [direct,event.id,event.legacyId]);
 return <PlacePicker maps={maps} ids={ids} date={event.date}/>;
}

function EventPlaceOverview({spaces,shapes}:{spaces:WorkspaceSpace[];shapes:Shapes}){
 const [drawing,setDrawing]=useState<{space:WorkspaceSpace;layer:MapLayer}[]>();
 useEffect(()=>{
  let active=true;
  setDrawing(undefined);
  void Promise.all(spaces.map(async space=>{
   const shape=shapes.get(space.mapKey);
   const layer=shape&&await placeLayer(shape).catch(()=>undefined);
   return layer?{space,layer}:null;
  })).then(entries=>{if(active)setDrawing(entries.filter(entry=>entry!==null));});
  return ()=>{active=false;};
 },[spaces,shapes]);
 if(!drawing)return <p className="lesson-empty-map" role="status">장소 지도를 읽는 중…</p>;
 const box=mapLayerFrame(drawing.map(({layer})=>layer));
 if(!box)return <p className="lesson-empty-map" role="status">한 지도에 표시할 수 있는 장소 도형이 없습니다.</p>;
 const [left,top,width,height]=box;
 const font=Math.max(width/28,height/19);
 const credits=uniqueMapCredits([...drawing.map(({space})=>shapeSourceCredit(shapes.get(space.mapKey))),naturalEarthCredit]);
 return <figure className="lesson-basemap lesson-event-overview">
  <svg viewBox={box.join(' ')} role="img" aria-label={drawing.map(({space})=>space.name).join(', ')+' 위치 지도'}>
   <use href="/assets/swimlane-basemap.svg#land"/>
   {drawing.map(({space,layer})=>layer.paths&&<path key={space.id} d={projectedPath(layer.paths,flatProject,!layer.line)}
    className={layer.line?'category-location-line':'category-location-area'} fillRule="evenodd" vectorEffect="non-scaling-stroke"><title>{space.name}</title></path>)}
   {drawing.map(({space,layer})=>{
    if(!layer.point)return null;
    const [x,lat]=layer.point;
    const side=x>left+width/2?-1:1;
    const labelY=-lat>top+font*1.6?-lat-font*.48:-lat+font*1.15;
    return <g key={space.id}><circle cx={x} cy={-lat} r={font*.32} className="category-location-dot"><title>{space.name}</title></circle>
     <text x={x+side*font*.55} y={labelY} textAnchor={side<0?'end':'start'} fontSize={font} className="category-map-label">{space.name}</text></g>;
   })}
  </svg>
  <div className="point-basemap-credit map-credit-links">
   {credits.map(({label,href,license,licenseHref})=><Fragment key={href}>
    <a href={href} target="_blank" rel="noopener noreferrer">{label}</a>
    {licenseHref&&<a href={licenseHref} target="_blank" rel="noopener noreferrer">{license}</a>}
   </Fragment>)}
  </div>
  {drawing.length<spaces.length&&<figcaption>일부 장소의 도형을 이 지도에 표시할 수 없습니다.</figcaption>}
 </figure>;
}

function PlacePicker({maps,ids,date}:{maps:LessonMaps;ids:Set<string>;date:string}){
 const [chosen,setChosen]=useState('');
 const spaces=useMemo(()=>maps.geography?.spaces.filter(s=>ids.has(s.id))??[],[maps.geography,ids]);
 const selected=spaces.find(s=>s.id===chosen);
 const space=selected??spaces[0];
 if(!maps.geography||!maps.shapes||!space)return <p className="lesson-empty-map">{maps.geography===null||maps.shapes===null?'공간 지도를 불러오지 못했습니다.':!maps.geography||!maps.shapes?'지도를 읽는 중…':'연결된 장소가 없습니다.'}</p>;
 const overview=spaces.length>1&&!selected;
 return <><div className="lesson-spaces" role="group" aria-label="지도에 표시할 장소">
  {spaces.length>1&&<button type="button" aria-pressed={overview} onClick={()=>setChosen('')}>전체</button>}
  {spaces.map(s=><button type="button" key={s.id} aria-pressed={!overview&&s===space} onClick={()=>setChosen(s.id)}>{s.name}</button>)}
 </div>
  {overview?<EventPlaceOverview spaces={spaces} shapes={maps.shapes}/>:
   <SpaceDrawing space={space} shape={maps.shapes.get(space.mapKey)} date={date} nearbyKeys={spaces.map(s=>s.mapKey)}/>}
 </>;
}
