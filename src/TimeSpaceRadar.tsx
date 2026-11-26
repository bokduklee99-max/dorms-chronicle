import {type RefObject,useEffect,useId,useMemo,useState} from 'react';
import type {HistoryData} from './metro-model';
import {fetchWorkspaceGeography} from './package-content';
import {buildRadar,radarCenter,radarEdges,radarPoint} from './radar-model';
import {WorkspaceEventCard} from './WorkspaceRoomEditor';
import './time-space-radar.css';

const sectorColors=['#426456','#9c5339','#426780','#78633b','#755877','#487673','#566075'];
const relationStyles:Record<string,[string,string]>={
 cause:['원인·계기','#9d4e35'],shift:['전환·변화','#49658a'],action:['활동·실행','#917031'],
 integration:['통합·편입','#417157'],split:['분열·개편','#835985'],background:['구조적 배경','#646c62']
};
const relationshipModes=[['all','전체'],['selected','선택한 사건'],['none','숨기기']] as const;
type Geography = Awaited<ReturnType<typeof fetchWorkspaceGeography>>;
type RadarLesson = {
 events:{id:string;sourceId:string}[];
 relations:{id:string;fromType:string;fromId:string;toType:string;toId:string;kind:string;label:string}[];
};
type Props = {panelRef:RefObject<HTMLDivElement|null>;activeId:string;onDismiss:()=>void;data:HistoryData;lesson?:RadarLesson;packageId:string;onVisit:(id:string,button:HTMLButtonElement|SVGGElement,kind?:'event'|'relation')=>void;onHideEvent?:(id:string)=>void};

