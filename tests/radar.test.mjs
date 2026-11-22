import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRadar,radarEdges} from '../src/radar-model.ts';
import {readWorkspaceGeography} from '../src/package-content.ts';

const geography=readWorkspaceGeography([
 ['공간ID','공간명','상위공간ID','공간유형'],
 ['geo_east_asia','동아시아','','area'],
 ['geo_korean_peninsula','한반도','geo_east_asia','area'],
 ['seoul','서울','geo_korean_peninsula','point'],
 ['paris','파리','europe','point'],['europe','유럽','','area']
],[['사건ID','공간ID'],['old-a','geo_east_asia'],['old-a','seoul'],['old-a','paris'],['b','seoul']]);
const events=[{id:'a',legacyId:'old-a',date:'1919',year:1919,title:'첫 사건'},
 {id:'b',date:'1945-08',year:1945,title:'둘째 사건'}, {id:'c',date:'1920',year:1920,title:'미연결 사건'}];

test('the radar places events by year and sheet region, collapsing linked ancestors',()=>{
 const model=buildRadar(events,geography,'japan');
 assert.deepEqual(model.sectors.map(s=>s.id).sort(),['europe','geo_korean_peninsula','unplaced']);
 assert.deepEqual(model.eventPlaces.get('a').sort(),['서울','파리']);
 assert.equal(model.sectors.flatMap(s=>s.points).filter(p=>p.event.id==='a').length,2);
 assert.ok(model.radius(1919)<model.radius(1945));
 assert.equal(buildRadar([events[0]],geography,'japan').radius(1919),165);
});

test('registered relationships use visible event IDs and produce one directed arc each',()=>{
 const model=buildRadar(events.slice(0,2),geography,'japan');
 const edges=radarEdges(model,[{id:'keep',from:'old-a',to:'b',type:'cause',label:''},
  {id:'hide',from:'b',to:'c',type:'shift',label:''}]);
 assert.deepEqual(edges.map(edge=>[edge.id,edge.from.event.id,edge.to.event.id]),[['keep','a','b']]);
});
