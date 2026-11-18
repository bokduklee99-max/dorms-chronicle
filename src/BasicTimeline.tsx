import {useId} from 'react';
import type {HistoryData} from './metro-model';
import {strataTimeline} from './strata-model';
import './basic-timeline.css';

export function BasicTimeline({events,topics,onVisit}:{events:HistoryData['events'];topics:HistoryData['topics'];onVisit:(id:string,button:HTMLButtonElement)=>void}){
 const id=useId();
 // makeMetro supplies chronological events without duplicate topic memberships.
 const years=strataTimeline(events);
 const decades=years.filter((group,index)=>index===0||Math.floor(group.year/10)!==Math.floor(years[index-1].year/10));
 function jump(year:number){
  const heading=document.getElementById(`${id}-${year}`);
  heading?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  heading?.focus({preventScroll:true});
 }
 return <section id="panel-timeline" role="tabpanel" aria-labelledby="tab-timeline" className="basic-timeline">
  <header className="basic-timeline-heading"><h2>{years[0].year}<span aria-hidden="true">—</span>{years.at(-1)!.year}</h2><p>사건 {events.length}개</p></header>
  <div className="basic-timeline-layout">
   <nav className="basic-timeline-nav" aria-label="연표 시기 바로가기">{decades.map(group=><button type="button" key={group.year} onClick={()=>jump(group.year)}>{Math.floor(group.year/10)*10}<span>년대</span><span aria-hidden="true">↓</span></button>)}</nav>
   <div className="basic-timeline-list">{years.map(group=><section className="basic-timeline-year" key={group.year} aria-labelledby={`${id}-${group.year}`}>
    <h3 id={`${id}-${group.year}`} tabIndex={-1}><time dateTime={String(group.year)}>{group.year}</time></h3>
    <ol>{group.events.map(event=><li key={event.id}>
     <button type="button" className="basic-timeline-event" data-open-event={event.id} aria-label={`${event.date} ${event.title}`} onClick={e=>onVisit(event.id,e.currentTarget)}>
      <time dateTime={event.date}>{event.date}</time>
      <span className="basic-timeline-event-copy"><strong>{event.title}</strong>{event.description&&<span className="basic-timeline-description">{event.description}</span>}<span className="basic-timeline-topics">{event.directTopicIds.map(topic=>topics.find(item=>item.topic_id===topic)).filter(item=>!!item).map(topic=><span key={topic.topic_id}>{topic.name}</span>)}</span></span>
      <span className="basic-timeline-open" aria-hidden="true">↗</span>
     </button>
    </li>)}</ol>
   </section>)}</div>
  </div>
 </section>;
}
