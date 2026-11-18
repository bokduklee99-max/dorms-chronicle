import type {HistoryData} from './metro-model';

type Row = Record<string,string>;
type Tables = Record<string,Row[]>;
type PackageSource = {id:string; name:string; tables?:Tables};

export function historyDataTables(data:HistoryData, tenures:Row[]):Tables {
 const countries = data.actors.map(actor=>({actor_id:actor.actor_id,name:actor.name,actor_type:actor.actor_type??''}));
 const categories = data.topics.map(({topic_id,name,parent_topic_id},index)=>({
  topic_id,name,parent_topic_id:data.topics.some(topic=>topic.topic_id===parent_topic_id)?parent_topic_id:'',sort_order:String(index+1),
 }));
 const names = (ids:string[], rows:Row[], key:string) => ids.map(id=>rows.find(row=>row[key]===id)?.name).filter(Boolean).join('\n');
 return {
  countries,categories,
  tenure_periods:tenures.filter(row=>countries.some(country=>country.actor_id===row.country_id)),
  events:data.events.map(event=>({
   event_id:event.id,title:event.title,start_date:event.date,summary:event.description??'',
   images:event.media.map(image=>image.url).join('\n'),source_url:event.source??'',review_status:event.reviewStatus??'',
   country_names:names(event.actorIds,countries,'actor_id'),category_names:names(event.directTopicIds,categories,'topic_id'),
  })),
  event_countries:data.events.flatMap(event=>event.actorIds.map(actor_id=>({event_id:event.id,actor_id}))),
  event_categories:data.events.flatMap(event=>event.directTopicIds.map(topic_id=>({event_id:event.id,topic_id}))),
 };
}

export function dashboardTables(sources:PackageSource[], packageId = ''):Tables {
 const selected = sources.filter(source=>!packageId||source.id===packageId);
 const rows = (key:string):Row[] => selected.flatMap(({id,tables})=>(tables?.[key]??[]).map(row=>({...row,package_id:id})));
 const unique = (records:Row[], key:string) => {
  const byId = new Map<string,Row>();
  for (const row of records) if (!byId.has(row[key])) byId.set(row[key],row);
  return [...byId.values()];
 };
 return {
  packages:selected.map(({id,name})=>({package_id:id,name})),
  events:rows('events').sort((a,b)=>a.start_date.localeCompare(b.start_date)||a.event_id.localeCompare(b.event_id)),
  categories:rows('categories'),
  countries:unique(selected.flatMap(({tables})=>tables?.countries??[]),'actor_id'),
  tenure_periods:unique(selected.flatMap(({tables})=>tables?.tenure_periods??[]),'tenure_id'),
  event_countries:rows('event_countries'),
  event_categories:rows('event_categories'),
 };
}
