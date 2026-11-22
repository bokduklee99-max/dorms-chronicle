import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {dashboardTables,historyDataTables} from '../src/data-explorer-model.ts';
import {koreanHistory} from '../src/korean-history.ts';
import {fallbackPackages as packages,parseCategoryMetadata,parsePackages} from '../src/package-catalog.ts';
import {fetchEventTables} from '../src/package-content.ts';
import {createRelation,eventActorLinks,eventPackageLinks,filterRelationDirections,findRelationEndpoint,geographyLinks,groupRelationsByDirection,parseDashboardCSV,relationPackages,relationTypes,updateCategoryEvents} from '../src/data-dashboard-source.js';
import {saveToGoogleRelationSheet} from '../src/google-relation-sheet.js';

test('category metadata follows sheet headers and preserves missing types and dates',()=>{
 const rows=[
  ['카테고리ID','카테고리명','패키지ID','카테고리유형','종료일','시작일'],
  ['military','무단 통치','japan','period','1919','1910'],
  ['economy','경제 정책','japan','theme','',''],
  ['untyped','기타','cold-war'],
 ];
 const categories=parseCategoryMetadata(rows);
 assert.deepEqual(categories.get('military'),{packageId:'japan',type:'period',startDate:'1910',endDate:'1919'});
 assert.equal(categories.get('economy').type,'theme');
 assert.deepEqual(categories.get('untyped'),{packageId:'cold-war',type:'',startDate:'',endDate:''});
 assert.throws(()=>parseCategoryMetadata([...rows,rows[1]]),/중복/);
 const linked=parseCategoryMetadata(rows,[['공간ID','카테고리ID'],['geo_seoul','military'],['geo_seoul','military'],['geo_cuba','missing']]);
 assert.deepEqual(linked.get('military').spaceIds,['geo_seoul']);
});

const context = vm.createContext({URL,URLSearchParams,AbortSignal});
vm.runInContext(readFileSync(new URL('../sheet-snapshot.js',import.meta.url),'utf8'),context);
vm.runInContext(readFileSync(new URL('../sheets.js',import.meta.url),'utf8'),context);
const sheet = context.SHEET_SNAPSHOT.tables;
test('renamed independence-movement arcs retain their original category links',()=>{
 const events=[{사건ID:'E187',사건군:'만주·연해주, 중국 관내의 독립운동, 연합군 협력'}];
 const categories=[
  {topic_id:'japan_manchuria',name:'만주·연해주의 독립운동',category_type:'arc'},
  {topic_id:'japan_china',name:'중국 관내의 독립운동',category_type:'arc'},
  {topic_id:'japan_allied',name:'연합군과의 협력',category_type:'arc'}
 ];
 const ids=Array.from(context.SheetData.categoryLinks(events,categories),row=>row.topic_id);
 assert.deepEqual(ids,['japan_manchuria','japan_china','japan_allied']);
 assert.throws(()=>context.SheetData.categoryLinks([{사건ID:'E187',사건군:'없는 이름'}],categories),/카테고리/);
});

