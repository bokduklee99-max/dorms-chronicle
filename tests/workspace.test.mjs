import test from 'node:test';
import assert from 'node:assert/strict';
import {koreanHistory} from '../src/korean-history.ts';
import {makeMetro} from '../src/metro-model.ts';
import {readWorkspaceGeography} from '../src/package-content.ts';
import {createLesson,deleteWorkspace,exploreHref,filterPackage,learningHref,loadWorkspaces,matchesWorkspaceScope,moveWorkspaceEventCategory,packageName,saveWorkspace,selectWorkspaceEvents,setWorkspaceCategoryColor,setupHref,undoWorkspaceEventCategory,views,workspaceDraft,workspaceSelectionChanges} from '../src/workspace-model.ts';

test('workspace geography links events to places and ancestors without matching sibling regions',()=>{
 const geography=readWorkspaceGeography(
  [['공간명','공간ID','공간유형','상위공간ID','시대별칭'],
   ['동아시아','east-asia','area'],['한반도','korea','area','east-asia'],['서울','seoul','point','korea','경성'],
   ['중국 관내','china','area','east-asia'],['상하이','shanghai','point','china']],
  [['공간ID','사건ID'],['seoul','E248'],['shanghai','E305'],['missing','E248'],['seoul','E248']]
 );
 assert.deepEqual([...geography.directByEvent.get('E248')],['seoul']);
 assert.deepEqual([...geography.byEvent.get('E248')],['seoul','korea','east-asia']);
 assert.deepEqual([...geography.byEvent.get('E305')],['shanghai','china','east-asia']);
 assert.equal(geography.spaces.find(space=>space.id==='seoul').alias,'경성');
});

test('workspace search uses intersecting event years and combines categories within and across groups',()=>{
 const koreanWar={year:1950,endDate:'1953-07-27',directTopicIds:['korean-war','militarization']};
 const cuba={year:1962,directTopicIds:['cuba-crisis','cold-war-start']};
 const arcs=[['korean-war','cuba-crisis']];
 assert.equal(matchesWorkspaceScope(koreanWar,1952,1952,arcs),true);
 assert.equal(matchesWorkspaceScope(cuba,1962,1962,arcs),true);
 assert.equal(matchesWorkspaceScope(cuba,1945,1950,[['cold-war-start']]),false);
 assert.equal(matchesWorkspaceScope(cuba,1962,1962,[...arcs,['militarization']]),false);
 assert.equal(matchesWorkspaceScope(koreanWar,1953,1952,arcs),false);
});

test('swimlane ink round-trips by room and ignores malformed strokes',()=>{
 const storage={getItem(key){return this[key]??null;},setItem(key,value){this[key]=value;}};
 const stroke=[{lane:'economy',points:[{time:Date.UTC(1910,0,1),y:0.3}]},
  {lane:'',points:[{time:Date.UTC(1910,0,2),y:0.9}]}];
 const room=createLesson({...workspaceDraft('필기 수업','japan'),swimlaneInk:[stroke,
  [{lane:'economy',points:[{time:0,y:2}]}],[null]]},storage);
 const other=createLesson(workspaceDraft('다른 수업','japan'),storage);
 const rooms=loadWorkspaces(storage);
 assert.deepEqual(rooms.find(item=>item.id===room.id).swimlaneInk,[stroke]);
 assert.equal(rooms.find(item=>item.id===other.id).swimlaneInk,undefined);
});

test('school and package configurations round-trip independently and edits retain the same ID',()=>{
 const storage={getItem(key){return this[key]??null;},setItem(key,value){this[key]=value;}};
 const draft=workspaceDraft('  테스트고  ','korean-history','radar');
 const korea=saveWorkspace({...draft,hiddenTopics:['opening'],hiddenEvents:['kr-april']},storage);
 const coldWar=saveWorkspace(workspaceDraft('테스트고'),storage);
 const other=saveWorkspace(workspaceDraft('다른 학교'),storage);
 assert.notEqual(korea.id,coldWar.id);
 assert.notEqual(coldWar.id,other.id);
 assert.equal(korea.school,'테스트고');
 const updated=saveWorkspace({...draft,view:'swimlane',hiddenEvents:korea.hiddenEvents},storage);
 assert.equal(updated.id,korea.id);
 assert.equal(loadWorkspaces(storage).length,3);
 assert.deepEqual(loadWorkspaces(storage).find(item=>item.id===korea.id),updated);
 assert.equal(new URL(exploreHref(updated),'https://example.com').searchParams.get('view'),'swimlane');
 assert.equal(new URL(exploreHref(updated),'https://example.com').searchParams.get('workspace'),updated.id);
 const learning=new URL(learningHref(updated),'https://example.com');
 assert.equal(learning.pathname,'/classroom.html');
 assert.equal(learning.searchParams.get('workspace'),updated.id);
 assert.equal(new URL(setupHref({workspace:updated.id}),'https://example.com').searchParams.get('workspace'),updated.id);
 assert.throws(()=>saveWorkspace(workspaceDraft('  '),storage));
});

