import React,{useEffect,useLayoutEffect,useMemo,useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {MetroMapGallery,type MetroStation,type MetroDialogControls} from './components/ui/metro-map-gallery';
import {makeMetro,stationEventId,type EventRecord,type HistoryData} from './metro-model';
import {MetroTimeline} from './MetroTimeline';
import {BasicTimeline} from './BasicTimeline';
import {Strata} from './Strata';
import {WorldMap} from './WorldMap';
import {Constellation} from './Constellation';
import {EventDetail} from './EventDetail';
import {koreanHistory} from './korean-history';
import {useColdWarData} from './use-cold-war-data';
import {filterPackage,loadWorkspaces,packageName,packageViews,setupHref,type View,type Workspace} from './workspace-model';
import './style.css';
import '../assets/chronicle-theme.css';
declare global {interface Window {HistorySource:{data:HistoryData;media:Record<string,string>;config:{url:string;feedUrl:string};SheetData:{parseCSV:(s:string)=>unknown;decodeFeed:(s:unknown)=>unknown;build:(s:unknown)=>HistoryData};HistoryViews:{leadersDuring:(t:HistoryData['tenures'],id:string,b:EventRecord['bounds'])=>HistoryData['tenures'];eventLeaders:(e:EventRecord,a:HistoryData['actors'],t:HistoryData['tenures'])=>{country:HistoryData['actors'][number];people:{person:string;tenures:HistoryData['tenures']}[]}[]}}}}
const source=window.HistorySource;
const params=new URLSearchParams(location.search);
const workspaceId=params.get('workspace');
const media=Object.fromEntries(Object.entries(source.media).map(([key,value])=>[key,'/'+value]));
const workspace=workspaceId?loadWorkspaces().find(item=>item.id===workspaceId):undefined;
const selectedPackageName=packageName(workspace?.packageId??'cold-war');
const timelineTitle=workspace?`${workspace.school}의 ${selectedPackageName} 연표`:`${selectedPackageName} 연표`;

function App({workspace}:{workspace?:Workspace}){
 const packageId=workspace?.packageId??'cold-war';
 const isColdWar=packageId==='cold-war';
 const views=packageViews(packageId);
 const {data:coldWar,status}=useColdWarData(isColdWar);
 const data=useMemo(()=>{
  const full=isColdWar?coldWar:koreanHistory(source.data.tenures);
  return workspace?filterPackage(full,workspace.hiddenTopics,workspace.hiddenEvents):full;
 },[coldWar,isColdWar,workspace]);
 const [open,setOpen]=useState<string|null>(null);
 const [detailTopic,setDetailTopic]=useState<string|null>(null);
 const [detailContainer,setDetailContainer]=useState<HTMLElement|null>(null);
 const [view,setView]=useState<View>(()=>views.find(v=>v.id===params.get('view'))?.id??workspace?.view??'timeline');
 const detailTrigger=useRef<HTMLElement|SVGElement|null>(null);
 const initialEvent=useRef(params.get('event'));
 function changeView(next:View){setView(next);const url=new URL(location.href);if(next==='timeline'&&!workspace)url.searchParams.delete('view');else url.searchParams.set('view',next);history.replaceState(null,'',url);}
 function onOpenChange(id:string|null){setOpen(id);if(!id){setDetailTopic(null);setDetailContainer(null);}}
 useLayoutEffect(()=>{if(!open)detailTrigger.current?.focus({preventScroll:true});},[open]);
 const metro=useMemo(()=>makeMetro(data,media),[data]);
 const dataStatus=isColdWar?status:'한국 근현대사 대표 사건';

 function visit(id:string){
  const station=metro.items.find(item=>item.eventId===id);
  if(!station)return false;
  setOpen(station.id);
  return true;
 }
 useEffect(()=>{
  if(!initialEvent.current)return;
  if(visit(initialEvent.current))initialEvent.current=null;
 },[data]);
 const detail=(station:MetroStation,controls:MetroDialogControls)=>{
  const event=data.events.find(e=>e.id===stationEventId(station.id));if(!event)return null;
  return <EventDetail event={event} data={data} media={source.media} titleId={controls.titleId} topicId={detailTopic} onTopicChange={setDetailTopic} onVisit={visit}/>;
 };

 return <><nav className="topbar"><a href={setupHref({workspace:workspace?.id,view:workspace?undefined:view})}>← 탐색 설정</a><a href="/">Dorms' Chronicle</a>{!workspace&&<a href={source.config.url} target="_blank" rel="noreferrer">시트 편집 ↗</a>}</nav><main className={`metro-app ${view==='strata'?'strata-mode':view==='constellation'?'constellation-mode':''}`}><header className="hero"><h1>{timelineTitle}</h1></header>
 <div className="explore-tabs" role="tablist" aria-label="역사를 읽는 방식">{views.map((item,index)=><button key={item.id} role="tab" id={`tab-${item.id}`} aria-controls={`panel-${item.id}`} aria-selected={view===item.id} tabIndex={view===item.id?0:-1} onClick={()=>changeView(item.id)} onKeyDown={ev=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(ev.key)){ev.preventDefault();const next=views[ev.key==='Home'?0:ev.key==='End'?views.length-1:(index+(ev.key==='ArrowRight'?1:-1)+views.length)%views.length].id;changeView(next);document.getElementById(`tab-${next}`)?.focus();}}}>{item.name}</button>)}</div>
 {!data.events.length&&<p role="status">표시할 사건이 없어요. <a href={setupHref({workspace:workspace?.id})}>탐색 설정에서 구성을 확인해 주세요.</a></p>}
 {view==='timeline'&&data.events.length>0&&<BasicTimeline events={metro.events} topics={data.topics} onVisit={(id,button)=>{detailTrigger.current=button;visit(id);}}/>}
 {data.events.length>0&&<div id="panel-metro" role="tabpanel" aria-labelledby="tab-metro" hidden={view!=='metro'}><MetroTimeline data={data} media={media} status={dataStatus} onVisit={(id,button)=>{detailTrigger.current=button;visit(id);}}/></div>}
 <MetroMapGallery hidden items={metro.items} lines={metro.lines} trainSpeed={0} autoplay={false} open={open} onOpenChange={onOpenChange} labels={{close:'닫기',previous:'이전 사건',next:'다음 사건',line:'주제',station:'사건'}} dialogContainer={detailContainer??undefined} renderDialog={detail}/>
 {view==='strata'&&data.events.length>0&&<Strata data={data} status={dataStatus} onVisit={(id,button)=>{detailTrigger.current=button;visit(id);}}/>}
 {view==='world'&&<WorldMap data={data} onVisit={(id,button)=>{detailTrigger.current=button;visit(id);}}/>}
 {view==='constellation'&&<Constellation data={data} media={source.media} detailOpen={!!open} onVisit={(id,star,topicId)=>{
  detailTrigger.current=star;
  setDetailContainer(star.closest('dialog'));
  if(topicId)setDetailTopic(topicId);
  visit(id);
 }}/>}
 <footer>Metro Map Gallery · <a href="https://21st.dev/@dhxwhy/components/metro-map-gallery" target="_blank" rel="noreferrer">DHxWhy / 21st.dev</a>{!workspace&&<><a href="/classroom.html">연표·지도·활동 ↗</a><a href="/lens.html">시간·주제 관계 지도 ↗</a></>}</footer></main></>;
}
class ErrorBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true};}render(){return this.state.failed?<main className="empty"><h1>연표를 불러오지 못했어요.</h1><p>새로고침하거나 기존 연표를 열어 주세요.</p><a href="/">기존 연표 열기 ↗</a></main>:this.props.children;}}
document.title=`${workspaceId&&!workspace?'저장한 구성을 찾을 수 없어요':timelineTitle} · Dorms' Chronicle`;
createRoot(document.getElementById('root')!).render(<ErrorBoundary>{workspaceId&&!workspace?
 <main className="metro-app"><h1>저장한 구성을 찾을 수 없어요.</h1><p>구성은 저장한 브라우저에서 열 수 있어요.</p><a href={setupHref()}>탐색 설정 ↗</a></main>:<App workspace={workspace}/>}</ErrorBoundary>);
