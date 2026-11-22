import {useEffect,useMemo,useState} from 'react';
import {projectedPath} from './map-view.js';
import {placeLayer,type MapLayer} from './map-layers';
import {CategoryMap,SpaceDrawing,type LessonMaps} from './LessonMap';
import type {WorkspaceSpace} from './package-content';
import type {CategoryMetadata} from './package-catalog';
import type {EventRecord} from './metro-model';

function frame(layers:MapLayer[]){
 if(!layers.length)return;
 const left=Math.min(...layers.map(l=>l.box[0])),right=Math.max(...layers.map(l=>l.box[0]+l.box[2]));
 const top=Math.min(...layers.map(l=>l.box[1])),bottom=Math.max(...layers.map(l=>l.box[1]+l.box[3]));
 const pad=Math.max(1,(right-left)*.08,(bottom-top)*.12);
 const x=Math.max(-180,left-pad),y=Math.max(-90,top-pad);
 return [x,y,Math.min(180,right+pad)-x,Math.min(90,bottom+pad)-y];
}

export function CategoryEventMap({events,meta,maps}:{events:EventRecord[];meta?:CategoryMetadata;maps:LessonMaps}){
 const [activeId,setActiveId]=useState('');
 const [layers,setLayers]=useState<Map<string,MapLayer>>();
 const groups=useMemo(()=>{
  const places=new Map<string,{space:WorkspaceSpace;events:EventRecord[]}>();
  const unlinked:EventRecord[]=[];
  const sorted=[...events].sort((a,b)=>a.bounds.start-b.bounds.start);
  for(const event of sorted){
   const direct=maps.geography?.directByEvent;
   const ids=new Set([...(direct?.get(event.id)??[]),...(direct?.get(event.legacyId??'')??[])]);
   const spaces=maps.geography?.spaces.filter(s=>ids.has(s.id))??[];
   if(!spaces.length)unlinked.push(event);
   for(const space of spaces){
    const group=places.get(space.id)??{space,events:[]};
    group.events.push(event); places.set(space.id,group);
   }
  }
  return {all:sorted,places:[...places.values()].sort((a,b)=>b.events.length-a.events.length),unlinked};
 },[events,maps.geography]);
 useEffect(()=>{
  let live=true;
  if(!maps.shapes||!maps.geography)return;
  const shapes=maps.shapes;
  const result=new Map<string,MapLayer>();
  Promise.all(groups.places.map(async({space})=>{
   const shape=shapes.get(space.mapKey);
   if(!shape)return;
   try{const layer=await placeLayer(shape);if(layer)result.set(space.id,layer);}catch{/* The place remains accessible through its own preview. */}
  })).then(()=>{if(live)setLayers(result);});
  return ()=>{live=false;};
 },[groups,maps.shapes,maps.geography]);
 if(!maps.geography||!maps.shapes||!layers)return <p role="status" className="lesson-empty-map">{maps.geography===null||maps.shapes===null?'사건 장소를 불러오지 못했습니다.':'사건 장소를 읽는 중…'}</p>;
 const place=groups.places.find(g=>g.space.id===activeId);
 const missing=activeId==='unlinked';
 const shownEvents=missing?groups.unlinked:place?.events??groups.all;
 const drawn=(place?[place]:groups.places).flatMap(g=>{
  const layer=layers.get(g.space.id);return layer?[{...g,layer}]:[];
 }).sort((a,b)=>Number(!!a.layer.point)-Number(!!b.layer.point)||(b.layer.box[2]*b.layer.box[3]-a.layer.box[2]*a.layer.box[3]));
 const box=frame(drawn.map(g=>g.layer));
 const focus=place?box:undefined;
 return <div className="category-places">
  <div className="category-map-summary">사건 {events.length}개 <span>·</span> 연결된 장소 {groups.places.length}곳</div>
  {!missing&&place&&!drawn.length?<><SpaceDrawing space={place.space} shape={maps.shapes.get(place.space.mapKey)} date={meta?.startDate??''} nearbyKeys={[]}/><p className="category-edition">{maps.shapes.get(place.space.mapKey)?.기준시점}</p></>:
   !missing&&(drawn.length>0||meta?.viewId)?<CategoryMap meta={meta} maps={maps} box={box} focus={focus} label={place?.space.name??'카테고리 사건에 연결된 장소'}>
    {(project,frame)=>{
     const [left,top,width,height]=frame;
     const radius=Math.min(width,height)/54;
     const positions=new Map(drawn.flatMap(({space,layer})=>layer.point?[[space.id,project(layer.point[0],layer.point[1])] as const]:[]));
     const labels=[...positions].filter(([, [x,y]])=>x>left&&x<left+width&&y>top&&y<top+height).slice(0,2);
     return <>
      {drawn.map(({space,events:linked,layer})=>{
       const point=positions.get(space.id);
       return <g key={space.id} className="category-map-feature" onClick={()=>setActiveId(space.id)}><title>{space.name} · 사건 {linked.length}개</title>
        {point?<circle cx={point[0]} cy={point[1]} r={radius} className="category-location-dot"/>:
         <path d={projectedPath(layer.paths??[],project,!layer.line)} className={layer.line?'category-location-line':'category-location-area'} fillRule="evenodd" vectorEffect="non-scaling-stroke"/>}
       </g>;
      })}
      {labels.map(([id,[x,y]],index)=>{
       if(index&&Math.abs(x-labels[0][1][0])<radius*16&&Math.abs(y-labels[0][1][1])<radius*6)return null;
       const side=x>left+width*.65?-1:1;
       return <text key={id} className="category-map-label" x={x+side*radius*1.7} y={y-radius*1.7} textAnchor={side>0?'start':'end'} fontSize={radius*2.7}>{groups.places.find(g=>g.space.id===id)?.space.name}</text>;
      })}
     </>;
    }}
   </CategoryMap>:<p className="lesson-empty-map">{missing||!groups.places.length?'지도로 표시할 장소가 없습니다.':'장소를 선택하면 등록된 도형을 볼 수 있습니다.'}</p>}
  <div className="category-map-filter lesson-spaces" role="group" aria-label="장소별 사건">
   <button type="button" aria-pressed={!activeId} onClick={()=>setActiveId('')}>전체</button>
   {groups.places.map(({space,events:linked})=><button type="button" key={space.id} aria-pressed={activeId===space.id} onClick={()=>setActiveId(space.id)}>{space.name} {linked.length}</button>)}
   {!!groups.unlinked.length&&<button type="button" aria-pressed={missing} onClick={()=>setActiveId('unlinked')}>장소 미연결 {groups.unlinked.length}</button>}
  </div>
  <ol className="category-map-events" aria-label={(place?.space.name??'카테고리')+' 사건 연표'} tabIndex={0}>{shownEvents.map(e=><li key={e.id}><time>{e.date}</time><span>{e.title}{!place&&!missing&&<small>{groups.places.filter(g=>g.events.includes(e)).map(g=>g.space.name).join(' · ')||'장소 미연결'}</small>}</span></li>)}</ol>
 </div>;
}