test('creating two lessons for the same school and package keeps both and edits the intended lesson',()=>{
 const storage={getItem(key){return this[key]??null;},setItem(key,value){this[key]=value;}};
 const draft=workspaceDraft('테스트고','japan');
 const legacy=saveWorkspace(draft,storage);
 const first=createLesson(draft,storage);
 const second=createLesson(draft,storage);
 const edited=saveWorkspace({...first,view:'radar'},storage);
 assert.equal(edited.id,first.id);
 assert.deepEqual(new Set(loadWorkspaces(storage).map(w=>w.id)),new Set([legacy.id,first.id,second.id]));
 assert.equal(loadWorkspaces(storage).find(w=>w.id===second.id).view,'timeline');
 assert.equal(loadWorkspaces(storage).find(w=>w.id===first.id).view,'radar');
});

test('renaming and changing a legacy lesson package preserves its ID and the other lessons',()=>{
 const storage={getItem(key){return this[key]??null;},setItem(key,value){this[key]=value;}};
 const old=saveWorkspace(workspaceDraft('원래 학교','japan'),storage);
 const other=saveWorkspace(workspaceDraft('새 학교','cold-war'),storage);
 const moved=saveWorkspace({...old,school:'새 학교',packageId:'cold-war',hiddenEvents:['E012']},storage);
 assert.equal(moved.id,old.id);
 assert.deepEqual(loadWorkspaces(storage).find(item=>item.id===other.id),other);
 assert.equal(loadWorkspaces(storage).length,2);
 const readded=saveWorkspace(workspaceDraft('원래 학교','japan'),storage);
 assert.notEqual(readded.id,old.id);
 assert.deepEqual(loadWorkspaces(storage).find(item=>item.id===old.id),moved);
 assert.throws(()=>saveWorkspace({...old,id:'missing'},storage),/수업을 찾을 수 없습니다/);
});

test('the review names category changes and event swaps even if the event count is unchanged',()=>{
 const data={topics:[{topic_id:'a',name:'첫 분류'},{topic_id:'b',name:'둘째 분류'}],events:[
  {id:'old',legacyId:'old-legacy',date:'1910',title:'이전 사건',directTopicIds:['a']},
  {id:'next',date:'1919',title:'다음 사건',directTopicIds:['b']},
 ]};
 const before={...workspaceDraft(),hiddenEvents:['next']};
 const after={...workspaceDraft(),hiddenTopics:['a']};
 assert.deepEqual(workspaceSelectionChanges(data,before,data,after),{
  categories:{added:[],removed:['첫 분류']},
  events:{added:['1919 · 다음 사건'],removed:['1910 · 이전 사건']},
 });
});

test('removed views open the basic timeline with their saved IDs and event choices',()=>{
 const storage={getItem(key){return this[key]??null;},setItem(key,value){this[key]=value;}};
 for(const view of ['world','metro','strata','constellation','kanban','map-sync']){
  const saved={...workspaceDraft('테스트고'),id:view,view,hiddenTopics:['opening'],hiddenEvents:['E001'],includedEvents:['E002']};
  storage['chronicle.workspace.v1.lesson.'+view]=JSON.stringify(saved);
  const migrated=loadWorkspaces(storage).find(item=>item.id===saved.id);
  assert.deepEqual(migrated,{...saved,view:'timeline'});
  assert.equal(new URL(exploreHref(migrated),'https://example.com').searchParams.get('view'),'timeline');
  assert.equal(saveWorkspace(migrated,storage).id,saved.id);
  assert.equal(workspaceDraft('테스트고','cold-war',view).view,'timeline');
 }
});

