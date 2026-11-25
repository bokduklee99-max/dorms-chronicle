import type {CSSProperties} from 'react';
import type {EventRecord,HistoryData} from './metro-model';
import {categoryColors} from './topic-colors';
import './kanban-board.css';

type Props = {
 events: HistoryData['events'];
 topics: HistoryData['topics'];
 media: Record<string,string>;
 onVisit: (id:string,button:HTMLButtonElement,topicId:string|null)=>void;
};

export function KanbanBoard({events,topics,media,onVisit}:Props) {
 const knownTopics = new Set(topics.map(topic => topic.topic_id));
 const byYear = new Map<number,Map<string|null,EventRecord[]>>();
 const counts = new Map<string|null,number>();
 for (const event of [...events].sort((a,b) => a.date.localeCompare(b.date))) {
  const memberships = [...new Set(event.directTopicIds.filter(id => knownTopics.has(id)))];
  const cells = byYear.get(event.year) ?? new Map<string|null,EventRecord[]>();
  for (const id of memberships.length ? memberships : [null]) {
   const cards = cells.get(id) ?? [];
   cards.push(event);
   cells.set(id,cards);
   counts.set(id,(counts.get(id) ?? 0)+1);
  }
  byYear.set(event.year,cells);
 }
 const columns = [
  ...topics.map((topic,index) => ({id:topic.topic_id,name:topic.name,color:categoryColors[index % categoryColors.length]})),
  {id:null,name:'미분류',color:categoryColors[0]},
 ].filter(column => counts.has(column.id));
 const rows = [...byYear].sort(([a],[b]) => a-b);

 return <section id="panel-kanban" role="tabpanel" aria-labelledby="tab-kanban">
  <div className="kanban-board" role="region" aria-label="연도와 카테고리별 사건 보드" tabIndex={0}>
   <table className="kanban-grid" style={{'--column-count':columns.length} as CSSProperties}>
    <thead><tr>
     <th scope="col" className="kanban-year"><span className="sr-only">연도</span></th>
     {columns.map(column => <th key={JSON.stringify(column.id)} scope="col" className="kanban-column-heading" style={{'--kanban-color':column.color} as CSSProperties}>
      <span className="kanban-column-title">{column.name}</span><span className="kanban-column-count">{counts.get(column.id)}건</span>
     </th>)}
    </tr></thead>
    <tbody>{rows.map(([year,cells]) => <tr key={year}>
     <th scope="row" className="kanban-year"><time dateTime={String(year)}>{year}</time></th>
     {columns.map(column => <td key={JSON.stringify(column.id)}>
      {cells.get(column.id)?.map(event => {
       const image = TimelineImage.src(event.media[0]?.url,media);
       const [,month,day] = event.date.split('-');
       const dateLabel = month ? `${Number(month)}월${day ? ` ${Number(day)}일` : ''}` : '연도만 기록';
       return <button key={event.id} className="kanban-card" type="button" onClick={e => onVisit(event.id,e.currentTarget,column.id)}>
        <span className="kanban-card-copy">
         <time dateTime={event.date}>{dateLabel}</time>
         <strong>{event.shortTitle || event.title}</strong>
        </span>
        {image && <img src={image} alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}} />}
       </button>;
      })}
     </td>)}
    </tr>)}</tbody>
   </table>
  </div>
 </section>;
}
