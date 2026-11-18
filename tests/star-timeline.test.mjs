import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {buildStarTimeline,dateAtProgress,placeCategoryRanges,placeCategoryStars} from '../src/constellation-model.ts';
import {coldWarData,makeMetro} from '../src/metro-model.ts';

const context = vm.createContext({URL});
for (const file of ['sheet-snapshot.js','sheets.js']) {
 vm.runInContext(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
}
const data = coldWarData(context.SheetData.build(context.SHEET_SNAPSHOT.tables));

test('every Cold War record appears once in date order and opens an existing Metro detail',()=>{
 const {start,end,stars} = buildStarTimeline([...data.events].reverse(),data.topics);
 assert.equal(stars.length,data.events.length);
 assert.equal(new Set(stars.map(star=>star.event.id)).size,data.events.length);
 assert.equal(stars[0].along,0);
 assert.equal(stars.at(-1).along,1);
 assert.deepEqual(dateAtProgress(start,end,-1),{year:1945,month:4});
 assert.deepEqual(dateAtProgress(start,end,2),{year:1991,month:12});
 assert.ok(stars.every((star,index)=>index===0||star.along>=stars[index-1].along));
 const detailIds = new Set(makeMetro(data,{}).items.map(item=>item.eventId));
 assert.ok(stars.every(star=>detailIds.has(star.event.id)));
});

test('category constellation fits its chronological members in landscape and portrait',()=>{
 const {stars,ranges} = buildStarTimeline(data.events,data.topics);
 for (const {category} of ranges) {
  const id = category.topic_id;
  for (const [width,height,axis] of [[853,740,'x'],[390,760,'y']]) {
   const points = placeCategoryStars(stars,id,width,height);
   assert.deepEqual(points.map(star=>star.event.id),stars.filter(star=>star.categoryIds.includes(id)).map(star=>star.event.id));
   assert.ok(points.every(({x,y},index)=>x>=22&&x<=width-22&&y>=22&&y<=height-22&&(!index||points[index-1][axis]<points[index][axis])));
  }
 }
 const [star] = stars;
 assert.deepEqual(placeCategoryStars([star],star.categoryIds[0],390,760).map(({x,y})=>[x,y]),[[195,380]]);
 assert.deepEqual(placeCategoryStars(stars,'missing',390,760),[]);
});

test('constellation links only consecutive events that share the same documented category',()=>{
 const {links,stars} = buildStarTimeline(data.events,data.topics);
 assert.ok(stars.some(star=>star.categoryIds.length>1));
 for (const {categoryId,from,to} of links) {
  assert.ok(from.event.directTopicIds.includes(categoryId));
  assert.ok(to.event.directTopicIds.includes(categoryId));
  assert.ok(from.along<=to.along);
 }
 assert.deepEqual(buildStarTimeline([],data.topics).stars,[]);
});

test('category bars keep their exact event endpoints even when a short range needs room for its label',()=>{
 const {ranges,stars} = buildStarTimeline([...data.events].reverse(),data.topics);
 for (const width of [290,704,1200]) {
  const laidOut = placeCategoryRanges(ranges,width);
  if (width>=704) assert.equal(Math.max(...laidOut.map(range=>range.row))+1,6);
  for (const range of laidOut) {
   const members = stars.filter(star=>star.categoryIds.includes(range.category.topic_id));
   assert.equal(range.start,members[0].along*width);
   assert.equal(range.end,members.at(-1).along*width);
   assert.ok(range.left>=0 && range.right<=width);
   for (const other of laidOut) {
    if (range!==other && range.row===other.row) {
     assert.ok(range.right<=other.left || other.right<=range.left);
    }
   }
  }
 }
 const solo = buildStarTimeline([data.events[0]],data.topics);
 assert.ok(placeCategoryRanges(solo.ranges,704).every(range=>range.start===range.end));
});
