import type {EventRecord} from './metro-model';
import {useEffect,useMemo,useRef,useState} from 'react';
import {useSheetHistory} from './use-sheet-history';
import {CategoryEventMap} from './CategoryEventMap';
import {EventImportanceGroups} from './EventImportanceGroups';
import {readEventImportance,swimlaneSnapshot,type ImportanceRow} from './event-importance';
import {matchSwimlaneEvents} from '../swimlane-data.js';
import {CategoryMap,EventMap,useLessonMaps} from './LessonMap';
import {createLesson,exploreHref,packageTopics,setupHref,views,workspaceDraft,type View} from './workspace-model';
import './workspace.css';
import '../assets/event-importance.css';
import './lesson-wizard.css';

const steps=[['package','패키지'],['categories','카테고리'],['events','사건'],['settings','수업 설정']] as const;
const categoryTypes=[['period','시기'],['arc','사건군'],['theme','주제'],['','기타']] as const;
const toggle=(ids:string[],id:string)=>ids.includes(id)?ids.filter(x=>x!==id):[...ids,id];
const requestedStep=()=>Math.max(0,steps.findIndex(([key])=>location.hash==='#'+key));
type Choices={packageId:string;categories:string[];events:string[];school:string;view:View};
type CategoryType=(typeof categoryTypes)[number][0];
type EventFilter={categoryId:string}|{categoryType:CategoryType}|null;

const unassigned=':unassigned';
const matchesTopic=(event:EventRecord,id:string)=>id===unassigned?!event.directTopicIds.length:event.directTopicIds.includes(id);

