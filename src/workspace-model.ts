import type {HistoryData} from './metro-model';
import type {HistoryPackage} from './package-catalog';

export const views = [
 {id:'swimlane',name:'스윔레인'},
 {id:'timeline',name:'기본 연표'},
 {id:'radar',name:'시공간 레이더'},
] as const;
export type View = typeof views[number]['id'];
export type WorkspaceDraft = {
 school:string;
 packageId:string;
 view:View;
 hiddenTopics:string[];
 hiddenEvents:string[];
 includedEvents?:string[];
};
export type Workspace = WorkspaceDraft & {id:string};

export const packageName = (packages:HistoryPackage[],id:string) => packages.find(pkg=>pkg.id===id)?.name??id;
export const viewName = (id:View) => views.find(view=>view.id===id)!.name;

export function workspaceDraft(school='',packageId='cold-war',view?:string|null):WorkspaceDraft {
 return {school,packageId,view:views.find(item=>item.id===view)?.id??'timeline',hiddenTopics:[],hiddenEvents:[]};
}

export function packageTopics(data:HistoryData){
 const used = new Set(data.events.flatMap(event=>event.topicIds??event.directTopicIds));
 return data.topics.filter(topic=>used.has(topic.topic_id));
}

export function matchesWorkspaceScope(event:Pick<HistoryData['events'][number],'year'|'endDate'|'directTopicIds'>,startYear:number,endYear:number,categoryIds:string[][]) {
 const lastYear = event.endDate ? Number(event.endDate.slice(0,4)) : event.year;
 return startYear<=endYear&&event.year<=endYear&&lastYear>=startYear&&
  categoryIds.every(group=>group.some(id=>event.directTopicIds.includes(id)));
}

export function selectWorkspaceEvents(draft:WorkspaceDraft, events:HistoryData['events'], include:boolean):WorkspaceDraft {
 const hidden = new Set(draft.hiddenEvents);
 const included = new Set(draft.includedEvents);
 for(const event of events){
  hidden.delete(event.id);
  included.delete(event.id);
  if(event.legacyId){
   hidden.delete(event.legacyId);
   included.delete(event.legacyId);
  }
  const key = event.legacyId??event.id;
  if(!include)hidden.add(key);
  else if(event.directTopicIds.every(id=>draft.hiddenTopics.includes(id)))included.add(key);
 }
 return {...draft,hiddenEvents:[...hidden],includedEvents:[...included]};
}

export function filterLessonEvents<T extends Pick<HistoryData['events'][number],'id'|'legacyId'|'directTopicIds'|'topicIds'>>(records:T[],hiddenTopics:string[],hiddenEvents:string[],includedEvents:string[]=[]) {
 const excludedTopics = new Set(hiddenTopics);
 const excludedEvents = new Set(hiddenEvents);
 const included = new Set(includedEvents);
 return records.flatMap(event=>{
   if(excludedEvents.has(event.id)||(event.legacyId&&excludedEvents.has(event.legacyId)))return [];
   const directTopicIds = event.directTopicIds.filter(id=>!excludedTopics.has(id));
   if(!directTopicIds.length){
    if(!included.has(event.id)&&!(event.legacyId&&included.has(event.legacyId)))return [];
    return [event];
   }
   return [{...event,directTopicIds,...(event.topicIds?{topicIds:directTopicIds}:{})}];
 });
}

export function filterPackage(data:HistoryData,hiddenTopics:string[],hiddenEvents:string[],includedEvents:string[]=[]):HistoryData {
 const events=filterLessonEvents(data.events,hiddenTopics,hiddenEvents,includedEvents);
 const excludedTopics=new Set(hiddenTopics);
 const restoredTopics=new Set(events.flatMap(event=>event.directTopicIds));
 return {...data,events,topics:data.topics.filter(topic=>!excludedTopics.has(topic.topic_id)||restoredTopics.has(topic.topic_id))};
}

