import {readLessonSheet} from './local-sheet-copy.js';
import '../history.js';
import {lessonRecordViews} from './lesson-record-views.js';
import {lessonAtlas,renderShapePreview} from './record-atlas.js';
import './record-back-shortcut.js';
export const labels={event:'사건',period:'시기',arc:'사건군',theme:'주제',actor:'주체',relation:'관계'};
export const relationNames={cause:'원인·계기',shift:'전환·변화',action:'활동·실행',succession:'계승',integration:'통합·편입',split:'분열·개편',background:'구조적 배경'};
export const eventTypes={event:'사건',policy:'정책·조치',publication:'선언·보고서',context:'배경·정세',period:'시기·국면'};
export const actorTypes={organization:'단체',institution:'기관',army:'군사 조직',person:'인물'};
export const roleNames={initiator:'주도',participant:'참여',related:'관련',affected:'영향을 받음',counterparty:'상대',mediator:'중재',leader:'지도',executor:'실행',author:'저술',founder:'창립'};



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
  const read=(tab,fields)=>SheetData.sheetRecords(SHEET_CONFIG,tab,fields,readLessonSheet);
  const [actors,jobs,terms]=await Promise.all([read('주체',['주체ID','주체명']),read('직위',['직위ID','직위명']),read('재임',['주체ID','직위ID','시작일'])]);
  const people=new Map(actors.map(a=>[a.주체ID,a])),offices=new Map(jobs.map(j=>[j.직위ID,j]));
  const tenures=terms.flatMap(t=>{
   const job=offices.get(t.직위ID),person=people.get(t.주체ID);
   if(!job||!person||!t.시작일)return [];
   return [{id:t.재임ID,actorId:job.국가ID,organizationId:job.조직ID,officeId:t.직위ID,title:job.직위명,
    person:person.주체명,personId:t.주체ID,startDate:t.시작일,endDate:t.종료일}];
  });
  return {countries:actors.filter(a=>['state','territory'].includes(a.구분)).map(a=>({actor_id:a.주체ID,iso3:a.국가코드})),people,tenures};
 })().catch(()=>{leadershipRequest=null;return null;});
 return leadershipRequest;
}

export function getSwimlaneEmbed(frame){
 const showroom=frame.closest('main[data-showroom]');
 const outerFrame=showroom?window.parent.frameElement:null;
 const scrollWindow=outerFrame?.ownerDocument.defaultView??window.parent;
 function bounds(){
  const rect=frame.getBoundingClientRect();
  const offset=outerFrame?outerFrame.getBoundingClientRect().top+outerFrame.clientTop:0;
  return {top:rect.top+offset,bottom:rect.bottom+offset,height:rect.height};
 }
 return {showroom,outerFrame,scrollWindow,bounds};
}

/**
 * @param {{events: Array, categories: Array, actors: Array, detailActors?: Array, relations: Array, geography?: object, leadership?: object, name?: string, packageId?: string}} data
 * @param {Element|null} [frame]
 * @param {((id: string|null, host: HTMLElement|null) => void)|null} [onEventContext]
 * @param {HTMLElement|null} [panel] Inline host for a non-modal record reader.
 */
