export type Bounds={start:number;end:number};
export type EventRecord={id:string;legacyId?:string;title:string;shortTitle:string;date:string;endDate?:string;place?:string;dateQualifier?:string;eventType?:'period'|'policy'|'event'|'context'|'publication';originLabel?:string;year:number;description:string;reviewStatus:string;source?:string;bounds:Bounds;topicIds?:string[];directTopicIds:string[];actorIds:string[];media:{url:string;title:string;caption?:string}[]};
export type Topic={topic_id:string;name:string};
export type Actor={actor_id:string;name:string;actor_type?:string;lean?:string};
export type Tenure={id:string;actorId:string;title:string;person:string;startDate:string;endDate:string;start:Bounds;end:Bounds|null;status:string;source?:string};
export type HistoryData={events:EventRecord[];topics:Topic[];actors:Actor[];tenures:Tenure[]};
export function coldWarData(data:HistoryData):HistoryData{return {...data,events:data.events.filter(event=>event.year>=1945)};}
export const stationEventId=(id:string)=>id.split('::')[0];
export function makeMetro(data:HistoryData,media:Record<string,string>){
  const events=[...data.events].sort((a,b)=>a.bounds.start-b.bounds.start||a.id.localeCompare(b.id));
  const topics=data.topics.filter(t=>events.some(e=>e.directTopicIds.includes(t.topic_id))).slice(0,4);
  const lines=topics.map((t,i)=>({name:t.name,topicId:t.topic_id,tone:(i+1) as 1|2|3|4|5}));
  const outside=events.filter(e=>!topics.some(t=>e.directTopicIds.includes(t.topic_id)));
  if(outside.length)lines.push({name:'다른 사건',topicId:'other',tone:5});
  const items=lines.flatMap((line,i)=>events.filter(e=>line.topicId==='other'?outside.includes(e):e.directTopicIds.includes(line.topicId)).map((e,order)=>({id:`${e.id}::${line.topicId}`,eventId:e.id,title:e.shortTitle||e.title,label:e.directTopicIds.length>1?'여러 주제에 걸친 사건':undefined,date:e.date,description:e.description,image:e.media[0]?(media[e.media[0].url]||e.media[0].url):'',line:i,order})));
  return {events,lines,items};
}
