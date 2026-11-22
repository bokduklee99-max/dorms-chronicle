import {useLayoutEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import type {EventRecord} from './metro-model';
import {strataTimeline} from './strata-model';
import './basic-timeline.css';

const modes={arc:'사건군',theme:'주제',period:'시기'} as const;
type Mode=keyof typeof modes;
const modeOrder=Object.keys(modes) as Mode[];
type Category={id:string;name:string;kind:string};
type Props={
 events:EventRecord[];
 categories:Category[];
 records:{id:string;sourceId:string;place?:string;title:string}[];
 relations:{fromType:string;fromId:string;toType:string;toId:string;status?:string;visible?:boolean;body?:string}[];
 onVisit:(id:string,button:HTMLButtonElement)=>void;
};

function dateLabel(date:string,groupYear?:number){
 const [year,month,day]=date.split('-');
 const prefix=Number(year)===groupYear?'':year+'년';
 if(!month)return year+'년';
 return [prefix,Number(month)+'월',day&&Number(day)+'일'].filter(Boolean).join(' ');
}

function periodLabel(start:string,end:string){
 if(start===end)return dateLabel(start);
 if(/^\d{4}$/.test(start)&&/^\d{4}$/.test(end))return start+'–'+end+'년';
 return dateLabel(start)+' – '+dateLabel(end);
}

export function BasicTimeline({events,categories,records,relations,onVisit}:Props){
 const [choice,setChoice]=useState<Mode>('arc');
 const viewport=useRef<HTMLDivElement>(null);
 const [selected,setSelected]=useState<string[]>([]);
 const filterGroups=useMemo(()=> (['period','arc','theme'] as const)
  .map(kind=>({kind,options:categories.filter(category=>category.kind===kind)}))
  .filter(group=>group.options.length),[categories]);
 const activeGroups=useMemo(()=>filterGroups.map(({options})=>
  options.filter(category=>selected.includes(category.id)).map(category=>category.id)
 ).filter(ids=>ids.length),[filterGroups,selected]);
 function toggleFilter(category:Category,kind:Mode){
  if(!activeGroups.length)setChoice(kind);
  setSelected(ids=>ids.includes(category.id)?ids.filter(id=>id!==category.id):[...ids,category.id]);
 }
 const relatedContext=useMemo(()=>{
  const byId=new Map(records.map(record=>[record.id,record]));
  const context=new Map<string,{peer:string;body:string}>();
  for(const relation of relations){
   if(relation.fromType!=='event'||relation.toType!=='event'||relation.visible===false||relation.status!=='verified')continue;
   const from=byId.get(relation.fromId),to=byId.get(relation.toId),body=relation.body?.trim();
   if(!from||!to||!body)continue;
   if(!context.has(from.sourceId))context.set(from.sourceId,{peer:to.title,body});
   if(!context.has(to.sourceId))context.set(to.sourceId,{peer:from.title,body});
  }
  return context;
 },[records,relations]);
 const places=useMemo(()=>new Map(records.map(record=>[record.sourceId,record.place])),[records]);
 const mode=categories.some(c=>c.kind===choice)?choice:modeOrder.find(kind=>categories.some(c=>c.kind===kind))??choice;
 const {columns,years,visibleCount}=useMemo(()=>{
  const counts=new Map<string,number>();
  const selectedColumns=categories.filter(c=>c.kind===mode&&selected.includes(c.id));
  const allowed=new Map((selectedColumns.length?selectedColumns:categories.filter(c=>c.kind===mode)).map(c=>[c.id,c]));
  const chronological=[...events].sort((a,b)=>a.bounds.start-b.bounds.start||a.id.localeCompare(b.id));
  const visible=chronological.filter(event=>{
   if(!activeGroups.every(ids=>ids.some(id=>event.directTopicIds.includes(id))))return false;
   const matches=[...new Set(event.directTopicIds)].filter(id=>allowed.has(id));
   for(const id of matches)counts.set(id,(counts.get(id)??0)+1);
   return matches.length>0;
  });
  return {
   columns:Array.from(counts,([id,count])=>({...allowed.get(id)!,count})),
   years:strataTimeline(visible),visibleCount:visible.length
  };
 },[categories,events,mode,activeGroups,selected]);
 const decades=years.filter((entry,i)=>!i||Math.floor(entry.year/10)!==Math.floor(years[i-1].year/10));
 useLayoutEffect(()=>{
  const box=viewport.current,head=box?.querySelector('thead');
  if(!box||!head)return;
  function measure(){
   if(!box||!head)return;
   box.style.setProperty('--head-height',head.offsetHeight+'px');
  }
  measure();
  const observer=new ResizeObserver(measure);observer.observe(box);observer.observe(head);
  return ()=>observer.disconnect();
 },[mode,columns]);
 useLayoutEffect(()=>{viewport.current?.scrollTo(0,0);},[mode,selected]);
 function jumpYear(year:number){
  const box=viewport.current,group=box?.querySelector('tbody[data-year="'+year+'"]');
  const head=box?.querySelector('thead');
  if(box&&group&&head)box.scrollTop+=group.getBoundingClientRect().top-head.getBoundingClientRect().bottom;
 }
 return <section id="panel-timeline" role="tabpanel" aria-labelledby="tab-timeline" className="basic-timeline">
  <header className="bt-heading">
   <div>{years.length>0&&<h2>{years[0].year}{years.length>1&&<> — {years.at(-1)!.year}</>}</h2>}<p>사건 {visibleCount}개</p></div>
   <div className="bt-modes" role="group" aria-label="열 기준"><span>열 기준</span>{modeOrder.map(kind=>
    <button type="button" key={kind} aria-pressed={mode===kind} disabled={!categories.some(c=>c.kind===kind)} onClick={()=>setChoice(kind)}>{modes[kind]}</button>
   )}</div>
  </header>
  {decades.length>1&&<nav className="bt-jumps" aria-label="연대 바로가기">{decades.map(({year})=>
   <button key={year} onClick={()=>jumpYear(year)}>{Math.floor(year/10)*10}년대 ↓</button>
  )}</nav>}
  {filterGroups.length>0&&<section className="bt-filters" aria-label="카테고리 필터">
   <header><h3>카테고리 필터</h3>
    <button type="button" disabled={!activeGroups.length} onClick={()=>setSelected([])}>선택 해제</button>
   </header>
   {filterGroups.map(({kind,options})=><div key={kind} role="group" aria-label={modes[kind]} className="bt-filter-group">
    <strong>{modes[kind]}</strong>
    <div>{options.map(category=><button type="button" key={category.id} aria-pressed={selected.includes(category.id)}
     onClick={()=>toggleFilter(category,kind)}>{category.name}</button>)}</div>
   </div>)}
  </section>}
  {!visibleCount?<p role="status">{activeGroups.length?'선택한 조건에 맞는 사건이 없습니다.':'연결된 카테고리가 있는 사건이 없습니다.'}</p>:
   <div className="bt-board" ref={viewport} role="region" aria-label={modes[mode]+'별 연표'} tabIndex={0}>
    <table style={{'--lanes':columns.length} as CSSProperties} aria-label={modes[mode]+'별 사건'}>
     <colgroup><col className="bt-year-col"/><col className="bt-date-col"/>{columns.map(col=><col key={col.id}/>)}</colgroup>
     <thead><tr><th colSpan={2}>시간</th>{columns.map((col,i)=><th key={col.id} scope="col" data-tone={i%3}>{col.name} <small>{col.count}개</small></th>)}</tr></thead>
     {years.map(group=><tbody key={group.year} data-year={group.year}>{group.events.map((event,index)=>{
      const assigned=new Set(event.directTopicIds);
      const membership=columns.map(col=>assigned.has(col.id));
      const last=membership.lastIndexOf(true);
      const place=places.get(event.id)||event.place;
      const description=event.description?.trim().replace(/^>\s*/,'');
      const context=description&&description!==event.title?undefined:relatedContext.get(event.id);
      const summary=context?.body||(description!==event.title?description:'');
      const period=event.endDate?periodLabel(event.date,event.endDate):'';
      return <tr key={event.id}>
       {!index&&<th scope="rowgroup" rowSpan={group.events.length}><span>{group.year}</span></th>}
       <th scope="row"><time dateTime={event.date}>{dateLabel(event.date,group.year)}</time></th>
       {columns.map((col,i)=><td key={col.id} data-tone={i%3} className={i===last?'bt-branch bt-end':i<last?'bt-branch':undefined}>
        {membership[i]&&<button type="button" className="basic-timeline-event" data-open-event={event.id} aria-haspopup="dialog"
         aria-label={event.date+' '+event.title} onClick={e=>onVisit(event.id,e.currentTarget)}>
         <span className="bt-card-heading"><strong>{event.title}</strong><span className="bt-card-chevron" aria-hidden="true">›</span></span>
         {(period||place)&&<span className="bt-card-facts">
          {period&&<span className="bt-card-period">{period}</span>}{place&&<span>{place}</span>}
         </span>}
         {summary&&<span className="bt-card-context">
          {context&&<span className="bt-card-peer">관련 사건 · {context.peer}</span>}
          <span className="bt-card-summary">{summary.split(/\r?\n/,1)[0]}</span>
         </span>}
        </button>}
       </td>)}
      </tr>;
     })}</tbody>)}
    </table>
   </div>}
 </section>;
}
