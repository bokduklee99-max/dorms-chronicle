import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {draftTabs,mergeTabCsv,mergeFeedCsv,tabOf,withLocalDrafts,parseCsv} from '../assets/local-drafts.js';
import {personalDraftPrefix} from '../assets/studio-library.js';

const context=vm.createContext({URL,URLSearchParams,AbortSignal});
for(const name of ['sheets.js','sheet-config.js'])vm.runInContext(readFileSync(new URL('../'+name,import.meta.url),'utf8'),context);
const api=vm.runInContext('SheetData',context),config=vm.runInContext('SHEET_CONFIG',context);
const csv=rows=>rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n')+'\r\n';

const draft={
 id:'draft-1',name:'한국 현대사',school:'고등',subject:'한국사',description:'테스트',
 categories:[
  {id:'c-gov',name:'이승만 정부',kind:'period',start:'1948-08-15',end:'1960-04-26',body:'',spaceIds:[],members:[]},
  {id:'c-pol',name:'정치',kind:'theme',start:'',end:'',body:'',spaceIds:[],members:['e1','e2']},
  {id:'c-bad',name:'종류 오류',kind:'unknown',members:['e1']}
 ],
 events:[
  {id:'e1',title:'5·10 총선거',date:'1948-05-10',end:'',body:'첫 선거',type:'event',importance:'core',media:'',source:'',spaceIds:['geo_seoul','p-local'],participants:[{id:'actor_usa',role:'initiator'},{id:'a-local',role:''},{id:'actor_x',role:'엉뚱'}]},
  {id:'e2',title:'정부 수립',date:'1948-08',end:'',body:'',type:'event',importance:'',media:'',source:'',spaceIds:[],participants:[]},
  {id:'e3',title:'날짜 오류',date:'1948-13-40',end:'',body:'',type:'',importance:'',media:'',source:'',spaceIds:[],participants:[]},
  {id:'e4',title:'',date:'1950',end:'',body:'',type:'',importance:'',media:'',source:'',spaceIds:[],participants:[]},
  {id:'e5',title:'끝이 앞섬',date:'1950-05',end:'1950-01',body:'',type:'',importance:'',media:'',source:'',spaceIds:[],participants:[]}
 ],
 relations:[
  {id:'r1',fromType:'event',fromId:'e1',toType:'event',toId:'e2',kind:'cause',label:'계기',source:'2-1-4',body:''},
  {id:'r2',fromType:'event',fromId:'e1',toType:'event',toId:'e2',kind:'',label:'',source:'',body:''},
  {id:'r3',fromType:'event',fromId:'e1',toType:'event',toId:'없는사건',kind:'cause',label:'',source:'',body:''},
  {id:'r4',fromType:'event',fromId:'e1',toType:'category',toId:'c-pol',kind:'shift',label:'',source:'https://example.com/a',body:'설명'}
 ],
 actors:[{id:'actor_usa',title:'미국',kind:'state'},{id:'a-local',title:'새 단체',kind:'organization',local:true}],
 spaces:[],queue:[{kind:'actor',id:'a-local'},{kind:'place',id:'p-local'}]
};

test('초안에서 연표가 받아들이는 행만 만든다',()=>{
 const built=draftTabs(draft);
 assert.deepEqual(built.tabs.사건.map(r=>r.사건ID),['e1','e2']);
 assert.deepEqual(built.tabs.카테고리.map(r=>r.카테고리ID),['c-gov','c-pol']);
 assert.deepEqual(built.tabs.사건_카테고리,[{사건ID:'e1',카테고리ID:'c-pol'},{사건ID:'e2',카테고리ID:'c-pol'}]);
 assert.deepEqual(built.tabs.사건_주체,[{사건ID:'e1',주체ID:'actor_usa',역할:'initiator'},{사건ID:'e1',주체ID:'actor_x',역할:'related'}]);
 assert.deepEqual(built.tabs.사건_공간,[{사건ID:'e1',공간ID:'geo_seoul'}]);
 assert.deepEqual(built.tabs.관계.map(r=>r.관계ID),['r1','r4']);
 assert.equal(built.tabs.관계[0].출처,'');
 assert.equal(built.tabs.관계[1].출처,'https://example.com/a');
 assert.equal(built.tabs.패키지[0].패키지명,'한국 현대사 (내 초안)');
});

test('탭 CSV는 머리글 순서에 맞춰 덧붙이고 없는 열은 비운다',()=>{
 const base=csv([['사건ID','날짜','사건명','기타','작성상태'],['E1','1923','국공합작','x','']]);
 const merged=parseCsv(mergeTabCsv(base,draftTabs(draft).tabs.사건));
 assert.equal(merged.length,4);
 assert.deepEqual(merged[2],['e1','1948-05-10','5·10 총선거','','']);
 assert.equal(mergeTabCsv(base,[]),base);
});

