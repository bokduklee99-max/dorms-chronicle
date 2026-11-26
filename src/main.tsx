import {localLesson,refreshLocalLessonSheets} from '../assets/local-sheet-copy.js';
import React,{useEffect,useMemo,useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {setupSwimlaneModal} from '../assets/swimlane-modal.js';
import '../assets/swimlane-modal.css';
import '../assets/space-preview.css';
import {type EventRecord,type HistoryData} from './metro-model';
import {lessonSwimlane} from '../swimlane-data.js';
import {SwimlaneTimeline,useLessonRecords} from './SwimlaneTimeline';
import {BasicTimeline} from './BasicTimeline';
import {TimeSpaceRadar} from './TimeSpaceRadar';
import {CreatorCredit} from './CreatorCredit';
import {ChronicleHeader} from './ChronicleHeader';
import {useSheetHistory} from './use-sheet-history';
import type {PackageSheet} from './package-catalog';
import type {GeographySheet,SheetParser,SheetTables} from './package-content';
import {filterPackage,loadWorkspaces,packageName,setupHref,views,type Workspace} from './workspace-model';
import './style.css';
import '../assets/chronicle-theme.css';
declare global {interface Window {HistorySource:{data:HistoryData;tables:SheetTables;media:Record<string,string>;config:PackageSheet&GeographySheet&{url:string;feedUrl:string;eventSheetId:number};SheetData:SheetParser;HistoryViews:{leadersDuring:(t:HistoryData['tenures'],id:string,b:EventRecord['bounds'])=>HistoryData['tenures'];eventLeaders:(e:EventRecord,a:HistoryData['actors'],t:HistoryData['tenures'])=>{country:HistoryData['actors'][number];people:{person:string;tenures:HistoryData['tenures']}[]}[]}}}}
const source=window.HistorySource;
const params=new URLSearchParams(location.search);
const showroom=params.has('showroom')&&window.parent!==window;
const workspaceId=params.get('workspace');
const workspace=workspaceId?loadWorkspaces().find(item=>item.id===workspaceId):undefined;
const timelineViews=[...views,{id:'territory',name:'영토 변화 지도'}] as const;
type TimelineView=typeof timelineViews[number]['id'];

function App({workspace}:{workspace?:Workspace}){
 const packageId=workspace?.packageId??(params.get('package')==='japan'?'japan':'cold-war');
 const {packages,packageData,categoryMetadata,pending}=useSheetHistory();
 const selectedPackageName=packageName(packages,packageId);
 const data=useMemo(()=>{
  const full=packageData(packageId);
  return workspace?filterPackage(full,workspace.hiddenTopics,workspace.hiddenEvents,workspace.includedEvents):full;
 },[packageData,packageId,workspace]);
 const lesson=useLessonRecords(data,categoryMetadata,packageId);
 return <Timeline {...{workspace,packageId,selectedPackageName,data,pending,lesson}}/>;
}

function SampleTimeline(){
 const [sample,setSample]=useState<{data:HistoryData;lesson:ReturnType<typeof lessonSwimlane>}>();
 const [failed,setFailed]=useState(false);
 useEffect(()=>{
  let active=true;
  async function load(){
   const [tables,sheet]=await Promise.all(['/assets/example-japan.json','/assets/swimlane-japan.json'].map(async path=>{
    const response=await fetch(path);
    if(!response.ok)throw Error('연표 예시를 불러오지 못했습니다.');
    return response.json();
   }));
   const data=source.SheetData.build(tables);
   if(active)setSample({data,lesson:lessonSwimlane(data,new Map(),sheet)});
  }
  load().catch(()=>{if(active)setFailed(true);});
  return ()=>{active=false;};
 },[]);
 if(!sample)return <><TimelineHeader sample/><p role="status">{failed?<>연표 예시를 불러오지 못했습니다. <button onClick={()=>location.reload()}>다시 열기</button></>:'연표를 불러오는 중입니다.'}</p></>;
 return <Timeline {...sample} packageId="japan" selectedPackageName="일제강점기와 독립운동" pending={false} sample/>;
}

function TimelineHeader({sample, workspace}: {sample?: boolean; workspace?: Workspace}){
 return <ChronicleHeader hidden={showroom}>
  <a href={setupHref()}>← 수업 목록으로</a>
  {sample?<a href="/classroom.html?sample=japan">학습 콘텐츠 열기 ↗</a>:
   !workspace&&<a href={source.config.url} target="_blank" rel="noreferrer">시트 편집 ↗</a>}
 </ChronicleHeader>;
}

function Timeline({workspace,packageId,selectedPackageName,data,pending,lesson,sample=false}:{
 workspace?:Workspace;packageId:string;selectedPackageName:string;data:HistoryData;pending:boolean;lesson:ReturnType<typeof useLessonRecords>;sample?:boolean
}){
 const [refreshState,setRefreshState]=useState<'idle'|'loading'|'failed'>('idle');
 async function refreshLocalCopy(){
  setRefreshState('loading');
  try{await refreshLocalLessonSheets();location.reload();}
  catch{setRefreshState('failed');}
 }
 const timelineTitle=workspace?`${workspace.school}의 ${selectedPackageName} 연표`:`${selectedPackageName} 연표`;
 useEffect(()=>{document.title=`${timelineTitle} · Dorms' Chronicle`;},[timelineTitle]);
 const [view,setView]=useState<TimelineView>(()=>timelineViews.find(v=>v.id===params.get('view'))?.id??workspace?.view??'timeline');
 const timelineFrame=showroom&&view==='timeline'?window.frameElement as HTMLElement|null:null;
 const main=useRef<HTMLElement>(null);
 useEffect(()=>{
  const content=main.current;
  if(!timelineFrame||!content)return;
  const observer=new ResizeObserver(()=>{
   const border=timelineFrame.offsetHeight-timelineFrame.clientHeight;
   timelineFrame.style.height=Math.ceil(content.getBoundingClientRect().height+border)+'px';
  });
  observer.observe(content);
  return ()=>observer.disconnect();
 },[timelineFrame]);
 const [requested,setRequested]=useState<{kind:'event'|'relation';id:string;external?:boolean}|null>(()=>{
  const id=view==='territory'?null:params.get('event');
  return id?{kind:'event',id}:null;
 });
 const reader=useRef<ReturnType<typeof setupSwimlaneModal>|null>(null);
 const radarPanel=useRef<HTMLDivElement>(null);
 const [radarRecord,setRadarRecord]=useState('');
 const trigger=useRef<HTMLButtonElement|SVGGElement|null>(null);
 function changeView(next:TimelineView){if(next!==view){setRequested(null);setRadarRecord('');reader.current=null;}setView(next);const url=new URL(location.href);if(next==='timeline'&&!workspace)url.searchParams.delete('view');else url.searchParams.set('view',next);history.replaceState(null,'',url);}
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
    reader.current=setupSwimlaneModal({...lesson,name:selectedPackageName,packageId},timelineFrame,(id:string|null)=>{
     const sourceId=current.find(e=>e.id===id)?.sourceId;
     const original=data.events.find(e=>e.id===sourceId);
     if(panel)setRadarRecord(original?.id||id||'');
     if(!id){
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
 },[requested,pending,lesson,data,timelineFrame]);

 const canRefreshSheet=!sample&&localLesson&&globalThis.caches;
 const showClassroomLinks=!sample&&!workspace;
 const firstYear=data.events.reduce((earliest,event)=>Math.min(earliest,event.year),Infinity);
 const territoryQuery=new URLSearchParams();
 if(Number.isFinite(firstYear))territoryQuery.set('year',String(firstYear));
 if(packageId==='japan')territoryQuery.set('scope','korea');
 return <><TimelineHeader {...{sample,workspace}}/>
 <main ref={main} data-showroom={showroom||undefined} className={view==='radar'?'metro-app radar-mode':'metro-app'}><header className="hero" hidden={showroom}><h1>{timelineTitle}</h1></header>
 <div className="explore-tabs" hidden={showroom} role="tablist" aria-label="역사를 읽는 방식">{timelineViews.map((item,index)=><button key={item.id} role="tab" id={`tab-${item.id}`} aria-controls={`panel-${item.id}`} aria-selected={view===item.id} tabIndex={view===item.id?0:-1} onClick={()=>changeView(item.id)} onKeyDown={ev=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(ev.key)){ev.preventDefault();const next=timelineViews[ev.key==='Home'?0:ev.key==='End'?timelineViews.length-1:(index+(ev.key==='ArrowRight'?1:-1)+timelineViews.length)%timelineViews.length].id;changeView(next);document.getElementById(`tab-${next}`)?.focus();}}}>{item.name}</button>)}</div>
 {view!=='territory'&&!data.events.length&&<p role="status">{pending?'시트에서 사건을 읽는 중이에요.':<>표시할 사건이 없어요. <a href={setupHref({workspace:workspace?.id})}>탐색 설정에서 구성을 확인해 주세요.</a></>}</p>}
 {view==='swimlane'&&data.events.length>0&&<SwimlaneTimeline lesson={pending?undefined:lesson} packageId={packageId} name={selectedPackageName}/>}
 {view==='radar'&&data.events.length>0&&<TimeSpaceRadar data={data} lesson={lesson} packageId={packageId} panelRef={radarPanel} activeId={radarRecord} onDismiss={()=>{setRequested(null);if(radarPanel.current?.firstChild)reader.current?.close();}} onVisit={visit}/>}
 {view==='territory'&&<section id="panel-territory" role="tabpanel" aria-labelledby="tab-territory">
  {pending?<p role="status">수업의 시작 연도를 확인하는 중입니다.</p>:
   <iframe src={'/territory-map.html'+(territoryQuery.size?'?'+territoryQuery:'')} title="영토 변화 지도" allowFullScreen/>}
 </section>}
 {view==='timeline'&&data.events.length>0&&(lesson&&!pending
  ? <BasicTimeline events={data.events} categories={lesson.categories} records={lesson.events} relations={lesson.relations} onVisit={visit} showroomFrame={timelineFrame}/>
  : <p role="status">기본 연표를 불러오는 중입니다.</p>)}
 {requested&&!lesson&&<p role="status">상세 정보를 불러오는 중입니다.</p>}
 {!showroom&&(canRefreshSheet||showClassroomLinks)&&<footer>{canRefreshSheet&&<>
  <button type="button" disabled={pending||!lesson||refreshState==='loading'} onClick={refreshLocalCopy}>{refreshState==='loading'?'시트 갱신 중…':'원본 시트에서 다시 받기'}</button>
  {refreshState==='failed'&&<span role="status">시트를 갱신하지 못했습니다. 다시 시도해 주세요.</span>}
 </>}{showClassroomLinks&&<>
  <a href="/classroom.html">연표·활동 ↗</a><CreatorCredit/>
 </>}</footer>}</main></>;
}
class ErrorBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true};}render(){return this.state.failed?<><ChronicleHeader hidden={showroom}><a href={setupHref()}>← 수업 목록으로</a></ChronicleHeader><main className="empty"><h1>연표를 불러오지 못했어요.</h1><p>새로고침하거나 기존 연표를 열어 주세요.</p><a href="/">기존 연표 열기 ↗</a></main></>:this.props.children;}}
if(workspaceId&&!workspace)document.title="저장한 구성을 찾을 수 없어요 · Dorms' Chronicle";
createRoot(document.getElementById('root')!).render(<ErrorBoundary>{workspaceId&&!workspace?
 <><ChronicleHeader hidden={showroom}><a href={setupHref()}>← 수업 목록으로</a></ChronicleHeader><main className="metro-app"><h1>저장한 구성을 찾을 수 없어요.</h1><p>구성은 저장한 브라우저에서 열 수 있어요.</p></main></>:params.get('sample')==='japan'?<SampleTimeline/>:<App workspace={workspace}/>}</ErrorBoundary>);
