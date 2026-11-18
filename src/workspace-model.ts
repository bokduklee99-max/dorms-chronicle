import type {HistoryData} from './metro-model';

export const packages = [
 {id:'cold-war',name:'냉전'},
 {id:'korean-history',name:'한국 근현대사'},
] as const;
export const views = [
 {id:'timeline',name:'기본 연표'},
 {id:'metro',name:'Metro 노선도'},
 {id:'strata',name:'역사의 지층'},
 {id:'world',name:'냉전 세계지도'},
 {id:'constellation',name:'Constellation'},
] as const;
type PackageId = typeof packages[number]['id'];
export type View = typeof views[number]['id'];
export type WorkspaceDraft = {
 school:string;
 packageId:PackageId;
 view:View;
 hiddenTopics:string[];
 hiddenEvents:string[];
};
export type Workspace = WorkspaceDraft & {id:string};

export const packageViews = (id:PackageId) => views.filter(view=>id==='cold-war'||view.id!=='world');
export const packageName = (id:PackageId) => packages.find(pkg=>pkg.id===id)!.name;
export const viewName = (id:View) => views.find(view=>view.id===id)!.name;

export function workspaceDraft(school='',packageId:PackageId='cold-war',view?:string|null):WorkspaceDraft {
 return {school,packageId,view:packageViews(packageId).find(item=>item.id===view)?.id??'timeline',hiddenTopics:[],hiddenEvents:[]};
}

export function packageTopics(data:HistoryData){
 const used = new Set(data.events.flatMap(event=>event.directTopicIds));
 return data.topics.filter(topic=>used.has(topic.topic_id));
}

export function filterPackage(data:HistoryData,hiddenTopics:string[],hiddenEvents:string[]):HistoryData {
 const excludedTopics = new Set(hiddenTopics);
 const excludedEvents = new Set(hiddenEvents);
 return {
  ...data,
  topics:data.topics.filter(topic=>!excludedTopics.has(topic.topic_id)),
  events:data.events.flatMap(event=>{
   if(excludedEvents.has(event.id))return [];
   const directTopicIds = event.directTopicIds.filter(id=>!excludedTopics.has(id));
   return directTopicIds.length ? [{...event,directTopicIds}] : [];
  }),
 };
}

const prefix = 'chronicle.workspace.v1.';
const strings = (value:unknown):value is string[] => Array.isArray(value)&&value.every(item=>typeof item==='string');
function readWorkspace(raw:string|null):Workspace|null {
 try {
  const saved = raw&&JSON.parse(raw);
  if(typeof saved?.id!=='string'||!saved.id||typeof saved.school!=='string'||!saved.school.trim()||
   !packages.some(pkg=>pkg.id===saved.packageId)||!packageViews(saved.packageId).some(view=>view.id===saved.view)||
   !strings(saved.hiddenTopics)||!strings(saved.hiddenEvents))return null;
  return saved;
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
 const key = prefix+JSON.stringify([school.toLowerCase(),draft.packageId]);
 const id = readWorkspace(storage.getItem(key))?.id??crypto.randomUUID();
 const workspace = {...draft,school,id};
 storage.setItem(key,JSON.stringify(workspace));
 return workspace;
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
