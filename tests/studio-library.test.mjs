import test from 'node:test';
import assert from 'node:assert/strict';
import {clearBrowserPackages,studioDraftDirectory} from '../assets/studio-library.js';
import {lessonSwimlane} from '../swimlane-data.js';

test('the studio lists new working packages, excluding legacy editions, published packages and revisions',()=>{
 const {drafts,published}=studioDraftDirectory([['패키지명','과목','패키지ID','작성상태','학교급'],
  ['초안','역사','draft:new:new','작성 중','중학교'],['냉전','역사','cold-war',''],
  ['개정안','','draft:old:old','작성 중'],['게시 완료','','old','게시됨'],
  ['이전 형식','','plain','작성 중'],[]]);
 assert.deepEqual([...drafts.values()],[{id:'new',name:'초안',school:'중학교',course:'역사'},{id:'plain',name:'이전 형식',school:'',course:''}]);
 assert.deepEqual([...published],['cold-war','old']);
});

test('retiring browser packages clears package drafts and editions while preserving lessons and actor records',()=>{
 const storage={'chronicle.package.v1.a':'old','chronicle.package-studio.mock.v1.b':'draft',
  'chronicle.studio.actor.a':'actor','chronicle.workspace.v1':'lesson',removeItem(key){delete this[key];}};
 clearBrowserPackages(storage);
 assert.deepEqual(Object.keys(storage).sort(),['chronicle.studio.actor.a','chronicle.workspace.v1','removeItem']);
});

test('a studio lesson keeps links between included actors and their detail records',()=>{
 const actors=['a','b','c'].map(id=>({id,title:id}));
 const sheet={events:[],categories:[],actors,detailActors:actors,relations:[
  {id:'ab',fromId:'a',toId:'b',fromType:'actor',toType:'actor'},
  {id:'bc',fromId:'b',toId:'c',fromType:'actor',toType:'actor'}]};
 const result=lessonSwimlane({events:[],topics:[],actors:[]},new Map(),sheet,new Set(['a','b']));
 assert.deepEqual(result.relations.map(r=>r.id),['ab']);
 assert.deepEqual(result.detailActors.map(a=>a.id),['a','b']);
});
