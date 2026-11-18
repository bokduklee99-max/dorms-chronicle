import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryTimeline,timelineGaps} from '../src/detail-model.ts';
const event=(id,year,topics=['topic'])=>({id,bounds:{start:year,end:year},directTopicIds:topics});
test('category timeline includes all events of the selected category and excludes other categories',()=>{
 const current=event('center',1968,['topic','second']);
 const same=Array.from({length:9},(_,i)=>event(String(i),1964+i));
 const second=event('other',1967,['second']);
 const events=[current,second,...same.toReversed()];
 const timeline=categoryTimeline(current,events,'topic');
 assert.equal(timeline.length,10);
 assert.equal(timeline.filter(e=>e.id==='center').length,1);
 assert.ok(timeline.every(e=>e.id!=='other'));
 assert.ok(timeline.every((e,i)=>i===0||e.bounds.start>=timeline[i-1].bounds.start));
 assert.deepEqual(categoryTimeline(current,events,'second'),[second,current]);
});
test('timeline spacing is proportional within each category and compresses long gaps uniformly',()=>{
 const year=365.25*24*60*60*1000;
 const gaps=(times)=>timelineGaps(times.map((time,i)=>event(String(i),time*year)));
 assert.deepEqual(gaps([]),[]);
 assert.deepEqual(gaps([0,0,.5,1.5]),[0,0,24,48]);
 assert.deepEqual(gaps([0,5,25]),[0,36,144]);
});
test('the current event stays in chronological position even without shared topics or a source-list entry',()=>{
 const current=event('current',1950,[]);
 assert.deepEqual(categoryTimeline(current,[event('unrelated',1949)]),[current]);
 const selected=event('current',1950),before=event('before',1949),after=event('after',1951),same=event('a-same-date',1950);
 assert.deepEqual(categoryTimeline(selected,[after,before,same],'topic').map(e=>e.id),['before','a-same-date','current','after']);
});
