import type {EventRecord} from './metro-model';

type DateRange=(value:string)=>{start:number;end:number};
export type DatedSpan={start:number;end:number};
export type Territory=DatedSpan&{id:string;actorId:string;mapKey:string;kind:'sovereignty'|'occupation'|'sphere';description:string};

export const dayMs=86400000;
export const isoDate=(day:number)=>new Date(day*dayMs).toISOString().slice(0,10);
export const covers=(span:DatedSpan,day:number)=>span.start<=day&&day<=span.end;

export function eventSpan(event:Pick<EventRecord,'bounds'|'endDate'>,dateRange:DateRange):DatedSpan{
 return {start:event.bounds.start/dayMs,end:(event.endDate?dateRange(event.endDate).end:event.bounds.end)/dayMs};
}

export function territorySpans(rows:Record<string,string>[],dateRange:DateRange):Territory[]{
 return rows.flatMap(row=>{
  const kind=row.영토유형;
  if(!row.영토ID||!row.지도참조키||(kind!=='sovereignty'&&kind!=='occupation'&&kind!=='sphere'))return [];
  try{
   const start=dateRange(row.시작일).start/dayMs;
   const end=row.종료일?dateRange(row.종료일).end/dayMs:Infinity;
   return start<=end?[{id:row.영토ID,actorId:row.주체ID,mapKey:row.지도참조키,kind,description:row.설명,start,end}]:[];
  }catch{return [];}
 });
}

export function mapTimeBounds(events:DatedSpan[],territories:DatedSpan[]){
 const start=Math.min(...events.map(event=>event.start));
 const end=Math.max(...events.map(event=>event.end));
 const changes=[...events.map(event=>event.start),...territories.flatMap(row=>[row.start,row.end+1])];
 const frames=[...new Set([start,...changes.filter(day=>day>=start&&day<=end),end])].sort((a,b)=>a-b);
 return {start,end,frames};
}