test('요청 주소로 탭과 게시 피드를 알아본다',()=>{
 const id=config.id,gid=config.sheetIds.카테고리;
 assert.equal(tabOf(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`,config),'카테고리');
 assert.equal(tabOf(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?gid=${config.sheetIds.패키지}&headers=1&tqx=out:csv`,config),'패키지');
 assert.equal(tabOf(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?sheet=사건_주체&headers=1&tqx=out:csv`,config),'사건_주체');
 assert.equal(tabOf(config.feedUrl+'&v=1',config),'feed');
 assert.equal(tabOf('https://example.com/export?gid='+gid,config),'');
 assert.equal(tabOf(`https://docs.google.com/spreadsheets/d/다른시트/export?format=csv&gid=${gid}`,config),'');
});

// 가짜 시트: 탭마다 기본 사건 하나씩만 들어 있다.
const feedRows=[
 ['events','event_id','title','start_date','summary','images','country_names','category_names','date_qualifier','game_eligible','review_status','end_date','event_type','importance'],
 ['events','E1','국공합작','1923','','','미국','국공내전','','','','','event',''],
 ['countries','actor_id','name','actor_type','iso3'],['countries','actor_usa','미국','state','USA'],
 ['tenure_periods','tenure_id','country_id','name','office_title','start_date','end_date','notes','person_id','original_name','institution_id','office_id','role_type','office_start_date','office_end_date','office_order','office_status','date_qualifier','appointment_type','review_status','office_notes'],
 ['categories','topic_id','name','package_id'],['categories','t1','국공내전','cold-war'],
 ['event_countries','event_id','actor_id','role','actor_role'],['event_countries','E1','actor_usa','participant','participant']
];
const tabCsv={
 사건:csv([['사건ID','날짜','종료일','사건명','사건유형','내용','이미지','작성상태','중요도','출처'],['E1','1923','','국공합작','event','','','','','']]),
 사건_카테고리:csv([['사건ID','카테고리ID','작성상태'],['E1','t1','']]),
 사건_패키지:csv([['사건ID','패키지ID','작성상태'],['E1','cold-war','']]),
 패키지:csv([['패키지ID','패키지명','학교급','과목','설명','작성상태'],['cold-war','냉전','','','','']]),
 카테고리:csv([['카테고리ID','패키지ID','카테고리명','카테고리유형','시작일','종료일','설명','작성상태'],['t1','cold-war','국공내전','arc','','','','']]),
 관계:csv([['관계ID','패키지ID','출발유형','출발ID','도착유형','도착ID','관계유형','라벨','설명','출처','검토상태']])
};
function fakeSheet(storage){
 const request=async(input)=>{
  const tab=tabOf(input,config);
  const base=tab==='feed'?csv(feedRows):tabCsv[tab];
  return withLocalDrafts(input,new Response(base,{status:200}),{config,storage});
 };
 return request;
}
const storageWith=drafts=>Object.fromEntries([...drafts.map(d=>[personalDraftPrefix+d.id,JSON.stringify(d)]),['getItem',function(k){return this[k]??null;}]]);

test('초안을 끼운 시트를 실제 읽기·분류·build가 그대로 받아들인다',async()=>{
 const request=fakeSheet(storageWith([draft]));
 const feed=await (await request(config.feedUrl)).text();
 const tables=await api.readPublishedTables(api.parseCSV(feed),config,request);
 const scoped=api.scopePackage('draft-1',tables);
 const data=api.build(scoped);
 assert.deepEqual(Array.from(data.events,e=>e.title).sort(),['5·10 총선거','정부 수립']);
 assert.equal(data.events.find(e=>e.title==='5·10 총선거').importance,undefined);
 const old=api.build(api.scopePackage('cold-war',tables));
 assert.deepEqual(Array.from(old.events,e=>e.title),['국공합작']);
 const relations=api.readRelations(api.parseCSV(await (await request(`https://docs.google.com/spreadsheets/d/${config.id}/export?format=csv&gid=${config.sheetIds.관계}`)).text()),'draft-1',{events:data.events,actors:[],topics:scoped.categories.map(c=>({topic_id:c.topic_id}))});
 assert.deepEqual(Array.from(relations,r=>r.id),['r1','r4']);
 const packages=(await (await request(`https://docs.google.com/spreadsheets/d/${config.id}/gviz/tq?gid=${config.sheetIds.패키지}&headers=1&tqx=out:csv`)).text());
 assert.match(packages,/한국 현대사 \(내 초안\)/);
});

test('초안이 없으면 응답을 그대로 돌려준다',async()=>{
 const request=fakeSheet(storageWith([]));
 assert.equal(await (await request(config.feedUrl)).text(),csv(feedRows));
 const response=new Response('x',{status:200});
 assert.equal(await withLocalDrafts('https://docs.google.com/x',response,{config,storage:storageWith([draft])}),response);
});

test('초안이 망가져 있어도 원래 응답을 돌려준다',async()=>{
 const broken={getItem(){throw Error('저장소 오류');}};
 const response=new Response('a,b\r\n',{status:200});
 const url=`https://docs.google.com/spreadsheets/d/${config.id}/export?format=csv&gid=${config.sheetIds.사건}`;
 assert.equal(await withLocalDrafts(url,response,{config,storage:broken}),response);
 assert.equal(mergeFeedCsv('events,a\r\n',[]),'events,a\r\n');
});
