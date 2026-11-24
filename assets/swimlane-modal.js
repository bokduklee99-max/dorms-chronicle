import {readLessonSheet} from './local-sheet-copy.js';
import '../history.js';
import {countryFlag} from './country-flag.js';
import {eventPeriods} from '../swimlane-data.js';
export const labels={event:'사건',period:'시기',arc:'사건군',theme:'주제',actor:'주체',relation:'관계'};
export const relationNames={cause:'원인·계기',shift:'전환·변화',action:'활동·실행',succession:'계승',integration:'통합·편입',split:'분열·개편',background:'구조적 배경'};
export const eventTypes={event:'사건',policy:'정책·조치',publication:'선언·보고서',context:'배경·정세',period:'시기·국면'};
export const actorTypes={organization:'단체',institution:'기관',army:'군사 조직',person:'인물'};
export const roleNames={initiator:'주도',participant:'참여',related:'관련',affected:'영향을 받음',counterparty:'상대',mediator:'중재',leader:'지도',executor:'실행',author:'저술',founder:'창립'};

import {renderSpaceMap} from './space-preview-map.js';

export const relationRoles={
 cause:['원인·계기','그 결과'],
 shift:['변화의 계기','이어진 변화'],
 background:['역사적 배경','이 배경에서 전개된 일'],
 action:['활동 주체','활동·참여 대상'],
 integration:['통합·편입에 참여한 조직','통합·편입을 이룬 조직'],
 split:['개편 전 조직','개편 후 조직'],
 succession:['계승의 기반','계승 주체']
};
const rolesFor=rel=>relationRoles[rel.kind]??[labels[rel.fromType]||'관련 항목',labels[rel.toType]||'관련 항목'];
const make=(tag,cls='',text='')=>Object.assign(document.createElement(tag),{className:cls,textContent:text});
const title=r=>r.title||r.name||r.label||relationNames[r.kind]||'관계';
function dateMark(value){
 const exact=/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value);
 const decade=/^(\d{4})s$/.exec(value);
 const node=make(exact?'time':'span','date-mark');
 if(!exact&&!decade){node.textContent=value;return node;}
 if(exact)node.dateTime=value;
 const parts=exact?exact.slice(1):[decade[1]];
 const units=[decade?'년대':'년','월','일'];
 parts.forEach((part,i)=>{
  if(!part)return;
  if(i)node.append(' ');
  const pair=make('span','date-part',String(Number(part)));
  pair.append(make('span','date-unit',units[i]));node.append(pair);
 });
 return node;
}
function dateRange(record){
 const start=record.date||record.start,end=record.end;
 const range=make('span','date-range');
 if(start)range.append(dateMark(start));
 if(start&&end)range.append(make('span','date-dash',' – '));
 if(end)range.append(dateMark(end));
 return range;
}
const action=(text,click,cls='')=>{
 const b=make('button',cls,text);
 b.type='button'; b.onclick=click;
 return b;
};
function section(label,...nodes){
 const box=make('section','block');
 if(label)box.append(make('h3','',label));
 box.append(...nodes);return box;
}

let mapTables;
function readMapTables(){
 if(!mapTables)mapTables=loadMapTables().catch(()=>null);
 return mapTables;
}
async function loadMapTables(){
 const fields={공간:['공간ID','지도참조키'],지도도형:['지도참조키','도형유형'],사건_공간:['사건ID','공간ID'],
  카테고리_공간:['카테고리ID','공간ID'],주체_공간:['주체ID','공간ID']};
 try{
  const entries=await Promise.all(Object.entries(fields).map(async ([name,keys])=>
   [name,await SheetData.sheetRecords(SHEET_CONFIG,name,keys,readLessonSheet)]));
  return Object.fromEntries(entries);
 }catch{
  const response=await fetch('/assets/swimlane-gallery-maps.json');
  if(!response.ok)throw Error('장소 정보를 불러오지 못했습니다.');
  return response.json();
 }
}

