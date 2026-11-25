import './record-views.js';
import {countryFlag} from './country-flag.js';
import {eventPeriods} from '../swimlane-data.js';

// Join the current lesson, including filtered lessons and unpublished package drafts.
export function lessonRecordViews({events,categories,detailActors,relations,leadership,name='',packageId=''}){
  const rows={사건:[],주체:[],카테고리:[],관계:[],공간:[],직위:[],재임:[],패키지:[],사건_주체:[],사건_카테고리:[]};
  const add=(tab,id,fields)=>rows[tab].push({tab,id,n:rows[tab].length+1,...fields});
  add('패키지',packageId,{패키지명:name});
  const categoryNames=new Map(),actorNames=new Map();
  for(const c of categories){
    categoryNames.set(c.kind+'|'+c.name,c.id);
    add('카테고리',c.id,{카테고리유형:c.kind,카테고리명:c.name,시작일:c.start||'',종료일:c.end||'',설명:c.body,패키지ID:packageId,출처:c.source});
  }
  for(const a of detailActors){
    actorNames.set(a.title,a.id);
    add('주체',a.id,{주체명:a.title,구분:a.kind,소개:a.body,원어명:a.originalName,성향:a.orientation,검토상태:a.status,
      '존속 시작일':a.start,'존속 종료일':a.end,'기간 설명':a.periodNotes,국가코드:a.iso3});
  }
  for(const e of events){
    add('사건',e.id,{사건명:e.title,날짜:e.date||'',종료일:e.end,내용:e.body,이미지:e.media,사건유형:e.type,중요도:e.importance,출처:e.source,originLabel:e.originLabel,images:e.images});
    const categoryIds=e.categoryIds??[['period',eventPeriods(e)],['arc',e.arcs],['theme',e.themes]].flatMap(([kind,names])=>
      (names||[]).map(name=>categoryNames.get(kind+'|'+name)));
    for(const id of new Set(categoryIds.filter(Boolean)))rows.사건_카테고리.push({사건ID:e.id,카테고리ID:id});
    for(const actor of e.actors||[]){
      const id=actor.id||actorNames.get(actor.name);
      if(id)rows.사건_주체.push({사건ID:e.id,주체ID:id,역할:actor.role});
    }
  }
  for(const r of relations)add('관계',r.id,{관계유형:r.kind,출발ID:r.fromId,도착ID:r.toId,출발명:r.fromName,도착명:r.toName,라벨:r.label,설명:r.body});
  const countries=new Map((leadership?.countries||[]).map(country=>[country.actor_id,country]));
  const jobs=new Set(),people=new Set(rows.주체.map(a=>a.id));
  for(const t of leadership?.tenures||[]){
    const personId=t.personId||actorNames.get(t.person)||'tenure-person:'+t.person;
    if(!people.has(personId)){
      add('주체',personId,{...leadership?.people?.get(personId),주체명:t.person,구분:'person'});people.add(personId);
    }
    if(!jobs.has(t.officeId)){
      add('직위',t.officeId,{직위명:t.title,국가ID:t.actorId,조직ID:t.organizationId});jobs.add(t.officeId);
    }
    add('재임',t.id,{주체ID:personId,직위ID:t.officeId,시작일:t.startDate,종료일:t.endDate});
  }
  return globalThis.createChronicleRecordViews(rows,{
    key:row=>row?.id||'',
    flagFor:(actor,date)=>countryFlag(countries.get(actor.id)||{actor_id:actor.id,iso3:actor.국가코드},date),
    placeSection:()=>'<div data-record-places></div>'
  });
}
