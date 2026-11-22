import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {chronicleCards,heroPosition} from '../src/landing-model.ts';
const context=vm.createContext({URL});
for(const file of ['sheet-snapshot.js','sheets.js','sheet-config.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
const data=context.SheetData.build(context.SHEET_SNAPSHOT.tables),media=vm.runInContext('SHEET_MEDIA',context);
test('landing highlights use twelve distinct post-1945 source events with real local images and event links',()=>{
 const cards=chronicleCards(data.events,media);
 assert.equal(cards.length,12);assert.equal(new Set(cards.map(card=>card.id)).size,12);
 for(const card of cards){
  assert.ok(fs.existsSync('.'+card.image));
  assert.ok(data.events.find(event=>event.id===card.id)?.year>=1945);
  assert.equal(new URL(card.href,'https://example.com').searchParams.get('event'),card.id);
  assert.ok(card.summary.length>card.title.length&&card.summary.length<=40,card.title);
 }
 assert.deepEqual(chronicleCards([],media),[]);
 assert.equal(chronicleCards(data.events,{}).length,0);
});
test('hero positions stay finite across mobile, desktop and a single-card source, and morph to an arc',()=>{
 for(const width of [375,853,1440])for(const count of [1,12])for(const progress of [0,.2,1])for(let index=0;index<count;index++){
  const position=heroPosition(index,count,width,800,progress);assert.ok(Object.values(position).every(Number.isFinite));
 }
 assert.notDeepEqual(heroPosition(0,12,1440,800,0),heroPosition(0,12,1440,800,1));
 assert.deepEqual(heroPosition(0,12,1440,800,1),heroPosition(0,12,1440,800,2));
});
test('the top and bottom cards fit around the hero copy on a short desktop stage',()=>{
 const height=560;
 for(const index of [0,6]){
  const {y,rotate,scale}=heroPosition(index,12,1920,height,0);
  const radians=Math.abs(rotate)*Math.PI/180;
  const halfHeight=(184*Math.cos(radians)+146*Math.sin(radians))*scale/2;
  assert.ok(Math.abs(y)+halfHeight<=height/2-15);
  assert.ok(Math.abs(y)-halfHeight>=120);
 }
});
