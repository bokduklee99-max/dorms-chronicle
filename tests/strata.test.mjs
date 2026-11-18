import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeStrata,strataEvents,strataTimeline} from '../src/strata-model.ts';
import {coldWarData} from '../src/metro-model.ts';
const c=vm.createContext({URL});for(const f of ['sheet-snapshot.js','sheets.js'])vm.runInContext(readFileSync(new URL('../'+f,import.meta.url),'utf8'),c);
const data=coldWarData(c.SheetData.build(c.SHEET_SNAPSHOT.tables));
test('year and five-year matrices start in 1945 and preserve every Cold War topic membership',()=>{
 for(const step of [1,5]){
  const m=makeStrata(data,step);assert.equal(m.first,1945);assert.ok(m.last+step>1991);
  for(const row of m.rows){assert.equal(row.cells.flat().length,data.events.filter(e=>e.directTopicIds.includes(row.topic_id)).length);row.cells.forEach((cell,i)=>{assert.equal(new Set(cell.map(e=>e.id)).size,cell.length);assert.ok(cell.every(e=>e.year>=m.bins[i]&&e.year<m.bins[i]+step));});}
  assert.equal(m.rows.flatMap(r=>r.cells.flat()).length,data.events.reduce((n,e)=>n+e.directTopicIds.length,0));
 }
});
test('cross-sections deduplicate multi-topic events and preserve partial dates and cell totals',()=>{
 const m=makeStrata(data,5),bin=1970,all=strataEvents(data,bin,5,null);assert.equal(new Set(all.map(e=>e.id)).size,all.length);
 assert.equal(all.length,data.events.filter(e=>e.year>=1970&&e.year<1975).length);
 for(const row of m.rows)assert.equal(strataEvents(data,bin,5,row.topic_id).length,row.cells[m.bins.indexOf(bin)].length);
 const partial=data.events.find(e=>e.date.length===4);assert.ok(strataEvents(data,partial.year,1,null).some(e=>e.id===partial.id&&e.date===partial.date));
});
test('empty source and zero-record cells remain empty without invalid scales',()=>{
 const m=makeStrata({...data,events:[]},5);assert.equal(m.max,1);assert.ok(m.rows.every(r=>r.cells.every(c=>c.length===0)));assert.equal(strataEvents(data,1800,5,null).length,0);
});
test('timeline groups preserve dates, chronological order and topic filtering without duplicate events',()=>{
 for(const step of [1,5])for(const topic of [null,...data.topics.map(t=>t.topic_id)]){
  const events=strataEvents(data,1945,step,topic),groups=strataTimeline(events);
  assert.deepEqual(groups.flatMap(g=>g.events.map(e=>e.id)),Array.from(events,e=>e.id));
  assert.equal(new Set(groups.flatMap(g=>g.events.map(e=>e.id))).size,events.length);
  assert.deepEqual(groups.map(g=>g.year),[...new Set(events.map(e=>e.year))]);
  for(const group of groups)assert.ok(group.events.every(e=>e.year===group.year&&data.events.find(original=>original.id===e.id).date===e.date));
 }
 assert.deepEqual(strataTimeline([]),[]);
});
