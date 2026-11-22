import {clearBrowserPackages} from '../assets/studio-library.js';
import {readLessonSheet} from '../assets/local-sheet-copy.js';
import {matchSwimlaneEvents} from '../swimlane-data.js';
import {readEventImportance,swimlaneSnapshot,type ImportanceRow} from './event-importance';
import {fetchPackages,type PackageSheet} from './package-catalog';
import {fetchEventTables,type SheetParser,type SheetTables} from './package-content';
import {coldWarData} from './metro-model';
import {koreanHistory} from './korean-history';
import {exploreHref,filterLessonEvents,loadWorkspaces,setupHref,workspaceDraft,type WorkspaceDraft} from './workspace-model';
import actorDirectory from '../assets/package-studio-actors.json';
import type {QuizPerson,QuizRecord} from './record-quiz';
export {mountExampleActivities} from './ExampleActivities';
export {mountRecordQuiz} from './RecordQuiz';
export {parsePlan,quizEventIds} from './authored-quiz';

async function japanSnapshot(item:WorkspaceDraft,dateRange:SheetParser['dateRange']):Promise<QuizRecord[]>{
 type Row=ImportanceRow&{end?:string;body:string;period?:string;periodNames?:string[];arcs:string[];themes:string[];actors:{name:string}[];place:string;media:string;approximate?:boolean};
 const sheet=await swimlaneSnapshot<Row>('japan');
 if(!sheet)throw Error('저장된 수업 자료를 읽지 못했습니다.');
 const personNames=new Set(actorDirectory.filter(row=>row.구분==='person').map(row=>row.주체명));
 const peopleOf=(event:Row)=>event.actors.filter(a=>personNames.has(a.name))
  .map(a=>({label:'관련 인물',name:a.name,year:Number(event.date.slice(0,4))}));
 const personPool=sheet.events.flatMap(peopleOf);
 const events=sheet.events.map(event=>{
  const labels:Record<string,string[]>={period:event.periodNames??[event.period||''],arc:event.arcs,theme:event.themes};
  return {...event,directTopicIds:sheet.categories.filter(c=>labels[c.kind]?.includes(c.name)).map(c=>c.id)};
 });
 return filterLessonEvents(events,item.hiddenTopics,item.hiddenEvents,item.includedEvents).map(event=>{
  const categories=sheet.categories.filter(c=>event.directTopicIds.includes(c.id));
  let startBounds:QuizRecord['startBounds'];
  try{startBounds=dateRange(event.date);}catch{/* An undated event can still be used in a blank quiz. */}
  return {...event,startBounds,categoryIds:categories.map(c=>c.id),categories:categories.map(c=>c.name),categoryTypes:categories.map(c=>c.kind),
   people:peopleOf(event),personPool,
   body:event.body||'',actors:event.actors.map(a=>a.name),image:event.media?.split(/\s+/)[0]};
 });
}

