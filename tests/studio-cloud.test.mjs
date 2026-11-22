import test from 'node:test';
import assert from 'node:assert/strict';
import {sharedContent,mergeChanges,removeDraftItem} from '../assets/studio-cloud.js';
import {readFileSync} from 'node:fs';
import {gridState,gridContent} from '../assets/studio-grid-model.js';
import {studioCatalog} from '../assets/studio-catalog.js';
import {publicationRequests,createDraft,readDraft,writeDraft,publishDraft} from '../assets/studio-publish.js';

const id='12345678-1234-1234-1234-123456789abc';
const base={id,name:'한국사',school:'중학교',subject:'역사',description:'설명',categories:[{id:'c',name:'시기',kind:'period',members:['e'],spaceIds:['seoul']}],
 events:[{id:'e',title:'사건',date:'1919',participants:[{id:'a',role:''}],spaceIds:['seoul'],media:'https://example.org/photo'}],
 relations:[{id:'r',fromType:'actor',fromId:'a',toType:'event',toId:'e',kind:'action',label:'활동'}],actors:[{id:'a',title:'새 단체',kind:'organization',local:true}]};
const headers={패키지:'패키지ID 패키지명 학교급 과목 설명',사건:'사건ID 날짜 종료일 사건명 사건유형 내용 이미지',카테고리:'카테고리ID 패키지ID 카테고리명 카테고리유형 시작일 종료일 설명',
 주체:'주체ID 주체명 구분 소개',관계:'관계ID 패키지ID 출발유형 출발ID 도착유형 도착ID 관계유형 라벨',사건_패키지:'사건ID 패키지ID',사건_카테고리:'사건ID 카테고리ID',사건_주체:'사건ID 주체ID 역할',사건_공간:'사건ID 공간ID',카테고리_공간:'카테고리ID 공간ID',공간:'공간ID 공간명'};
