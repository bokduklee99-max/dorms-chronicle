import test from 'node:test';
import assert from 'node:assert/strict';
import {recordQuestions,acceptsAnswer} from '../src/record-quiz.ts';

const event={id:'E1',title:'3·1 운동',date:'1919-03-01',body:'독립선언과 만세 시위가 전국으로 퍼졌다.',categories:[],actors:[]};

test('asks for a recorded year and accepts common written variants',()=>{
 const [q]=recordQuestions([event]);
 assert.equal(q.field,'year');
 assert.ok(acceptsAnswer(q,' １９１９ 년 '));
 assert.ok(!acceptsAnswer(q,'1918'));
 assert.ok(!acceptsAnswer(q,''));
});

test('switches to the event title if the text gives the year and skips disclosed answers',()=>{
 const [q]=recordQuestions([{...event,body:'1919년 독립선언과 만세 시위가 전국으로 퍼졌다.'}]);
 assert.equal(q.field,'title');
 assert.ok(acceptsAnswer(q,'3ㆍ1운동'));
 assert.ok(!acceptsAnswer(q,'독립선언'));
 assert.deepEqual(recordQuestions([{...event,approximate:true,body:'3·1 운동'}]),[]);
 assert.deepEqual(recordQuestions([]),[]);
});

test('draws up to five distinct event records',()=>{
 const qs=recordQuestions(Array.from({length:9},(_,i)=>({...event,id:String(i)})));
 assert.equal(qs.length,5);
 assert.equal(new Set(qs.map(q=>q.record.id)).size,5);
});