export function workspaceSelectionChanges(previousData:HistoryData,previous:WorkspaceDraft,nextData:HistoryData,next:WorkspaceDraft) {
 const categories=(data:HistoryData,draft:WorkspaceDraft)=>new Map(packageTopics(data)
  .filter(topic=>!draft.hiddenTopics.includes(topic.topic_id)).map(topic=>[topic.topic_id,topic.name]));
 const events=(data:HistoryData,draft:WorkspaceDraft)=>new Map(filterPackage(data,draft.hiddenTopics,draft.hiddenEvents,draft.includedEvents)
  .events.map(event=>[event.id,`${event.date} · ${event.title}`]));
 const compare=(before:Map<string,string>,after:Map<string,string>)=>({
  added:[...after].filter(([id])=>!before.has(id)).map(([,label])=>label),
  removed:[...before].filter(([id])=>!after.has(id)).map(([,label])=>label),
 });
 return {
  categories:compare(categories(previousData,previous),categories(nextData,next)),
  events:compare(events(previousData,previous),events(nextData,next)),
 };
}

const prefix = 'chronicle.workspace.v1.';
const strings = (value:unknown):value is string[] => Array.isArray(value)&&value.every(item=>typeof item==='string');
function readWorkspace(raw:string|null):Workspace|null {
 try {
  const saved = raw&&JSON.parse(raw);
  if(typeof saved?.id!=='string'||!saved.id||typeof saved.school!=='string'||!saved.school.trim()||
   typeof saved.packageId!=='string'||!saved.packageId.trim()||
   !strings(saved.hiddenTopics)||!strings(saved.hiddenEvents)||(saved.includedEvents!==undefined&&!strings(saved.includedEvents)))return null;
  const view=views.find(item=>item.id===saved.view)?.id;
  if(view)return saved;
  if(['world','metro','strata','constellation','kanban','map-sync'].includes(saved.view))return {...saved,view:'timeline'};
  return null;
 } catch { return null; }
}

export function loadWorkspaces(storage?:Storage):Workspace[] {
 try {
  const records = storage??localStorage;
  return Object.keys(records).filter(key=>key.startsWith(prefix)).flatMap(key=>{
   const workspace = readWorkspace(records.getItem(key));
   return workspace?[workspace]:[];
  }).sort((a,b)=>a.school.localeCompare(b.school,'ko')||a.packageId.localeCompare(b.packageId));
 } catch { return []; }
}

export function saveWorkspace(draft:WorkspaceDraft,storage=localStorage):Workspace {
 const school = draft.school.trim().normalize();
 if(!school)throw new Error('학교명이 필요합니다.');
 if('id' in draft){
  const id=draft.id;
  if(typeof id!=='string')throw new Error('편집할 수업을 찾을 수 없습니다.');
  const key=Object.keys(storage).find(entry=>entry.startsWith(prefix)&&readWorkspace(storage.getItem(entry))?.id===id);
  if(!key)throw new Error('편집할 수업을 찾을 수 없습니다.');
  const workspace={...draft,school,id};
  storage.setItem(key,JSON.stringify(workspace));
  return workspace;
 }
 const key = prefix+JSON.stringify([school.toLowerCase(),draft.packageId]);
 const previous=readWorkspace(storage.getItem(key));
 const occupied=previous&&(previous.school.toLowerCase()!==school.toLowerCase()||previous.packageId!==draft.packageId);
 const id = (!occupied&&previous?.id)||crypto.randomUUID();
 const workspace = {...draft,school,id};
 storage.setItem(occupied?prefix+'lesson.'+id:key,JSON.stringify(workspace));
 return workspace;
}

export function createLesson(draft:WorkspaceDraft,storage=localStorage):Workspace {
 const school=draft.school.trim().normalize();
 if(!school)throw new Error('학교명이 필요합니다.');
 const lesson={...draft,school,id:crypto.randomUUID()};
 storage.setItem(prefix+'lesson.'+lesson.id,JSON.stringify(lesson));
 return lesson;
}

export function deleteWorkspace(id:string,storage=localStorage):void {
 for(const key of Object.keys(storage)){
  if(key.startsWith(prefix)&&readWorkspace(storage.getItem(key))?.id===id)storage.removeItem(key);
 }
}

export function setupHref(options:{workspace?:string;view?:View}={}) {
 const query = new URLSearchParams({setup:'1'});
 if(options.workspace)query.set('workspace',options.workspace);
 if(options.view)query.set('view',options.view);
 return '/?'+query;
}

export function exploreHref(workspace:Workspace,event?:string){
 const query = new URLSearchParams({workspace:workspace.id,view:workspace.view});
 if(event)query.set('event',event);
 return '/metro/?'+query;
}

export function learningHref(workspace:Workspace){
 return '/classroom.html?'+new URLSearchParams({workspace:workspace.id});
}