test('geography follows explicit parent, event and map shape references',()=>{
 const result=geographyLinks({
  공간:[{공간ID:'area'},{공간ID:'city',상위공간ID:'area',지도참조키:'shape_city'},{공간ID:'orphan',상위공간ID:'unknown'}],
  사건:[{사건ID:'E1'}],
  사건_공간:[{사건ID:'E1',공간ID:'city'},{사건ID:'E1',공간ID:'city'},{사건ID:'missing',공간ID:'city'}],
  지도도형:[{지도참조키:'shape_city'}]
 });
 assert.deepEqual(result.roots,['area','orphan']);
 assert.deepEqual(result.spaces.get('area').children,['city']);
 assert.deepEqual([...result.spaces.get('city').events],['E1']);
 assert.deepEqual([...result.shapes],['shape_city']);
});
test('relation matrix keeps direction and combines actor subtypes in the same cell',()=>{
 const records=[
  {출발유형:'event',도착유형:' Event '},
  {출발유형:'actor',도착유형:'event'},
  {출발유형:'organization',도착유형:'event'},
  {출발유형:'event',도착유형:'actor'},
  {출발유형:'category',도착유형:'event'},
  {출발유형:'event'}
 ].map((row,origIdx)=>({row,origIdx}));
 const groups=groupRelationsByDirection(records);
 assert.deepEqual(groups.get('사건→사건'),[records[0]]);
 assert.deepEqual(groups.get('주체→사건'),records.slice(1,3));
 assert.deepEqual(groups.get('사건→주체'),[records[3]]);
 assert.deepEqual(groups.get('카테고리→사건'),[records[4]]);
 assert.deepEqual(groups.get('사건→기타'),[records[5]]);
 assert.deepEqual([...filterRelationDirections(groups,'주체').keys()],['주체→사건']);
 assert.deepEqual([...filterRelationDirections(groups,'','사건').keys()],['사건→사건','주체→사건','카테고리→사건']);
 assert.deepEqual([...filterRelationDirections(groups,'카테고리','사건').values()],[ [records[4]] ]);
 assert.equal(filterRelationDirections(groups,'주체','카테고리').size,0);
 assert.deepEqual(filterRelationDirections(groups),groups);
});
test('a relation endpoint resolves to the record of its declared type',()=>{
 const event={사건ID:'shared',사건명:'3·1 운동'};
 const actor={주체ID:'shared',주체명:'의열단'};
 const records={사건:[event],주체:[actor]};
 assert.deepEqual(findRelationEndpoint(records,'event','shared'),{tab:'사건',row:event});
 assert.deepEqual(findRelationEndpoint(records,'actor','shared'),{tab:'주체',row:actor});
 assert.deepEqual(findRelationEndpoint(records,'organization','missing'),{tab:'주체',row:undefined});
});
test('event actor edits preserve other events and reject invalid or duplicate links',()=>{
 const data={
  주체:[{주체ID:'first'}],
  사건_주체:[{사건ID:'second',주체ID:'first',역할:'related'}]
 };
 const actor={사건ID:'first',주체ID:'first',역할:'participant'};
 assert.deepEqual(eventActorLinks(data,'first',[actor]),[...data.사건_주체,actor]);
 assert.deepEqual(eventActorLinks(data,'second',[]),[]);
 assert.throws(()=>eventActorLinks(data,'first',[{...actor,주체ID:'missing'}]),/참여 주체/);
 assert.throws(()=>eventActorLinks(data,'first',[actor,actor]),/두 번/);
 assert.equal(data.사건_주체.length,1);
});
test('creating relations preserves typed direction, validates endpoints and scopes duplicates',()=>{
 const data={
  사건:[{사건ID:'older'},{사건ID:'newer'},{사건ID:'other'}],
  주체:[{주체ID:'older'},{주체ID:'no-membership'}],
  패키지:[{패키지ID:'a'},{패키지ID:'b'}],
  카테고리:[{카테고리ID:'ca',패키지ID:'a'},{카테고리ID:'cb',패키지ID:'b'}],
  사건_카테고리:[{사건ID:'older',카테고리ID:'ca'},{사건ID:'newer',카테고리ID:'ca'},{사건ID:'other',카테고리ID:'cb'}],
  사건_주체:[{사건ID:'older',주체ID:'older'}],
  관계:[]
 };
 const event=id=>({type:'event',id});
 const actor={type:'actor',id:'older'};
 const category={type:'category',id:'ca'};
 const selection={from:event('newer'),to:event('older'),type:'cause',packageId:'a'};
 const create=(edit=selection)=>createRelation(data,['출처'],edit,'R-test');
 assert.equal(relationTypes.length,6);
 assert.deepEqual(relationPackages(data,event('newer'),event('older')),[data.패키지[0]]);
 assert.deepEqual(relationPackages(data,event('older'),event('other')),data.패키지);
 assert.deepEqual(relationPackages(data,actor,category),[data.패키지[0]]);
 assert.deepEqual(relationPackages(data,{type:'actor',id:'no-membership'},category),[data.패키지[0]]);
 const row=create();
 assert.deepEqual(row,{
  관계ID:'R-test',패키지ID:'a',출발유형:'event',출발ID:'newer',도착유형:'event',도착ID:'older',
  관계유형:'cause',검토상태:'draft',출처:''
 });
 data.관계.push(row);
 assert.throws(()=>create(),/이미 저장/);
 assert.equal(create({...selection,type:'shift'}).관계유형,'shift');
 assert.equal(create({...selection,from:event('older'),to:event('newer')}).출발ID,'older');
 assert.throws(()=>create({...selection,to:event('newer')}),/서로 다른 출발/);
 assert.throws(()=>create({...selection,packageId:'b'}),/패키지/);
 assert.throws(()=>create({...selection,type:'invalid'}),/관계 유형/);
 const mixed={...selection,from:actor,to:category};
 assert.equal(create(mixed).출발유형,'actor');
 assert.equal(create(mixed).도착유형,'category');
 assert.equal(create({...selection,from:actor}).도착ID,'older');
 assert.equal(create({...selection,from:category,to:actor}).도착유형,'actor');
 assert.throws(()=>create({...mixed,from:{type:'actor',id:'newer'}}),/출발 대상/);
 data.관계.push({...create(mixed),출발유형:'organization'});
 assert.throws(()=>create(mixed),/이미 저장/);
});
test('Google relation saves append to the configured tab by header order and check retries',async()=>{
 const config={id:'sheet',relationSheetId:42};
 const selection={from:{type:'actor',id:'A'},to:{type:'event',id:'E'},type:'action',packageId:'japan'};
 const row={관계ID:'R',패키지ID:'japan',출발유형:'actor',출발ID:'A',도착유형:'event',도착ID:'E',관계유형:'action',검토상태:'draft',설명:'=text'};
 const headers=['관계ID','','도착ID','출발ID','관계유형','출발유형','도착유형','패키지ID','검토상태','설명'];
 const values=[headers];
 let writes=0;
 const request=async(url,options)=>{
  assert.equal(options.headers.Authorization,'Bearer mock');
  const body=JSON.parse(options.body);
  if(url.endsWith('/values:batchGetByDataFilter')){
   assert.deepEqual(body.dataFilters,[{gridRange:{sheetId:42}}]);
   return Response.json({valueRanges:[{valueRange:{values}}]});
  }
  assert.equal(url,'https://sheets.googleapis.com/v4/spreadsheets/sheet:batchUpdate');
  const {sheetId,fields,rows}=body.requests[0].appendCells;
  assert.equal(sheetId,42);
  assert.equal(fields,'userEnteredValue');
  const cells=rows[0].values.map(cell=>cell.userEnteredValue.stringValue);
  assert.deepEqual(cells,['R','','E','A','action','actor','event','japan','draft','=text']);
  values.push(cells);
  writes++;
  return Response.json({});
 };
 assert.deepEqual(await saveToGoogleRelationSheet(config,'mock',row,selection,request),{row,created:true});
 assert.deepEqual(await saveToGoogleRelationSheet(config,'mock',{...row,관계ID:'R-retry'},selection,request),{row,created:false});
 assert.equal(writes,1);
 await assert.rejects(saveToGoogleRelationSheet(config,'mock',row,selection,async()=>new Response(null,{status:403})),/편집 권한/);
});

