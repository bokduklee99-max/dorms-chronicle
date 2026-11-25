import {useLayoutEffect,useRef,useState} from 'react';
import type {EventRecord,HistoryData} from './metro-model';
import {previewNeighbours,previewPosition} from './hover-model';
export function EventHoverCard({event,events,data,media,anchor,onSelect,onOpen,onClose,onEnter,onLeave}:{event:EventRecord;events:EventRecord[];data:HistoryData;media:Record<string,string>;anchor:{left:number;top:number;bottom:number};onSelect:(event:EventRecord)=>void;onOpen:()=>void;onClose:()=>void;onEnter:()=>void;onLeave:()=>void}){
 const ref=useRef<HTMLDivElement>(null),[position,setPosition]=useState({left:12,top:12});
 const [width,setWidth]=useState(Math.min(980,innerWidth-24));
 const {previous,next}=previewNeighbours(events,event.id);
 const image=event.media[0],imageSrc=TimelineImage.src(image?.url,media);
 const countries=data.actors.filter(a=>['state','territory'].includes(a.actor_type||'')&&event.actorIds.includes(a.actor_id));
 useLayoutEffect(()=>{const el=ref.current;if(!el)return;const place=()=>{setWidth(Math.min(980,innerWidth-24));const size=el.getBoundingClientRect();setPosition(previewPosition(anchor,size,{width:innerWidth,height:innerHeight}));};place();const observer=new ResizeObserver(place);observer.observe(el);window.addEventListener('resize',place);return()=>{observer.disconnect();window.removeEventListener('resize',place);};},[anchor]);
 function neighbour(record:EventRecord|null,direction:'previous'|'next'){
  return <aside className={`preview-neighbour preview-${direction}`}><span className="preview-side-label">{direction==='previous'?'← 이전 사건':'이후 사건 →'}</span>{record?<button onClick={()=>onSelect(record)}><time>{record.date}</time><strong>{record.title}</strong><span>{direction==='previous'?'이전 사건 살펴보기':'이후 사건 살펴보기'}</span></button>:<p>{direction==='previous'?'이 시기의 첫 사건입니다.':'이 시기의 마지막 사건입니다.'}</p>}</aside>;
 }
 return <div ref={ref} id="transit-preview-card" className="event-hover-card" data-transit-preview role="dialog" aria-label="사건 미리보기" aria-modal="false" style={{...position,width}} onMouseEnter={onEnter} onMouseLeave={onLeave} onFocus={onEnter} onBlur={ev=>{if(!ev.currentTarget.contains(ev.relatedTarget))onLeave();}}>
  <button className="preview-close" aria-label="미리보기 닫기" onClick={onClose}>×</button>
  {neighbour(previous,'previous')}
  <article className="preview-main" key={event.id}>
   <figure aria-hidden={!imageSrc}>{imageSrc&&<img src={imageSrc} alt={image?.title||event.title} onError={ev=>{ev.currentTarget.hidden=true;}}/>}</figure>
   <div className="preview-story"><time>{event.date}</time><h3>{event.title}</h3><p className="preview-content">{event.description||'내용이 아직 입력되지 않았습니다.'}</p><div className="preview-countries"><h4>관련 국가</h4><div>{countries.length?countries.map(c=><span key={c.actor_id}>{c.name}</span>):<p>연결된 국가가 없습니다.</p>}</div></div><button className="preview-open" onClick={onOpen}>사진·관계망 자세히 보기 ↗</button></div>
  </article>
  {neighbour(next,'next')}
 </div>;
}
