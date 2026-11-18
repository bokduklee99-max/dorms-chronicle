import type {HistoryData,EventRecord} from './metro-model';
export function makeStrata(data:HistoryData,step:1|5){
 const years=data.events.map(e=>e.year);
 const first=years.length?Math.floor(Math.min(...years)/step)*step:1945;
 const last=years.length?Math.floor(Math.max(...years)/step)*step:first;
 const bins=Array.from({length:(last-first)/step+1},(_,i)=>first+i*step);
 const rows=data.topics.map(t=>({...t,name:t.parent_topic_id?t.name:`${t.name} 전반`,cells:bins.map(start=>data.events.filter(e=>e.year>=start&&e.year<start+step&&e.directTopicIds.includes(t.topic_id)))}));
 return {bins,rows,max:Math.max(1,...rows.flatMap(r=>r.cells.map(c=>c.length))),first,last};
}
export function strataEvents(data:HistoryData,start:number,step:1|5,topic:string|null):EventRecord[]{
 return data.events.filter(e=>e.year>=start&&e.year<start+step&&(!topic||e.directTopicIds.includes(topic))).sort((a,b)=>a.bounds.start-b.bounds.start||a.id.localeCompare(b.id));
}
export function strataTimeline(events:EventRecord[]){
 return [...new Set(events.map(e=>e.year))].map(year=>({year,events:events.filter(e=>e.year===year)}));
}