test('category edits preserve linked events across names, types and legacy category IDs',()=>{
 const category={카테고리ID:'trade',카테고리명:'무역',카테고리유형:'theme'};
 const categories=[category,
  {카테고리ID:'port',카테고리명:'항구',카테고리유형:'theme'},
  {카테고리ID:'era',카테고리명:'근대',카테고리유형:'period'}
 ];
 const events=[
  {사건ID:'E1',사건명:'개항',시기:'근대',사건군:'',주제:'무역, 항구'},
  {사건ID:'E2',카테고리ID:'trade',카테고리명:'무역'},
  {사건ID:'E3',주제:'항구'}
 ];
 const update=changes=>updateCategoryEvents(events,categories,category,{...category,...changes},context.SheetData);
 const renamed=update({카테고리명:'해상 무역'});
 assert.equal(renamed[0].주제,'해상 무역, 항구');
 assert.deepEqual(renamed[1],{사건ID:'E2',카테고리ID:'trade',카테고리명:'해상 무역'});
 assert.equal(renamed[2],events[2]);
 const moved=update({카테고리유형:'arc'});
 assert.equal(moved[0].사건군,'무역');
 assert.equal(moved[0].주제,'항구');
 assert.equal(moved[0].시기,'근대');
 assert.throws(()=>update({카테고리유형:'period'}),/이미 시기/);
 assert.throws(()=>update({카테고리명:'항구'}),/카테고리/);
 assert.equal(events[0].주제,'무역, 항구');
});
test('the dashboard derives each distinct category ID from the event sheet',()=>{
 const {headers,records}=parseDashboardCSV('"사건ID","","카테고리ID"\r\n"E01","","japan_military_rule, japan_economy, japan_economy"\r\n"","","japan_other"',context.SheetData.parseCSV);
 assert.deepEqual(Array.from(headers),['사건ID','카테고리ID']);
 assert.equal(JSON.stringify(context.SheetData.categoryLinks(records,[])),JSON.stringify([
  {event_id:'E01',topic_id:'japan_military_rule'},
  {event_id:'E01',topic_id:'japan_economy'}
 ]));
 assert.throws(()=>parseDashboardCSV('사건ID,사건ID',context.SheetData.parseCSV),/열 이름/);
});

