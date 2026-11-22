import type {EventRecord} from './metro-model';
import type {readWorkspaceGeography} from './package-content';

type Geography = ReturnType<typeof readWorkspaceGeography>;
type RecordForRadar = Pick<EventRecord,'id'|'legacyId'|'year'|'date'|'title'>;
export type RadarRelation = {id:string;from:string;to:string;type:string;label:string};

const refinements=new Map([
 ['cold-war',new Set(['geo_ussr'])],
 ['japan',new Set(['geo_korean_peninsula','geo_manchuria_primorsky','geo_china_proper','geo_japan'])]
]);
const unknown = {id:'unplaced',name:'공간 미연결'};
export const radarCenter = 310;
export function radarPoint(radius:number,angle:number){
 return {x:radarCenter+radius*Math.cos(angle),y:radarCenter+radius*Math.sin(angle)};
}

export function buildRadar(events:RecordForRadar[],geography:Geography|undefined,packageId:string){
 const spaces=new Map(geography?.spaces.map(space=>[space.id,space]));
 const sectorGroups=new Map<string,{id:string;name:string;entries:{event:RecordForRadar;places:string[]}[]}>();
 const eventPlaces=new Map<string,string[]>();
 for(const event of events){
  const ids=new Set([...(geography?.directByEvent.get(event.id)??[]),...(geography?.directByEvent.get(event.legacyId??'')??[])]);
  const paths=[...ids].flatMap(id=>{
   const visited=new Set<string>();
   const path=[];
   for(let space=spaces.get(id);space&&!visited.has(space.id);space=spaces.get(space.parentId)){
    visited.add(space.id);
    path.push(space);
   }
   return path.length?[path]:[];
  });
  // An explicitly linked parent and its child share one placement.
  const ancestors=new Set(paths.flatMap(path=>path.slice(1).map(space=>space.id)));
  const placements=new Map<string,{region:{id:string;name:string};places:string[]}>();
  for(const path of paths.filter(path=>!ancestors.has(path[0].id))){
   const region=path.find(space=>refinements.get(packageId)?.has(space.id))??path.at(-1)!;
   const entry=placements.get(region.id)??{region,places:[]};
   entry.places.push(path[0].name);
   placements.set(region.id,entry);
  }
  if(!placements.size)placements.set(unknown.id,{region:unknown,places:[]});
  eventPlaces.set(event.id,[...new Set([...placements.values()].flatMap(entry=>entry.places))]);
  for(const {region,places} of placements.values()){
   const group=sectorGroups.get(region.id)??{id:region.id,name:region.name,entries:[]};
   group.entries.push({event,places});
   sectorGroups.set(region.id,group);
  }
 }
 const years=events.map(event=>event.year);
 const minYear=years.length?Math.min(...years):0;
 const maxYear=years.length?Math.max(...years):0;
 const radius=(year:number)=>minYear===maxYear?165:64+(year-minYear)/(maxYear-minYear)*183;
 const ordered=[...sectorGroups.values()].sort((a,b)=>Number(a.id===unknown.id)-Number(b.id===unknown.id)||a.name.localeCompare(b.name,'ko'));
 const span=2*Math.PI/Math.max(ordered.length,1);
 const sectors=ordered.map(({id,name,entries},index)=>{
  const start=-Math.PI/2+index*span;
  const years=new Map<number,typeof entries>();
  for(const entry of entries){
   const year=entry.event.year;
   if(!years.has(year))years.set(year,[]);
   years.get(year)!.push(entry);
  }
  const points=[...years].sort(([a],[b])=>a-b).flatMap(([year,group])=>group.sort((a,b)=>a.event.date.localeCompare(b.event.date)||a.event.id.localeCompare(b.event.id)).map((entry,i)=>{
   const phase=((i+.5)/group.length+(year-minYear)*.381966)%1;
   return {...entry,...radarPoint(radius(year),start+span*(.10+.80*phase)),key:JSON.stringify([id,entry.event.id]),sector:id};
  }));
  return {id,name,start,points};
 });
 return {sectors,span,radius,minYear,maxYear,eventPlaces};
}

type RadarPoint = ReturnType<typeof buildRadar>['sectors'][number]['points'][number];
export function radarEdges(model:ReturnType<typeof buildRadar>,relations:RadarRelation[]){
 const nodes=new Map<string,RadarPoint[]>();
 const aliases=new Map<string,string>();
 for(const sector of model.sectors)for(const point of sector.points){
  const id=point.event.id;
  if(!nodes.has(id))nodes.set(id,[]);
  nodes.get(id)!.push(point);
  const legacy=point.event.legacyId;
  if(legacy)aliases.set(legacy,id);
 }
 const locate=(id:string)=>nodes.get(id)??nodes.get(aliases.get(id)??'')??[];
 return relations.flatMap(relation=>{
  let best:{from:RadarPoint;to:RadarPoint;distance:number}|undefined;
  for(const from of locate(relation.from))for(const to of locate(relation.to)){
   if(from.event.id===to.event.id)continue;
   const distance=(from.x-to.x)**2+(from.y-to.y)**2;
   if(!best||distance<best.distance)best={from,to,distance};
  }
  return best?[{...relation,from:best.from,to:best.to}]:[];
 });
}
