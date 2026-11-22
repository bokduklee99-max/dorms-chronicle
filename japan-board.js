'use strict';
(() => {
 const index=JSON.parse(document.getElementById('board-index').textContent);
 const stage=document.getElementById('stage');
 const dialog=document.getElementById('board-detail');
 const heading=document.getElementById('board-detail-title');
 const content=document.getElementById('board-detail-content');
 const feedback=document.getElementById('board-status');
 const relationButton=document.getElementById('view-relations');
 const filters=document.getElementById('board-filters');
 const leanButtons=document.getElementById('board-leans');
 const subjectPicker=document.getElementById('board-subject');
 const actorLabels={state:'국가',territory:'지역',organization:'단체',army:'무장조직',institution:'기관',person:'인물'};
 const eventLabels={period:'시기',policy:'정책',event:'사건',context:'배경',publication:'저술·선언'};
 const roleLabels={initiator:'주도',participant:'참여',related:'관련',affected:'영향을 받음',counterparty:'상대',mediator:'중재',leader:'지도',executor:'실행',author:'저술',founder:'창립'};
 const relationLabels={cause:'인과',succession:'계승',split:'분화',integration:'통합·편입',shift:'전환',action:'활동',background:'배경'};
 let events=new Map(), actors=new Map(), relations=new Map(), topics=new Map(), eventActors=[];
 let selection='';
 let openedBy=null;

 function element(tag,text,cls){
  const el=document.createElement(tag);
  if(text)el.textContent=text;
  if(cls)el.className=cls;
  return el;
 }
 function appendText(text,cls){if(text)content.append(element('p',text,cls));}
 function appendSource(url){
  if(!url)return;
  let parsed;
  try{parsed=new URL(url);}catch{return;}
  if(!['https:','http:'].includes(parsed.protocol))return;
  const link=element('a','자료 출처 ↗');
  link.href=parsed.href;link.target='_blank';link.rel='noreferrer';
  content.append(link);
 }
 function action(title,subtitle,visit){
  const button=element('button',null,'board-detail-action');
  button.type='button';
  button.append(element('strong',title));
  if(subtitle)button.append(element('span',subtitle));
  button.onclick=visit;
  return button;
 }
 function section(title,items){
  if(!items.length)return;
  const group=element('section',null,'board-detail-group');
  group.append(element('h3',title),...items);
  content.append(group);
 }
 function open(title){
  heading.textContent=title;
  content.replaceChildren();
  if(!dialog.open){openedBy=document.activeElement;dialog.showModal();}
  heading.focus({preventScroll:true});
 }
 dialog.addEventListener('close',()=>openedBy?.focus({preventScroll:true}));
 function relatedLinks(kind,id){
  return [...relations.values()].filter(row=>(row.fromType===kind&&row.from===id)||(row.toType===kind&&row.to===id))
   .map(row=>action(row.label||relationLabels[row.type],row.status==='draft'?'관계 초안':'',()=>showRelation(row)));
 }
 function showEvent(id){
  const event=events.get(id);
  if(!event)return;
  open(event.title);
  const period=event.date+(event.endDate?' ~ '+event.endDate:'')+(event.dateQualifier==='approximate'?' (추정)':'');
  appendText([eventLabels[event.eventType],period,
   ...event.directTopicIds.map(topicId=>topics.get(topicId)?.name),event.reviewStatus==='draft'?'초안':''].filter(Boolean).join(' · '),'board-detail-meta');
  appendText(event.description);
  appendText(event.originLabel,'board-detail-meta');
  appendSource(event.source);
  section('관련 주체',eventActors.filter(link=>link.event_id===id).map(link=>{
   const actor=actors.get(link.actor_id);
   return action(actor.name,roleLabels[link.actor_role||link.role],()=>showActor(actor.actor_id));
  }));
  section('역사 관계',relatedLinks('event',id));
 }
 function showActor(id){
  const actor=actors.get(id);
  if(!actor)return;
  open(actor.name);
  const period=actor.start_date?[actor.start_date,actor.end_date||(actor.end_status==='ongoing'?'존속 중':actor.end_status==='unknown'?'종료일 미상':'')].filter(Boolean).join(' ~ '):'';
  appendText([actorLabels[actor.actor_type],actor.lean,period].filter(Boolean).join(' · '),'board-detail-meta');
  appendText(actor.summary);
  appendText(actor.date_note);
  appendSource(actor.source_url);
  const related=new Map(eventActors.filter(link=>link.actor_id===id).map(link=>[link.event_id,link.actor_role||link.role]));
  section('관련 사건',[...events.values()].filter(event=>related.has(event.id))
   .map(event=>action(event.title,[event.date,roleLabels[related.get(event.id)]].filter(Boolean).join(' · '),()=>showEvent(event.id))));
  section('역사 관계',relatedLinks('actor',id));
 }
 function showCategory(id){
  const topic=topics.get(id);
  if(!topic)return;
  open(topic.name);
  section('관련 사건',[...events.values()].filter(event=>event.directTopicIds.includes(id))
   .map(event=>action(event.title,event.date,()=>showEvent(event.id))));
  section('역사 관계',relatedLinks('category',id));
 }
 function endpointLabel(kind,id){
  if(kind==='category')return topics.get(id)?.name||id;
  return kind==='actor'?actors.get(id)?.name||id:events.get(id)?.title||id;
 }
 function showRelation(row){
  open(row.label||relationLabels[row.type]);
  appendText([relationLabels[row.type],row.status==='draft'?'초안':'검토 완료'].join(' · '),'board-detail-meta');
  appendText(row.notes);
  appendSource(row.source);
  section('연결된 기록',[[row.fromType,row.from,'출발'],[row.toType,row.to,'도착']].map(([kind,id,direction])=>
   action(endpointLabel(kind,id),direction,()=>({actor:showActor,event:showEvent,category:showCategory}[kind])(id))));
 }
 function bind(el,canOpen,visit){
  if(!canOpen)return;
  el.dataset.opensBoardDetail='true';
  const activate=()=>{if(!document.body.classList.contains('student'))visit();};
  el.onclick=activate;
  el.onkeydown=e=>{
   if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}
  };
 }
 function refreshInteraction(){
  const teacher=!document.body.classList.contains('student');
  for(const el of stage.querySelectorAll('[data-opens-board-detail]')){
   el.tabIndex=teacher?0:-1;
   if(teacher){el.setAttribute('role','button');el.setAttribute('aria-haspopup','dialog');}
   else{el.removeAttribute('role');el.removeAttribute('aria-haspopup');}
  }
  relationButton.hidden=!teacher||!relations.size;
  filters.hidden=!teacher||!leanButtons.childElementCount;
  applyFilter(teacher?selection:'');
  if(!teacher&&dialog.open)dialog.close();
 }
 function applyFilter(active){
  const matches=new Set(SheetData.filterActorEvents([...events.values()],[...actors.values()],active).map(event=>event.id));
  for(const el of stage.querySelectorAll('[data-opens-board-detail][data-board-key]')){
   const key=el.dataset.boardKey, actorId=index.actors[key], actor=actors.get(actorId);
   const activeActor=actor&&(active===`actor:${actorId}`||active===`lean:${actor.lean?.trim()}`);
   const related=actor&&eventActors.some(link=>link.actor_id===actorId&&matches.has(link.event_id));
   el.classList.toggle('board-muted',Boolean(active&&!activeActor&&!related&&!(index.events[key]||[]).some(id=>matches.has(id))));
  }
 }
 function selectFilter(value){
  selection=value;
  subjectPicker.value=value.startsWith('actor:')?value:'';
  for(const button of filters.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.value===value));
  applyFilter(value);
 }
 function loadFilters(data){
  const {groups,leans}=SheetData.actorFilterOptions(data.events,data.actors);
  if(!groups.length)return;
  function addFilter(group,value,label){
   const button=element('button',label);
   button.type='button';button.value=value;button.onclick=()=>selectFilter(value);
   group.append(button);
  }
  addFilter(leanButtons,'','전체');
  for(const lean of leans)addFilter(leanButtons,`lean:${lean}`,lean);
  for(const [label,list] of groups){
   const group=element('optgroup');group.label=label;
   for(const actor of list)group.append(new Option(actor.name,`actor:${actor.actor_id}`));
   subjectPicker.append(group);
  }
  subjectPicker.onchange=()=>selectFilter(subjectPicker.value);
  selectFilter(selection);
 }
 function bindArrows(){
  for(const path of stage.querySelectorAll('[data-board-arrow]')){
   const relation=relations.get(index.arrows[path.dataset.boardArrow]);
   if(!relation)continue;
   path.setAttribute('aria-label',relation.label);
   bind(path,true,()=>showRelation(relation));
  }
  refreshInteraction();
 }
 document.addEventListener('board-arrows-ready',bindArrows);
 document.addEventListener('board-mode-change',refreshInteraction);
 relationButton.onclick=()=>{
  open('역사 관계');
  section('일제 강점기와 독립운동',[...relations.values()].map(row=>
   action(row.label||relationLabels[row.type],
    endpointLabel(row.fromType,row.from)+' → '+endpointLabel(row.toType,row.to),()=>showRelation(row))));
 };

 async function readCSV(url){
  const response=await fetch(url,{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('연표 시트를 읽지 못했습니다.');
  return SheetData.parseCSV(await response.text());
 }
 async function load(){
  const relationURL=new URL('https://docs.google.com/spreadsheets/d/'+SHEET_CONFIG.id+'/gviz/tq');
  relationURL.search=new URLSearchParams({gid:String(SHEET_CONFIG.relationSheetId),range:'A1:K1000',headers:'1',tqx:'out:csv'});
  const [feed,edges]=await Promise.allSettled([readCSV(SHEET_CONFIG.feedUrl),readCSV(relationURL)]);
  if(feed.status==='rejected')throw feed.reason;
  const tables=SheetData.scopePackage('japan',await SheetData.readPublishedTables(feed.value,SHEET_CONFIG));
  const data=SheetData.build(tables);
  events=new Map(data.events.map(row=>[row.id,row]));
  actors=new Map(data.actors.map(row=>[row.actor_id,row]));
  topics=new Map(data.topics.map(row=>[row.topic_id,row]));
  eventActors=tables.event_countries;
  for(const el of stage.querySelectorAll('[data-board-key]')){
   const key=el.dataset.boardKey, actor=actors.get(index.actors[key]);
   const ids=(index.events[key]||[]).filter(id=>events.has(id));
   if(actor){if(actor.lean)el.dataset.lean=actor.lean;bind(el,true,()=>showActor(actor.actor_id));}
   else bind(el,ids.length,()=>{
    if(ids.length===1){showEvent(ids[0]);return;}
    open(el.querySelector('.fill')?.textContent||el.textContent);
    section('관련 사건',ids.map(id=>action(events.get(id).title,events.get(id).date,()=>showEvent(id))));
   });
  }
  loadFilters(data);
  if(edges.status==='fulfilled'){
   try{
    relations=new Map(SheetData.readRelations(edges.value,'japan',data).map(row=>[row.id,row]));
   }catch{feedback.textContent='관계 자료를 읽지 못했습니다.';}
  }else feedback.textContent='관계 자료를 읽지 못했습니다.';
  bindArrows();
 }
 load().catch(()=>{feedback.textContent='시트 상세를 불러오지 못했습니다.';});
})();
