import test from 'node:test';
import assert from 'node:assert/strict';
import {constellationLayout} from '../constellation-layout.js';

test('constellation plots one star per event and only links its registered topics',()=>{
 const topics=[
  {topic_id:'root',name:'냉전',parent_topic_id:''},
  {topic_id:'a',name:'한국전쟁',parent_topic_id:'root'},
  {topic_id:'b',name:'군사화',parent_topic_id:'root'},
 ];
 const events=[
  {id:'bridge',directTopicIds:['a','b','root']},
  {id:'local',directTopicIds:['b']},
  {id:'unclassified',directTopicIds:['root']},
 ];
 const layout=constellationLayout(events,topics);
 assert.deepEqual(layout.stars.map(star=>[star.event.id,star.groups.map(group=>group.id)]),[
  ['bridge',['a','b']],['local',['b']],
 ]);
 assert.deepEqual(layout,constellationLayout(events,topics));
 for(const {x,y} of layout.stars)assert.ok(x>0&&x<520&&y>0&&y<280);
});