test('saved workspaces use stable package IDs when the sheet names change',()=>{
 const storage={getItem(key){return this[key]??null;},setItem(key,value){this[key]=value;}};
 const saved=saveWorkspace(workspaceDraft('테스트고','new-package'),storage);
 assert.equal(loadWorkspaces(storage)[0].id,saved.id);
 assert.equal(packageName([{id:'new-package',name:'이름 변경'}],saved.packageId),'이름 변경');
});

test('hiding a category keeps events with another selected category and omits hidden events everywhere',()=>{
 const full=koreanHistory([]);
 const selected=filterPackage(full,['independence'],['kr-april']);
 assert.deepEqual(selected.events.find(event=>event.id==='kr-liberation').directTopicIds,['division']);
 assert.deepEqual(full.events.find(event=>event.id==='kr-liberation').directTopicIds,['independence','division']);
 assert.ok(!selected.events.some(event=>['kr-march-first','kr-april'].includes(event.id)));
 assert.ok(!selected.topics.some(topic=>topic.topic_id==='independence'));
 assert.ok(full.events.every(event=>event.bounds.start<=event.bounds.end&&event.source.startsWith('https://')));
 const metro=makeMetro(selected,{}).items;
 assert.deepEqual(new Set(metro.map(item=>item.eventId)),new Set(selected.events.map(event=>event.id)));
});

test('a saved selection still hides an event after its ID is shortened',()=>{
 const old=koreanHistory([]);
 const [record]=old.events;
 const updated={...old,events:[{...record,id:'E168',legacyId:record.id}]};
 assert.equal(filterPackage(updated,[],[record.id]).events.length,0);
});

test('undoing a room category move restores the exact earlier memberships for that event',()=>{
 const draft=workspaceDraft('연표 테스트');
 const event={id:'short',legacyId:'old',directTopicIds:['group','theme-a','theme-b']};
 const before=moveWorkspaceEventCategory(draft,event,[],'theme-c');
 const moved=moveWorkspaceEventCategory(before,event,['theme-a'],'theme-d');
 const other={added:['other-theme'],removed:[]};
 const latest={...moved,eventCategoryChanges:{...moved.eventCategoryChanges,other}};
 const previousEntry=before.eventCategoryChanges.old;
 const movedEntry=moved.eventCategoryChanges.old;
 assert.deepEqual(previousEntry,{added:['theme-c'],removed:[]});
 assert.deepEqual(undoWorkspaceEventCategory(latest,event,previousEntry,movedEntry).eventCategoryChanges,{old:previousEntry,other});
 assert.deepEqual(undoWorkspaceEventCategory(before,event,undefined,previousEntry).eventCategoryChanges,{});
 assert.throws(()=>undoWorkspaceEventCategory(before,event,previousEntry,movedEntry),/다시 변경/);
});

test('room category moves survive reloads and follow a shortened event ID',()=>{
 const storage={getItem(key){return this[key]??null;},setItem(key,value){this[key]=value;}};
 const full=koreanHistory([]);
 const event=full.events.find(item=>item.id==='kr-liberation');
 const original=createLesson(workspaceDraft('분류 편집 테스트','korean-history'),storage);
 const move=moveWorkspaceEventCategory(original,event,['independence'],'opening');
 saveWorkspace({...original,...move},storage);
 const saved=loadWorkspaces(storage)[0];
 const renamed={...event,id:'E001',legacyId:event.id};
 const current={...full,events:[renamed]};
 const visible=draft=>filterPackage(current,draft.hiddenTopics,draft.hiddenEvents,draft.includedEvents,draft.eventCategoryChanges).events;
 assert.deepEqual(visible(saved)[0].directTopicIds,['division','opening']);
 assert.deepEqual(event.directTopicIds,['independence','division']);
 const twice=moveWorkspaceEventCategory(saved,renamed,['division'],'independence');
 assert.deepEqual(visible(twice)[0].directTopicIds,['independence','opening']);
 const hidden=selectWorkspaceEvents({...saved,hiddenTopics:['division','opening']},[renamed],false);
 assert.deepEqual(visible(hidden),[]);
 assert.deepEqual(visible(selectWorkspaceEvents(hidden,[renamed],true))[0].directTopicIds,['division','opening']);
 const restored=moveWorkspaceEventCategory(saved,renamed,['opening'],'independence');
 assert.deepEqual(restored.eventCategoryChanges,{});
});