test('only the space sheet can recover its mistyped ID header from distinct space IDs',()=>{
 const parse=(csv,tab)=>parseDashboardCSV(csv,context.SheetData.parseCSV,tab);
 const csv='ㅇ,공간명,공간유형\ngeo_europe,유럽,area';
 assert.equal(parse(csv,'공간').records[0].공간ID,'geo_europe');
 assert.equal(parse(csv,'사건').headers[0],'ㅇ');
 assert.equal(parse(csv.replace('geo_europe','E001'),'공간').headers[0],'ㅇ');
 assert.equal(parse(csv+'\ngeo_europe,유럽,area','공간').headers[0],'ㅇ');
});

test('typed category names and the original date restore a feed without event-category rows',async()=>{
 const serialize=rows=>rows.map(row=>row.map(value=>'"'+String(value??'').replaceAll('"','""')+'"').join(',')).join('\n');
 const [event]=sheet.events;
 const categories=[
  {topic_id:'period',name:'냉전의 시작',package_id:'cold-war'},
  {topic_id:'arc',name:'국공내전',package_id:'cold-war'},
  {topic_id:'theme',name:'냉전',package_id:'cold-war'}
 ];
 const inputs={...sheet,categories,events:[{...event,start_date:'16528',date_qualifier:'',review_status:'',game_eligible:''}],
  event_countries:sheet.event_countries.filter(row=>row.event_id===event.event_id)};
 const feed=Object.entries(inputs).filter(([name])=>name!=='event_categories').flatMap(([name,records])=>{
  const keys=Object.keys(records[0]??sheet[name][0]);
  return [[name,...keys],...records.map(row=>[name,...keys.map(key=>row[key])])];
 });
 const tables=await context.SheetData.readPublishedTables(feed,{id:'sheet',eventSheetId:123},async url=>{
  assert.equal(url.pathname,'/spreadsheets/d/sheet/export');
  return new Response(serialize([['사건ID','시기','사건군','주제','날짜'],[event.event_id,'냉전의 시작','국공내전','냉전, 냉전','1945-04']]));
 });
 const [record]=context.SheetData.build(tables).events;
 assert.equal(record.date,'1945-04');
 assert.equal(record.reviewStatus,'summary');
 assert.equal(record.gameEligible,false);
 assert.deepEqual(Array.from(record.directTopicIds).sort(),['arc','period','theme']);
});

test('lesson events recover category memberships from the separate link sheet',async()=>{
 const feed=Object.entries(sheet).filter(([name])=>name!=='event_categories').flatMap(([name,records])=>{
  const keys=Object.keys(records[0]);
  return [[name,...keys],...records.map(row=>[name,...keys.map(key=>row[key])])];
 });
 const tables=await context.SheetData.readPublishedTables(feed,{id:'sheet',eventSheetId:123},async url=>{
  if(url.pathname.endsWith('/export'))return new Response(['사건ID,사건유형',...sheet.events.map(row=>row.event_id+',사건')].join('\n'));
  assert.equal(url.searchParams.get('sheet'),'사건_카테고리');
  return new Response(['카테고리ID,사건ID',...sheet.event_categories.map(row=>[row.topic_id,row.event_id].join(','))].join('\n'));
 });
 assert.equal(JSON.stringify(tables.event_categories),JSON.stringify(sheet.event_categories.map(({event_id,topic_id})=>({event_id,topic_id}))));
});

