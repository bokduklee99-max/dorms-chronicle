import {readFileSync} from 'node:fs';import vm from 'node:vm';import test from 'node:test';import assert from 'node:assert/strict';
import {makeTransit,countryMatches,placeRouteLabels,topicMatches} from '../src/transit-model.ts';
import {coldWarData} from '../src/metro-model.ts';
const c=vm.createContext({URL});for(const f of ['sheet-snapshot.js','sheets.js'])vm.runInContext(readFileSync(new URL('../'+f,import.meta.url),'utf8'),c);const data=coldWarData(c.SheetData.build(c.SHEET_SNAPSHOT.tables));
const full=makeTransit(data),sample=makeTransit({...data,events:data.events.filter(event=>event.year>=1968&&event.year<=1973)});
test('the axis includes only event years in chronological order',()=>{
 const first=full.events[0],last=full.events.at(-1);
 const combined=makeTransit({...data,events:[last,first]});
 assert.deepEqual(combined.years.map(y=>y.year),[first.year,last.year]);
 assert.deepEqual(combined.points.map(p=>p.event.id),[first.id,last.id]);
 const empty=makeTransit({...data,events:[]});
 assert.equal(empty.years.length,0);
 assert.equal(empty.points.length,0);
});
test('route order follows the first event for each category',()=>{
 const firstDates=Array.from(full.routes,route=>route.stations[0].event.bounds.start);
 assert.deepEqual(firstDates,[...firstDates].sort((a,b)=>a-b));
});
test('each event has exactly one physical station, shared by every participating category',()=>{for(const m of [full,sample]){assert.equal(new Set(m.points.map(p=>p.event.id)).size,m.events.length);assert.equal(m.points.length,m.events.length);for(const s of m.points){assert.equal(s.lines.length,s.event.directTopicIds.length);for(const line of s.lines)assert.equal(m.routes[line].stations.find(x=>x.event.id===s.event.id),s);assert.ok(Number.isFinite(s.x)&&Number.isFinite(s.y));}}});
test('every route travels monotonically left to right and stations remain in their labeled year',()=>{for(const m of [full,sample]){for(const r of m.routes){for(let i=1;i<r.nodes.length;i++)assert.ok(r.nodes[i].x>=r.nodes[i-1].x);assert.ok(!/NaN|undefined/.test(r.d));}for(const s of m.points){const y=m.years.find(y=>y.year===s.event.year);assert.ok(s.x>=y.x&&s.x<y.x+y.width);}assert.ok(m.height>0);}});
test('country filters use relational country IDs and never delete stations',()=>{const m=sample,total=m.points.length;const us=m.points.filter(p=>countryMatches(p.event,'actor_usa'));assert.ok(us.length>0&&us.length<total);assert.ok(m.points.every(p=>countryMatches(p.event,'')));assert.equal(m.points.filter(p=>countryMatches(p.event,'missing')).length,0);assert.equal(m.points.length,total);});

test("unrelated routes stay clear of transfer stations",()=>{for(const m of [full,sample]){for(const s of m.points)for(let i=0;i<m.routes.length;i++){const n=m.routes[i].nodes.find(n=>n.x===s.x);assert.ok(n);if(s.lines.includes(i))assert.equal(n.y,s.y);else assert.ok(Math.abs(n.y-s.y)>=43);}}});

test('sticky category names track the visible route and separate at transfers',()=>{
 const route=(y,slope=0)=>({getTotalLength:()=>1000,getPointAtLength:length=>({x:length,y:y+length*slope})});
 const labels=placeRouteLabels([route(100,.2),route(200),route(200)],500,600);
 for(const label of labels)assert.ok(Math.abs(label.lineY-200)<.01);
 assert.ok(Math.abs(labels[0].slope-.2)<.00001);assert.equal(labels[1].slope,0);
 const ordered=labels.map(l=>l.y).sort((a,b)=>a-b);
 assert.ok(ordered[1]-ordered[0]>=60&&ordered[2]-ordered[1]>=60);
 assert.ok(ordered[0]>=30&&ordered.at(-1)<=570);
 assert.ok(placeRouteLabels([route(100,.2)],800,600)[0].lineY>labels[0].lineY);
 assert.deepEqual(placeRouteLabels([],0,600),[]);
});

test('route emphasis retains shared transfer events and intersects country emphasis',()=>{
 const m=sample,route=m.routes.find(r=>r.stations.some(p=>p.lines.length>1)&&r.stations.some(p=>countryMatches(p.event,'actor_usa')));
 const selected=m.events.filter(e=>topicMatches(e,route.topic_id));
 assert.deepEqual(selected.map(e=>e.id),route.stations.map(p=>p.event.id));
 assert.ok(selected.some(e=>e.directTopicIds.length>1));
 assert.equal(m.events.filter(e=>topicMatches(e,'')).length,m.events.length);
 assert.equal(m.events.filter(e=>topicMatches(e,'missing')).length,0);
 const combined=selected.filter(e=>countryMatches(e,'actor_usa'));
 assert.ok(combined.length>0&&combined.length<=selected.length);
});

test('label joins preserve route tangents and stay finite on an empty path',()=>{
 const stationary={getTotalLength:()=>0,getPointAtLength:()=>({x:0,y:90})};
 const curved={getTotalLength:()=>1000,getPointAtLength:l=>({x:l,y:80+l*l/2000})};
 const labels=placeRouteLabels([stationary,curved],230,600);
 assert.equal(labels[0].slope,0);
 assert.ok(Math.abs(labels[1].slope-.23)<.0001);
 assert.ok(labels.every(label=>Object.values(label).every(Number.isFinite)));
});

test('larger event labels have clear horizontal space and room past the category rail',()=>{
 for(const m of [full,sample]){
  for(let i=1;i<m.points.length;i++)assert.ok(m.points[i].x-m.points[i-1].x>=220);
  if(m.points.length)assert.ok(m.points[0].x-102>=230);
  for(const point of m.points)assert.ok(point.y+135<=m.height);
 }
});


test('parallel routes stay straight through unrelated events and only converge at real transfers',()=>{
 const m=sample,start=m.points.find(p=>p.event.date==='1968-01'),end=m.points.find(p=>p.event.date==='1968-11');
 for(const line of start.lines){const route=m.routes[line],between=route.nodes.filter(n=>n.x>start.x&&n.x<end.x);
  assert.ok(between.length>3);assert.equal(new Set(between.map(n=>n.y)).size,1);
  assert.notEqual(between[0].y,start.y);assert.equal(route.nodes.find(n=>n.x===start.x).y,start.y);assert.equal(route.nodes.find(n=>n.x===end.x).y,end.y);
  assert.ok(route.d.includes(' C'));assert.ok(!route.d.includes(' Q'));
 }
});
