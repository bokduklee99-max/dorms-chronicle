import {useEffect,useMemo,useRef,useState} from 'react';
import {lessonSwimlane,loadSwimlane} from '../swimlane-data.js';
import type {HistoryData} from './metro-model';
import type {CategoryMetadata} from './package-catalog';

type Sheet = Awaited<ReturnType<typeof loadSwimlane>>;
type Lesson = ReturnType<typeof lessonSwimlane>;

export function useLessonRecords(data:HistoryData,metadata:Map<string,CategoryMetadata>,packageId:string){
 const [sheet,setSheet]=useState<Sheet|null>();
 useEffect(()=>{
  let active=true;
  const {config,SheetData}=window.HistorySource;
  loadSwimlane(config,SheetData,packageId).catch(async()=>{
   if(!['japan','cold-war'].includes(packageId))return null;
   const response=await fetch('/assets/swimlane-'+packageId+'.json');
   return response.ok?response.json():null;
  }).catch(()=>null).then(result=>{if(active)setSheet(result);});
  return ()=>{active=false;};
 },[packageId]);
 return useMemo(()=>{
  return sheet===undefined?undefined:lessonSwimlane(data,metadata,sheet);
 },[data,metadata,sheet]);
}

export function SwimlaneTimeline({lesson,packageId,name}:{lesson?:Lesson;packageId:string;name:string}){
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!lesson||!host.current)return;
  const params=new URLSearchParams({embedded:'',package:packageId});
  const focus=new URLSearchParams(location.search).get('focus');
  if(focus)params.set('focus',focus);
  const frame=Object.assign(document.createElement('iframe'),{
   title:name+' 스윔레인',src:'/swimlane-focus.html?'+params,
   lessonSwimlane:{name,...lesson}
  });
  host.current.append(frame);
  return ()=>frame.remove();
 },[lesson,name,packageId]);
 return <section role="tabpanel" id="panel-swimlane" aria-labelledby="tab-swimlane">
  {!lesson&&<p role="status">스윔레인을 불러오는 중입니다.</p>}<div ref={host}/>
 </section>;
}
