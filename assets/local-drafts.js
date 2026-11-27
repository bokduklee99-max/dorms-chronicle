// 이 브라우저에 저장된 개인 초안을 연표 화면이 읽는 시트 CSV에 끼워 넣는다.
// 시트 원본은 바꾸지 않는다. 화면에서 읽은 CSV 사본에 초안 행을 덧붙일 뿐이다.
// 초안 하나가 잘못돼도 다른 패키지가 깨지지 않도록, 연표가 거부하는 값은 미리 걸러 낸다.
import {readPersonalDrafts} from './studio-library.js';

export const draftLabel=' (내 초안)';
const categoryKinds=['period','arc','theme'];
const actorRoles=['initiator','counterparty','participant','mediator','affected','related','leader','executor','author','founder'];
const relationKinds=['cause','succession','split','integration','shift','action','background'];
const text=value=>String(value??'');
const line=cells=>cells.map(value=>'"'+text(value).replaceAll('"','""')+'"').join(',');

export function parseCsv(input){
 const rows=[];let row=[],cell='',quoted=false;
 const source=text(input).replace(/^﻿/,'');
 for(let i=0;i<source.length;i++){
  const ch=source[i];
  if(quoted){
   if(ch==='"'&&source[i+1]==='"'){cell+='"';i++;}
   else if(ch==='"')quoted=false;
   else cell+=ch;
  }else if(ch==='"')quoted=true;
  else if(ch===','){row.push(cell);cell='';}
  else if(ch==='\n'||ch==='\r'){
   if(ch==='\r'&&source[i+1]==='\n')i++;
   row.push(cell);rows.push(row);row=[];cell='';
  }else cell+=ch;
 }
 if(cell!==''||row.length){row.push(cell);rows.push(row);}
 return rows;
}

function dateKey(value,end){
 const m=/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(text(value));
 if(!m||Number(m[1])<1)return null;
 const year=Number(m[1]),month=Number(m[2]||(end?12:1));
 const leap=year%4===0&&(year%100!==0||year%400===0);
 const last=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31][month-1];
 const day=Number(m[3]||(end?last:1));
 if(month<1||month>12||day<1||day>last)return null;
 return [m[1],String(month).padStart(2,'0'),String(day).padStart(2,'0')].join('-');
}
const validDate=value=>dateKey(value,false)!==null;
const rangeOk=(start,end)=>!end||(validDate(end)&&dateKey(start,false)<=dateKey(end,true));
const httpUrl=value=>{try{return ['http:','https:'].includes(new URL(text(value)).protocol)?text(value):'';}catch{return '';}};

/** 개인 초안 하나를 시트 탭별 행(열 이름→값)으로 바꾼다. 연표가 받아들이지 못할 행은 뺀다. */
export function draftTabs(draft){
 const id=text(draft.id),queue=draft.queue||[];
 const localActors=new Set(queue.filter(r=>r.kind==='actor').map(r=>r.id));
 const localPlaces=new Set(queue.filter(r=>r.kind==='place').map(r=>r.id));
 const actorNames=new Map((draft.actors||[]).map(a=>[a.id,a.title]));
 const seen=new Set();
 const events=(draft.events||[]).filter(e=>{
  if(!e.id||seen.has(e.id)||!text(e.title).trim()||!validDate(e.date)||!rangeOk(e.date,e.end))return false;
  seen.add(e.id);return true;
 });
 const eventIds=new Set(events.map(e=>e.id));
 const categories=[],categoryIds=new Set();
 for(const c of draft.categories||[]){
  if(!c.id||categoryIds.has(c.id)||!text(c.name).trim()||!categoryKinds.includes(c.kind))continue;
  categoryIds.add(c.id);
  categories.push({...c,start:validDate(c.start)?c.start:'',end:validDate(c.end)?c.end:''});
 }
 const members=categories.map(c=>({...c,members:(c.members||[]).filter(m=>eventIds.has(m))}));
 const participants=events.flatMap(e=>(e.participants||[]).filter(a=>a.id&&!localActors.has(a.id)).map(a=>({event:e.id,actor:a.id,role:actorRoles.includes(a.role)?a.role:'related'})));
 const places=events.flatMap(e=>(e.spaceIds||[]).filter(p=>!localPlaces.has(p)).map(p=>({event:e.id,place:p})));
 const nodes=new Map([...events.map(e=>[e.id,'event']),...members.map(c=>[c.id,'category'])]);
 const relations=(draft.relations||[]).filter(r=>r.id&&relationKinds.includes(r.kind)&&r.fromId!==r.toId&&
  nodes.get(r.fromId)===r.fromType&&nodes.get(r.toId)===r.toType);
 const tabs={
  패키지:[{패키지ID:id,패키지명:text(draft.name).trim()+draftLabel,학교급:draft.school,과목:draft.subject,설명:draft.description}],
  사건:events.map(e=>({사건ID:e.id,날짜:e.date,종료일:e.end,사건명:e.title,사건유형:e.type,내용:e.body,이미지:e.media,중요도:e.importance,출처:e.source})),
  카테고리:members.map(c=>({카테고리ID:c.id,패키지ID:id,카테고리명:c.name,카테고리유형:c.kind,시작일:c.start,종료일:c.end,설명:c.body})),
  사건_패키지:events.map(e=>({사건ID:e.id,패키지ID:id})),
  사건_카테고리:members.flatMap(c=>c.members.map(m=>({사건ID:m,카테고리ID:c.id}))),
  사건_주체:participants.map(p=>({사건ID:p.event,주체ID:p.actor,역할:p.role})),
  사건_공간:places.map(p=>({사건ID:p.event,공간ID:p.place})),
  카테고리_공간:members.flatMap(c=>(c.spaceIds||[]).filter(p=>!localPlaces.has(p)).map(p=>({카테고리ID:c.id,공간ID:p}))),
  관계:relations.map(r=>({관계ID:r.id,패키지ID:id,출발유형:r.fromType,출발ID:r.fromId,도착유형:r.toType,도착ID:r.toId,관계유형:r.kind,라벨:r.label,설명:r.body,출처:httpUrl(r.source),검토상태:'draft'}))
 };
 // 화면 목록에 쓰는 보조 정보(피드용)
 const byEvent=new Map(events.map(e=>[e.id,{actors:[],categories:[]}]));
 for(const p of participants)byEvent.get(p.event).actors.push(actorNames.get(p.actor)||'');
 for(const c of members)for(const m of c.members)byEvent.get(m).categories.push(c.name);
 return {tabs,events,categories:members,participants,byEvent,id};
}

