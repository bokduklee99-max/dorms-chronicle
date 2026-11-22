import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../sheets.js';
import {exampleQuizzes} from '../src/example-quizzes.ts';
import {authoredQuestions,insertionRecords,orderQuestions,personQuestions} from '../src/authored-quiz.ts';

test('all four public activities can be played with the published Japan timeline',()=>{
 const read=name=>JSON.parse(readFileSync(new URL('../assets/'+name,import.meta.url),'utf8'));
 const data=SheetData.build(read('example-japan.json'));
 const snapshot=read('swimlane-japan.json');
 assert.equal(data.events.length,145);
 assert.deepEqual(new Set(data.events.map(e=>e.id)),new Set(snapshot.events.map(e=>e.id)));
 const actors=new Map(data.actors.map(a=>[a.actor_id,a]));
 const people=data.actors.filter(a=>a.actor_type==='person').map(a=>({label:'관련 인물',name:a.name}));
 const topics=new Map(data.topics.map(t=>[t.topic_id,t.name]));
 const records=data.events.map(e=>{
  const participants=e.actorIds.map(id=>actors.get(id));
  return {id:e.id,title:e.title,date:e.date,body:e.description,startBounds:e.bounds,actors:participants.map(a=>a.name),
   categories:e.directTopicIds.map(id=>topics.get(id)),categoryIds:e.directTopicIds,people:participants.filter(a=>a.actor_type==='person').map(a=>({label:'관련 인물',name:a.name})),personPool:people};
 });
 const [blank,order,person,insertion]=exampleQuizzes.map(q=>q.plan);
 assert.equal(authoredQuestions(blank,records).flatMap(q=>q.blanks).length,9);
 assert.equal(orderQuestions(order,records).length,3);
 assert.deepEqual(personQuestions(person,records).map(q=>q.choices[0]).sort(),['김원봉','조만식','홍범도']);
 assert.equal(insertionRecords(insertion,records).length,4);
});
