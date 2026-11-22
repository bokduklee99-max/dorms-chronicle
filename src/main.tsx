import {localLesson,refreshLocalLessonSheets} from '../assets/local-sheet-copy.js';
import React,{useEffect,useMemo,useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {createPortal} from 'react-dom';
import {setupSwimlaneModal} from '../assets/swimlane-modal.js';
import '../assets/swimlane-modal.css';
import '../assets/space-preview.css';
import {type EventRecord,type HistoryData} from './metro-model';
import {SwimlaneTimeline,useLessonRecords} from './SwimlaneTimeline';
import {BasicTimeline} from './BasicTimeline';
import {TimeSpaceRadar} from './TimeSpaceRadar';
import {EventCategoryTimeline} from './EventDetail';
import {CreatorCredit} from './CreatorCredit';
import {useSheetHistory} from './use-sheet-history';
import type {PackageSheet} from './package-catalog';
import type {GeographySheet,SheetParser,SheetTables} from './package-content';
import {filterPackage,loadWorkspaces,packageName,setupHref,views,type View,type Workspace} from './workspace-model';
import './style.css';
import '../assets/chronicle-theme.css';
declare global {interface Window {HistorySource:{data:HistoryData;tables:SheetTables;media:Record<string,string>;config:PackageSheet&GeographySheet&{url:string;feedUrl:string;eventSheetId:number};SheetData:SheetParser;HistoryViews:{leadersDuring:(t:HistoryData['tenures'],id:string,b:EventRecord['bounds'])=>HistoryData['tenures'];eventLeaders:(e:EventRecord,a:HistoryData['actors'],t:HistoryData['tenures'])=>{country:HistoryData['actors'][number];people:{person:string;tenures:HistoryData['tenures']}[]}[]}}}}
const source=window.HistorySource;
const params=new URLSearchParams(location.search);
const showroom=params.has('showroom')&&window.parent!==window;
const workspaceId=params.get('workspace');
const workspace=workspaceId?loadWorkspaces().find(item=>item.id===workspaceId):undefined;

function App({workspace}:{workspace?:Workspace}){
 const packageId=workspace?.packageId??(params.get('package')==='japan'?'japan':'cold-war');
 const {packages,packageData,categoryMetadata,pending}=useSheetHistory();
 const [refreshState,setRefreshState]=useState<'idle'|'loading'|'failed'>('idle');
 async function refreshLocalCopy(){
  setRefreshState('loading');
  try{await refreshLocalLessonSheets();location.reload();}
  catch{setRefreshState('failed');}
 }
 const selectedPackageName=packageName(packages,packageId);
 const timelineTitle=workspace?`${workspace.school}의 ${selectedPackageName} 연표`:`${selectedPackageName} 연표`;
 useEffect(()=>{document.title=`${timelineTitle} · Dorms' Chronicle`;},[timelineTitle]);
 const data=useMemo(()=>{
  const full=packageData(packageId);
  return workspace?filterPackage(full,workspace.hiddenTopics,workspace.hiddenEvents,workspace.includedEvents):full;
 },[packageData,packageId,workspace]);
 const [view,setView]=useState<View>(()=>views.find(v=>v.id===params.get('view'))?.id??workspace?.view??'timeline');
 const lesson=useLessonRecords(data,categoryMetadata,packageId);
 const [requested,setRequested]=useState<{kind:'event'|'relation';id:string;external?:boolean}|null>(()=>{
  const id=params.get('event');
  return id?{kind:'event',id}:null;
 });
 const [context,setContext]=useState<{event:EventRecord;host:HTMLElement}|null>(null);
 const [detailTopic,setDetailTopic]=useState<string|null>(null);
 const reader=useRef<ReturnType<typeof setupSwimlaneModal>|null>(null);
 const radarPanel=useRef<HTMLDivElement>(null);
 const [radarRecord,setRadarRecord]=useState('');
 const trigger=useRef<HTMLButtonElement|SVGGElement|null>(null);
 function changeView(next:View){if(next!==view){setRequested(null);setContext(null);setRadarRecord('');setDetailTopic(null);reader.current=null;}setView(next);const url=new URL(location.href);if(next==='timeline'&&!workspace)url.searchParams.delete('view');else url.searchParams.set('view',next);history.replaceState(null,'',url);}
 function visit(id:string,button?:HTMLButtonElement|SVGGElement,kind:'event'|'relation'='event'){
  if(button&&!document.querySelector('#reader[open]'))trigger.current=button;
  setRequested({id,kind,external:!!button});
 }
 useEffect(()=>{
  if(!requested||pending||!lesson)return;
  type LessonEvent={id:string;sourceId:string;legacyId?:string;title:string;date:string};
  const current:LessonEvent[]=lesson.events;
  const {id,kind}=requested;
  function resolveEvent(){
   const direct=current.find(e=>e.id===id||e.sourceId===id||e.legacyId===id);
   if(direct)return direct;
   const saved=source.data.events.find(e=>e.id===id||e.legacyId===id);
   const matches=current.filter(e=>e.date===saved?.date&&e.title===saved.title);
   return matches.length===1?matches[0]:undefined;
  }
  const record=kind==='event'?resolveEvent():lesson.relations.find((rel:{id:string})=>rel.id===id);
  if(record){
   const panel=radarPanel.current;
   const dialog=document.querySelector<HTMLDialogElement>('#reader');
   if((panel?requested.external||!panel.firstChild:!dialog?.open)||!reader.current){
    if(kind==='event'&&trigger.current&&!trigger.current.isConnected){
     trigger.current=document.querySelector<HTMLButtonElement|SVGGElement>('[data-open-event="'+CSS.escape(record.sourceId)+'"]');
    }
    reader.current=setupSwimlaneModal(lesson,null,(id:string|null,host:HTMLElement|null)=>{
     const sourceId=current.find(e=>e.id===id)?.sourceId;
     const original=data.events.find(e=>e.id===sourceId);
     if(panel)setRadarRecord(original?.id||id||'');
     setContext(host&&original?{event:original,host}:null);
     if(!id){
      setDetailTopic(null);
      if(!panel||document.activeElement===document.body||panel.contains(document.activeElement)){
       requestAnimationFrame(()=>trigger.current?.focus({preventScroll:true}));
      }
     }
    },panel);
   }
   reader.current.open(kind,record);
   if(panel&&requested.external&&window.matchMedia('(max-width:639px)').matches){
    panel.scrollIntoView({block:'start'});
   }
  }
  setRequested(null);
 },[requested,pending,lesson,data]);

 return <><nav className="topbar" hidden={showroom}><a href={setupHref()}>← 수업 목록으로</a><a href="/">Dorms' Chronicle</a>{!workspace&&<a href={source.config.url} target="_blank" rel="noreferrer">시트 편집 ↗</a>}</nav><main data-showroom={showroom||undefined} className={view==='radar'?'metro-app radar-mode':'metro-app'}><header className="hero" hidden={showroom}><h1>{timelineTitle}</h1></header>
 <div className="explore-tabs" hidden={showroom} role="tablist" aria-label="역사를 읽는 방식">{views.map((item,index)=><button key={item.id} role="tab" id={`tab-${item.id}`} aria-controls={`panel-${item.id}`} aria-selected={view===item.id} tabIndex={view===item.id?0:-1} onClick={()=>changeView(item.id)} onKeyDown={ev=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(ev.key)){ev.preventDefault();const next=views[ev.key==='Home'?0:ev.key==='End'?views.length-1:(index+(ev.key==='ArrowRight'?1:-1)+views.length)%views.length].id;changeView(next);document.getElementById(`tab-${next}`)?.focus();}}}>{item.name}</button>)}</div>
 {!data.events.length&&<p role="status">{pending?'시트에서 사건을 읽는 중이에요.':<>표시할 사건이 없어요. <a href={setupHref({workspace:workspace?.id})}>탐색 설정에서 구성을 확인해 주세요.</a></>}</p>}
 {view==='swimlane'&&data.events.length>0&&<SwimlaneTimeline lesson={pending?undefined:lesson} packageId={packageId} name={selectedPackageName}/>}
 {view==='radar'&&data.events.length>0&&<TimeSpaceRadar data={data} lesson={lesson} packageId={packageId} panelRef={radarPanel} activeId={radarRecord} onDismiss={()=>{setRequested(null);if(radarPanel.current?.firstChild)reader.current?.close();}} onVisit={visit}/>}
 {view==='timeline'&&data.events.length>0&&(lesson&&!pending
  ? <BasicTimeline events={data.events} categories={lesson.categories} records={lesson.events} relations={lesson.relations} onVisit={visit}/>
  : <p role="status">기본 연표를 불러오는 중입니다.</p>)}
 {requested&&!lesson&&<p role="status">상세 정보를 불러오는 중입니다.</p>}
 {context&&createPortal(<EventCategoryTimeline event={context.event} data={data} titleId={view==='radar'?'radar-detail-title':'reader-title'} topicId={detailTopic} onTopicChange={setDetailTopic} onVisit={visit}/>,context.host)}
 <footer hidden={showroom}>{localLesson&&globalThis.caches&&<>
  <button type="button" disabled={pending||!lesson||refreshState==='loading'} onClick={refreshLocalCopy}>{refreshState==='loading'?'시트 갱신 중…':'원본 시트에서 다시 받기'}</button>
  {refreshState==='failed'&&<span role="status">시트를 갱신하지 못했습니다. 다시 시도해 주세요.</span>}
 </>}Metro Map Gallery · <a href="https://21st.dev/@dhxwhy/components/metro-map-gallery" target="_blank" rel="noreferrer">DHxWhy / 21st.dev</a>{!workspace&&<>
  <a href="/classroom.html">연표·활동 ↗</a><CreatorCredit/>
 </>}</footer></main></>;
}
class ErrorBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true};}render(){return this.state.failed?<main className="empty"><h1>연표를 불러오지 못했어요.</h1><p>새로고침하거나 기존 연표를 열어 주세요.</p><a href="/">기존 연표 열기 ↗</a></main>:this.props.children;}}
if(workspaceId&&!workspace)document.title="저장한 구성을 찾을 수 없어요 · Dorms' Chronicle";
createRoot(document.getElementById('root')!).render(<ErrorBoundary>{workspaceId&&!workspace?
 <main className="metro-app"><h1>저장한 구성을 찾을 수 없어요.</h1><p>구성은 저장한 브라우저에서 열 수 있어요.</p><a href={setupHref()}>탐색 설정 ↗</a></main>:<App workspace={workspace}/>}</ErrorBoundary>);
