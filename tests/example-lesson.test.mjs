import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../sheets.js';
import {lessonSwimlane,swimlaneDateRange} from '../swimlane-data.js';
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

test('the public swimlane can place its dated records, including decade ranges',()=>{
 const read=name=>JSON.parse(readFileSync(new URL('../assets/'+name,import.meta.url),'utf8'));
 const lesson=lessonSwimlane(SheetData.build(read('example-japan.json')),new Map(),read('swimlane-japan.json'));
 for(const record of [...lesson.events,...lesson.categories,...lesson.actors]){
  for(const value of [record.date||record.start,record.end].filter(Boolean)){
   const range=swimlaneDateRange(value,SheetData.dateRange);
   assert.ok(Number.isFinite(range.start)&&range.start<=range.end,record.id);
  }
 }
 const range=swimlaneDateRange('1930s',SheetData.dateRange);
 assert.equal(range.start,SheetData.dateRange('1930-01-01').start);
 assert.equal(range.end,SheetData.dateRange('1939-12-31').end);
 assert.deepEqual(swimlaneDateRange('1919-03',SheetData.dateRange),SheetData.dateRange('1919-03'));
 assert.throws(()=>swimlaneDateRange('1930-13',SheetData.dateRange));
});
