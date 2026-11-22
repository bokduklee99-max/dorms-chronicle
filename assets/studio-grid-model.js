import {sharedContent} from './studio-cloud.js';

export function eventRecord(row){
 return {id:row.사건ID,title:row.사건명,date:row.날짜||'',end:row.종료일||'',body:row.내용||'',image:row.이미지||'',type:row.사건유형||'',importance:row.중요도||'',source:row.출처||'',actor:[],place:[]};
}
export function actorRecord(a){
 return {id:a.id,name:a.title,kind:a.kind,body:a.body||'',original:a.originalName||'',start:a.start||'',end:a.end||'',source:a.source||'',local:!!a.local,place:[...(a.spaceIds||[])]};
}
export function spaceRecord(r){return {id:r.공간ID,name:r.공간명,kind:r.공간유형||'',body:r.설명||'',alias:r.시대별칭||'',parent:r.상위공간ID||''};}
function gridEvent(e){
 return {id:e.id,title:e.title,date:e.date,end:e.end,body:e.body,image:e.media,type:e.type,importance:e.importance,source:e.source,
  actor:(e.participants||[]).map(a=>({...a})),place:[...(e.spaceIds||[])]};
}
export function gridState(d){
 const pack={id:d.id,name:d.name,school:d.school,course:d.subject,description:d.description,ids:d.events.map(e=>e.id),links:{},relations:structuredClone(d.relations),
  categories:d.categories.map(c=>({id:c.id,name:c.name,kind:c.kind,start:c.start,end:c.end,body:c.body,place:[...(c.spaceIds||[])]}))};
 for(const c of d.categories)for(const id of c.members)((pack.links[id]??={}).category??=[]).push(c.id);
 const index=rows=>Object.fromEntries(rows.map(r=>[r.id,r]));
 return {active:d.id,packages:[pack],over:{event:index(d.events.map(gridEvent)),actor:index((d.actors||[]).map(actorRecord)),place:index(structuredClone(d.spaces||[]))},queue:structuredClone(d.queue||[])};
}
export function gridContent(state,base){
 const p=state.packages[0],get=(k,id)=>state.over[k][id]||base[k][id];
 const categories=p.categories.map(c=>({...c,spaceIds:c.place||[],members:p.ids.filter(id=>p.links[id]?.category?.includes(c.id))}));
 const events=p.ids.map(id=>{const e=get('event',id);return {...e,media:e.image||'',participants:e.actor||[],spaceIds:e.place||[]};});
 const relations=p.relations;
 const needed=new Set(events.flatMap(e=>e.participants.map(a=>a.id)));
 for(const r of relations){if(get('actor',r.fromId))needed.add(r.fromId);if(get('actor',r.toId))needed.add(r.toId);}
 for(const r of state.queue)if(r.kind==='actor')needed.add(r.id);
 const actors=[...needed].map(id=>{const a=get('actor',id);if(!a)throw Error('연결된 주체를 찾을 수 없습니다: '+id);
  return {id,title:a.name,kind:a.kind,body:a.body,originalName:a.original,start:a.start,end:a.end,source:a.source,spaceIds:a.place,local:!!(a.local||state.queue.some(r=>r.id===id&&r.kind==='actor'))};});
 return sharedContent({id:p.id,name:p.name,school:p.school,subject:p.course,description:p.description,categories,events,relations,spaces:Object.values(state.over.place),queue:state.queue},actors);
}