test('explicit package membership keeps an event even before it has a category',()=>{
 const [event]=sheet.events;
 const scoped=context.SheetData.scopePackage('cold-war',{
  ...sheet,event_packages:[{event_id:event.event_id,package_id:'cold-war'}],
  event_categories:sheet.event_categories.filter(row=>row.event_id!==event.event_id)
 });
 const [record]=context.SheetData.build(scoped).events;
 assert.equal(scoped.events.length,1);
 assert.equal(record.id,event.event_id);
 assert.equal(record.directTopicIds.length,0);
 const existing=[{사건ID:event.event_id,패키지ID:'cold-war'}];
 assert.equal(eventPackageLinks({사건_패키지:existing}),existing);
 assert.deepEqual(eventPackageLinks({카테고리:[{카테고리ID:'T',패키지ID:'legacy'}],
  사건_카테고리:[{사건ID:'E1',카테고리ID:'T'},{사건ID:'E1',카테고리ID:'T'}]}),[{사건ID:'E1',패키지ID:'legacy'}]);
});

test('repairs serialized end dates even when the rest of the feed is valid',async()=>{
 const [event]=sheet.events;
 const input={...sheet,events:[{...event,start_date:'1950-06-25',end_date:'19567'}],
  event_categories:sheet.event_categories.filter(row=>row.event_id===event.event_id),
  event_countries:sheet.event_countries.filter(row=>row.event_id===event.event_id)};
 const feed=Object.entries(input).flatMap(([name,records])=>{
  const headers=Object.keys(records[0]??sheet[name][0]);
  return [[name,...headers],...records.map(row=>[name,...headers.map(key=>row[key])])];
 });
 const tables=await context.SheetData.readPublishedTables(feed,{id:'sheet',eventSheetId:123},async()=>{
  return new Response(`사건ID,날짜,종료일\n${event.event_id},1950-06-25,1953-07-27`);
 });
 assert.equal(context.SheetData.build(tables).events[0].endDate,'1953-07-27');
});
const korea = koreanHistory([]);
const datasets = {'cold-war':sheet,'korean-history':historyDataTables(korea,sheet.tenure_periods)};
const sources = packages.map(pkg=>({...pkg,tables:datasets[pkg.id]}));

test('recovers a broken event-category feed from the original category IDs',async t=>{
 const quote=value=>'"'+String(value??'').replaceAll('"','""')+'"';
 const csv=rows=>rows.map(row=>row.map(quote).join(',')).join('\n');
 const feed=Object.entries(sheet).flatMap(([name,records])=>{
  const columns=Object.keys(records[0]);
  return [[name,...columns],...(name==='event_categories'?[['#REF!']]:records.map(row=>[name,...columns.map(key=>row[key])]))];
 });
 const sourceRows=sheet.events.map(({event_id})=>[event_id,sheet.event_categories.filter(link=>link.event_id===event_id).map(link=>link.topic_id).join(', ')]);
 const config={id:'sheet',eventSheetId:123,feedUrl:'https://example.com/feed?output=csv'};
 const fetchMock=t.mock.method(globalThis,'fetch',async url=>{
  if(String(url).startsWith(config.feedUrl))return new Response(csv(feed));
  assert.equal(url.searchParams.get('gid'),'123');
  return new Response(csv([['사건ID','카테고리ID'],...sourceRows]));
 });
 const tables=await fetchEventTables(config,context.SheetData);
 const ids=links=>Array.from(links,link=>link.event_id+' '+link.topic_id).sort();
 assert.deepEqual(ids(tables.event_categories),ids(sheet.event_categories));
 assert.equal(fetchMock.mock.callCount(),2);
});

test('dashboard aggregates the registered packages and scopes rows and relations together',()=>{
 const all = dashboardTables(sources);
 assert.deepEqual(all.packages.map(row=>row.package_id),packages.map(pkg=>pkg.id));
 assert.equal(all.events.length,sheet.events.length+korea.events.length);
 assert.equal(all.categories.length,sheet.categories.length+korea.topics.length);
 assert.ok(all.categories.every(row=>!Object.hasOwn(row,'parent_topic_id')));
 assert.equal(all.countries.find(row=>row.actor_id==='actor_kor').iso3,'KOR');
 assert.ok(all.event_categories.every(link=>all.categories.some(row=>row.package_id===link.package_id&&row.topic_id===link.topic_id)));
 const scoped = dashboardTables(sources,'korean-history');
 assert.equal(scoped.events[0].title,'강화도 조약 체결');
 assert.ok(scoped.events.every(row=>row.package_id==='korean-history'&&row.review_status==='summary'));
 for (const {event_id,topic_id} of scoped.event_categories) {
  assert.ok(scoped.events.some(row=>row.event_id===event_id));
  assert.ok(scoped.categories.some(row=>row.topic_id===topic_id));
 }
 for (const {event_id,actor_id} of scoped.event_countries) {
  assert.ok(scoped.events.some(row=>row.event_id===event_id));
  assert.ok(scoped.countries.some(row=>row.actor_id===actor_id));
 }
 const empty = dashboardTables([...sources,{id:'new-package',name:'새 패키지'}],'new-package');
 assert.deepEqual(empty.packages,[{package_id:'new-package',name:'새 패키지'}]);
 assert.equal(empty.events.length,0);
 assert.equal(empty.categories.length,0);
});

