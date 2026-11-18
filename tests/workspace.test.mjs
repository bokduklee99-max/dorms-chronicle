import test from 'node:test';
import assert from 'node:assert/strict';
import {koreanHistory} from '../src/korean-history.ts';
import {makeMetro} from '../src/metro-model.ts';
import {deleteWorkspace,exploreHref,filterPackage,loadWorkspaces,packageViews,saveWorkspace,setupHref,workspaceDraft} from '../src/workspace-model.ts';

test('school and package configurations round-trip independently and edits retain the same ID',()=>{
 const storage={getItem(key){return this[key]??null;},setItem(key,value){this[key]=value;}};
 const draft=workspaceDraft('  테스트고  ','korean-history','constellation');
 const korea=saveWorkspace({...draft,hiddenTopics:['opening'],hiddenEvents:['kr-april']},storage);
 const coldWar=saveWorkspace(workspaceDraft('테스트고'),storage);
 const other=saveWorkspace(workspaceDraft('다른 학교'),storage);
 assert.notEqual(korea.id,coldWar.id);
 assert.notEqual(coldWar.id,other.id);
 assert.equal(korea.school,'테스트고');
 const updated=saveWorkspace({...draft,view:'strata',hiddenEvents:korea.hiddenEvents},storage);
 assert.equal(updated.id,korea.id);
 assert.equal(loadWorkspaces(storage).length,3);
 assert.deepEqual(loadWorkspaces(storage).find(item=>item.id===korea.id),updated);
 assert.equal(new URL(exploreHref(updated),'https://example.com').searchParams.get('view'),'strata');
 assert.equal(new URL(setupHref({workspace:updated.id}),'https://example.com').searchParams.get('workspace'),updated.id);
 assert.throws(()=>saveWorkspace(workspaceDraft('  '),storage));
 assert.equal(workspaceDraft('테스트고','korean-history','world').view,'timeline');
 assert.ok(packageViews('cold-war').some(item=>item.id==='world'));
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


test('basic timeline is first for both packages while saved Metro choices stay unchanged',()=>{
 const storage={getItem(key){return this[key]??null;},setItem(key,value){this[key]=value;}};
 for(const packageId of ['cold-war','korean-history']){
  assert.equal(packageViews(packageId)[0].id,'timeline');
  assert.equal(workspaceDraft('새 학교',packageId).view,'timeline');
  const timeline=saveWorkspace(workspaceDraft('새 학교',packageId,'timeline'),storage);
  const metro=saveWorkspace(workspaceDraft('기존 학교',packageId,'metro'),storage);
  assert.equal(loadWorkspaces(storage).find(item=>item.id===timeline.id).view,'timeline');
  assert.equal(loadWorkspaces(storage).find(item=>item.id===metro.id).view,'metro');
  assert.equal(new URL(exploreHref(timeline),'https://example.com').searchParams.get('view'),'timeline');
 }
});