const config={id:'public',packageSheetId:1,sheetIds:Object.fromEntries(Object.keys(headers).map((k,i)=>[k,i+1]))};
function blankTables(){
 const result=Object.fromEntries(Object.entries(headers).map(([k,v])=>[k,[k==='공간'?v.split(' '):[...v.split(' '),'작성상태']]]));
 result.공간.push(['seoul','서울']);return result;
}
test('independent edits merge by field and record ID; conflicting edits retain both choices',()=>{
 const a=structuredClone(base),b=structuredClone(base);
 a.events[0].date='1920';b.events[0].title='수정';b.events.push({id:'b',title:'추가',date:'1921'});
 assert.deepEqual(mergeChanges(base,a,b).events,[{...b.events[0],date:'1920'},b.events[1]]);
 a.events[0].title='내 제목';
 assert.throws(()=>mergeChanges(base,a,b),{conflict:true});
 assert.equal(mergeChanges(base,a,b,'패키지','local').events[0].title,'내 제목');
 assert.equal(mergeChanges(base,a,b,'패키지','remote').events[0].date,'1920');
 b.events=[];assert.throws(()=>mergeChanges(base,a,b),{conflict:true});
});
function mockSource(t,config,initial){
 let tables=structuredClone(initial),marks=[];
 const tabFor=id=>Object.keys(config.sheetIds).find(k=>config.sheetIds[k]===id);
 t.mock.method(globalThis,'fetch',async(url,opts)=>{
  assert.ok(url.includes('/public:'));
  if(url.includes(':getByDataFilter')){
   return Response.json({namedRanges:marks,sheets:Object.entries(tables).map(([tab,values])=>({
    properties:{sheetId:config.sheetIds[tab]},data:[{rowData:values.map(row=>({values:row.map(formattedValue=>({formattedValue}))}))}]}))});
  }
  const next=structuredClone(tables),names=structuredClone(marks);
  for(const r of JSON.parse(opts.body).requests){
   if(r.deleteNamedRange){
    const i=names.findIndex(n=>n.namedRangeId===r.deleteNamedRange.namedRangeId);
    if(i<0)return Response.json({},{status:400});names.splice(i,1);
   }else if(r.addNamedRange){
    const n=r.addNamedRange.namedRange;if(names.some(row=>row.name===n.name||row.namedRangeId===n.namedRangeId))return Response.json({},{status:400});names.push(n);
   }else if(r.appendCells){
    next[tabFor(r.appendCells.sheetId)].push(...r.appendCells.rows.map(row=>row.values.map(v=>v.userEnteredValue.stringValue)));
   }else{
    const u=r.updateCells,loc=u.start||u.range,rows=next[tabFor(loc.sheetId)];
    if(!u.rows)rows[loc.startRowIndex]=[];
    else u.rows[0].values.forEach((v,i)=>{rows[loc.rowIndex][loc.columnIndex+i]=v.userEnteredValue.stringValue;});
   }
  }
  tables=next;marks=names;return Response.json({});
 });
 return ()=>tables;
}
test('deleting a category or event clears its draft links and preserves the reusable source and other review items',async t=>{
 const tables=blankTables();tables.패키지[0].push('제작실 보완정보');
 tables.사건.push(['e','1919','','원본 사건']);tables.사건_패키지.push(['e','other']);
 const snapshot=mockSource(t,config,tables);
 const original=sharedContent({...base,
  categories:[...base.categories,{id:'keep',name:'남는 주제',kind:'theme',members:['e']}],
  relations:[...base.relations,{id:'cr',fromType:'category',fromId:'c',toType:'event',toId:'e',kind:'action'}],
  queue:[{id:'c',kind:'category',pkg:id,origin:'e',originKind:'event',done:true},{id:'a',kind:'actor',pkg:id,origin:'e',originKind:'event',done:false}]},base.actors);
 await createDraft('token',config,original);
 let draft=await readDraft('token',config,id);
 const categoryRemoved=removeDraftItem(draft.content,'category','c');
 assert.deepEqual(categoryRemoved.events,original.events);
 assert.deepEqual(categoryRemoved.relations.map(r=>r.id),['r']);
 assert.deepEqual(categoryRemoved.queue.map(r=>r.id),['a']);
 await writeDraft('token',config,draft,categoryRemoved);
 draft=await readDraft('token',config,id);
 assert.deepEqual(draft.content,categoryRemoved);
 const eventRemoved=removeDraftItem(draft.content,'event','e');
 assert.deepEqual(eventRemoved.categories[0].members,[]);
 assert.deepEqual(eventRemoved.relations,[]);assert.deepEqual(eventRemoved.queue,[{...original.queue[1],origin:id,originKind:'package'}]);
 await writeDraft('token',config,draft,eventRemoved);
 assert.deepEqual((await readDraft('token',config,id)).content,eventRemoved);
 assert.deepEqual(snapshot().사건[1],tables.사건[1]);
 assert.deepEqual(snapshot().사건_패키지[1],['e','other']);
});
test('a concurrent link to a deleted event cannot survive the three-way merge',()=>{
 const local=removeDraftItem(base,'event','e'),remote=structuredClone(base);
 remote.categories.push({id:'new',name:'새 주제',kind:'theme',members:['e']});
 remote.relations.push({id:'new-edge',fromType:'event',fromId:'e',toType:'category',toId:'new',kind:'cause'});
 for(const [first,second] of [[local,remote],[remote,local]]){
  const merged=mergeChanges(base,first,second);
  assert.deepEqual(merged.events,[]);assert.deepEqual(merged.relations,[]);
  assert.deepEqual(merged.categories.map(c=>[c.id,c.members]),[['c',[]],['new',[]]]);
 }
});
test('the source sheet stages all records, publishes in place, and closes the draft after publication',async t=>{
 const snapshot=mockSource(t,config,blankTables());
 const original=sharedContent(base,base.actors);
 await createDraft('token',config,original);
 for(const [tab,rows] of Object.entries(snapshot()))if(tab!=='공간')assert.equal(rows[1].at(-1),'작성 중',tab);
 const first=await readDraft('token',config,id);
 assert.deepEqual(first.content,original);
 const edited={...original,description:'서로 다른 교사의 수정'};
 await writeDraft('token',config,first,edited);
 await assert.rejects(writeDraft('token',config,first,original),{status:400});
 const latest=await readDraft('token',config,id);
 assert.deepEqual(latest.content,edited);
 await assert.rejects(publishDraft('token',config,first),/변경/);
 const release=await publishDraft('token',config,latest);
 for(const [tab,rows] of Object.entries(snapshot()))if(tab!=='공간'){assert.equal(rows.length,2);assert.equal(rows[1].at(-1),'게시됨',tab);}
 const live=await readDraft('token',config,id);
 assert.deepEqual(live.content,release.content);
 assert.equal((await publishDraft('token',config,latest)).version,release.version);
 assert.equal((await publishDraft('token',config,live)).version,release.version);
 const revised={...live.content,name:'개정 중'};
 await assert.rejects(writeDraft('token',config,live,revised),{published:true});
 await assert.rejects(createDraft('token',config,revised),{published:true});
 await assert.rejects(publishDraft('token',config,{...live,content:revised}),{published:true});
 await assert.rejects(writeDraft('token',config,latest,revised),{status:400});
 assert.equal(snapshot().패키지.length,2);assert.equal(snapshot().패키지[1][1],'한국사');
});

test('republishing preserves shared actors, unrelated packages and external event links',()=>{
 const tables=blankTables(),created=publicationRequests(base,config,tables,false);
 for(const {appendCells:r} of created){
  const [tab]=Object.entries(config.sheetIds).find(([,n])=>n===r.sheetId);
  for(const row of r.rows)tables[tab].push(row.values.map(c=>c.userEnteredValue.stringValue));
 }
 tables.패키지.push(['other','다른 패키지']);tables.사건_패키지.push(['e','other']);
 assert.deepEqual(publicationRequests(base,config,tables,true),[]);
 const edited=structuredClone(base);edited.events[0].title='새 제목';
 assert.throws(()=>publicationRequests(edited,config,tables,true),/다른 패키지/);
 const removed=publicationRequests({...base,events:[],categories:[],actors:[],relations:[]},config,tables,true);
 const changed=removed.map(r=>r.updateCells.range.sheetId);
 assert.ok(changed.includes(config.sheetIds.사건_패키지));
 assert.ok(!changed.includes(config.sheetIds.사건)&&!changed.includes(config.sheetIds.사건_주체)&&!changed.includes(config.sheetIds.주체));
 assert.throws(()=>publicationRequests({...base,actors:[]},config,tables,true),/연결/);
});

