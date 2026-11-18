import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {coldWarData,makeMetro,stationEventId} from '../src/metro-model.ts';
const c=vm.createContext({URL});for(const f of ['sheet-snapshot.js','sheets.js'])vm.runInContext(readFileSync(new URL('../'+f,import.meta.url),'utf8'),c);
const source=c.SheetData.build(c.SHEET_SNAPSHOT.tables),data=coldWarData(source);
test('all Metro tabs receive only events from 1945, including after a sheet refresh',()=>{
 const before=JSON.stringify(source),early=source.events.find(e=>e.title==='국공합작');assert.ok(early);
 for(const loaded of [source,JSON.parse(before)]){
  const filtered=coldWarData(loaded);
  assert.equal(filtered.events.length,loaded.events.filter(e=>e.year>=1945).length);
  assert.ok(filtered.events.every(e=>e.year>=1945));assert.ok(!filtered.events.some(e=>e.id===early.id));
  assert.ok(filtered.events.some(e=>e.year===1945));assert.equal(filtered.actors,loaded.actors);assert.equal(filtered.tenures,loaded.tenures);
 }
 assert.equal(JSON.stringify(source),before);
});
test('all events survive as chronological stations with unique occurrence IDs and at most five lines',()=>{
 const m=makeMetro(data,{});assert.ok(m.lines.length<=5);assert.equal(new Set(m.items.map(i=>i.id)).size,m.items.length);
 assert.equal(new Set(m.items.map(i=>i.eventId)).size,data.events.length);
 for(const i of m.items){assert.equal(stationEventId(i.id),i.eventId);const e=m.events.find(e=>e.id===i.eventId);assert.ok(e);assert.equal(i.date,e.date);const line=m.lines[i.line];assert.ok(line.topicId==='other'||e.directTopicIds.includes(line.topicId));}
 for(let n=0;n<m.lines.length;n++){const es=m.items.filter(i=>i.line===n).map(i=>m.events.find(e=>e.id===i.eventId));for(let i=1;i<es.length;i++)assert.ok(es[i-1].bounds.start<=es[i].bounds.start);}
});
test('multi-topic stations share one event; media uses originals and no invented photo fallback',()=>{
 const m=makeMetro(data,{});assert.ok(m.events.some(e=>e.directTopicIds.length>1&&m.items.filter(i=>i.eventId===e.id).length>1));
 const photographed=m.events.find(e=>e.media.length),url=photographed.media[0].url,updated=makeMetro(data,{[url]:'/assets/original.png'});
 assert.ok(updated.items.filter(i=>i.eventId===photographed.id).every(i=>i.image==='/assets/original.png'));
 for(const i of m.items)if(!m.events.find(e=>e.id===i.eventId).media.length)assert.equal(i.image,'');
 assert.equal(makeMetro({...data,events:[]},{}).items.length,0);
});
