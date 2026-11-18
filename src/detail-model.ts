import type {EventRecord} from './metro-model';
export function categoryTimeline(event:EventRecord,events:EventRecord[],topicId?:string){
 return events.filter(other=>other.id!==event.id&&topicId!==undefined&&other.directTopicIds.includes(topicId))
  .concat(event).sort((a,b)=>a.bounds.start-b.bounds.start||a.id.localeCompare(b.id));
}

export function timelineGaps(events:EventRecord[]){
 const intervals=events.map((event,index)=>index===0?0:event.bounds.start-events[index-1].bounds.start);
 const threeYears=3*365.25*24*60*60*1000;
 const scale=144/Math.max(threeYears,...intervals);
 return intervals.map(interval=>interval*scale);
}
