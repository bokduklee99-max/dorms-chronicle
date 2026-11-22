import test from 'node:test';
import assert from 'node:assert/strict';
import {constellationLayout} from '../constellation-layout.js';

test('constellation plots one star per event and only links its registered topics',()=>{
 const topics=[
  {topic_id:'cold-war',name:'냉전'},
  {topic_id:'a',name:'한국전쟁'},
  {topic_id:'b',name:'군사화'},
 ];
 const events=[
  {id:'bridge',directTopicIds:['a','b','cold-war']},
  {id:'local',directTopicIds:['b']},
  {id:'broad',directTopicIds:['cold-war']},
  {id:'unclassified',directTopicIds:['missing']},
 ];
 const layout=constellationLayout(events,topics);
 assert.deepEqual(layout.stars.map(star=>[star.event.id,star.groups.map(group=>group.id)]),[
  ['bridge',['cold-war','a','b']],['local',['b']],['broad',['cold-war']],
 ]);
 assert.deepEqual(layout,constellationLayout(events,topics));
 for(const {x,y} of layout.stars)assert.ok(x>0&&x<520&&y>0&&y<280);
});
