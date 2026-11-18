import {useEffect,useLayoutEffect,useMemo,useRef,useState,type CSSProperties,type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import {EventHoverCard} from './EventHoverCard';
import type {EventRecord,HistoryData} from './metro-model';
import {countryMatches,makeTransit,placeRouteLabels,topicMatches} from './transit-model';
import {filterPackage,packageTopics} from './workspace-model';
const labelWidth=230;
const colors=['#dc7335','#438f8c','#b1a14d','#7e86bd','#a16e88','#7e9954','#ba8a67','#718ca5'];
type Preview={event:EventRecord;anchor:{left:number;top:number;bottom:number}};
export function MetroTimeline({data,onVisit,media,status}:{data:HistoryData;onVisit:(id:string,trigger:HTMLButtonElement)=>void;media:Record<string,string>;status:string}){
 const [country,setCountry]=useState(''),[topic,setTopic]=useState(''),[query,setQuery]=useState(''),[allOpen,setAllOpen]=useState(false),[picker,setPicker]=useState(false),[countryQuery,setCountryQuery]=useState(''),[preview,setPreview]=useState<Preview|null>(null),[active,setActive]=useState('');
 const [selectedTopics,setSelectedTopics]=useState<string[]|null>(null);
 const categories=useMemo(()=>packageTopics(data),[data]);
 const model=useMemo(()=>{
  const selected=selectedTopics===null?data:filterPackage(data,categories.filter(item=>!selectedTopics.includes(item.topic_id)).map(item=>item.topic_id),[]);
  return makeTransit(selected);
 },[data,categories,selectedTopics]);
 const scroll=useRef<HTMLDivElement>(null);
 const firstYear=model.years[0]?.year,lastYear=model.years.at(-1)?.year;
 const selectedIndex=model.routes.findIndex(r=>r.topic_id===topic),selectedRoute=selectedIndex>=0?model.routes[selectedIndex]:null;
 function selectRoute(id:string){clear();setTopic(old=>old===id?'':id);}
 const countries=useMemo(()=>data.actors.filter(a=>['state','territory'].includes(a.actor_type||'')&&model.events.some(e=>e.actorIds.includes(a.actor_id))).map(a=>({...a,count:model.events.filter(e=>e.actorIds.includes(a.actor_id)).length})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name)),[data,model]);
 const chosen=data.actors.find(a=>a.actor_id===country),common=countries.slice(0,8),chips=chosen&&!common.some(a=>a.actor_id===country)?[...common,{...chosen,count:model.events.filter(e=>e.actorIds.includes(country)).length}]:common;
 const matches=(e:EventRecord)=>countryMatches(e,country)&&topicMatches(e,selectedRoute?.topic_id||'')&&(!query||`${e.title} ${e.date}`.toLowerCase().includes(query.toLowerCase()));
 const events=model.events.filter(matches);
 const [routeLabels,setRouteLabels]=useState<{y:number;lineY:number;slope:number}[]>([]);
 function trackLabels(){const el=scroll.current;if(el)setRouteLabels(placeRouteLabels([...el.querySelectorAll<SVGPathElement>('.route-ink')],el.scrollLeft+labelWidth,model.height));}
 useLayoutEffect(trackLabels,[model]);
 const closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null),suppressFocus=useRef(false);
 function cancelClose(){if(closeTimer.current){clearTimeout(closeTimer.current);closeTimer.current=null;}}
 function clear(){cancelClose();setPreview(null);setActive('');}
 function selectCategory(id:string|null){
  clear();
  setTopic('');
  if(scroll.current)scroll.current.scrollLeft=0;
  setSelectedTopics(previous=>{
   if(id===null)return null;
   const ids=previous??[];
   return ids.includes(id)?ids.filter(item=>item!==id):[...ids,id];
  });
 }
 function hideLater(){cancelClose();closeTimer.current=setTimeout(()=>{if(!document.activeElement?.closest('[data-transit-preview]'))clear();},220);}
 function show(event:EventRecord,button:HTMLButtonElement){if(suppressFocus.current)return;cancelClose();const r=button.getBoundingClientRect();setActive(event.id);setPreview({event,anchor:{left:r.left,top:r.top,bottom:r.bottom}});}
 function selectPreview(event:EventRecord){cancelClose();setActive(event.id);setPreview(old=>old?{...old,event}:null);}
 function dismiss(){const id=preview?.event.id;clear();const trigger=scroll.current?.querySelector<HTMLButtonElement>(`[data-event-id="${id}"]`);suppressFocus.current=true;trigger?.focus({preventScroll:true});requestAnimationFrame(()=>{suppressFocus.current=false;});}
 useEffect(()=>()=>{if(closeTimer.current)clearTimeout(closeTimer.current);},[]);
 useEffect(()=>{if(!preview)return;const pointer=(ev:PointerEvent)=>{if(!(ev.target as Element).closest('[data-transit-preview],[data-transit-stop]'))clear();};const key=(ev:globalThis.KeyboardEvent)=>{if(ev.key==='Escape'){ev.preventDefault();dismiss();}};document.addEventListener('pointerdown',pointer);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',pointer);document.removeEventListener('keydown',key);};},[preview]);
 function open(event:EventRecord,button:HTMLButtonElement){clear();onVisit(event.id,button);}
 function move(ev:KeyboardEvent<HTMLButtonElement>,index:number){if(ev.key==='ArrowDown'){ev.preventDefault();if(!preview)show(model.points[index].event,ev.currentTarget);requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('[data-transit-preview] .preview-neighbour button, [data-transit-preview] .preview-open')?.focus());return;}let next=index;if(ev.key==='ArrowLeft')next--;else if(ev.key==='ArrowRight')next++;else if(ev.key==='Home')next=0;else if(ev.key==='End')next=model.points.length-1;else return;ev.preventDefault();scroll.current?.querySelector<HTMLButtonElement>(`[data-transit-stop="${Math.max(0,Math.min(model.points.length-1,next))}"]`)?.focus();}
 return <><section className="transit-map">
 <div className="category-picker">
  <h2 id="metro-category-title">카테고리 선택</h2>
  <div className="category-choice" role="group" aria-labelledby="metro-category-title">
   <button type="button" aria-pressed={selectedTopics===null} onClick={()=>selectCategory(null)}>전체 카테고리</button>
   {categories.map(item=><button key={item.topic_id} type="button" aria-pressed={selectedTopics?.includes(item.topic_id)??false} onClick={()=>selectCategory(item.topic_id)}>{item.name}</button>)}
  </div>
 </div>
 {!model.events.length?<p className="category-empty" role="status">노선도에서 볼 카테고리를 선택하세요.</p>:<>
 <div className="transit-toolbar"><span>{firstYear===lastYear?firstYear:`${firstYear}—${lastYear}`} <b>{model.events.length}개 사건</b></span><p>정류장을 누르면 원문·사진·관계망이 펼쳐집니다.</p></div>
 <div className="country-filter"><div className="country-chips" role="group" aria-label="국가별 정류장 강조"><button aria-pressed={!country} onClick={()=>setCountry('')}>전체 국가</button>{chips.map(a=><button key={a.actor_id} aria-pressed={country===a.actor_id} onClick={()=>{clear();setCountry(country===a.actor_id?'':a.actor_id);}}>{a.name}<span>{a.count}</span></button>)}<button className="other-countries" aria-expanded={picker} aria-controls="country-picker" onClick={()=>setPicker(!picker)}>다른 국가 {picker?'−':'＋'}</button></div>{picker&&<div id="country-picker"><label>국가 찾기<input value={countryQuery} onChange={ev=>setCountryQuery(ev.target.value)} placeholder="국가 이름"/></label><div className="country-chips" role="group" aria-label="다른 국가 선택">{countries.filter(a=>a.name.includes(countryQuery)).map(a=><button key={a.actor_id} aria-pressed={country===a.actor_id} onClick={()=>{clear();setCountry(country===a.actor_id?'':a.actor_id);setPicker(false);}}>{a.name}<span>{a.count}</span></button>)}</div></div>}<div className="country-summary" role="status">{selectedRoute?`${chosen?chosen.name+' · ':''}${selectedRoute.name} ${events.length}개 사건 강조`:chosen?`${chosen.name} 관련 ${events.length}개 사건 강조`:`전체 ${events.length}개 사건 표시`}</div></div>
 <div className="transit-scroll" ref={scroll} onScroll={()=>{clear();trackLabels();}} role="region" aria-label="시간순 Metro 노선도"><div className="transit-canvas" style={{width:model.width}}><div className="transit-axis"><svg width={model.width} height="57" aria-label="연도축">{model.years.map(y=><g key={y.year}><text x={y.x+150} y="27" textAnchor="middle">{y.year}</text><path d={`M${y.x} 43V57`}/></g>)}</svg><span>카테고리</span></div><div className="transit-stage" style={{width:model.width,height:model.height}}><svg className="transit-routes" width={model.width} height={model.height} aria-hidden="true">{model.years.map(y=><path key={y.year} className="year-guide" d={`M${y.x} 0V${model.height}`}/>)}{model.routes.map((r,i)=><g key={r.topic_id} className={`route-group ${selectedRoute&&r.topic_id!==topic?'muted-route':''}`} style={{'--route-color':colors[i%colors.length],'--row-delay':`${i*50}ms`} as CSSProperties}><path d={r.d} className="route-outline"/><path d={r.d} pathLength={1} className="route-ink"/><path d={r.d} className="route-hit" onClick={()=>selectRoute(r.topic_id)}/></g>)}{selectedRoute&&<path d={selectedRoute.d} className="raised-route" style={{'--route-color':colors[selectedIndex%colors.length]} as CSSProperties}/>}</svg>
 <div className="route-labels" style={{width:labelWidth}}><svg width={labelWidth} height={model.height} aria-hidden="true">{routeLabels.map((label,i)=>{const d=`M30,${label.y} H165 C190,${label.y} ${labelWidth-24},${label.lineY-label.slope*24} ${labelWidth},${label.lineY}`;return <g key={model.routes[i]?.topic_id||i} className={`route-group ${selectedRoute&&i!==selectedIndex?'muted-route':''}`} style={{'--route-color':colors[i%colors.length]} as CSSProperties}><path d={d} className="route-outline"/><path d={d} className={selectedRoute&&i===selectedIndex?'raised-route':'route-join'}/><path d={d} className="route-hit" onClick={()=>selectRoute(model.routes[i].topic_id)}/></g>;})}</svg>{model.routes.map((r,i)=><button key={r.topic_id} aria-pressed={topic===r.topic_id} onClick={()=>selectRoute(r.topic_id)} className={`route-name ${selectedRoute&&topic!==r.topic_id?'muted-route':''}`} style={{top:routeLabels[i]?.y??r.y,'--route-color':colors[i%colors.length]} as CSSProperties}><span>{r.name}</span></button>)}</div>
 {model.points.map((p,i)=><button key={p.event.id} data-transit-stop={i} data-event-id={p.event.id} className={`transit-stop ${p.lines.length>1?'interchange':''} ${matches(p.event)?'':'faded-station'} ${active===p.event.id?'active-stop':''} ${selectedRoute&&p.lines.includes(selectedIndex)?'focused-route-stop':''}`} style={{left:p.x,top:p.y,'--station-color':colors[(selectedRoute&&p.lines.includes(selectedIndex)?selectedIndex:p.lines[0])%colors.length]} as CSSProperties} aria-label={`${p.event.date} ${p.event.title} · ${p.lines.map(n=>model.routes[n].name).join(' · ')}${p.lines.length>1?' · 환승역':''}`} onMouseEnter={ev=>show(p.event,ev.currentTarget)} onMouseLeave={hideLater} onFocus={ev=>show(p.event,ev.currentTarget)} onBlur={hideLater} aria-haspopup="dialog" aria-expanded={preview?.event.id===p.event.id} aria-controls={preview?.event.id===p.event.id?'transit-preview-card':undefined} onKeyDown={ev=>move(ev,i)} onClick={ev=>open(p.event,ev.currentTarget)}><i>{p.lines.length>1&&<span>{p.lines.length}</span>}</i><span className="transit-event-label"><time>{p.event.date}</time><strong>{p.event.title}</strong></span></button>)}
 </div></div></div><div className="transit-legend" aria-label="카테고리 노선">{model.routes.map((r,i)=><button key={r.topic_id} aria-pressed={topic===r.topic_id} onClick={()=>selectRoute(r.topic_id)} className={selectedRoute&&topic!==r.topic_id?'muted-route':''}><i style={{background:colors[i%colors.length]}}/>{r.name}</button>)}</div><div className="map-note"><p>노선은 카테고리, 정류장은 사건입니다. 같은 사건은 환승역 하나로 연결합니다. 연도 안에서는 날짜순이며 간격은 시간에 비례하지 않습니다.</p><span role="status">{status}</span></div></>}
 </section>
 {model.events.length>0&&<section className="records"><div className="records-heading"><button aria-expanded={allOpen} onClick={()=>setAllOpen(!allOpen)}>{allOpen?'−':'＋'} {country||selectedRoute?'관련':'선택한 카테고리의'} 기록 {events.length}개</button><label>사건 검색<input value={query} onChange={ev=>{setQuery(ev.target.value);setAllOpen(true);}} placeholder="사건 이름 또는 날짜"/></label></div>{allOpen&&<div className="record-list">{events.map(e=><button key={e.id} onClick={ev=>open(e,ev.currentTarget)}><time>{e.date}</time><span>{e.title}</span><b>↗</b></button>)}{!events.length&&<p>검색 결과가 없습니다.</p>}</div>}</section>}
 {preview&&createPortal(<EventHoverCard event={preview.event} events={model.events} data={data} media={media} anchor={preview.anchor} onSelect={selectPreview} onEnter={cancelClose} onLeave={hideLater} onClose={dismiss} onOpen={()=>{const trigger=scroll.current?.querySelector<HTMLButtonElement>(`[data-event-id="${preview.event.id}"]`);if(trigger)open(preview.event,trigger);}}/>,document.body)}
 </>;
}
