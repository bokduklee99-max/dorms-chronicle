import {useEffect,useLayoutEffect,useRef,useState,type CSSProperties} from 'react';
import type {EventRecord,HistoryData} from './metro-model';
import {EventLeaders} from './EventLeaders';
import {EventImageCredit} from './EventImageCredit';
import {categoryTimeline,timelineGaps} from './detail-model';

type Props={
 event:EventRecord;
 data:HistoryData;
 media:Record<string,string>;
 titleId:string;
 topicId:string|null;
 onTopicChange:(id:string)=>void;
 onVisit:(id:string)=>void;
 autoFocus?:boolean;
};

export function EventDetail({event,data,media,titleId,topicId,onTopicChange,onVisit,autoFocus=true}:Props){
 const [photo,setPhoto]=useState({eventId:event.id,index:0});
 const index=photo.eventId===event.id?photo.index:0;
 const title=useRef<HTMLHeadingElement>(null);
 const body=useRef<HTMLDivElement>(null);
 const image=event.media[index];
 const imageSrc=TimelineImage.src(image?.url,media);

 useEffect(()=>{
  if(body.current)body.current.scrollTop=0;
  if(autoFocus)title.current?.focus({preventScroll:true});
 },[event.id,autoFocus]);
 return <div className="event-workspace" data-dialog-scroll>
  <header className="event-workspace-header">
   <div className="event-heading">
    <time dateTime={event.date}>{event.date}</time>{event.endDate&&<time dateTime={event.endDate}> – {event.endDate}</time>}
    {event.source&&<a href={event.source} target="_blank" rel="noreferrer">자료 출처 ↗</a>}
    <h2 ref={title} id={titleId} tabIndex={-1}>{event.title}</h2>
   </div>

  </header>
  <div className="event-workspace-main" ref={body} tabIndex={0} role="region" aria-label="사건 상세 내용">
   <div className="event-reader">
    {(event.description||image)&&<article className="event-story" aria-label="사건 내용">
     {image&&<figure className="event-media">
      {imageSrc&&<a data-dialog-figure className="event-main-image" href={imageSrc} target="_blank" rel="noreferrer" aria-label={`${event.title} 사진 크게 보기`}>
       <img key={imageSrc} src={imageSrc} alt={image.title||event.title} onError={error=>{error.currentTarget.hidden=true;}}/>
      </a>}
      {event.media.length>1&&<div className="event-image-picker" role="group" aria-label="사건 사진 선택">{event.media.map((item,i)=>{
       const src=TimelineImage.src(item.url,media);
       return <button type="button" key={item.url} aria-label={`사진 ${i+1}`} aria-pressed={i===index} onClick={()=>setPhoto({eventId:event.id,index:i})}>{src?<img src={src} alt=""/>:i+1}</button>;
      })}</div>}
      {(image.caption||imageSrc!==image.url)&&<figcaption>{image.caption}{image.caption&&imageSrc!==image.url?' · ':''}{TimelineImage.credit(imageSrc)?<EventImageCredit src={imageSrc} url={image.url}/>:imageSrc!==image.url&&<a href={image.url} target="_blank" rel="noreferrer">이미지 출처 ↗</a>}</figcaption>}
     </figure>}
     {event.description&&<p className="event-description">{event.description}</p>}
    </article>}
    {event.originLabel&&<p className="event-context-empty">{event.originLabel}</p>}
    <EventLeaders event={event} data={data}/>
   </div>
   <EventCategoryTimeline {...{event,data,titleId,topicId,onTopicChange,onVisit}}/>
  </div>
 </div>;
}

export function EventCategoryTimeline({event,data,titleId,topicId,onTopicChange,onVisit}:Omit<Props,'media'|'autoFocus'>){
 const scroller=useRef<HTMLDivElement>(null);
 const current=useRef<HTMLSpanElement>(null);
 const topics=data.topics.filter(topic=>event.directTopicIds.includes(topic.topic_id));
 const topic=topics.find(item=>item.topic_id===topicId)??topics[0];
 const timeline=categoryTimeline(event,data.events,topic?.topic_id);
 const gaps=timelineGaps(timeline);
 const position=timeline.findIndex(item=>item.id===event.id);
 const previous=timeline[position-1],next=timeline[position+1];
 useLayoutEffect(()=>{
  const list=scroller.current,row=current.current;
  if(list&&row)list.scrollTop+=row.getBoundingClientRect().top-list.getBoundingClientRect().top-(list.clientHeight-row.offsetHeight)/2;
 },[event.id,topic?.topic_id,timeline.length]);

 function visit(id:string){
  if(topic)onTopicChange(topic.topic_id);
  onVisit(id);
 }

 return <section className="event-timeline" aria-labelledby={`${titleId}-timeline`}>
    <header>
     <h3 id={`${titleId}-timeline`}>{topics.length===1?`${topics[0].name} 연표`:'카테고리 연표'}</h3>
     {topics.length>1&&<div className="event-topic-links" role="group" aria-label="연표 카테고리">{topics.map(item=><button type="button" key={item.topic_id} aria-pressed={item.topic_id===topic?.topic_id} onClick={()=>onTopicChange(item.topic_id)}>{item.name}</button>)}</div>}
     <div className="event-step-actions" onKeyDown={key=>{
      const target=key.key==='ArrowLeft'?previous:key.key==='ArrowRight'?next:null;
      if(target){key.preventDefault();visit(target.id);}
     }}>
    <button type="button" aria-label="같은 카테고리의 이전 사건" disabled={!previous} onClick={()=>visit(previous.id)}>←</button>
    <button type="button" aria-label="같은 카테고리의 다음 사건" disabled={!next} onClick={()=>visit(next.id)}>→</button>
   </div>
    </header>
    {timeline.length>1?<div className="event-timeline-scroll" ref={scroller}>
     <ol className="event-related-list">
      {timeline.map((item,index)=>{
       const isCurrent=item.id===event.id;
       return <li key={item.id} aria-current={isCurrent||undefined} style={{'--event-gap':`${gaps[index]}px`} as CSSProperties}>
        {isCurrent?<span ref={current}><time dateTime={item.date}>{item.date}</time><strong>{item.title}</strong><small>현재</small></span>:
         <button type="button" onClick={()=>visit(item.id)}><time dateTime={item.date}>{item.date}</time><strong>{item.title}</strong><span aria-hidden="true">↗</span></button>}
       </li>;
      })}
     </ol>
    </div>:<p className="event-context-empty">이 카테고리에 속하는 다른 사건이 없습니다.</p>}
   </section>;
}
