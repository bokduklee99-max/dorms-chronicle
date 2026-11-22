import {useEffect,useId,useMemo,useState} from 'react';
import {useLessonMaps} from './LessonMap';
import {historicalMapPath,placeLayer,readBasemap,type MapLayer} from './map-layers';
import {geographicSvgLines,mapCamera,projectedPath} from './map-view.js';
import {covers,dayMs,eventSpan,isoDate,mapTimeBounds,territorySpans,type Territory} from './timed-map-model';
import type {HistoryData} from './metro-model';
import './time-space-map.css';

const territoryLabels={sphere:'세력권',sovereignty:'주권 영토',occupation:'점령·관할'};
const fallbackView={name:'세계 전체',projection:'geoNaturalEarth1',lon:15,lat:20,west:-180,south:-60,east:180,north:80};

export function TimeSpaceMap({data,packageId,onVisit}:{data:HistoryData;packageId:string;onVisit:(id:string,button:HTMLButtonElement)=>void}){
 const maps=useLessonMaps();
 const {config,SheetData}=window.HistorySource;
 const [territories,setTerritories]=useState<Territory[]|null>();
 const [layers,setLayers]=useState<Map<string,MapLayer>>();
 const [basemap,setBasemap]=useState<{path:string;paths:number[][][][]}|null>();
 const [viewId,setViewId]=useState(()=>new URLSearchParams(location.search).get('map')||'');
 const [cursor,setCursor]=useState<number>(()=>{
  try{return SheetData.dateRange(new URLSearchParams(location.search).get('date')||'').start/dayMs;}
  catch{return -Infinity;}
 });
 const [playing,setPlaying]=useState(false);
 const [placeId,setPlaceId]=useState('');
 const clipId=useId();

 useEffect(()=>{
  let active=true;
  SheetData.sheetRecords(config,'영토변화',['영토ID','주체ID','영토유형','시작일','종료일','지도참조키']).then(rows=>{
   if(active)setTerritories(territorySpans(rows,SheetData.dateRange));
  },()=>{if(active)setTerritories(null);});
  return ()=>{active=false;};
 },[config,SheetData]);

 const events=useMemo(()=>{
  const direct=maps.geography?.directByEvent;
  return data.events.map(event=>({
   event,...eventSpan(event,SheetData.dateRange),
   spaces:new Set([...(direct?.get(event.id)??[]),...(direct?.get(event.legacyId??'')??[])])
  }));
 },[data.events,maps.geography,SheetData]);
 const time=useMemo(()=>mapTimeBounds(events,territories??[]),[events,territories]);
 const day=Math.max(time.start,Math.min(time.end,cursor));
 const date=isoDate(day);
 const previous=time.frames.filter(value=>value<day).at(-1);
 const next=time.frames.find(value=>value>day);
 const siteIndex=useMemo(()=>new Map(maps.geography?.spaces.map(space=>[space.id,space])),[maps.geography]);
 const mapKeys=useMemo(()=>[...new Set([
  ...events.flatMap(row=>[...row.spaces].map(id=>siteIndex.get(id)?.mapKey??'')),
  ...(territories??[]).filter(row=>row.start<=time.end&&row.end>=time.start).map(row=>row.mapKey)
 ])].filter(Boolean),[events,siteIndex,territories,time.start,time.end]);

 useEffect(()=>{
  const shapes=maps.shapes;
  if(!shapes||!maps.geography||territories===undefined)return;
  let active=true;
  const ready=new Map<string,MapLayer>();
  Promise.all(mapKeys.map(async key=>{
   const shape=shapes.get(key);
   if(!shape)return;
   try{const layer=await placeLayer(shape);if(layer)ready.set(key,layer);}catch{/* The event remains in the list when its geometry is unavailable. */}
  })).then(()=>{if(active)setLayers(ready);});
  return ()=>{active=false;};
 },[maps.shapes,maps.geography,mapKeys,territories]);

 const editions=useMemo(()=>[...(maps.shapes?.values()??[])].flatMap(shape=>{
  const match=/^world_(\d{4})$/.exec(shape.지도참조키);
  return match&&shape.도형유형==='basemap'&&historicalMapPath(shape.파일경로)
   ?[{year:Number(match[1]),path:shape.파일경로}]:[];
 }).sort((a,b)=>a.year-b.year),[maps.shapes]);
 const currentYear=Number(date.slice(0,4));
 const edition=editions.filter(item=>item.year<=currentYear).at(-1)??editions[0];
 const path=edition?.path;
 useEffect(()=>{
  if(!path)return;
  let active=true;
  readBasemap(path).then(base=>{
   if(active)setBasemap({path,paths:base.paths.map(geographicSvgLines)});
  },()=>{if(active)setBasemap(null);});
  return ()=>{active=false;};
 },[path]);

 useEffect(()=>{
  if(!playing)return;
  if(next===undefined){setPlaying(false);return;}
  const timer=window.setTimeout(()=>setCursor(next),850);
  return ()=>window.clearTimeout(timer);
 },[playing,next]);

 const view=maps.views?.get(viewId)||maps.views?.get(packageId==='japan'?'view_east_asia':'view_world')||fallbackView;
 const {project,box}=useMemo(()=>mapCamera(view,undefined),[view]);
 const background=useMemo(()=>basemap?.path===path?basemap?.paths.map(lines=>projectedPath(lines,project,true)):undefined,[basemap,path,project]);
 const projectedLayers=useMemo(()=>new Map([...(layers??[])].flatMap(([key,layer])=>
  layer.paths?[[key,projectedPath(layer.paths,project,!layer.line)] as const]:[])),[layers,project]);
 const [x,y,width,height]=box;
 const radius=Math.min(width,height)/62;
 const activeEvents=events.filter(row=>covers(row,day));
 const selected=placeId&&siteIndex.get(placeId);
 const visibleEvents=selected?activeEvents.filter(row=>row.spaces.has(placeId)):activeEvents;
 const activeSites=[...new Set(activeEvents.flatMap(row=>[...row.spaces]))];
 function inView(layer:MapLayer){
  if(layer.point){
   const [lon,lat]=layer.point;
   return lon>=view.west&&lon<=view.east&&lat>=view.south&&lat<=view.north;
  }
  const [west,north,w,h]=layer.box;
  return west<=view.east&&west+w>=view.west&&-north-h<=view.north&&-north>=view.south;
 }
 const markers=activeSites.flatMap(id=>{
  const space=siteIndex.get(id);
  const layer=space&&layers?.get(space.mapKey);
  return space&&layer&&inView(layer)?[{space,layer}]:[];
 }).sort((a,b)=>Number(!!a.layer.point)-Number(!!b.layer.point)||(b.layer.box[2]*b.layer.box[3]-a.layer.box[2]*a.layer.box[3]));
 const regions=(territories??[]).flatMap(row=>{
  if(!covers(row,day))return [];
  const layer=layers?.get(row.mapKey);
  const name=data.actors.find(actor=>actor.actor_id===row.actorId)?.name||row.description||row.actorId;
  return layer?.paths&&inView(layer)?[{row,layer,name}]:[];
 }).sort((a,b)=>Object.keys(territoryLabels).indexOf(a.row.kind)-Object.keys(territoryLabels).indexOf(b.row.kind));
 const unmapped=layers?activeEvents.filter(row=>![...row.spaces].some(id=>layers.has(siteIndex.get(id)?.mapKey??''))).length:0;
 const missingTerritories=layers?(territories??[]).filter(row=>covers(row,day)&&!layers.has(row.mapKey)).length:0;
 const issue=maps.shapes===null||maps.geography===null?'지도 데이터를 불러오지 못했습니다.'
  :basemap===null||(maps.shapes&&!path)?'배경지도를 불러오지 못했습니다.':territories===null?'영토 변화 시트를 불러오지 못했습니다.':'';

 function seek(value:number){
  setPlaying(false);
  setCursor(value);
  setPlaceId('');
 }
 function selectPlace(id:string){
  setPlaying(false);
  setPlaceId(current=>current===id?'':id);
 }

 return <section id="panel-map-sync" role="tabpanel" aria-labelledby="tab-map-sync" className="sync-map">
  <header className="sync-map-header">
   <h2>시공간 동기화</h2>
   {!!maps.views?.size&&<div className="sync-map-views" role="group" aria-label="지도 범위">
    {[...maps.views].map(([id,item])=><button key={id} type="button" aria-pressed={view===item} onClick={()=>{setViewId(id);setPlaceId('');}}>{item.name}</button>)}
   </div>}
  </header>
  <div className="sync-map-layout">
   <div className="sync-map-stage">
    <figure>
     <svg viewBox={box.join(' ')} role="group" aria-label={view.name+' '+date+' 지도'}>
      <defs><clipPath id={clipId}><rect x={x} y={y} width={width} height={height}/></clipPath></defs>
      <g clipPath={`url(#${clipId})`}>
       {background?.map((d,index)=><path key={index} d={d} className="sync-map-base" fillRule="evenodd" vectorEffect="non-scaling-stroke"/>)}
       {regions.map(({row,name})=><path key={row.id} d={projectedLayers.get(row.mapKey)}
        className={`sync-map-territory ${row.kind}`} data-territory={row.mapKey} fillRule="evenodd" vectorEffect="non-scaling-stroke"><title>{name} · {territoryLabels[row.kind]}</title></path>)}
       {markers.map(({space,layer})=>{
        const point=layer.point&&project(layer.point[0],layer.point[1]);
        return <g key={space.id} role="button" tabIndex={0} aria-label={space.name+' 사건 보기'} aria-pressed={placeId===space.id}
         className="sync-map-place" onClick={()=>selectPlace(space.id)} onKeyDown={event=>{
          if(event.key==='Enter'||event.key===' '){event.preventDefault();selectPlace(space.id);}
         }}>
         <title>{space.name}</title>
         {point?<><circle cx={point[0]} cy={point[1]} r={radius*1.75} fill="transparent"/><circle cx={point[0]} cy={point[1]} r={radius} className="sync-map-dot" vectorEffect="non-scaling-stroke"/></>
          :<path d={projectedLayers.get(space.mapKey)} className={layer.line?'sync-map-line':'sync-map-area'} fillRule="evenodd" vectorEffect="non-scaling-stroke"/>}
        </g>;
       })}
      </g>
     </svg>
     {!background&&!issue&&<p className="sync-map-status" role="status">지도를 읽는 중…</p>}
     {issue&&<p className="sync-map-status" role="status">{issue}</p>}
     {edition&&basemap?.path===path&&<figcaption>{edition.year}년 {edition.year>currentYear?'참고 지도':'배경지도'}</figcaption>}
    </figure>
    <div className="sync-map-controls">
     <button className="sync-map-play" type="button" disabled={time.start===time.end} onClick={()=>{
      if(playing){setPlaying(false);return;}
      if(day===time.end)setCursor(time.start);
      setPlaceId('');
      setPlaying(true);
     }}>{playing?'일시정지':'▶ 재생'}</button>
     <button type="button" aria-label="이전 변화" disabled={previous===undefined} onClick={()=>{if(previous!==undefined)seek(previous);}}>←</button>
     <div className="sync-map-scrubber">
      <input aria-label="지도 날짜" aria-valuetext={date} type="range" min={time.start} max={time.end} value={day} step={1}
       disabled={time.start===time.end} onChange={event=>seek(event.currentTarget.valueAsNumber)}/>
      <div><span>{isoDate(time.start)}</span><span>{isoDate(time.end)}</span></div>
     </div>
     <button type="button" aria-label="다음 변화" disabled={next===undefined} onClick={()=>{if(next!==undefined)seek(next);}}>→</button>
    </div>
   </div>
   <aside className="sync-map-inspector" aria-label="현재 날짜의 기록">
    <header><time dateTime={date}>{date}</time><h3>{selected?selected.name:'현재 사건'} <span>{visibleEvents.length}건</span></h3>
     {selected&&<button type="button" onClick={()=>setPlaceId('')}>전체 사건</button>}
    </header>
    <div className="sync-map-records">
     {visibleEvents.length?<ul className="sync-map-events">{visibleEvents.map(({event,spaces})=>{
      const places=[...spaces].flatMap(id=>siteIndex.get(id)?.name??[]);
      return <li key={event.id}><button type="button" onClick={click=>{setPlaying(false);onVisit(event.id,click.currentTarget);}}>
       <strong>{event.title}</strong><small>{[event.date,places.join(' · ')].filter(Boolean).join(' · ')}</small>
      </button></li>;
     })}</ul>:<p>이 날짜에 기록된 사건이 없습니다.</p>}
     {(!!regions.length||!!missingTerritories)&&<section className="sync-map-regions"><h4>영토와 세력권</h4>
      <ul>{regions.map(({row,name})=><li key={row.id}><i className={row.kind} aria-hidden="true"/><span>{name} <small>{territoryLabels[row.kind]}</small></span></li>)}</ul>
      {!!missingTerritories&&<p>지도에 표시할 수 없는 영역 {missingTerritories}건</p>}
     </section>}
    </div>
    {!!unmapped&&<p className="sync-map-unmapped">지도에 표시할 수 없는 사건 {unmapped}건</p>}
   </aside>
  </div>
 </section>;
}