test('an existing event source column keeps its values through drafting and publication',async t=>{
 const tables=blankTables();
 tables.사건[0].push('출처');
 const snapshot=mockSource(t,config,tables);
 const draft=sharedContent(base,base.actors);
 draft.events[0].source='기존 사건 출처';
 await createDraft('token',config,draft);
 const staged=await readDraft('token',config,id);
 assert.equal(staged.content.events[0].source,draft.events[0].source);
 await publishDraft('token',config,staged);
 assert.deepEqual(snapshot().사건[0],tables.사건[0]);
 assert.equal(snapshot().사건[1].at(-1),draft.events[0].source);
});

test('the grid builds a new shared package with catalog records and leaves existing teaching packages intact',async t=>{
 const tables=JSON.parse(readFileSync(new URL('../assets/studio-catalog.json',import.meta.url),'utf8'));
 const cfg={...config,sheetIds:Object.fromEntries(Object.keys(tables).map((k,i)=>[k,i+1])),packageSheetId:1};
 const snapshot=mockSource(t,cfg,tables);
 const library=studioCatalog(tables),japan=library.open('japan'),other=library.open('cold-war');
 const source=japan.events[0];
 const original=sharedContent({...japan,id,name:'새 공동 초안',events:[{...source,id:'new-event'}],
  categories:[{id:'new-category',name:'시기',kind:'period',members:[]}],
  relations:[{id:'initial-relation',fromType:'event',fromId:'new-event',toType:'category',toId:'new-category',kind:'action'}]},
  japan.actors.filter(a=>source.participants.some(p=>p.id===a.id)));
 await createDraft('token',cfg,original);
 const current=await readDraft('token',cfg,original.id);
 assert.deepEqual(current.content,original);
 const grid=gridState(original);
 assert.deepEqual(gridContent(grid,library.catalog),original);
 const pkg=grid.packages[0],event=pkg.ids[0],category=pkg.categories.find(c=>!pkg.links[event]?.category.includes(c.id));
 (pkg.links[event]??={}).category??=[];
 pkg.links[event].category.push(category.id);
 const modified=grid.over.event[event];modified.importance='core';modified.source='교과서 35쪽';
 modified.actor.push({id:'test-group',role:'initiator'});modified.place.push('test-place');
 grid.over.place['test-place']={id:'test-place',name:'테스트 공간',kind:'point',parent:'',alias:'',body:'검토한 장소'};
 grid.over.actor['test-group']={id:'test-group',name:'테스트 단체',kind:'organization',original:'단체 원어명',source:'교과서 35쪽',body:'주체 설명',place:['test-place']};
 for(const [kind,id] of [['place','test-place'],['actor','test-group']])grid.queue.push({id,kind,pkg:pkg.id,origin:event,originKind:'event',done:true});
 const actor=Object.keys(library.catalog.actor).find(id=>!original.actors.some(a=>a.id===id));
 const removed=pkg.relations.pop().id;
 pkg.relations.push({id:'test-relation',fromType:'actor',fromId:actor,toType:'category',toId:category.id,kind:'action',label:'자료 발행',source:'교과서 36쪽'});
 const edited=gridContent(grid,library.catalog);
 assert.ok(edited.actors.some(a=>a.id===actor));
 const staged=await writeDraft('token',cfg,current,edited);
 assert.ok(!snapshot().사건[0].includes('출처'));
 assert.deepEqual((await readDraft('token',cfg,pkg.id)).content,edited);
 assert.ok(!studioCatalog(snapshot()).editions.some(p=>p.id===pkg.id));
 assert.equal(snapshot().공간.some(r=>r[0]==='test-place'),false);
 const release=await publishDraft('token',cfg,staged);
 assert.deepEqual((await readDraft('token',cfg,pkg.id)).content,release.content);
 const catalog=studioCatalog(snapshot());
 assert.ok(!snapshot().사건[0].includes('출처'));
 assert.deepEqual(catalog.open('japan'),japan);
 assert.deepEqual(catalog.open('cold-war'),other);
 assert.deepEqual(catalog.open(pkg.id).relations.find(r=>r.id==='test-relation'),pkg.relations.at(-1));
 assert.ok(!catalog.open(pkg.id).relations.some(r=>r.id===removed));
 assert.equal(catalog.catalog.actor['test-group'].source,'교과서 35쪽');
 assert.deepEqual(catalog.catalog.actor['test-group'].place,['test-place']);
 assert.equal(catalog.catalog.place['test-place'].body,'검토한 장소');
 assert.equal(catalog.open(pkg.id).categories.find(c=>c.id===category.id).members.includes(event),true);
});