/** 시트 탭 CSV의 머리글 순서에 맞춰 초안 행을 덧붙인다. */
export function mergeTabCsv(csv,rows){
 if(!rows.length)return csv;
 const header=parseCsv(csv.split(/\r?\n/,1)[0])[0]||[];
 if(!header.some(Boolean))return csv;
 const added=rows.map(row=>line(header.map(name=>name?text(row[name]):'')));
 return csv.replace(/[\r\n]+$/,'')+'\n'+added.join('\n')+'\n';
}

/** 웹 게시용 피드(첫 칸이 표 이름인 CSV)에 초안 행을 덧붙인다. */
export function mergeFeedCsv(csv,built){
 const rows=parseCsv(csv),headers={},countryIds=new Set();
 for(const row of rows)if(row[0]&&!headers[row[0]])headers[row[0]]=row.slice(1).filter(Boolean);
 const actorColumn=headers.countries?.indexOf('actor_id')??-1;
 if(actorColumn>=0)for(const row of rows)if(row[0]==='countries'&&row!==rows.find(r=>r[0]==='countries'))countryIds.add(row[1+actorColumn]);
 const out=[],push=(table,values)=>{
  if(headers[table])out.push(line([table,...headers[table].map(key=>text(values[key]))]));
 };
 for(const b of built){
  for(const e of b.events){
   const info=b.byEvent.get(e.id);
   push('events',{event_id:e.id,title:e.title,start_date:e.date,end_date:e.end,summary:e.body,images:e.media,event_type:e.type,importance:e.importance,
    country_names:info.actors.filter(Boolean).join(', '),category_names:info.categories.join(', ')});
  }
  for(const c of b.categories)push('categories',{topic_id:c.id,name:c.name,package_id:b.id});
  for(const p of b.participants)if(countryIds.has(p.actor))push('event_countries',{event_id:p.event,actor_id:p.actor,role:p.role,actor_role:p.role});
 }
 return out.length?csv.replace(/[\r\n]+$/,'')+'\n'+out.join('\n')+'\n':csv;
}

/** 요청 주소가 어느 시트 탭(또는 게시 피드)인지 알아낸다. */
export function tabOf(input,config){
 let url;
 try{url=new URL(input instanceof Request?input.url:String(input));}catch{return '';}
 if(url.hostname!=='docs.google.com')return '';
 const gid=url.searchParams.get('gid');
 if(url.pathname.startsWith('/spreadsheets/d/e/')){
  const feed=new URL(config.feedUrl);
  return gid&&gid===feed.searchParams.get('gid')&&url.pathname===feed.pathname?'feed':'';
 }
 if(!url.pathname.startsWith('/spreadsheets/d/'+config.id+'/'))return '';
 const ids=config.sheetIds||{};
 if(gid){
  const hit=Object.entries(ids).find(([,value])=>String(value)===gid);
  if(hit)return hit[0];
 }
 return url.searchParams.get('sheet')||'';
}

const mergedTabs=new Set(['패키지','사건','카테고리','사건_패키지','사건_카테고리','사건_주체','사건_공간','카테고리_공간','관계']);

export function loadDrafts(storage){
 try{
  return [...readPersonalDrafts(storage).values()].map(draftTabs).filter(b=>b.events.length);
 }catch{return [];}
}
// sheet-config.js는 const로 선언돼 globalThis의 속성이 아니므로 이름으로 직접 읽는다.
const sheetConfig=()=>typeof SHEET_CONFIG==='undefined'?undefined:SHEET_CONFIG;
const disabled=()=>{try{return new URLSearchParams(globalThis.location?.search).get('drafts')==='off';}catch{return false;}};

/** 시트 응답에 개인 초안을 더한 응답을 돌려준다. 해당 없거나 실패하면 원래 응답을 그대로 돌려준다. */
export async function withLocalDrafts(input,response,{config=sheetConfig(),storage=globalThis.localStorage}={}){
 try{
  if(!response?.ok||!config||disabled())return response;
  const tab=tabOf(input,config);
  if(tab!=='feed'&&!mergedTabs.has(tab))return response;
  const built=loadDrafts(storage);
  if(!built.length)return response;
  const csv=await response.clone().text();
  const merged=tab==='feed'?mergeFeedCsv(csv,built):mergeTabCsv(csv,built.flatMap(b=>b.tabs[tab]));
  return new Response(merged,{status:200,headers:{'content-type':'text/csv; charset=utf-8'}});
 }catch{return response;}
}