export function setupSwimlaneModal(data,frame=null,onEventContext=null,panel=null){
 const {events,categories,actors,detailActors=actors,relations,geography=null}=data;
 let leadership=data.leadership;
 const modelForLesson=()=>lessonRecordViews({...data,detailActors,leadership});
 let model=modelForLesson();
 const dialog=panel?null:(document.getElementById('reader')||document.createElement('dialog'));
 const surface=panel||dialog;
 const titleId=panel?panel.id+'-title':'reader-title';
 if(dialog){
  dialog.id='reader';dialog.setAttribute('aria-labelledby',titleId);
  if(!dialog.isConnected)document.body.append(dialog);
 }
 const trail=[];
 const embed=frame&&getSwimlaneEmbed(frame);
 let viewportListeners;
 function positionModal(){
  if(!embed)return;
  const bounds=embed.bounds();
  const top=Math.max(0,-bounds.top);
  const bottom=Math.max(0,bounds.bottom-embed.scrollWindow.innerHeight);
  const height=bounds.height-top-bottom;
  if(height<=28)return;
  dialog.style.setProperty('--modal-top',top+'px');
  dialog.style.setProperty('--modal-bottom',bottom+'px');
  dialog.style.setProperty('--modal-viewport',height+'px');
 }
 function trackViewport(){
  if(!embed)return;
  viewportListeners?.abort();
  const listeners=new AbortController();
  viewportListeners=listeners;
  const {signal}=listeners;
  embed.scrollWindow.addEventListener('scroll',positionModal,{passive:true,signal});
  embed.scrollWindow.addEventListener('resize',positionModal,{signal});
  window.addEventListener('resize',positionModal,{signal});
  window.addEventListener('pagehide',()=>listeners.abort(),{once:true,signal});
 }

 const records=new Map();
 for(const [items,kind] of [[events,'event'],[categories,'category'],[detailActors,'actor'],[relations,'relation']]){
  for(const r of items)records.set(r.id,{...r,view:kind==='category'?r.kind:kind});
 }
 records.set('all',{id:'all',title:'전체 관계',view:'all'});
 const label=kind=>labels[kind]||'전체 관계';
 const jump=(text,id)=>records.has(id)?action(text,()=>open(id),'jump'):make('span','',text);
 async function fillPlaces(host,record){
  if(record.place)host.append(section('장소',make('p','prose',record.place)));
  const local=geography||frame?.hasAttribute('data-package-draft');
  if(local&&!record.spaceIds?.length)return;
  const tables=await (local?(geography||frame.draftGeography):readMapTables());
  if(!tables||!host.isConnected)return;
  const tab=record.view==='event'?'사건':record.view==='actor'?'주체':'카테고리';
  const ids=local?record.spaceIds:(tables[tab+'_공간']||[]).filter(row=>[record.id,record.legacyId,record.sourceId].filter(Boolean).includes(row[tab+'ID'])).map(row=>row.공간ID);
  const spaces=[...new Set(ids)].map(id=>tables.공간.find(space=>space.공간ID===id)).filter(Boolean);
  if(!spaces.length)return;
  const list=make('ol','place-key');
  for(const [index,space] of spaces.entries()){
   const item=make('li'),text=make('div'),ref=space.지도참조키;
   const shape=tables.지도도형.find(s=>s.지도참조키===ref);
   const mapId='shape/'+space.공간ID;
   if(shape)records.set(mapId,{id:mapId,view:'shape',title:space.공간명,tables,ref});
   text.append(shape?jump(space.공간명,mapId):make('strong','',space.공간명));
   const intro=model.placeIntroduction(space);if(intro)text.append(make('p','prose',intro));
   item.append(make('span','place-index',String(index+1)),text);list.append(item);
  }
  const canvas=make('div');
  host.replaceChildren(section('장소',canvas,list));
  const atlas=await lessonAtlas(spaces,tables);
  if(!host.isConnected)return;
  canvas.innerHTML=atlas.html;
  const figure=canvas.querySelector('.places-atlas');if(figure)atlas.maps.bind(figure);
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
 function backButton(className){
  const button=action('← 이전 항목',goBack,className);
  button.setAttribute('aria-keyshortcuts',recordBackShortcut.keys);
  button.title=recordBackShortcut.hint;
  return button;
 }
 function readingSheet(r,inDialog){
  const layouts={event:'photo',period:'period-spread',arc:'sequence-spread',theme:'theme-spread',actor:'profile',all:'ledger',shape:'atlas'};
  const page=make('div','record-presentation live-reader'),article=make('article','surface '+layouts[r.view]);
  page.dataset.kind=r.view;
  const tools=make('div','record-controls');
  if(inDialog){
   if(trail.length>1)tools.append(backButton('record-back'));
   const close=action('×',closeReader,'record-close');close.setAttribute('aria-label','닫기');tools.append(close);
  }else tools.append(action('창으로 보기',()=>open(r.id),'record-back'));
  page.append(tools,article);
  if(r.view==='shape'){
   const status=make('h2','record-title',r.title);status.id=titleId;status.tabIndex=-1;article.append(status);
   void renderShapePreview(article,r.ref,r.tables).then(()=>{
    const h=article.querySelector('h2');if(h)h.id=titleId;
   }).catch(()=>article.append(make('p','prose','지도를 불러오지 못했습니다.')));
   return page;
  }
  if(r.view==='all'){
   article.innerHTML='<header class="index-heading">'+model.title('전체 관계')+'</header>';
   for(const kind of new Set(relations.map(r=>r.kind))){
    article.insertAdjacentHTML('beforeend',model.box(model.label(kind),model.relationList(model.rows.관계.filter(row=>row.관계유형===kind))));
   }
  }else{
   const row=model.find(r.id);
   article.innerHTML=r.view==='event'?model.eventView(row):model.categoryView(row);
   const places=article.querySelector('[data-record-places]');
   if(places)void fillPlaces(places,r).catch(()=>places.prepend(make('p','prose','지도를 불러오지 못했습니다.')));
   if(r.view==='event'&&!leadership&&r.actors?.length){
    void readLeadership().then(value=>{
     if(!value||!page.isConnected)return;
     leadership=value;model=modelForLesson();
     const list=article.querySelector('.participant-list');
     if(list)list.closest('section').outerHTML=model.participantSection(model.find(r.id));
    });
   }
  }
  article.addEventListener('click',e=>{
   const target=e.target.closest('[data-act^="go:"]');
   if(!target)return;
   const route=target.dataset.act, id=decodeURIComponent(route.slice(route.indexOf('/')+1));
   if(!records.has(id)){
    const person=model.get('주체',id);
    if(person)records.set(id,{id,view:'actor',title:person.주체명,kind:person.구분});
   }
   open(id);
  });
  const h=article.querySelector('h2');if(inDialog)h.id=titleId;else h.removeAttribute('id');
  return page;
 }
 function sheet(r,inDialog){
  if(r.view!=='relation')return readingSheet(r,inDialog);
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
   if(trail.length>1)tools.append(backButton('return'));
   const close=action('×',closeReader,'open');close.setAttribute('aria-label','닫기');tools.append(close);head.append(tools);
  }else{
   const expand=action('창으로 보기',()=>open(r.id),'open');expand.setAttribute('aria-label',title(r)+' 창으로 보기');head.append(expand);
  }
  page.append(head);
  const body=make('div','inside');page.append(body);
  const story=()=>make('p','prose',r.body||'');
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
  onEventContext?.(record.id,null);
  requestAnimationFrame(()=>{for(const list of surface.querySelectorAll('.scroll-list')){
   const current=list.querySelector('[aria-current=step]')?.closest('li');
   if(current)list.scrollTop+=current.getBoundingClientRect().top-list.getBoundingClientRect().top-(list.clientHeight-current.offsetHeight)/2;
  }});
  surface.querySelector('h2').focus({preventScroll:true});
 }
 function open(id){
  if(dialog&&!dialog.open)trail.length=0;
  if(!records.has(id))return;
  trail.push(id);positionModal();showCurrent();
  if(dialog&&!dialog.open){
   dialog.showModal();trackViewport();dialog.querySelector('h2').focus({preventScroll:true});
  }
 }
 function goBack(){
  if(trail.length<=1){closeReader();return;}
  trail.pop();
  showCurrent();
 }
 function closeReader(){
  if(dialog){dialog.close();return;}
  trail.length=0;
  panel.replaceChildren();
  onEventContext?.(null,null);
 }
 surface.onkeydown=event=>{
  if(dialog?dialog.open:trail.length>1)recordBackShortcut.handle(event,goBack);
 };
 if(dialog){
  dialog.onclose=()=>{viewportListeners?.abort();onEventContext?.(null,null);};
  dialog.onclick=e=>{if(e.target===dialog)dialog.close();};
 }
 return {close:closeReader,open:(kind,record)=>open(kind==='all'?'all':record.id),preview:id=>records.has(id)?sheet(records.get(id),false):null};
}
