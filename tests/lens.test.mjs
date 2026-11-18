import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const c=vm.createContext({URL});for(const f of ['sheet-snapshot.js','sheets.js','lens-layout.js'])vm.runInContext(readFileSync(new URL('../'+f,import.meta.url),'utf8'),c);
const data=c.SheetData.build(c.SHEET_SNAPSHOT.tables);
test('both layouts retain every event with finite in-bounds positions across four periods',()=>{
 for(const [start,end] of [[1945,1953],[1961,1963],[1968,1973],[1985,1991]]){
  const events=data.events.filter(e=>e.year>=start&&e.year<=end),ids=new Set(events.flatMap(e=>e.directTopicIds)),topics=data.topics.filter(t=>ids.has(t.topic_id));
  for(const mode of ['time','topics']){
   const l=c.LensLayout.layout(events,topics,mode,start,end);assert.equal(l.positions.size,events.length);
   for(const p of l.positions.values()){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(p.x>=0&&p.x+l.cardWidth<=l.width&&p.y>=0&&p.y+l.cardHeight<=l.height);}
   const points=[...l.positions.values()];for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)assert.ok(Math.abs(points[i].x-points[j].x)>=l.cardWidth||Math.abs(points[i].y-points[j].y)>=l.cardHeight,'cards must not overlap');
   if(mode==='time'){for(const a of events)for(const b of events)if(a.year<b.year)assert.ok(l.positions.get(a.id).x<l.positions.get(b.id).x);}
  }
 }
});
test('repeated layouts are deterministic and empty input is valid',()=>{
 const a=c.LensLayout.layout(data.events.slice(0,2),data.topics,'topics',1945,1953),b=c.LensLayout.layout(data.events.slice(0,2),data.topics,'topics',1945,1953);assert.deepEqual([...a.positions],[...b.positions]);assert.equal(c.LensLayout.layout([],[],'topics',1968,1973).positions.size,0);
});
