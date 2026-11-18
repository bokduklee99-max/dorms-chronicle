import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const c=vm.createContext({URL});
for(const name of ['sheet-snapshot.js','sheets.js','history.js'])vm.runInContext(readFileSync(new URL('../'+name,import.meta.url),'utf8'),c);
const api=c.HistoryViews,data=c.SheetData.build(c.SHEET_SNAPSHOT.tables);
const tables=c.SheetData.decodeFeed(Object.entries(c.SHEET_SNAPSHOT.tables).flatMap(([name,rows])=>{
  const headers=Object.keys(rows[0]);return [[name,...headers],...rows.map(row=>[name,...headers.map(key=>row[key])])];
}));

test('country rows share a year axis, allow the same event in several countries and preserve missing links',()=>{
  const view=api.countryRows(data.events,data.actors,data.tenures,1960);
  assert.ok(view.columns.some(col=>col.id==='actor_usa'));
  assert.ok(view.columns.some(col=>col.id==='actor_ussr'));
  assert.ok(!view.columns.some(col=>col.id==='unassigned'));
  const missing=api.countryRows([{...data.events.find(event=>event.year===1962),actorIds:[]}],data.actors,data.tenures,1960);
  assert.ok(missing.columns.some(col=>col.id==='unassigned'));
  assert.equal(missing.rows[0].cells.find(cell=>cell.id==='unassigned').events.length,1);
  const row=view.rows.find(row=>row.year===1962),id='evt_385434add32c42afba9da294a27b5b38';
  assert.equal(row.cells.filter(cell=>cell.events.some(event=>event.id===id)).length,3);
  assert.ok(row.cells.find(cell=>cell.id==='actor_usa').leaders.some(leader=>leader.person.includes('케네디')));
  const present=new Set(view.rows.flatMap(row=>row.cells.flatMap(cell=>cell.events.map(event=>event.id))));
  assert.equal(present.size,data.events.filter(event=>event.year>=1960&&event.year<1970).length);
});
test('original leader tags and researched country participation remain separate views',()=>{
  const tags=api.countryRows(data.events,data.actors,data.tenures,1960,'tags');
  const actual=api.countryRows(data.events,data.actors,data.tenures,1960,'actors');
  assert.ok(!tags.columns.some(col=>col.id==='actor_cuba'));
  assert.ok(actual.columns.some(col=>col.id==='actor_cuba'));
});
test('same-topic network is undirected and navigable without invented causal edges',()=>{
  const graph=api.network(data.events,[], 'evt_385434add32c42afba9da294a27b5b38');
  assert.equal(graph.nodes.length,5);
  assert.ok(graph.edges.every(edge=>edge.type==='shared_topic'&&edge.topics.includes('topic_cuba_crisis')));
  const next=api.network(data.events,[],graph.nodes[0].id);
  assert.ok(next.nodes.some(event=>event.id===graph.center.id));
  assert.equal(api.network(data.events,[],graph.center.id,'relations').nodes.length,0);
});
test('registered relation direction stays intact and draft edges do not become verified',()=>{
  const [a,b,d]=data.events;
  const relations=[{id:'r',from:a.id,to:b.id,type:'responds_to',status:'verified'},{id:'draft',from:a.id,to:d.id,type:'causes',status:'draft'}];
  const view=api.network(data.events,relations,b.id,'relations');
  assert.equal(view.edges[0].from,a.id);assert.equal(view.edges[0].to,b.id);assert.equal(view.nodes.length,1);
});
test('daily reveal groups same-day events and excludes partial or approximate dates',()=>{
  const events=[{id:'a',date:'1962-10-22',dateQualifier:'stated'},{id:'b',date:'1962-10-22',dateQualifier:'stated'},{id:'c',date:'1962-10-26',dateQualifier:'stated'},{id:'d',date:'1962-10',dateQualifier:'stated'},{id:'e',date:'1962',dateQualifier:'stated'},{id:'f',date:'1962-10-23',dateQualifier:'approximate'}];
  const groups=api.exactDays(events);assert.equal(groups.length,2);assert.equal(groups[0].events.length,2);
  const first=api.revealAt(groups,'1962-10-22');assert.equal(first.today.length,2);assert.equal(first.past.length,0);
  assert.ok(!JSON.stringify(first.today).includes('"id":"c"'));
  const gap=api.revealAt(groups,'1962-10-23');assert.equal(gap.today.length,0);assert.equal(gap.next,'1962-10-26');
  assert.equal(api.nextDay('1960-02-28'),'1960-02-29');assert.equal(api.nextDay('1962-12-31'),'1963-01-01');
});
test('reveal start prevents earlier records from being treated as opened',()=>{
  const groups=api.exactDays(data.events),start=groups.at(-2).date;
  const opened=api.revealAt(groups,groups.at(-1).date,start);
  assert.equal(opened.past.length,1);assert.ok(opened.past.every(group=>group.date>=start));
});
test('relational date lookup handles presidential transition days and separate Soviet offices',()=>{
  const onDate=value=>c.SheetData.dateRange(value);
  const before=api.leadersDuring(data.tenures,'actor_usa',onDate('1963-11-21'));
  const transition=api.leadersDuring(data.tenures,'actor_usa',onDate('1963-11-22'));
  assert.equal(before.length,1);assert.equal(transition.length,2);
  const soviet=api.leadersDuring(data.tenures,'actor_ussr',onDate('1990-06-01'));
  assert.equal(soviet.length,2);assert.equal(new Set(soviet.map(row=>row.officeId)).size,2);
});
test('relations allow no source, but reject cycles, self links and invalid supplied sources',()=>{
  const copy=()=>JSON.parse(JSON.stringify(tables)),a=data.events[0].id,b=data.events[1].id;
  const relation=(from,to)=>({from_event_id:from,to_event_id:to,relation_type:'part_of',review_status:'verified',source_id:'',citation_detail:'',notes:''});
  let f=copy();f.event_relations=[relation(a,b)];assert.equal(c.SheetData.build(f).relations.length,1);
  f=copy();f.event_relations=[relation(a,b),relation(b,a)];assert.throws(()=>c.SheetData.build(f),/순환/);
  f=copy();f.event_relations=[relation(a,a)];assert.throws(()=>c.SheetData.build(f),/ID/);
  f=copy();f.event_relations=[{...relation(a,b),source_id:'missing'}];assert.throws(()=>c.SheetData.build(f),/출처/);
});

