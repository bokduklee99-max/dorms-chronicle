import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const context=vm.createContext({URL});
for(const name of ['sheet-snapshot.js','sheets.js','data.js','sheet-config.js'])vm.runInContext(readFileSync(new URL('../'+name,import.meta.url),'utf8'),context);
const api=context.SheetData,raw=context.SHEET_SNAPSHOT.tables;
const csv=rows=>rows.map(row=>row.map(value=>'"'+String(value??'').replaceAll('"','""')+'"').join(',')).join('\r\n');
const feed=Object.entries(raw).flatMap(([name,rows])=>{
  const headers=Object.keys(rows[0]);
  return [[name,...headers],...rows.map(row=>[name,...headers.map(key=>typeof row[key]==='boolean'?String(row[key]).toUpperCase():row[key])])];
});
const tables=api.decodeFeed(feed),data=api.build(raw),copy=()=>JSON.parse(JSON.stringify(tables));
test('content-only data preserves events, partial dates, images, leader tags and relational tenures',()=>{
  assert.equal(data.events.length,167);assert.equal(data.events[0].date,'1923');
  assert.equal(data.events.reduce((n,e)=>n+e.media.length,0),20);assert.equal(data.events.filter(e=>e.media.length).length,19);
  assert.equal(new Set(data.events.map(e=>e.id)).size,167);assert.ok(data.events.every(e=>!e.point));
  assert.equal(data.events.reduce((n,e)=>n+e.leaderTags.length,0),83);
  assert.equal(data.tenures.length,91);assert.equal(new Set(tables.tenures.map(row=>row.person_id)).size,80);
  assert.equal(data.events.filter(event=>event.actorIds.length).length,167);
  const cuba=data.events.find(event=>event.id==='evt_385434add32c42afba9da294a27b5b38');
  assert.ok(cuba.leaders.some(name=>name.includes('케네디')));assert.ok(cuba.leaders.some(name=>name.includes('흐루쇼프')));
  assert.equal(data.tenures.filter(row=>row.source).length,75);assert.ok(data.tenures.filter(row=>row.source).every(row=>/^https:\/\//.test(row.source)));
  assert.equal(tables.sources.length,0);assert.ok(data.events.every(row=>row.source===''));
});
test('separate event, country, tenure and category tables keep images on events and validate their links',()=>{
  assert.equal(raw.events.length,167);assert.equal(raw.countries.length,75);
  assert.equal(raw.tenure_periods.length,91);assert.equal(raw.categories.length,13);
  assert.equal(raw.events.filter(row=>row.images).length,19);
  assert.equal(raw.events.reduce((n,row)=>n+(row.images?row.images.split('\n').length:0),0),20);
  assert.equal(raw.event_categories.length,191);assert.equal(raw.event_countries.length,505);
  const clone=()=>JSON.parse(JSON.stringify(raw));
  for(const corrupt of [
    f=>f.events.push(f.events[0]),
    f=>f.countries.push(f.countries[0]),
    f=>delete f.events[0].images,
    f=>f.event_categories[0].topic_id='missing',
    f=>f.event_countries[0].actor_id='missing',
    f=>f.event_countries[0].role='unknown',
    f=>f.tenure_periods[0].country_id='actor_cpsu',
    f=>f.tenure_periods[0].name='',
    f=>f.tenure_periods[0].office_status='unknown',
    f=>f.tenure_periods[0].appointment_type='unknown',
    f=>f.tenure_periods.push(f.tenure_periods[0]),
    f=>f.events.find(row=>row.images).images='javascript:alert(1)',
    f=>f.events[0].us_leader='unregistered person',
    f=>f.items=[]
  ]) {
    const f=clone();corrupt(f);assert.throws(()=>api.build(f));
  }
  const before=JSON.stringify(raw);api.build(raw);assert.equal(JSON.stringify(raw),before);
});
test('country assignments respect historical states, treaty parties and the difference between participants and hosts',()=>{
  const actors=id=>new Set(raw.event_countries.filter(row=>row.event_id===id).map(row=>row.actor_id));
  const byTitle=title=>raw.events.find(row=>row.title.includes(title)).event_id;
  for(const event of raw.events){
    const ids=actors(event.event_id);
    assert.ok([...ids].some(id=>raw.countries.find(country=>country.actor_id===id)?.actor_type!=='organization'));
    if(event.start_date<'1949-10-01')assert.ok(!ids.has('actor_prc'));
    if(event.start_date<'1949-05-23')assert.ok(!ids.has('actor_frg'));
    if(event.start_date<'1948-08-15')assert.ok(!ids.has('actor_kor'));
    if(event.start_date<'1948-09-09')assert.ok(!ids.has('actor_prk'));
    if(event.start_date<'1976-07-02')assert.ok(!ids.has('actor_vietnam'));
  }
  assert.equal(actors(byTitle('헬싱키 최종합의')).size,35);
  const cfe=actors(byTitle('CFE Treaty'));assert.equal(cfe.size,22);assert.ok(!cfe.has('actor_gdr'));
  const treaty=actors(byTitle('2+4조약'));assert.equal(treaty.size,6);
  for(const id of ['actor_frg','actor_gdr','actor_usa','actor_ussr','actor_uk','actor_france'])assert.ok(treaty.has(id));
  assert.ok(!actors(byTitle('몰타 회담')).has('actor_malta'));
  assert.ok(!actors(byTitle('레이캬비크 정상회담')).has('actor_iceland'));
  const gas=actors(byTitle('천연가스'));assert.ok(gas.has('actor_ussr'));assert.ok(!gas.has('actor_russia'));
  assert.ok(!actors(byTitle('체코슬로바키아 침공')).has('actor_romania'));
});
test('spreadsheet paste preserves empty cells, commas and quoted multiline notes',()=>{
  const pasted=api.parseCSV('1919\t사건, 하나\t\t"첫 줄\n둘째 줄"\r\n1920\t다음 사건',true,'\t');
  assert.equal(JSON.stringify(pasted),JSON.stringify([['1919','사건, 하나','','첫 줄\n둘째 줄'],['1920','다음 사건']]));
});
test('CSV preserves quotes, commas, Korean and paragraphs; rejects incomplete responses',()=>{
  const rows=[['사건','"인용", 쉼표\n다음 줄',''],['','끝','TRUE']];
  assert.equal(JSON.stringify(api.parseCSV('\uFEFF'+csv(rows))),JSON.stringify(rows));
  assert.throws(()=>api.parseCSV('"unfinished'),/CSV/);assert.throws(()=>api.parseCSV('"closed"tail'),/CSV/);
  assert.throws(()=>api.decodeFeed([['<html>login']]));
  assert.throws(()=>api.decodeFeed([['countries','actor_id','name','actor_type','iso3']]),/아직 게시/);
});
test('published feed round trip preserves all events and excludes private archives',()=>{
  const parsed=api.parseCSV(csv(feed)),published=api.readFeedTables(parsed);
  const decoded=api.decodeFeed(parsed),loaded=api.build(decoded);
  assert.equal(JSON.stringify(published),JSON.stringify(raw));
  assert.equal(JSON.stringify(api.build(published)),JSON.stringify(loaded));
  assert.equal(JSON.stringify(loaded.events),JSON.stringify(data.events));
  assert.ok(!Object.hasOwn(decoded,'source_archive'));assert.ok(!Object.hasOwn(decoded,'unresolved_relations'));
});
test('flat category feeds retain only explicitly linked categories',()=>{
  const flatFeed=feed.map(row=>row[0]==='categories'?row.slice(0,3):row);
  const flat=api.build(api.decodeFeed(flatFeed));
  const expected={...data,topics:data.topics.map(({sort_order,...topic})=>topic)};
  assert.equal(JSON.stringify(flat),JSON.stringify(expected));
  assert.ok(flat.topics.every(topic=>!Object.hasOwn(topic,'parent_topic_id')));
  assert.ok(flat.events.every(event=>[...event.topicIds].sort().join()===raw.event_categories.filter(link=>link.event_id===event.id).map(link=>link.topic_id).sort().join()));
});
test('colonial feed keeps flat tags and filters by linked subjects or their leanings',()=>{
  const input=JSON.parse(JSON.stringify(raw));
  const seed=input.events[0];
  const {us_leader,ussr_leader,...common}=seed;
  input.events=[{...common,event_id:'E1',title:'선언',start_date:'1923',end_date:'',event_type:'publication',origin_label:'교사용.html#L5'},
    {...common,event_id:'E2',title:'운동',start_date:'1926',end_date:''}];
  input.tenure_periods=[];
  input.countries=[{actor_id:'person_a',name:'인물',actor_type:'person',iso3:'',lean:'사회주의'},
    {actor_id:'person_b',name:'미연결 인물',actor_type:'person',iso3:'',lean:'좌우합작'}];
  input.categories=[{topic_id:'domestic',name:'국내 운동',package_id:'japan'},
    {topic_id:'culture',name:'민족문화',package_id:'japan'}];
  input.event_categories=[{event_id:'E1',topic_id:'culture'},{event_id:'E1',topic_id:'domestic'},{event_id:'E2',topic_id:'domestic'}];
  input.event_countries=[{event_id:'E1',actor_id:'person_a',role:'participant',actor_role:'author'}];
  const decoded=api.decodeFeed(Object.entries(input).flatMap(([name,rows])=>{
    const keys=Object.keys(rows[0]??raw[name][0]);
    return [[name,...keys],...rows.map(row=>[name,...keys.map(key=>row[key]??'')])];
  }));
  const built=api.build(decoded);
  assert.equal(built.events[0].eventType,'publication');
  assert.equal(built.events[0].topicIds.slice().sort().join(), 'culture,domestic');
  assert.equal(built.events[0].topicIds.join(),built.events[0].directTopicIds.join());
  assert.equal(decoded.event_actors[0].role,'author');
  const filters=api.actorFilterOptions(built.events,built.actors);
  assert.equal(filters.leans.join(),'사회주의');
  assert.equal(filters.groups[0][1].map(actor=>actor.actor_id).join(),'person_a');
  for(const choice of ['actor:person_a','lean:사회주의'])assert.equal(api.filterActorEvents(built.events,built.actors,choice).map(event=>event.id).join(),'E1');
  assert.equal(api.filterActorEvents(built.events,built.actors,'').length,2);
  const header=['관계ID','패키지ID','출발유형','출발ID','도착유형','도착ID','관계유형','라벨','설명','출처','검토상태'];
  const edge=['R001','japan','actor','person_a','event','E1','action','발표','','https://example.com','draft'];
  assert.equal(api.readRelations([header,edge],'japan',built)[0].to,'E1');
  assert.throws(()=>api.readRelations([header,[...edge.slice(0,5),'missing',...edge.slice(6)]],'japan',built),/연결 대상/);
});
test('categories follow the first linked start date even when row order and display numbers disagree',()=>{
  const categories=[
    {topic_id:'missing',name:'미분류',sort_order:'0'},
    {topic_id:'late',name:'가장 늦음',sort_order:'1'},
    {topic_id:'early-b',name:'나',sort_order:'2'},
    {topic_id:'early-a',name:'가',sort_order:'3'},
  ];
  const events=[
    {event_id:'e3',start_date:'1950'},
    {event_id:'e2',start_date:'1945-01-01'},
    {event_id:'e1',start_date:'1945'},
  ];
  const links=[
    {event_id:'e3',topic_id:'early-a'},
    {event_id:'e3',topic_id:'late'},
    {event_id:'e2',topic_id:'early-a'},
    {event_id:'e1',topic_id:'early-b'},
  ];
  assert.deepEqual(Array.from(api.orderCategories(categories,events,links),row=>row.topic_id),['early-a','early-b','late','missing']);
});
test('direct lesson actors and separate board filter options use only linked actor IDs',()=>{
  const actors=[
    {actor_id:'g',name:'단체',actor_type:'organization',lean:' '},
    {actor_id:'p',name:'인물',actor_type:'person',lean:' 성향 A '},
    {actor_id:'q',name:'다른 인물',actor_type:'person',lean:'성향 B'}
  ];
  const events=[{id:'E282',actorIds:[]},{id:'e1',actorIds:['g','p']},{id:'e2',actorIds:['q']}];
  const selected=events.slice(0,2);
  assert.deepEqual(Array.from(api.linkedActors(selected,actors),actor=>actor.actor_id).sort(),['g','p']);
  const options=api.actorFilterOptions(selected,actors);
  assert.deepEqual(Object.keys(options).sort(),['groups','leans']);
  assert.deepEqual(Array.from(options.groups.flatMap(([,list])=>list.map(a=>a.actor_id))).sort(),['g','p']);
  assert.deepEqual(Array.from(options.leans),['성향 A']);
  assert.equal(api.filterActorEvents(selected,actors,'lean:성향 A').map(e=>e.id).join(),'e1');
  assert.equal(api.actorFilterOptions(events.slice(0,1),actors).groups.length,0);
});
test('broken IDs, duplicate links, empty snapshots and unsafe URLs reject the entire update',()=>{
  let b=copy();b.event_topics[0].event_id='missing';assert.throws(()=>api.build(b),/ID/);
  b=copy();b.events.push(b.events[0]);assert.throws(()=>api.build(b),/ID/);
  b=copy();b.event_topics.push(b.event_topics[0]);assert.throws(()=>api.build(b),/중복/);
  b=copy();b.events[0].origin_ref='javascript:alert(1)';assert.throws(()=>api.build(b),/링크/);
  b=copy();b.events=[];assert.throws(()=>api.build(b),/빈 사건/);
});
test('partial date intervals validate leap days and keep uncertain order unscored',()=>{
  const y=api.dateRange('1962'),m=api.dateRange('1962-10'),d=api.dateRange('1962-10-22');
  assert.ok(y.start<m.start&&m.start<d.start);assert.ok(y.end>m.end&&m.end>d.end);assert.equal(d.start,d.end);
  assert.throws(()=>api.dateRange('1962-02-29'));assert.doesNotThrow(()=>api.dateRange('1960-02-29'));assert.throws(()=>api.dateRange('1962-13'));
});
test('game selects only eligible reviewed events with nonoverlapping dates',()=>{
  assert.equal(api.gamePool(data.events).length,0);
  const items=['1962','1962-10-22','1962-10-22','1963-01','1964','1965','1966','1967'].map((date,i)=>({id:String(i),gameEligible:true,bounds:api.dateRange(date)}));
  items.push({id:'draft',gameEligible:false,bounds:api.dateRange('1900')});
  const pool=api.gamePool(items);assert.equal(pool.length,6);
  for(let i=1;i<pool.length;i++)assert.ok(pool[i-1].bounds.end<pool[i].bounds.start);
  const index=vm.runInContext('insertionIndex',context);
  assert.equal(index([pool[1],pool[3]],pool[0]),0);assert.equal(index([pool[1],pool[3]],pool[2]),1);assert.equal(index([pool[1],pool[3]],pool[4]),2);
});
test('place relations resolve coordinates and reject multiple primary locations',()=>{
  const f=copy(),eventId=f.events[0].event_id;
  f.places.push({place_id:'p',name:'시험 장소',latitude:37.5,longitude:127,location_precision:'city',source_id:'source_notion_coldwar'});
  f.event_places.push({event_id:eventId,place_id:'p',role:'representative',is_primary:true});
  assert.equal(JSON.stringify(api.build(f).events.find(e=>e.id===eventId).point),'[127,37.5]');
  f.event_places.push({event_id:eventId,place_id:'p',role:'occurred_at',is_primary:true});assert.throws(()=>api.build(f),/기본 장소/);
});
test('all twenty bundled Notion files exist and map to their original media URLs',()=>{
  const media=vm.runInContext('SHEET_MEDIA',context);assert.equal(Object.keys(media).length,20);
  for(const asset of tables.media_assets){assert.ok(media[asset.url]);assert.ok(existsSync(new URL('../'+media[asset.url],import.meta.url)));}
});