test('events follow their category packages and retain multiple memberships',()=>{
 const existing=sheet.events.find(event=>event.title.includes('서베를린 봉쇄'));
 const added={...existing,event_id:'local-history-example',start_date:'1986',title:'지역사 사건',source_url:'https://example.org/event',review_status:'summary'};
 const tables={...sheet,events:[...sheet.events,added],categories:[
  ...sheet.categories.map(row=>({...row,package_id:'cold-war'})),
  {topic_id:'cities',name:'도시사',sort_order:'14',package_id:'city-history'},
  {topic_id:'urban-policy',name:'도시 정책',sort_order:'15',package_id:'city-history'},
 ],event_categories:[
  ...sheet.event_categories,
  {event_id:existing.event_id,topic_id:'urban-policy'},
  {event_id:added.event_id,topic_id:'cities'},
 ]};
 const custom=context.SheetData.scopePackage('city-history',tables);
 assert.deepEqual(custom.events.map(row=>row.event_id),[existing.event_id,added.event_id]);
 assert.deepEqual(custom.events.map(row=>row.category_names),['도시 정책','도시사']);
 assert.deepEqual(Array.from(custom.categories,row=>row.topic_id),['urban-policy','cities']);
 const built=context.SheetData.build(custom);
 assert.deepEqual(Array.from(built.events[0].directTopicIds),['urban-policy']);
 assert.ok(built.events[0].actorIds.includes('actor_ussr'));
 assert.equal(built.events[1].source,'https://example.org/event');
 assert.equal(built.events[1].reviewStatus,'summary');
 const cold=context.SheetData.scopePackage('cold-war',tables);
 assert.equal(cold.events.length,sheet.events.length);
 assert.ok(cold.events.some(row=>row.event_id===existing.event_id));
 assert.ok(!cold.categories.some(row=>row.topic_id==='cities'));
 assert.deepEqual(context.SheetData.scopePackage('unlinked',tables).events,[]);
});

test('sheet names and new package IDs reach the dashboard without changing the dataset mapping',()=>{
 const catalog = parsePackages([
  ['패키지ID','패키지명'],
  ['cold-war','냉전사'],
  ['korean-history','한국 근현대사'],
  ['new-package','새 패키지'],
  ['',''],
 ]);
 const all = dashboardTables(catalog.map(pkg=>({...pkg,tables:datasets[pkg.id]})));
 assert.deepEqual(all.packages.map(row=>row.name),['냉전사','한국 근현대사','새 패키지']);
 assert.equal(all.events.length,sheet.events.length+korea.events.length);
 assert.equal(all.events.filter(row=>row.package_id==='new-package').length,0);
 assert.deepEqual(parsePackages([['패키지ID','패키지명']]),[]);
 assert.throws(()=>parsePackages([['패키지ID','패키지명'],['duplicate','A'],['duplicate','B']]));
 assert.throws(()=>parsePackages([['패키지ID','패키지명'],['missing-name','']]));
 assert.throws(()=>parsePackages([['잘못된 헤더']]));
});

test('package attributes follow their sheet headers and empty values stay omitted',()=>{
 const catalog = parsePackages([['패키지ID','패키지명','설명','학교급','과목'],['test','수업',' 주제 설명 ','고등학교','세계사'],['empty','빈 항목','','','']]);
 assert.deepEqual(dashboardTables(catalog).packages,[
  {package_id:'test',name:'수업',description:'주제 설명',schoolLevel:'고등학교',subject:'세계사'},
  {package_id:'empty',name:'빈 항목'}
 ]);
});