export function classroomWorkspace(id:string,sharedPackage?:string,includedEvents:string[]=[]){
 const item=sharedPackage?{...workspaceDraft('',sharedPackage),id:'',includedEvents}:loadWorkspaces().find(workspace=>workspace.id===id);
 if(!item)return null;
 return {
  packageId:item.packageId,school:item.school,timelineHref:exploreHref(item),setupHref:setupHref(),
  async packageName(config:PackageSheet,parseCSV:SheetParser['parseCSV']){
   try{clearBrowserPackages();}catch{}
   return (await fetchPackages(config,parseCSV)).find(pkg=>pkg.id===item.packageId)?.name;
  },
  async records(config:Parameters<typeof fetchEventTables>[0],parser:SheetParser,snapshot:SheetTables):Promise<QuizRecord[]>{
   let tables:SheetTables;
   try{tables=await fetchEventTables(config,parser);}
   catch(error){
    if(item.packageId==='japan')return japanSnapshot(item,parser.dateRange);
    if(!['cold-war','korean-history'].includes(item.packageId))throw error;
    tables=snapshot;
   }
   const scoped=parser.scopePackage(item.packageId,tables);
   const sample=item.packageId==='korean-history'&&!tables.categories.some(row=>Object.hasOwn(row,'package_id'));
   if(!sample&&!scoped.events.length)return [];
   let data=sample?koreanHistory([]):parser.build(scoped);
   if(item.packageId==='cold-war')data=coldWarData(data);
   let saved:ReturnType<typeof swimlaneSnapshot>|undefined;
   const savedMetadata=()=>saved??=swimlaneSnapshot(item.packageId).catch(()=>null);
   const savedImportance=async()=>(await savedMetadata())?.events??[];
   const importanceRows=sharedPackage||sample?[]:tables===snapshot?savedImportance():
    readEventImportance(config,parser).catch(savedImportance);
   const categoryTypes=new Map(scoped.categories.map(row=>[row.topic_id,row.category_type||'']));
   if(!sample&&!scoped.categories.some(row=>Object.hasOwn(row,'category_type'))){
    try{
     if(tables===snapshot&&item.packageId==='cold-war'){
      for(const c of (await savedMetadata())?.categories??[])categoryTypes.set(c.id,c.kind);
     }else{
      const rows=await parser.sheetRecords(config,'카테고리',['패키지ID','카테고리ID','카테고리유형'],readLessonSheet);
      for(const row of rows)if(row.패키지ID===item.packageId)categoryTypes.set(row.카테고리ID,row.카테고리유형);
     }
    }catch{/* Categories without source metadata stay selectable under 유형 미지정. */}
   }
   const topics=new Map(data.topics.map(topic=>[topic.topic_id,topic.name]));
   const actors=new Map(data.actors.map(actor=>[actor.actor_id,actor]));
   const leaders=data.tenures.flatMap(tenure=>{
    const country=actors.get(tenure.actorId)?.name;
    if(tenure.status!=='verified'||!country||!tenure.title||!tenure.person)return [];
    const office=tenure.title.includes(country)?tenure.title:country+' '+tenure.title;
    return [{tenure,person:{label:'당시 '+office,name:tenure.person,year:Number(tenure.startDate.slice(0,4))}}];
   });
   const personPool=[...leaders.map(({person})=>person),...data.actors.filter(actor=>actor.actor_type==='person')
    .map(actor=>({label:'관련 인물',name:actor.name}))];
   const matchEvent=matchSwimlaneEvents(data.events,await importanceRows);
   return filterLessonEvents(data.events,item.hiddenTopics,item.hiddenEvents,item.includedEvents).map(event=>{
    const categoryIds=event.directTopicIds.filter(id=>topics.has(id));
    const linked=event.actorIds.flatMap(id=>actors.get(id)??[]);
    const people:QuizPerson[]=linked.filter(actor=>actor.actor_type==='person').map(actor=>({label:'관련 인물',name:actor.name}));
    if(event.dateQualifier!=='approximate')for(const {tenure,person} of leaders){
     if(event.actorIds.includes(tenure.actorId)&&tenure.start.end<=event.bounds.start&&
      (!tenure.end||tenure.end.start>=event.bounds.end))people.push(person);
    }
    return {
    id:event.id,title:event.title,date:event.date,startBounds:event.bounds,end:event.endDate,body:event.description||'',place:event.place,importance:matchEvent(event)?.importance,
    categoryIds,categories:categoryIds.map(id=>topics.get(id)!),categoryTypes:categoryIds.map(id=>categoryTypes.get(id)||''),actors:linked.map(actor=>actor.name),people,personPool,
    image:event.media[0]?.url,approximate:event.dateQualifier==='approximate',
    };
   });
  },
 };
}

export const exampleJapanRecords=(parser:SheetParser)=>japanSnapshot(workspaceDraft('','japan'),parser.dateRange);