test('event leaders are limited to related states and the event date, with concurrent offices grouped',()=>{
  const bounds=c.SheetData.dateRange('1969');
  const event={actorIds:['actor_usa','actor_nato'],bounds};
  const rows=api.eventLeaders(event,data.actors,data.tenures);
  assert.equal(rows.length,1);assert.equal(rows[0].country.actor_id,'actor_usa');
  assert.deepEqual(Array.from(rows[0].people,p=>p.person),['린든 존슨','리처드 닉슨']);
  const exact=api.eventLeaders({...event,bounds:c.SheetData.dateRange('1968-11')},data.actors,data.tenures);
  assert.deepEqual(Array.from(exact[0].people,p=>p.person),['린든 존슨']);
  const concurrent=api.eventLeaders({actorIds:['actor_ussr'],bounds:c.SheetData.dateRange('1990-06')},data.actors,data.tenures);
  assert.equal(concurrent[0].people.length,1);assert.equal(concurrent[0].people[0].tenures.length,2);
  assert.equal(api.eventLeaders({...event,actorIds:[]},data.actors,data.tenures).length,0);
  const unresearched=api.eventLeaders({...event,actorIds:['actor_canada']},data.actors,data.tenures);
  assert.equal(unresearched.length,1);assert.equal(unresearched[0].people.length,0);
});