test('custom category colors are saved per room, reset independently and checked on load',()=>{
 const storage={getItem(key){return this[key]??null;},setItem(key,value){this[key]=value;}};
 const draft=workspaceDraft('색상 편집 테스트','japan');
 const room=createLesson(draft,storage);
 const other=createLesson(draft,storage);
 const first=setWorkspaceCategoryColor(room,'japan_economy','#A23D35');
 const second=setWorkspaceCategoryColor(first,'japan_domestic','#715286');
 const saved=saveWorkspace({...room,...second},storage);
 assert.deepEqual(loadWorkspaces(storage).find(item=>item.id===room.id).categoryColors,{
  japan_economy:'#a23d35',japan_domestic:'#715286'
 });
 assert.deepEqual(loadWorkspaces(storage).find(item=>item.id===other.id),other);
 const reset=setWorkspaceCategoryColor(saved,'japan_economy',null);
 assert.deepEqual(reset.categoryColors,{japan_domestic:'#715286'});
 assert.throws(()=>setWorkspaceCategoryColor(saved,'japan_economy','red;display:none'),/색상/);
 saveWorkspace({...room,...reset,categoryColors:{...reset.categoryColors,bad:'invalid'}},storage);
 assert.deepEqual(loadWorkspaces(storage).find(item=>item.id===room.id).categoryColors,reset.categoryColors);
});


test('deleting a configuration removes only its saved record and propagates storage failures',()=>{
 const storage={getItem(key){return this[key]??null;},setItem(key,value){this[key]=value;},removeItem(key){delete this[key];}};
 const cold=saveWorkspace(workspaceDraft('같은 학교'),storage);
 const korea=saveWorkspace(workspaceDraft('같은 학교','korean-history'),storage);
 storage['unrelated']=JSON.stringify(cold);
 storage['chronicle.workspace.v1.invalid']='broken';
 deleteWorkspace(cold.id,storage);
 assert.deepEqual(loadWorkspaces(storage),[korea]);
 assert.ok(storage.unrelated);
 assert.equal(storage['chronicle.workspace.v1.invalid'],'broken');
 deleteWorkspace('missing',storage);
 assert.deepEqual(loadWorkspaces(storage),[korea]);
 storage.removeItem=()=>{throw new Error('blocked');};
 assert.throws(()=>deleteWorkspace(korea.id,storage),/blocked/);
 assert.deepEqual(loadWorkspaces(storage),[korea]);
});


test('only swimlane, basic timeline and radar are available as starting views',()=>{
 const storage={getItem(key){return this[key]??null;},setItem(key,value){this[key]=value;}};
 assert.deepEqual(views.map(view=>view.id),['swimlane','timeline','radar']);
 for(const packageId of ['cold-war','korean-history']){
  assert.equal(workspaceDraft('새 학교',packageId,'swimlane').view,'swimlane');
  assert.equal(workspaceDraft('새 학교',packageId).view,'timeline');
  const timeline=saveWorkspace(workspaceDraft('새 학교',packageId,'timeline'),storage);
  const radar=saveWorkspace(workspaceDraft('기존 학교',packageId,'radar'),storage);
  assert.equal(loadWorkspaces(storage).find(item=>item.id===timeline.id).view,'timeline');
  assert.equal(loadWorkspaces(storage).find(item=>item.id===radar.id).view,'radar');
  assert.equal(new URL(exploreHref(timeline),'https://example.com').searchParams.get('view'),'timeline');
 }
});

test('bulk selection preserves unrelated exclusions and restores only requested legacy-category events',()=>{
 const data=koreanHistory([]);
 const event=data.events.find(item=>item.id==='kr-march-first');
 const records=[{...event,id:'E001',legacyId:event.id}];
 const full={...data,events:[...records,...data.events.filter(item=>item!==event)]};
 const draft={...workspaceDraft(),hiddenTopics:['independence'],hiddenEvents:[event.id,'kr-april']};
 const included=selectWorkspaceEvents(draft,records,true);
 const visible=state=>filterPackage(full,state.hiddenTopics,state.hiddenEvents,state.includedEvents);
 const before=visible(draft).events.map(item=>item.id);
 assert.deepEqual(new Set(visible(included).events.map(item=>item.id)),new Set([...before,'E001']));
 assert.ok(visible(included).topics.some(item=>item.topic_id==='independence'));
 const excluded=selectWorkspaceEvents(included,records,false);
 assert.deepEqual(visible(excluded).events.map(item=>item.id),before);
 assert.deepEqual(excluded.hiddenTopics,draft.hiddenTopics);
});