let leadershipRequest;
function readLeadership(){
 if(!leadershipRequest)leadershipRequest=(async()=>{
  const response=await readLessonSheet(SHEET_CONFIG.feedUrl,{signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error();
  const tables=await SheetData.readPublishedTables(SheetData.parseCSV(await response.text()),SHEET_CONFIG,readLessonSheet);
  const data=SheetData.build(tables);
  return {countries:data.actors.filter(a=>a.actor_type==='state'),tenures:data.tenures};
 })().catch(()=>{leadershipRequest=null;return null;});
 return leadershipRequest;
}

function annualChart(members){
 const counts=new Map();
 for(const e of members){
  const match=/^(\d{4})(?:-|$)/.exec(e.date);
  if(match){const year=Number(match[1]);counts.set(year,(counts.get(year)||0)+1);}
 }
 if(!counts.size)return null;
 const first=Math.min(...counts.keys()),last=Math.max(...counts.keys()),peak=Math.max(...counts.values());
 const bars=make('div','annual-bars');
 const chart=section('연도별 사건 수',bars);
 for(let year=first;year<=last;year++){
  const n=counts.get(year)||0;
  const col=make('span','annual-col'),bar=make('i');
  col.title=year+'년 · '+n+'건';
  bar.style.height=(n/peak*100)+'%';col.append(bar);bars.append(col);
 }
 bars.setAttribute('role','img');bars.setAttribute('aria-label',Array.from(counts,([y,n])=>y+'년 '+n+'건').join(', '));
 const axis=make('div','annual-axis');axis.append(make('span','',first+'년'),make('span','','최다 '+peak+'건'));
 if(last!==first)axis.append(make('span','',last+'년'));chart.append(axis);return chart;
}

function imageSlot(record,media){
 const urls=(media||'').split(/\r?\n/).map(s=>s.trim()).filter(s=>/^https?:\/\//i.test(s));
 const slot=section('사건 이미지');
 if(!urls.length){
  slot.append(make('p','image-slot','이미지가 등록되면 이 자리에 표시됩니다.'));
 }else for(const [i,url] of urls.entries()){
  const figure=make('figure','event-picture'),img=make('img'),link=make('a','','원본 이미지 ↗');
  const info=record.images?.find(image=>image.url===url);
  img.alt=info?.title||record.title+' · 자료 이미지 '+(i+1);img.loading='lazy';img.src=SHEET_MEDIA[url]?'/'+SHEET_MEDIA[url]:url;
  img.addEventListener('error',()=>img.replaceWith(make('p','','이미지를 열 수 없습니다.')));
  Object.assign(link,{href:url,target:'_blank',rel:'noopener noreferrer'});
  figure.append(img);if(info?.caption)figure.append(make('figcaption','',info.caption));
  figure.append(link);slot.append(figure);
 }
 return slot;
}

/**
 * @param {{events: Array, categories: Array, actors: Array, detailActors?: Array, relations: Array, geography?: object, leadership?: object}} data
 * @param {Element|null} [frame]
 * @param {((id: string|null, host: HTMLElement|null) => void)|null} [onEventContext]
 * @param {HTMLElement|null} [panel] Inline host for a non-modal record reader.
 */
export function setupSwimlaneModal({events,categories,actors,detailActors=actors,relations,geography=null,leadership=null},frame=null,onEventContext=null,panel=null){
 const dialog=panel?null:(document.getElementById('reader')||document.createElement('dialog'));
 const surface=panel||dialog;
 const titleId=panel?panel.id+'-title':'reader-title';
 if(dialog){
  dialog.id='reader';dialog.setAttribute('aria-labelledby',titleId);
  if(!dialog.isConnected)document.body.append(dialog);
 }
 const trail=[];
 function positionModal(){
  if(!frame)return;
  const bounds=frame.getBoundingClientRect();
  const top=Math.max(0,-bounds.top);
  const bottom=Math.max(0,bounds.bottom-window.parent.innerHeight);
  const height=bounds.height-top-bottom;
  if(height<=28)return;
  dialog.style.setProperty('--modal-top',top+'px');
  dialog.style.setProperty('--modal-bottom',bottom+'px');
  dialog.style.setProperty('--modal-viewport',height+'px');
 }
 if(frame){
  const keepModalVisible=()=>{if(dialog.open)positionModal();};
  window.parent.addEventListener('scroll',keepModalVisible,{passive:true});
  window.parent.addEventListener('resize',keepModalVisible);
  window.addEventListener('pagehide',()=>{
   window.parent.removeEventListener('scroll',keepModalVisible);
   window.parent.removeEventListener('resize',keepModalVisible);
  },{once:true});
 }

 const records=new Map();
 for(const [items,kind] of [[events,'event'],[categories,'category'],[detailActors,'actor'],[relations,'relation']]){
  for(const r of items)records.set(r.id,{...r,view:kind==='category'?r.kind:kind});
 }
 records.set('all',{id:'all',title:'전체 관계',view:'all'});
 const categoryIds=new Map(categories.map(r=>[r.kind+'|'+r.name,r.id]));
 const actorIds=new Map(detailActors.map(r=>[r.title,r.id]));
 const label=kind=>labels[kind]||'전체 관계';
 const jump=(text,id)=>records.has(id)?action(text,()=>open(id),'jump'):make('span','',text);
 const byDate=[...events].sort((a,b)=>a.date.localeCompare(b.date));
 function place(record){
  const [table,key]=record.view==='event'?['사건_공간','사건ID']:record.view==='actor'?['주체_공간','주체ID']:['카테고리_공간','카테고리ID'];
  const panel=section('장소');
  if(record.place)panel.append(make('p','',record.place));
  else panel.hidden=true;
  const local=geography||frame?.hasAttribute('data-package-draft');
  if(local&&!record.spaceIds?.length)return panel;
  const source=local?Promise.resolve(geography||frame.draftGeography):readMapTables();
  void source.then(tables=>{
   if(!tables||!panel.isConnected)return;
   const spaces=new Map(tables.공간.map(r=>[r.공간ID,r]));
   const shapes=new Map(tables.지도도형.map(r=>[r.지도참조키,r]));
   const ids=local?record.spaceIds:tables[table].filter(row=>row[key]===record.id||(record.legacyId&&row[key]===record.legacyId)).map(row=>row.공간ID);
   const places=[...new Set(ids)].map(id=>spaces.get(id)).filter(Boolean);
   if(!places.length)return;
   panel.hidden=false;panel.replaceChildren(make('h3','','장소'));panel.classList.add('schema-map');
   const controls=make('div','map-choices'),host=make('div');
   controls.setAttribute('role','group');controls.setAttribute('aria-label','지도에 표시할 장소');
   const nearbyKeys=places.map(s=>s.지도참조키);
   function select(space){
    for(const b of controls.children)b.setAttribute('aria-pressed',String(b.dataset.id===space.공간ID));
    const canvas=make('div','space-map','지도 읽는 중…');host.replaceChildren(canvas);
    void renderSpaceMap(canvas,space,shapes.get(space.지도참조키),{date:record.date||record.start,nearbyKeys});
   }
   for(const space of places){
    const b=action(space.공간명,()=>select(space));b.dataset.id=space.공간ID;controls.append(b);
   }
   panel.append(controls,host);
   select(places.find(s=>s.공간유형==='point')||places[0]);
  });
  return panel;
 }
 function linked(r){
  const band=make('div','links-grid');
  let hasBackground=false;
  for(const incoming of [true,false]){
   const items=relations.filter(rel=>(incoming?rel.toId:rel.fromId)===r.id);
   if(!items.length)continue;
   const branch=make('div',incoming?'incoming':'outgoing');
   const lists=new Map();
   for(const rel of items){
    if(r.view==='event'&&rel.kind==='background')hasBackground=true;
    const role=rolesFor(rel)[incoming?0:1];
    if(!lists.has(role)){
     const list=make('ul','connection-list');
     lists.set(role,list);branch.append(section(role,list));
    }
    const row=make('li');
    const peer=incoming?rel.fromName:rel.toName;
    const button=action('',()=>open(rel.id),'connection');
    button.append(make('b','',peer),make('span','',rel.label||relationNames[rel.kind]));
    row.append(button);lists.get(role).append(row);
   }
   band.append(branch);
  }
  if(band.childElementCount===2||hasBackground){
   band.insertBefore(make('span','relation-pivot',title(r)),band.querySelector('.outgoing'));
  }else if(band.childElementCount===1){
   band.classList.add('role-groups');
   band.replaceChildren(...band.firstElementChild.children);
  }
  return band;
 }
 function eventList(items,roleFor){
  const list=make('ol','chronology');
  for(const e of items){
   const row=make('li');row.append(dateRange(e),jump(e.title,e.id));
   const role=roleFor?.(e);if(role)row.append(make('small','',role));list.append(row);
  }
  return list;
 }
 function limited(items,draw){
  const initialCount=16;
  const wrap=make('div');
  const redraw=expanded=>{
   wrap.replaceChildren(draw(expanded?items:items.slice(0,initialCount)));
   if(items.length>initialCount){
    const b=action(expanded?'목록 접기':'사건 '+(items.length-initialCount)+'건 더 보기',()=>{
     redraw(!expanded);wrap.lastElementChild.focus({preventScroll:true});
    },'more');
    b.setAttribute('aria-expanded',String(expanded));wrap.append(b);
   }
  };
  redraw(false);return wrap;
 }
 function sourceLink(label,url){
  const a=make('a','',label+' ↗');Object.assign(a,{href:url,target:'_blank',rel:'noopener'});return a;
 }
 function sheetLink(r){
  if(geography||frame?.hasAttribute('data-package-draft'))return null;
  const type=r.view;
  const gid=type==='event'?SHEET_CONFIG.eventSheetId:['relation','all'].includes(type)?SHEET_CONFIG.relationSheetId:
   type==='actor'?SHEET_CONFIG.sheetIds.주체:SHEET_CONFIG.categorySheetId;
  if(gid==null)return null;
  return sourceLink('원본 시트',SHEET_CONFIG.url.split('#')[0]+'#gid='+gid+(r.row?'&range=A'+r.row:''));
 }
 function sheet(r,inDialog){
  const page=make('article','record');
  page.dataset.kind=r.view;
  const head=make('header','record-head');
  const headText=make('div');
  const subtype=r.view==='actor'?actorTypes[r.kind]:r.view==='event'?eventTypes[r.type]:null;
  headText.append(make('p','kind-name',[label(r.view),subtype].filter((s,i)=>s&&(i===0||s!==label(r.view))).join(' · ')));
  const h=make('h2','',title(r));headText.append(h);
  head.append(headText);
  if(inDialog){
   h.id=titleId;h.tabIndex=-1;
   const tools=make('div','reader-tools');
   if(trail.length>1)tools.append(action('← 이전 항목',()=>{trail.pop();showCurrent();},'return'));
   const close=action('×',closeReader,'open');close.setAttribute('aria-label','닫기');tools.append(close);head.append(tools);
  }else{
   const expand=action('창으로 보기',()=>open(r.id),'open');expand.setAttribute('aria-label',title(r)+' 창으로 보기');head.append(expand);
  }
  page.append(head);
  const body=make('div','inside');page.append(body);
  const story=()=>make('p','prose',r.body||'');
  const columns=(a,b)=>{
   const pair=make('div','columns');pair.append(a,b);body.append(pair);
  };
  if(r.view==='event'){
   const main=section('사건 내용');if(r.body)main.append(story());
   if(r.originLabel)main.append(make('p','',r.originLabel));
   if(r.media||!inDialog)main.append(imageSlot(r,r.media));
   const facts=make('aside','factsheet');
   if(r.date||r.end)facts.append(section(r.date&&r.end?'기간':'날짜',dateRange(r)));
   facts.append(place(r));
   for(const [kind,items] of [['period',eventPeriods(r)],['arc',r.arcs],['theme',r.themes]]){
    if(!items?.length)continue;
    const chips=make('div','category-chips');
    chips.dataset.kind=kind;
    chips.append(...items.map(name=>jump(name,categoryIds.get(kind+'|'+name))));
    facts.append(section(label(kind),chips));
   }
   if(r.actors?.length){
    const participants=make('ul','participant-list');
    const bounds={start:SheetData.dateRange(r.date).start,end:SheetData.dateRange(r.end||r.date).end};
    for(const actor of r.actors){
     const id=actor.id||actorIds.get(actor.name);
     const item=make('li','participant');
     const header=make('div','participant-head');
     const name=jump(actor.name,id);
     header.append(name);
     if(actor.role)header.append(make('span','participant-role',roleNames[actor.role]||actor.role));
     item.append(header);participants.append(item);
     const kind=records.get(id)?.kind;
     if(kind&&kind!=='state')continue;
     function showLeaders(context){
      if(!context){
       if(kind==='state')item.append(make('p','participant-note','재임 기록을 불러오지 못했습니다.'));
       return;
      }
      const country=context.countries.find(a=>id?a.actor_id===id:a.name===actor.name);
      if(!country)return;
      const flag=countryFlag(country,r.date);
      if(flag?.src)name.prepend(Object.assign(document.createElement('img'),{src:flag.src,alt:''}));
      else if(flag?.symbol){const symbol=make('span','',flag.symbol);symbol.setAttribute('aria-hidden','true');name.prepend(symbol);}
      const tenures=HistoryViews.leadersDuring(context.tenures,country.actor_id,bounds);
      if(!tenures.length){item.append(make('p','participant-note','해당 시기 재임 기록 없음'));return;}
      const list=make('ul','participant-tenures');
      for(const tenure of tenures){
       const row=make('li');
       row.append(make('strong','',tenure.person),make('span','',tenure.title));
       const uncertain=(tenure.start.start!==tenure.start.end&&tenure.start.end>bounds.start)||
        (tenure.end&&tenure.end.start!==tenure.end.end&&tenure.end.start<bounds.end);
       const period=make('small');
       period.append(make('time','',tenure.startDate),' – ',tenure.endDate?make('time','',tenure.endDate):'재임 중');
       if(uncertain)period.append(' · 교체 시점 불확실');
       row.append(period);
       if(tenure.source)row.append(sourceLink('재임 출처',tenure.source));
       list.append(row);
      }
      item.append(list);
     }
     if(leadership)showLeaders(leadership);
     else readLeadership().then(showLeaders);
    }
    main.append(section('참여 주체',participants));
   }
   columns(main,facts);
  }else if(r.view==='relation'){
   const route=make('div','route-line');
   for(const side of ['from','to']){
    if(side==='to')route.append(make('span','direction',(relationNames[r.kind]||'관계')+' →'));
    const endpoint=records.get(r[side+'Id']);
    const end=section(rolesFor(r)[side==='from'?0:1],jump(r[side+'Name'],r[side+'Id']));
    if(endpoint){
     const meta=make('small','endpoint-date',label(endpoint.view));
     if(endpoint.date||endpoint.start||endpoint.end)meta.append(' · ',dateRange(endpoint));
     end.append(meta);
    }
    route.append(end);
   }
   body.append(route);if(r.body)body.append(section('연결 근거',story()));
  }else if(r.view==='all'){
   const groups=new Map();
   for(const rel of relations){
    if(!groups.has(rel.kind))groups.set(rel.kind,[]);
    groups.get(rel.kind).push(rel);
   }
   const tables=make('div','relation-tables');
   for(const [kind,group] of groups){
    const table=make('table','matrix'),headers=table.createTHead().insertRow();
    const [first,last]=rolesFor(group[0]);
    for(const name of [first,'관계 설명',last])headers.append(make('th','',name));
    const tbody=table.createTBody();
    for(const rel of group){
     const row=tbody.insertRow();row.insertCell().append(jump(rel.fromName,rel.fromId));
     row.insertCell().append(jump(title(rel),rel.id));row.insertCell().append(jump(rel.toName,rel.toId));
    }
    tables.append(section(relationNames[kind]||kind,table));
   }
   body.append(section('관계 '+relations.length+'건',tables));
  }else{
   const members=byDate.filter(e=>r.view==='actor'?e.actors.some(a=>a.name===r.title):
    (r.view==='period'?eventPeriods(e):r.view==='arc'?e.arcs:e.themes).includes(r.name));
   const profile=make('div','profile');
   if(r.body)profile.append(story());
   profile.append(place(r));
   const chart=annualChart(members);if(chart)profile.append(chart);
   if(r.view==='period'){
    const interval=make('div','interval');
    if(r.start)interval.append(section('시작',dateMark(r.start)));
    if(r.start&&r.end)interval.append(make('span','rule'));
    if(r.end)interval.append(section('종료',dateMark(r.end)));
    body.append(interval,profile,section('이 시기의 사건 '+members.length+'건',limited(members,eventList)));
   }else if(r.view==='theme'){
    body.append(profile);
    const groups=new Map();
    for(const e of members){const periods=eventPeriods(e);for(const period of periods.length?periods:['시기 미기재']){
     if(!groups.has(period))groups.set(period,[]);groups.get(period).push(e);
    }}
    const grid=make('div','theme-groups');
    for(const [name,items] of groups)grid.append(section(name,limited(items,eventList)));
    body.append(section('시기별 관련 사건',grid));
   }else{
    // A subject's profile stays alongside its activities; an event series leads with the chronology.
    const list=section((r.view==='actor'?'참여 사건 ':'사건 순서 ')+members.length+'건',
     limited(members,items=>eventList(items,r.view==='actor'?e=>e.actors.filter(a=>a.name===r.title).map(a=>roleNames[a.role]||a.role).join(' · '):null)));
    if(r.start||r.end)profile.prepend(section(r.view==='actor'?'활동 기간':'사건군 기간',dateRange(r)));
    if(r.view==='actor')columns(profile,list);else columns(list,profile);
   }
   if(r.view==='theme'&&(r.start||r.end))headText.append(dateRange(r));
  }
  const links=linked(r);if(links.childElementCount)body.append(links);
  const foot=make('footer','record-foot');
  if(r.status)foot.append(make('span','',r.status==='verified'?'검토 완료':r.status==='draft'?'초안':r.status));
  if(/^https?:\/\//i.test(r.source||''))foot.append(sourceLink('자료 출처',r.source));
  const source=sheetLink(r);if(source)foot.append(source);
  if(foot.childElementCount)page.append(foot);
  return page;
 }
 function showCurrent(){
  const record=records.get(trail.at(-1));
  surface.replaceChildren(sheet(record,true));surface.scrollTop=0;
  if(onEventContext){
   const host=record.view==='event'?make('div','lesson-event-context'):null;
   if(host)surface.querySelector('.inside').append(host);
   onEventContext(record.id,host);
  }
  surface.querySelector('h2').focus({preventScroll:true});
 }
 function open(id){
  if(dialog&&!dialog.open)trail.length=0;
  if(!records.has(id))return;
  trail.push(id);positionModal();showCurrent();
  if(dialog&&!dialog.open){dialog.showModal();dialog.querySelector('h2').focus({preventScroll:true});}
 }
 function closeReader(){
  if(dialog){dialog.close();return;}
  trail.length=0;
  panel.replaceChildren();
  onEventContext?.(null,null);
 }
 if(dialog){
  dialog.onclose=()=>{onEventContext?.(null,null);};
  dialog.onclick=e=>{if(e.target===dialog)dialog.close();};
 }
 return {close:closeReader,open:(kind,record)=>open(kind==='all'?'all':record.id),preview:id=>records.has(id)?sheet(records.get(id),false):null};
}