export function LessonWizard(){
 const {packages,packageData,categoryMetadata,pending}=useSheetHistory();
 const maps=useLessonMaps();
 const [choice,setChoice]=useState<Choices>(()=>{
  const saved:Choices|undefined=history.state?.lessonChoices;
  const view=workspaceDraft('','',saved?.view??new URLSearchParams(location.search).get('view')).view;
  return {...(saved??{packageId:new URLSearchParams(location.search).get('package')??'',categories:[],events:[],school:''}),view};
 });
 const [requested,setRequested]=useState(requestedStep);
 const [activeTopic,setActiveTopic]=useState('');
 const [eventFilter,setEventFilter]=useState<EventFilter>(null);
 const [previewEvent,setPreviewEvent]=useState('');
 const [query,setQuery]=useState('');
 const [error,setError]=useState('');
 const [importance,setImportance]=useState<{packageId:string;rows:ImportanceRow[]} | null>(null);
 const [savedCategoryTypes,setSavedCategoryTypes]=useState<{packageId:string;types:Map<string,string>} | null>(null);
 const heading=useRef<HTMLHeadingElement>(null);
 const mapPanel=useRef<HTMLElement>(null);
 const pkg=packages.find(x=>x.id===choice.packageId);
 const data=packageData(choice.packageId);
 const matchImportance=useMemo(()=>matchSwimlaneEvents(data.events,importance?.packageId===choice.packageId?importance.rows:[]),
  [data.events,importance,choice.packageId]);

 const topics=packageTopics(data);
 if(data.events.some(e=>!e.directTopicIds.length))topics.push({topic_id:unassigned,name:'카테고리 미지정'});

 const selectedTopics=topics.filter(t=>choice.categories.includes(t.topic_id));
 const categoryGroups=categoryTypes.map(([type,label])=>{
  const group=topics.filter(t=>{
   const savedType=savedCategoryTypes?.packageId===choice.packageId?savedCategoryTypes.types.get(t.topic_id):undefined;
   const kind=categoryMetadata.get(t.topic_id)?.type??savedType??'';
   return type?kind===type:!['period','arc','theme'].includes(kind);
  });
  return {type,label,topics:group,selected:group.filter(t=>choice.categories.includes(t.topic_id))};
 });
 const allTopicsSelected=topics.length>0&&selectedTopics.length===topics.length;
 const eligible=data.events.filter(e=>choice.categories.some(id=>matchesTopic(e,id)));
 const selectedEventIds=new Set(choice.events);
 const pickedEvents=eligible.filter(e=>selectedEventIds.has(e.id));
 const allowed=!pkg?0:!selectedTopics.length?1:!pickedEvents.length?2:3;
 const step=Math.min(requested,allowed);
 const topic=topics.find(t=>t.topic_id===activeTopic)??topics[0];
 const eventTopic=eventFilter&&'categoryId' in eventFilter?selectedTopics.find(t=>t.topic_id===eventFilter.categoryId):undefined;
 const eventGroup=eventFilter&&'categoryType' in eventFilter?categoryGroups.find(g=>g.type===eventFilter.categoryType&&g.selected.length):undefined;
 const filteredTopics=eventTopic?[eventTopic]:eventGroup?.selected;
 const topicEvents=filteredTopics?eligible.filter(e=>filteredTopics.some(t=>matchesTopic(e,t.topic_id))):eligible;
 const rows=topicEvents.filter(e=>(e.title+' '+e.date).toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>a.bounds.start-b.bounds.start);
 const allRowsSelected=rows.length>0&&rows.every(e=>selectedEventIds.has(e.id));
 const event=rows.find(e=>e.id===previewEvent)??rows[0];
 const categoryEvents=useMemo(()=>data.events.filter(e=>matchesTopic(e,topic?.topic_id??'')),[data.events,topic?.topic_id]);
 const topicMeta=categoryMetadata.get(topic?.topic_id??'');
 useEffect(()=>{
  const packageId=choice.packageId;
  if(!packageId)return;
  let active=true;
  const {config,SheetData}=window.HistorySource;
  const snapshot=swimlaneSnapshot(packageId).catch(()=>null);
  void snapshot.then(saved=>{
   if(active&&saved)setSavedCategoryTypes({packageId,types:new Map(saved.categories.map(c=>[c.id,c.kind]))});
  });
  readEventImportance(config,SheetData).catch(async()=>(await snapshot)?.events??[])
   .catch(()=>[]).then(rows=>{if(active)setImportance({packageId,rows});});
  return ()=>{active=false;};
 },[choice.packageId]);
 useEffect(()=>{
  const onPop=()=>setRequested(requestedStep());
  window.addEventListener('popstate',onPop);
  return ()=>window.removeEventListener('popstate',onPop);
 },[]);
 useEffect(()=>{history.replaceState({...history.state,lessonChoices:choice},'');},[choice,requested]);
 useEffect(()=>{document.title=steps[step][1]+' · 새 수업 만들기';window.scrollTo({top:0,behavior:'instant'});heading.current?.focus({preventScroll:true});},[step]);
 function go(i:number){
  const url=new URL(location.href);url.hash=steps[i][0];
  history.pushState({lessonChoices:choice},'',url);
  setRequested(i);setError('');
 }
 function showMap(){
  if(window.matchMedia(step===2?'(max-width:1020px)':'(max-width:700px)').matches)mapPanel.current?.scrollIntoView({block:'start',behavior:'instant'});
 }
 function pickTopic(id:string){
  setActiveTopic(id);
  setChoice(c=>({...c,categories:toggle(c.categories,id)}));
 }
 function filterEvents(filter:EventFilter){
  setEventFilter(filter);setQuery('');
 }
 function selectEvents(events:EventRecord[],selected:boolean){
  setChoice(c=>{
   const next=new Set(c.events);
   for(const {id} of events){if(selected)next.add(id);else next.delete(id);}
   return {...c,events:[...next]};
  });
 }
 function finish(open:boolean){
  if(!pkg||!selectedTopics.length||!pickedEvents.length||!choice.school.trim()){setError('학교명을 입력해 주세요.');document.getElementById('lesson-school')?.focus();return;}
  try{
   const ids=new Set(pickedEvents.map(e=>e.id));
   const lesson=createLesson({...workspaceDraft(choice.school,pkg.id,choice.view),
    hiddenTopics:data.topics.filter(t=>!choice.categories.includes(t.topic_id)).map(t=>t.topic_id),
    includedEvents:pickedEvents.filter(e=>!e.directTopicIds.length).map(e=>e.id),
    hiddenEvents:data.events.filter(e=>!ids.has(e.id)).map(e=>e.legacyId??e.id)});
   const deepEvent=new URLSearchParams(location.search).get('event');
   location.assign(open?exploreHref(lesson,pickedEvents.find(e=>e.id===deepEvent||e.legacyId===deepEvent)?.id):setupHref());
  }catch{setError('이 브라우저에 수업을 저장할 수 없습니다.');}
 }
 return <>
 <header className="landing-nav setup-nav"><a className="wordmark" href="/">Dorms' Chronicle<span aria-hidden="true">✳</span></a><nav><a href={setupHref()}>수업 목록으로</a></nav></header>
 <main className="lesson-page">
  <header className="lesson-title"><h1>새 수업 만들기</h1><ol aria-label="수업 만들기 단계">{steps.map(([key,name],i)=><li key={key}><button type="button" aria-current={i===step?'step':undefined} disabled={i>allowed} onClick={()=>{if(i!==step)go(i);}}><span>{i+1}</span>{name}</button></li>)}</ol></header>
  <div className="lesson-section-title"><h2 tabIndex={-1} ref={heading}>{['수업에 사용할 패키지','수업에 담을 카테고리','카테고리별 사건 선택','수업 설정'][step]}</h2>
  {step>0&&step<3&&<span>{pkg?.name}</span>}</div>
  {step===0&&pending&&<p role="status">패키지를 읽는 중…</p>}
  {step===0&&<div className="lesson-packages">{(pending?[]:packages).map(item=>{
   const content=packageData(item.id), cats=packageTopics(content), first=cats.map(t=>categoryMetadata.get(t.topic_id)).find(m=>m?.mapKey);
   const years=content.events.map(e=>e.year);
   return <button className="lesson-package" type="button" key={item.id} aria-pressed={choice.packageId===item.id} onClick={()=>{
    if(choice.packageId!==item.id){setChoice(c=>({...c,packageId:item.id,categories:[],events:[]}));setActiveTopic('');setPreviewEvent('');filterEvents(null);}
   }}>
    <div className="lesson-package-map" aria-hidden="true">{first&&<CategoryMap meta={first} maps={maps}/>}</div>
    <div className="lesson-package-info">
    {(item.schoolLevel||item.subject)&&<span className="lesson-package-fields">
     {item.schoolLevel&&<span>학교급 <b>{item.schoolLevel}</b></span>}
     {item.subject&&<span>과목 <b>{item.subject}</b></span>}
    </span>}
    <strong>{item.name}</strong>
    <p>{item.description}</p><div>{years.length>0&&<span>{Math.min(...years)}–{Math.max(...years)}년</span>}<span>카테고리 {cats.length}개</span></div></div>
   </button>;
  })}</div>}
  {(step===1||step===2)&&<div className={step===2?'lesson-workbench lesson-events-workbench':'lesson-workbench'}>
   <section className={step===2?'lesson-picker lesson-event-picker':'lesson-picker'} aria-label={steps[step][1]+' 선택'}>
   {step===1&&<div className="lesson-bulk lesson-category-bulk"><button type="button" disabled={!topics.length} onClick={()=>{
    setChoice(c=>({...c,categories:allTopicsSelected?[]:topics.map(t=>t.topic_id)}));
   }}>{allTopicsSelected?'모두 해제':'모두 선택'}</button></div>}
   {step===1?categoryGroups.map(({label,topics:group})=>{
    if(!group.length)return null;
    return <fieldset key={label}><legend>{label}</legend>{group.map(t=>{
     const meta=categoryMetadata.get(t.topic_id);
     return <div className="lesson-row" key={t.topic_id} data-preview={topic?.topic_id===t.topic_id}>
      <label><input type="checkbox" checked={choice.categories.includes(t.topic_id)} onChange={()=>pickTopic(t.topic_id)}/><span>{t.name}<small>{[meta?.startDate,meta?.endDate].filter(Boolean).join(' – ')}</small></span></label>
      <button type="button" aria-label={t.name+' 지도 보기'} onClick={()=>{setActiveTopic(t.topic_id);showMap();}}>지도 보기</button></div>;
    })}</fieldset>;
   }):<>
    <div className="lesson-spaces lesson-category-filters" role="group" aria-label="선택한 카테고리">
     <button type="button" aria-pressed={!filteredTopics} onClick={()=>filterEvents(null)}>전체 보기</button>
     {categoryGroups.filter(group=>group.selected.length).map(group=><div className="lesson-category-filter" role="group" aria-label={group.label} key={group.type}>
      <button type="button" className="lesson-category-type" aria-pressed={eventGroup===group} onClick={()=>filterEvents({categoryType:group.type})}>{group.label} 전체</button>
      <div className="lesson-category-buttons">{group.selected.map(t=><button type="button" key={t.topic_id} aria-pressed={eventTopic===t} onClick={()=>filterEvents({categoryId:t.topic_id})}>{t.name}</button>)}</div>
     </div>)}
    </div>
    <input type="search" className="setup-input" aria-label="사건명 또는 연도 검색" placeholder="사건명 또는 연도 검색" value={query} onChange={e=>setQuery(e.target.value)}/>
    <div className="lesson-bulk"><strong>사건 {rows.length}개</strong><button type="button" disabled={!rows.length} onClick={()=>selectEvents(rows,!allRowsSelected)}>{allRowsSelected?'목록 선택 해제':'목록 모두 선택'}</button></div>
    <EventImportanceGroups entries={rows.map(record=>({record:{...record,importance:matchImportance(record)?.importance}}))} renderActions={(items,label)=>{
     const events=items.map(({record})=>record);
     const selected=events.filter(e=>selectedEventIds.has(e.id)).length;
     return <div className="lesson-bulk lesson-priority-actions">
      <button type="button" aria-label={`${label} 모두 선택`} disabled={selected===events.length} onClick={()=>selectEvents(events,true)}>모두 선택</button>
      <button type="button" aria-label={`${label} 모두 해제`} disabled={selected===0} onClick={()=>selectEvents(events,false)}>모두 해제</button>
     </div>;
    }} render={({record:e})=><div className="lesson-row" key={e.id} data-preview={event?.id===e.id}>
     <label><input type="checkbox" checked={selectedEventIds.has(e.id)} onChange={change=>{setPreviewEvent(e.id);selectEvents([e],change.target.checked);}}/>
     <span>{e.title}</span></label>
     <div className="lesson-event-meta"><time dateTime={e.date}>{e.date}</time>
      <button type="button" aria-label={e.title+' 지도 보기'} onClick={()=>{setPreviewEvent(e.id);showMap();}}>지도 보기</button></div>
    </div>}/>
   </>}
   {step===1&&!topics.length&&<p className="setup-help">{pending?'카테고리를 읽는 중…':'이 패키지에 연결된 카테고리가 없습니다.'}</p>}
   </section>
   <aside className="lesson-map-panel" aria-label="지도 미리보기" ref={mapPanel}>
    <div className="lesson-map-heading"><p>지도 미리보기</p><h3>{(step===1?topic?.name:event?.title)??'선택한 항목 없음'}</h3>{step===2&&event&&<time>{event.date}</time>}</div>
    {step===2&&event?.description?.trim()&&<p className="lesson-event-description">{event.description}</p>}
    {step===1&&topic&&<CategoryEventMap key={topic.topic_id} events={categoryEvents} meta={topicMeta} maps={maps}/>}
    {step===2&&event&&<EventMap key={event.id} event={event} maps={maps}/>}
   </aside>
  </div>}
  {step===3&&<section className="lesson-settings" aria-label="수업 설정">
   <div className="lesson-review">
    <header><h3>{pkg?.name}</h3><span>사건 <strong>{pickedEvents.length}</strong>개</span></header>
    <ul aria-label="선택한 카테고리">{selectedTopics.map(t=><li key={t.topic_id}>{t.name}</li>)}</ul>
   </div>
   <div className="lesson-settings-fields">
    <div className="lesson-school-field"><label className="setup-label" htmlFor="lesson-school">학교명</label>
     <input className="setup-input" id="lesson-school" required maxLength={100} value={choice.school} placeholder="학교 이름 입력" onChange={e=>{setError('');setChoice(c=>({...c,school:e.target.value}));}}/>
    </div>
    <fieldset className="setup-view"><legend>처음 열 화면</legend>
     <div className="setup-view-choices lesson-view-cards">{views.map(v=><label key={v.id}>
      <input name="lesson-view" type="radio" checked={choice.view===v.id} onChange={()=>setChoice(c=>({...c,view:v.id}))}/>
      <img src={`/assets/view-previews/${v.id}.jpg`} alt=""/>
      <span>{v.name}</span>
     </label>)}</div>
    </fieldset>
   </div>
  </section>}
  <footer className="lesson-actions">
   {step>0?<button type="button" onClick={()=>go(step-1)}>← 이전</button>:<a href={setupHref()}>취소</a>}
   {error&&<span role="alert">{error}</span>}
   {step<3&&<strong aria-live="polite">{step===0?pkg?.name:step===1?'카테고리 '+selectedTopics.length+'개 선택':'사건 '+pickedEvents.length+'개 선택'}</strong>}
   {step<3?<button type="button" className="setup-action" disabled={allowed<=step} onClick={()=>go(step+1)}>{steps[step+1][1]}{step<2?' 선택':''} →</button>:<><button className="lesson-save" type="button" onClick={()=>finish(false)}>수업 저장</button><button type="button" className="setup-action" onClick={()=>finish(true)}>저장하고 열기 ↗</button></>}
  </footer>
 </main>
 </>;
}
