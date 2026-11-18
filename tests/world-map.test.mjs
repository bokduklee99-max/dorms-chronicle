import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mapCountries,mapRelations,countriesAt,countryEvents,countryName,relationsAt,mapPoint,relationPath} from '../src/world-map-model.ts';
const c=vm.createContext({URL});
for(const file of ['sheet-snapshot.js','sheets.js'])vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),c);
const data=c.SheetData.build(c.SHEET_SNAPSHOT.tables);
test('dated relationships change at year-end boundaries, without turning participation into an alliance',()=>{
 const has=(year,id)=>relationsAt(year).some(r=>r.id===id);
 assert.equal(has(1948,'nato-uk'),false);assert.equal(has(1949,'nato-uk'),true);
 assert.equal(has(1954,'warsaw-gdr'),false);assert.equal(has(1955,'warsaw-gdr'),true);
 assert.equal(has(1953,'korea-defense'),false);assert.equal(has(1954,'korea-defense'),true);
 assert.equal(has(1959,'china-experts'),true);assert.equal(has(1960,'china-experts'),false);
 assert.equal(has(1959,'cuba-aid'),false);assert.equal(has(1960,'cuba-aid'),true);
 assert.equal(has(1978,'afghan-resistance'),false);assert.equal(has(1979,'afghan-resistance'),true);
 assert.equal(has(1981,'nato-spain'),false);assert.equal(has(1982,'nato-spain'),true);
 assert.equal(has(1989,'warsaw-gdr'),true);assert.equal(has(1990,'warsaw-gdr'),false);
 assert.equal(has(1990,'warsaw-poland'),true);assert.equal(has(1991,'warsaw-poland'),false);
 assert.equal(countriesAt(1991).some(c=>c.id==='ussr'),false);
 assert.equal(relationsAt(1991,'ussr').length,0);
 assert.ok(relationsAt(1962).some(r=>r.from==='usa'));assert.ok(relationsAt(1962).some(r=>r.from==='ussr'));
 assert.ok(relationsAt(1962,'usa').every(r=>r.from==='usa'));
 assert.ok(relationsAt(1980).filter(r=>r.to==='afghanistan').length===2);
});
test('country events use actor IDs, preserve original records and never show future events',()=>{
 for(const country of mapCountries){
  const events=countryEvents(data.events,1962,country);
  assert.ok(events.every(e=>e.year<=1962&&e.actorIds.some(id=>country.actors.includes(id))));
  assert.equal(new Set(events.map(e=>e.id)).size,events.length);
  assert.ok(events.every(e=>data.events.includes(e)));
  for(let i=1;i<events.length;i++)assert.ok(events[i-1].bounds.start>=events[i].bounds.start);
 }
 const cuba=mapCountries.find(c=>c.id==='cuba');
 assert.ok(countryEvents(data.events,1962,cuba).some(e=>e.year===1962&&/쿠바/.test(e.title)));
 assert.ok(countryEvents(data.events,1962,null).every(e=>e.year===1962));
 assert.equal(countryEvents([],1962,cuba).length,0);
});
test('every endpoint and source exists, projected paths remain finite and historical names change',()=>{
 const ids=new Set(mapCountries.map(c=>c.id)),actors=new Set(data.actors.map(a=>a.actor_id));
 assert.equal(ids.size,mapCountries.length);assert.equal(new Set(mapRelations.map(r=>r.id)).size,mapRelations.length);
 for(const country of mapCountries){assert.ok(country.actors.every(id=>actors.has(id)));assert.ok(mapPoint(country.point).every(Number.isFinite));}
 for(const r of mapRelations){assert.ok(ids.has(r.from)&&ids.has(r.to));assert.ok(r.start<=r.end);assert.equal(new URL(r.source).protocol,'https:');assert.ok(!relationPath(mapCountries.find(c=>c.id===r.from),mapCountries.find(c=>c.id===r.to)).includes('NaN'));}
 const germany=mapCountries.find(c=>c.id==='germany');assert.equal(countryName(germany,1989),'서독');assert.equal(countryName(germany,1990),'독일');
});
