import {localLesson,refreshLocalLessonSheets} from '../assets/local-sheet-copy.js';
import React,{useEffect,useLayoutEffect,useMemo,useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {setupSwimlaneModal} from '../assets/swimlane-modal.js';
import '../assets/swimlane-modal.css';
import '../assets/space-preview.css';
import {type EventRecord,type HistoryData} from './metro-model';
import {lessonSwimlane} from '../swimlane-data.js';
import {SwimlaneTimeline,useLessonRecords,type MoveEventCategory,type SetCategoryColor} from './SwimlaneTimeline';
import {BasicTimeline} from './BasicTimeline';
import {TimeSpaceRadar} from './TimeSpaceRadar';
import {CreatorCredit} from './CreatorCredit';
import {ChronicleHeader} from './ChronicleHeader';
import {WorkspaceRoomEditor,type WorkspaceEventChange} from './WorkspaceRoomEditor';
import {useSheetHistory} from './use-sheet-history';
import type {PackageSheet} from './package-catalog';
import type {GeographySheet,SheetParser,SheetTables} from './package-content';
import {filterPackage,loadWorkspaces,moveWorkspaceEventCategory,packageName,saveWorkspace,selectWorkspaceEvents,setWorkspaceCategoryColor,setupHref,undoWorkspaceEventCategory,views,type SwimlaneStroke,type Workspace} from './workspace-model';
import './style.css';
import '../assets/chronicle-theme.css';
import '../assets/workspace-event-edit.css';
declare global {interface Window {HistorySource:{data:HistoryData;tables:SheetTables;media:Record<string,string>;config:PackageSheet&GeographySheet&{url:string;feedUrl:string;eventSheetId:number};SheetData:SheetParser;HistoryViews:{leadersDuring:(t:HistoryData['tenures'],id:string,b:EventRecord['bounds'])=>HistoryData['tenures'];eventLeaders:(e:EventRecord,a:HistoryData['actors'],t:HistoryData['tenures'])=>{country:HistoryData['actors'][number];people:{person:string;tenures:HistoryData['tenures']}[]}[]}}}}
const source=window.HistorySource;
const params=new URLSearchParams(location.search);
const showroom=params.has('showroom')&&window.parent!==window;
const workspaceId=params.get('workspace');
const workspace=workspaceId?loadWorkspaces().find(item=>item.id===workspaceId):undefined;
const timelineViews=[...views,{id:'territory',name:'영토 변화 지도'}] as const;
type TimelineView=typeof timelineViews[number]['id'];

type RoomActions={hiddenEvents:EventRecord[];change:WorkspaceEventChange|null;error:string;clearError:()=>void;setVisible:(id:string,visible:boolean)=>void;moveCategory:MoveEventCategory;setCategoryColor:SetCategoryColor;editInk:(stroke:SwimlaneStroke|null)=>void};

function App({initialWorkspace}:{initialWorkspace?:Workspace}){
 const [workspace,setWorkspace]=useState(initialWorkspace);
 const [change,setChange]=useState<WorkspaceEventChange|null>(null);
 const [error,setError]=useState('');
 const packageId=workspace?.packageId??(params.get('package')==='japan'?'japan':'cold-war');
 const {packages,packageData,categoryMetadata,pending}=useSheetHistory();
 const selectedPackageName=packageName(packages,packageId);
 const full=useMemo(()=>packageData(packageId),[packageData,packageId]);
 const {hiddenTopics,hiddenEvents:hiddenEventIds,includedEvents,eventCategoryChanges}=workspace??{};
 const data=useMemo(()=>hiddenTopics&&hiddenEventIds?filterPackage(full,hiddenTopics,hiddenEventIds,includedEvents,eventCategoryChanges):full,
  [full,hiddenTopics,hiddenEventIds,includedEvents,eventCategoryChanges]);
 const records=useLessonRecords(data,categoryMetadata,packageId,full.events);
 const lesson=useMemo(()=>records&&hiddenTopics?{
  ...records,availableCategories:records.availableCategories.filter(category=>!hiddenTopics.includes(category.id)),
 }:records,[records,hiddenTopics]);
 const hiddenEvents=useMemo(()=>{
  const ids=new Set(workspace?.hiddenEvents);
  return full.events.filter(event=>ids.has(event.id)||ids.has(event.legacyId??''));
 },[full,workspace]);
 function setVisible(id:string,visible:boolean){
  const event=full.events.find(item=>item.id===id);
  if(!workspace||!event)return;
  try {
   const latest=loadWorkspaces().find(item=>item.id===workspace.id);
   if(!latest||latest.packageId!==packageId)throw Error('수업 구성이 변경됐어요.');
   const draft=selectWorkspaceEvents(latest,[event],visible);
   setWorkspace(saveWorkspace({...latest,...draft}));
   setChange({event,visible});setError('');
  }catch{setError('변경을 저장하지 못했어요. 방을 다시 열고 시도해 주세요.');}
 }
 const moveCategory:MoveEventCategory=(id,fromId,toId)=>{
  const event=full.events.find(item=>item.id===id);
  const categories=lesson?.availableCategories;
  const destination=categories?.find(item=>item.id===toId);
  if(!workspace||!event||!categories||!destination||!['theme','arc'].includes(destination.kind)||fromId===toId)return false;
  try {
   const latest=loadWorkspaces().find(item=>item.id===workspace.id);
   if(!latest||latest.packageId!==packageId||latest.hiddenTopics.includes(toId)||
    latest.hiddenEvents.some(key=>key===event.id||key===event.legacyId))throw Error('수업 구성이 변경됐어요.');
   const origin=categories.find(item=>item.id===fromId);
   const removeIds=origin&&origin.kind===destination.kind?[origin.id]:[];
   const draft=moveWorkspaceEventCategory(latest,event,removeIds,toId);
   const key=event.legacyId??event.id;
   const previous=latest.eventCategoryChanges?.[key];
   const moved=draft.eventCategoryChanges?.[key];
   if(JSON.stringify(previous)===JSON.stringify(moved))return false;
   setWorkspace(saveWorkspace({...latest,...draft}));
   setChange({event,category:destination.name,focusLane:toId,undo:()=>{
    try{
     const current=loadWorkspaces().find(item=>item.id===workspace.id);
     if(!current||current.packageId!==packageId)throw Error('수업 구성이 변경됐어요.');
     const restored=undoWorkspaceEventCategory(current,event,previous,moved);
     setWorkspace(saveWorkspace({...current,...restored}));
     setChange({event,categoryRestored:true,focusLane:fromId});setError('');
    }catch{setError('분류 이동을 되돌리지 못했어요. 방을 다시 열어 변경 사항을 확인해 주세요.');}
   }});setError('');
   return true;
  }catch{setError('변경을 저장하지 못했어요. 방을 다시 열고 시도해 주세요.');return false;}
 };
 const setCategoryColor:SetCategoryColor=(id,color)=>{
  if(!workspace||!full.topics.some(topic=>topic.topic_id===id))return false;
  try{
   const latest=loadWorkspaces().find(item=>item.id===workspace.id);
   if(!latest||latest.packageId!==packageId)throw Error('수업 구성이 변경됐어요.');
   const draft=setWorkspaceCategoryColor(latest,id,color);
   const saved=saveWorkspace({...latest,...draft});
   setWorkspace({...workspace,categoryColors:saved.categoryColors});
   return true;
  }catch{return false;}
 };
 function editInk(stroke:SwimlaneStroke|null){
  if(!workspace)return;
  try{
   const latest=loadWorkspaces().find(item=>item.id===workspace.id);
   if(!latest||latest.packageId!==packageId)throw Error('수업 구성이 변경됐어요.');
   const ink=latest.swimlaneInk??[];
   const saved=saveWorkspace({...latest,swimlaneInk:stroke?[...ink,stroke]:ink.slice(0,-1)});
   setWorkspace(current=>current&&({...current,swimlaneInk:saved.swimlaneInk}));
   setError('');
  }catch{setError('필기를 저장하지 못했어요. 다시 시도해 주세요.');}
 }
 const roomActions=workspace&&!showroom?{hiddenEvents,change,error,clearError:()=>setError(''),setVisible,moveCategory,setCategoryColor,editInk}:undefined;
 return <Timeline {...{workspace,packageId,selectedPackageName,data,pending,lesson,roomActions}}/>;
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

function TimelineHeader({sample,workspace}: {sample?: boolean;workspace?: Workspace}){
 return <ChronicleHeader hidden={showroom}>
  <a href={setupHref()}>← 수업 목록으로</a>
  {sample?<a href="/classroom.html?sample=japan">학습 콘텐츠 열기 ↗</a>:
   !workspace&&<a href={source.config.url} target="_blank" rel="noreferrer">시트 편집 ↗</a>}
 </ChronicleHeader>;
}

function Timeline({workspace,packageId,selectedPackageName,data,pending,lesson,sample=false,roomActions}:{
 workspace?:Workspace;packageId:string;selectedPackageName:string;data:HistoryData;pending:boolean;lesson:ReturnType<typeof useLessonRecords>;sample?:boolean;roomActions?:RoomActions
}){
 const [editingRoom,setEditingRoom]=useState(false);
 const [managingHidden,setManagingHidden]=useState(false);
 const [penMode,setPenMode]=useState(false);
 const [refreshState,setRefreshState]=useState<'idle'|'loading'|'failed'>('idle');
 async function refreshLocalCopy(){
  setRefreshState('loading');
  try{await refreshLocalLessonSheets();location.reload();}
  catch{setRefreshState('failed');}
 }
 const timelineTitle=workspace?`${workspace.school}의 ${selectedPackageName} 연표`:`${selectedPackageName} 연표`;
 useEffect(()=>{document.title=`${timelineTitle} · Dorms' Chronicle`;},[timelineTitle]);
 const [view,setView]=useState<TimelineView>(()=>timelineViews.find(v=>v.id===params.get('view'))?.id??workspace?.view??'timeline');
 const penActive=view==='swimlane'&&editingRoom&&penMode;
 const onHideEvent=editingRoom&&!penActive&&roomActions&&!pending?(id:string)=>roomActions.setVisible(id,false):undefined;
 const manageHidden=view==='territory';
 const roomEditorOpen=manageHidden?managingHidden:editingRoom;
 const toolbarOpen=view==='swimlane'&&roomEditorOpen;
 const roomEditToggle=useRef<HTMLButtonElement>(null);
 const timelineFrame=showroom&&view==='timeline'?window.frameElement as HTMLElement|null:null;
 const main=useRef<HTMLElement>(null);
 useLayoutEffect(()=>{
  if(toolbarOpen)main.current?.querySelector<HTMLButtonElement>('.room-edit-tools button[aria-pressed="true"]')?.focus({preventScroll:true});
 },[toolbarOpen]);
 const roomChange=roomActions?.change;
 useLayoutEffect(()=>{
  if(!roomChange)return;
  const frame=main.current?.querySelector<HTMLIFrameElement>('#panel-swimlane iframe');
  const content=frame?.contentDocument??document;
  const frameRect=frame?.getBoundingClientRect();
  const visible=(button:HTMLElement)=>{
   const rect=button.getBoundingClientRect();
   if(!rect.width||!rect.height)return false;
   const x=rect.left+rect.width/2,y=rect.top+rect.height/2;
   return button.contains(button.ownerDocument.elementFromPoint(x,y))&&(button.ownerDocument===document||!frame||!frameRect||
    document.elementFromPoint(x+frameRect.left+frame.clientLeft,y+frameRect.top+frame.clientTop)===frame);
  };
  const cards=[...content.querySelectorAll<HTMLElement>('[data-workspace-event="'+CSS.escape(roomChange.event.id)+'"]')];
  const lane='focusLane' in roomChange?roomChange.focusLane:undefined;
  const preferred=lane&&cards.find(card=>card.closest<HTMLElement>('[data-move-category]')?.dataset.moveCategory===lane);
  if(preferred)cards.unshift(preferred);
  const buttons=cards.map(card=>card.querySelector<HTMLButtonElement>(lane?'.room-event-move':'button'));
  const controls=document.querySelectorAll<HTMLElement>('#room-editor li button, #room-editor summary');
  const target=[...buttons,...controls].find(button=>button&&visible(button))??roomEditToggle.current;
  target?.focus({preventScroll:true});
 },[roomChange]);
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
 function toggleRoomEditor(){
  if(manageHidden){setManagingHidden(open=>!open);return;}
  roomActions?.clearError();
  setPenMode(false);
  setEditingRoom(open=>!open);
 }
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
 const editLabel=manageHidden?'숨긴 사건 관리':editingRoom?'편집 닫기':'편집';
 const firstYear=data.events.reduce((earliest,event)=>Math.min(earliest,event.year),Infinity);
 const territoryQuery=new URLSearchParams();
 if(Number.isFinite(firstYear))territoryQuery.set('year',String(firstYear));
 if(packageId==='japan')territoryQuery.set('scope','korea');
 return <><TimelineHeader {...{sample,workspace}}/>
 <main ref={main} data-showroom={showroom||undefined} data-saved-room={!!roomActions||undefined} className={view==='radar'?'metro-app radar-mode':'metro-app'}><header className="hero" hidden={showroom}><h1>{timelineTitle}</h1></header>
 <div className="explore-tabs" hidden={showroom} role="tablist" aria-label="역사를 읽는 방식">{timelineViews.map((item,index)=><button key={item.id} role="tab" id={`tab-${item.id}`} aria-controls={`panel-${item.id}`} aria-selected={view===item.id} tabIndex={view===item.id?0:-1} onClick={()=>changeView(item.id)} onKeyDown={ev=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(ev.key)){ev.preventDefault();const next=timelineViews[ev.key==='Home'?0:ev.key==='End'?timelineViews.length-1:(index+(ev.key==='ArrowRight'?1:-1)+timelineViews.length)%timelineViews.length].id;changeView(next);document.getElementById(`tab-${next}`)?.focus();}}}>{item.name}</button>)}</div>
 {workspace&&roomActions&&<div className="room-edit-dock" data-toolbar={toolbarOpen||undefined}>
  {roomEditorOpen&&<WorkspaceRoomEditor hiddenEvents={roomActions.hiddenEvents} manageHidden={manageHidden}
   change={manageHidden&&roomChange&&(!('visible' in roomChange)||!roomChange.visible)?null:roomActions.change}
   error={roomActions.error} onRestore={id=>roomActions.setVisible(id,true)}
   pen={toolbarOpen?{active:penActive,select:setPenMode,canUndo:!!workspace.swimlaneInk?.length,undo:()=>roomActions.editInk(null)}:undefined}/>}
  <button ref={roomEditToggle} className={'room-edit-toggle'+(manageHidden?'':' room-edit-icon')} type="button"
   aria-label={editLabel} title={editLabel} aria-expanded={roomEditorOpen} aria-controls={roomEditorOpen?'room-editor':undefined}
   onClick={toggleRoomEditor}>{manageHidden?editLabel:<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"
    fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
     <path d={editingRoom?'m6 6 12 12M18 6 6 18':'m15 6 3 3M5 19l4-1 11-11a2.1 2.1 0 0 0-3-3L6 15z'}/>
    </svg>}</button>
 </div>}
 {view!=='territory'&&view!=='swimlane'&&!data.events.length&&<p role="status">{pending?'시트에서 사건을 읽는 중이에요.':<>표시할 사건이 없어요. <a href={setupHref({workspace:workspace?.id})}>탐색 설정에서 구성을 확인해 주세요.</a></>}</p>}
 {view==='swimlane'&&<SwimlaneTimeline key={packageId} lesson={pending?undefined:lesson} packageId={packageId} name={selectedPackageName}
  onHideEvent={onHideEvent} onMoveCategory={onHideEvent?roomActions?.moveCategory:undefined}
  onSetCategoryColor={pending?undefined:roomActions?.setCategoryColor} categoryColors={workspace?.categoryColors}
  ink={workspace?.swimlaneInk} onDraw={penActive&&!pending?roomActions?.editInk:undefined}/>}
 {view==='radar'&&data.events.length>0&&<TimeSpaceRadar data={data} lesson={lesson} packageId={packageId} panelRef={radarPanel} activeId={radarRecord} onDismiss={()=>{setRequested(null);if(radarPanel.current?.firstChild)reader.current?.close();}} onVisit={visit} onHideEvent={onHideEvent}/>}
 {view==='territory'&&<section id="panel-territory" role="tabpanel" aria-labelledby="tab-territory">
  {pending?<p role="status">수업의 시작 연도를 확인하는 중입니다.</p>:
   <iframe src={'/territory-map.html'+(territoryQuery.size?'?'+territoryQuery:'')} title="영토 변화 지도" allowFullScreen/>}
 </section>}
 {view==='timeline'&&data.events.length>0&&(lesson&&!pending
  ? <BasicTimeline events={data.events} categories={lesson.categories} records={lesson.events} relations={lesson.relations} onVisit={visit} showroomFrame={timelineFrame} onHideEvent={onHideEvent}/>
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
 <><ChronicleHeader hidden={showroom}><a href={setupHref()}>← 수업 목록으로</a></ChronicleHeader><main className="metro-app"><h1>저장한 구성을 찾을 수 없어요.</h1><p>구성은 저장한 브라우저에서 열 수 있어요.</p></main></>:params.get('sample')==='japan'?<SampleTimeline/>:<App initialWorkspace={workspace}/>}</ErrorBoundary>);
