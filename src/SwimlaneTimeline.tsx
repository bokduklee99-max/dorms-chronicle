import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {lessonSwimlane,loadSwimlane} from '../swimlane-data.js';
import type {HistoryData} from './metro-model';
import type {CategoryMetadata} from './package-catalog';
import type {SwimlaneStroke,WorkspaceDraft} from './workspace-model';

type Sheet = Awaited<ReturnType<typeof loadSwimlane>>;
type Lesson = ReturnType<typeof lessonSwimlane>;
type NamedLesson=Lesson&{name:string};
export type MoveEventCategory=(eventId:string,fromId:string|undefined,toId:string)=>boolean;
export type SetCategoryColor=(categoryId:string,color:string|null)=>boolean;
type SwimlaneFrame = HTMLIFrameElement & {
 lessonSwimlane?:NamedLesson;
 updateSwimlaneLesson?:(lesson:NamedLesson)=>void;
 redrawSwimlane?:()=>void;
 hideWorkspaceEvent?:(id:string)=>void;
 moveWorkspaceCategory?:MoveEventCategory;
 setWorkspaceCategoryColor?:SetCategoryColor;
 workspaceCategoryColors?:WorkspaceDraft['categoryColors'];
 redrawSwimlaneColors?:()=>void;
 workspaceInk?:SwimlaneStroke[];
 drawWorkspaceStroke?:(stroke:SwimlaneStroke)=>void;
 redrawSwimlaneInk?:()=>void;
};

export function useLessonRecords(data:HistoryData,metadata:Map<string,CategoryMetadata>,packageId:string,sourceEvents:HistoryData['events']){
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
  return sheet===undefined?undefined:lessonSwimlane(data,metadata,sheet,undefined,sourceEvents);
 },[data,metadata,sheet,sourceEvents]);
}

export function SwimlaneTimeline({lesson,packageId,name,onHideEvent,onMoveCategory,onSetCategoryColor,categoryColors,ink,onDraw}:{
 lesson?:Lesson;packageId:string;name:string;onHideEvent?:(id:string)=>void;onMoveCategory?:MoveEventCategory;
 onSetCategoryColor?:SetCategoryColor;categoryColors?:WorkspaceDraft['categoryColors'];
 ink?:SwimlaneStroke[];onDraw?:(stroke:SwimlaneStroke)=>void;
}){
 const host=useRef<HTMLDivElement>(null);
 const currentFrame=useRef<SwimlaneFrame>(null);
 const edits=useRef({hideWorkspaceEvent:onHideEvent,moveWorkspaceCategory:onMoveCategory,setWorkspaceCategoryColor:onSetCategoryColor});
 const colors=useRef(categoryColors);
 const pen=useRef({workspaceInk:ink,drawWorkspaceStroke:onDraw});
 useLayoutEffect(()=>{
  edits.current={hideWorkspaceEvent:onHideEvent,moveWorkspaceCategory:onMoveCategory,setWorkspaceCategoryColor:onSetCategoryColor};
  const frame=currentFrame.current;
  if(!frame)return;
  const changed=(['hideWorkspaceEvent','moveWorkspaceCategory','setWorkspaceCategoryColor'] as const)
   .some(key=>Boolean(frame[key])!==Boolean(edits.current[key]));
  Object.assign(frame,edits.current);
  if(changed)frame.redrawSwimlane?.();
 },[onHideEvent,onMoveCategory,onSetCategoryColor]);
 useLayoutEffect(()=>{
  colors.current=categoryColors;
  const frame=currentFrame.current;
  if(!frame)return;
  frame.workspaceCategoryColors=categoryColors;
  frame.redrawSwimlaneColors?.();
 },[categoryColors]);
 useLayoutEffect(()=>{
  pen.current={workspaceInk:ink,drawWorkspaceStroke:onDraw};
  const frame=currentFrame.current;
  if(!frame)return;
  const changed=frame.workspaceInk!==ink||Boolean(frame.drawWorkspaceStroke)!==Boolean(onDraw);
  Object.assign(frame,pen.current);
  if(changed)frame.redrawSwimlaneInk?.();
 },[ink,onDraw]);
 useLayoutEffect(()=>{
  if(!lesson||!host.current)return;
  const content={name,...lesson,relations:[...lesson.relations,...lesson.partialRelations]};
  const mounted=currentFrame.current;
  if(mounted){
   mounted.lessonSwimlane=content;
   mounted.updateSwimlaneLesson?.(content);
   return;
  }
  if(!lesson.events.length)return;
  const params=new URLSearchParams({embedded:'',package:packageId});
  const focus=new URLSearchParams(location.search).get('focus');
  if(focus)params.set('focus',focus);
  const frame:SwimlaneFrame=Object.assign(document.createElement('iframe'),{
   title:name+' 스윔레인',src:'/swimlane-focus.html?'+params,allowFullscreen:true,
   lessonSwimlane:content,workspaceCategoryColors:colors.current,...edits.current,...pen.current
  });
  currentFrame.current=frame;
  host.current.append(frame);
 },[lesson,name,packageId]);
 return <section role="tabpanel" id="panel-swimlane" aria-labelledby="tab-swimlane">
  {!currentFrame.current&&(!lesson||!lesson.events.length)&&<p role="status">{lesson?'표시할 사건이 없어요.':'스윔레인을 불러오는 중입니다.'}</p>}<div ref={host}/>
 </section>;
}