export function TimeSpaceRadar({data,lesson,packageId,panelRef,activeId,onDismiss,onVisit,onHideEvent}:Props){
 const [geography,setGeography]=useState<Geography|null>();
 const [lastEvent,setLastEvent]=useState('');
 const [scan,setScan]=useState<number>();
 const [lineMode,setLineMode]=useState<typeof relationshipModes[number][0]>('all');
 const [focused,setFocused]=useState('');
 const markerId=useId();

 useEffect(()=>{

  const {config,SheetData}=window.HistorySource;
  let active=true;
  fetchWorkspaceGeography(config,SheetData.parseCSV).then(value=>{if(active)setGeography(value);},()=>{if(active)setGeography(null);});
  return ()=>{active=false;};
 },[packageId]);

 const model=useMemo(()=>buildRadar(data.events,geography??undefined,packageId),[data.events,geography,packageId]);
 const edges=useMemo(()=>{
  if(!lesson)return [];
  const ids=new Map(lesson.events.map(event=>[event.id,event.sourceId]));
  return radarEdges(model,lesson.relations.filter(rel=>rel.fromType==='event'&&rel.toType==='event').map(rel=>({
   id:rel.id,from:ids.get(rel.fromId)??rel.fromId,to:ids.get(rel.toId)??rel.toId,type:rel.kind,label:rel.label
  })));
 },[model,lesson]);
 const {sectors,radius,minYear,maxYear,span}=model;
 const year=Math.min(maxYear,Math.max(minYear,scan??minYear));
 const selected=activeId&&(data.events.find(event=>event.id===activeId)??data.events.find(event=>event.id===lastEvent))||undefined;
 const nearby=(value:number)=>Math.abs(value-year)<=2;
 const activeEdges=selected?edges.filter(edge=>edge.from.event.id===selected.id||edge.to.event.id===selected.id):[];
 const connected=new Set(activeEdges.flatMap(edge=>[edge.from.event.id,edge.to.event.id]));
 const drawnEdges=lineMode==='none'?[]:lineMode==='selected'?activeEdges:edges;
 const windowCount=data.events.filter(event=>nearby(event.year)).length;
 const pointList=sectors.flatMap(sector=>sector.points);
 const tabPoint=pointList.find(point=>point.key===focused)??pointList.find(point=>nearby(point.event.year))??pointList[0];
 const years=[...new Set(Array.from({length:6},(_,i)=>Math.round(minYear+(maxYear-minYear)*i/5)))];
 const start=Math.max(minYear,year-2),end=Math.min(maxYear,year+2);

 function openEvent(id:string,eventYear:number,trigger:HTMLButtonElement|SVGGElement){
  setLastEvent(id);
  setScan(eventYear);
  onVisit(id,trigger);
 }

 return <section id="panel-radar" role="tabpanel" aria-labelledby="tab-radar" className="time-radar">
  <header className="time-radar-controls">
   <h2>시공간 레이더</h2>
   <p>중심에서 바깥으로 시간이 흐르고, 부채꼴은 권역을 나타냅니다.</p>
  </header>
  <div className="time-radar-layout">
   <div className="time-radar-plot">
    <div className="time-radar-line-controls" role="group" aria-label="관계선">
     <span>관계선</span>{relationshipModes.map(([mode,label])=><button key={mode} type="button" aria-pressed={lineMode===mode} onClick={()=>setLineMode(mode)}>{label}</button>)}
    </div>
    <svg className="time-radar-chart" viewBox="0 0 620 620" role="group" aria-label="권역과 연도별 사건">
     <defs>{Object.entries(relationStyles).map(([type,[,color]])=><marker key={type} id={`${markerId}-${type}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L8 4 0 8Z" fill={color}/></marker>)}</defs>
     <g aria-hidden="true">
      {[...years].reverse().map((value,i)=><circle key={value} cx={radarCenter} cy={radarCenter} r={radius(value)} className={i%2?'radar-ring shaded':'radar-ring'}/>)}
      {sectors.length>1&&sectors.map(sector=>{
       const end=radarPoint(247,sector.start);
       return <line key={sector.id} x1={radarCenter} y1={radarCenter} x2={end.x} y2={end.y} className="radar-divider"/>;
      })}
      <circle cx={radarCenter} cy={radarCenter} r={radius(year)} className="radar-scan-ring"/>
     </g>
     {drawnEdges.map(edge=>{
       const type=Object.hasOwn(relationStyles,edge.type)?edge.type:'background';
       const control={x:(edge.from.x+edge.to.x)*.36+radarCenter*.28,y:(edge.from.y+edge.to.y)*.36+radarCenter*.28};
       const distance=Math.hypot(edge.to.x-control.x,edge.to.y-control.y)||1;
       const tip={x:edge.to.x+(control.x-edge.to.x)*7/distance,y:edge.to.y+(control.y-edge.to.y)*7/distance};
       const emphasized=selected?activeEdges.includes(edge):nearby(edge.from.event.year)&&nearby(edge.to.event.year);
       const curve=`M${edge.from.x} ${edge.from.y} Q${control.x} ${control.y} ${tip.x} ${tip.y}`;
       const label=[edge.from.event.title,edge.label||relationStyles[type][0],edge.to.event.title].join(' → ');
       return <g key={edge.id} className="radar-link" aria-pressed={edge.id===activeId} role="button" tabIndex={0} aria-label={label} aria-controls="radar-detail"
        onClick={e=>onVisit(edge.id,e.currentTarget,'relation')} onKeyDown={e=>{
         if(e.key==='Enter'||e.key===' '){e.preventDefault();onVisit(edge.id,e.currentTarget,'relation');}
        }}>
        <title>{label}</title>
        <path d={curve} className="radar-edge-hit"/>
        <path d={curve} className="radar-edge" data-active={emphasized} stroke={relationStyles[type][1]} markerEnd={`url(#${markerId}-${type})`}/>
       </g>;
      })}
     <g aria-hidden="true" pointerEvents="none">
      {years.map(value=><text key={value} className="radar-year-tick" x={radarCenter+6} y={radarCenter-radius(value)+4}>{value}</text>)}
      {sectors.map((sector,i)=>{
       const label=radarPoint(sectors.length===1?277:274,sector.start+span/2);
       const x=Math.max(57,Math.min(563,label.x));
       return <text key={sector.id} className="radar-sector-label" textAnchor="middle" dominantBaseline="central" x={x} y={label.y}
        fill={sector.id==='unplaced'?'#62695d':sectorColors[i%sectorColors.length]}>{sector.name}</text>;
      })}
     </g>
     {sectors.map((sector,i)=>sector.points.map(point=>{
      const {event,key}=point;
      const active=selected?.id===event.id;
      const emphasized=selected?(active||connected.has(event.id)):nearby(event.year);
      return <g key={key} data-radar-point data-open-event={event.id} aria-controls="radar-detail" className="radar-point" data-muted={!emphasized} role="button" tabIndex={key===tabPoint?.key?0:-1}
       aria-label={`${event.date} ${event.title} · ${sector.name}`} aria-pressed={active} onFocus={()=>setFocused(key)}
       onClick={e=>openEvent(event.id,event.year,e.currentTarget)} onKeyDown={keyboard=>{
        if(['Enter',' '].includes(keyboard.key)){keyboard.preventDefault();openEvent(event.id,event.year,keyboard.currentTarget);return;}
        const direction=({ArrowLeft:-1,ArrowUp:-1,ArrowRight:1,ArrowDown:1} as Record<string,number>)[keyboard.key];
        if(!direction&&keyboard.key!=='Home'&&keyboard.key!=='End')return;
        keyboard.preventDefault();
        const points=[...keyboard.currentTarget.ownerSVGElement!.querySelectorAll<SVGGElement>('[data-radar-point]')];
        const index=points.indexOf(keyboard.currentTarget);
        points[keyboard.key==='Home'?0:keyboard.key==='End'?points.length-1:(index+direction!+points.length)%points.length]?.focus();
       }}>
       <title>{event.title} · {event.date}{point.places.length?' · '+point.places.join(', '):''}</title>
       <circle cx={point.x} cy={point.y} r="8" fill="transparent"/>
       <circle className="radar-point-dot" cx={point.x} cy={point.y} r={active?6.5:4.2} fill={sector.id==='unplaced'?'#73786e':sectorColors[i%sectorColors.length]}/>
      </g>;
     }))}
    </svg>
    <div className="time-radar-scan">
     <label htmlFor="radar-year">탐색 연도</label>
     <output htmlFor="radar-year">{year}년</output>
     <input id="radar-year" type="range" min={minYear} max={maxYear} value={year} aria-valuetext={year+'년'} disabled={minYear===maxYear} onChange={event=>{
      setScan(event.currentTarget.valueAsNumber);setLastEvent('');onDismiss();
     }}/>
    </div>
    {geography===null&&<p role="status">공간 연결을 불러오지 못했습니다.</p>}
    {geography===undefined&&<p role="status">공간 연결을 읽는 중입니다.</p>}
    {drawnEdges.length>0&&<ul className="time-radar-legend" aria-label="관계선 범례">{Object.entries(relationStyles)
     .filter(([type])=>drawnEdges.some(edge=>edge.type===type)).map(([type,[label,color]])=><li key={type}><i style={{background:color}}/>{label}</li>)}</ul>}
   </div>
   <aside className="time-radar-inspector" aria-label="레이더 기록">
    <div ref={panelRef} id="radar-detail" className="radar-reader" onKeyDown={e=>{
     if(e.key==='Escape'){e.preventDefault();onDismiss();}
    }}/>
    <div hidden={!!activeId}>
     <header><time>{start===end?`${year}년`:`${start}–${end}년`}</time><h3>동시대 사건 <span>{windowCount}건</span></h3></header>
     <div className="time-radar-event-list">{windowCount===0&&<p>이 시기에 등록된 사건이 없습니다.</p>}
      {sectors.map(sector=>{
       const points=sector.points.filter(point=>nearby(point.event.year));
       return points.length>0&&<section key={sector.id}><h4>{sector.name}</h4>{points.map(({event,key,places})=><WorkspaceEventCard key={key} event={event} onHide={onHideEvent}>
        <button type="button" aria-controls="radar-detail" onClick={e=>openEvent(event.id,event.year,e.currentTarget)}>
         <strong>{event.title}</strong><time>{event.date}{places.length?' · '+places.join(' · '):''}</time>
        </button></WorkspaceEventCard>)}</section>;
      })}
     </div>
    </div>
   </aside>
  </div>
 </section>;
}
