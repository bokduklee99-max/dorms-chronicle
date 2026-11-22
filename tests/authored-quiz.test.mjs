import test from 'node:test';
import assert from 'node:assert/strict';
import '../sheets.js';
import {authoredQuestions,clueMask,dealInsertionRounds,fieldMatches,insertionRecords,orderQuestions,orderQuizQuestions,personChoiceFields,personFields,personQuestions,parsePlan,quizEventIds,quizFields} from '../src/authored-quiz.ts';
import {quizInsertionIndex} from '../src/record-quiz.ts';

const record={id:'e1',title:'3·1 운동',date:'1919-03-01',body:'독립 만세',place:'한반도',categoryIds:['c','d'],categories:['무단 통치','독립운동'],actors:['김구','유관순']};
test('teacher choices survive share round-trip, sheet reordering and chronological playback',()=>{
 const actor=quizFields(record,['c']).find(f=>f.value==='유관순');
 const plan={categories:['c'],items:[{id:'e1',blanks:[actor.key,'start1']},{id:'e0',blanks:['title']}]};
 const shared=parsePlan(decodeURIComponent(encodeURIComponent(JSON.stringify(plan))));
 const qs=authoredQuestions(shared,[{...record,actors:[...record.actors].reverse()},{...record,id:'e0',date:'1910'}]);
 assert.deepEqual(qs.map(q=>q.record.id),['e0','e1']);
 assert.equal(qs[1].fields.find(f=>f.key===actor.key).value,'유관순');
 assert.ok(!qs[1].fields.some(f=>f.value==='독립운동'));
 assert.ok(fieldMatches(qs[1].fields.find(f=>f.key==='start1'),'０３월'));
 assert.ok(!fieldMatches(actor,''));
 assert.throws(()=>authoredQuestions(plan,[record]));
 assert.throws(()=>authoredQuestions({...plan,items:[{id:'e1',blanks:['not-a-field']}]},[record]));
 assert.throws(()=>parsePlan('{"categories":["c"],"items":[{"id":"e1","blanks":[]}]}'));
});
test('textual clues, including timeline labels, mask repeated answers',()=>{
 const mask=clueMask([{value:'무단 통치'}, {value:'1919',unit:'년'}, {value:'김구(인물)'}, {value:'3',unit:'월'}]);
 assert.equal(mask('1919년 3월 무단통치 · 김구(인물)'),'□□년 □□ □□ · □□');
});
test('partial body blanks preserve the surrounding text and bind to a specific occurrence',()=>{
 const sentence='김일성, 남침을 계획하여 남침을 논의';
 const source={...record,body:sentence+'\n'+sentence};
 const [first,second]=quizFields(source,['c']).filter(f=>f.label==='사건 내용');
 const start=sentence.lastIndexOf('남침');
 const key=first.key+':'+start+':'+(start+2);
 const question=blanks=>authoredQuestions(parsePlan(JSON.stringify({categories:['c'],items:[{id:source.id,blanks}]})),[source])[0];
 const parts=question([key]).fields.filter(f=>f.line===first.key);
 assert.deepEqual(parts.map(f=>f.value),[sentence.slice(0,start),'남침',sentence.slice(start+2)]);
 assert.ok(fieldMatches(parts[1],'남침'));assert.ok(!fieldMatches(parts[1],sentence));
 assert.equal(question([key,second.key]).fields.find(f=>f.key===second.key).value,sentence);
 assert.equal(question([first.key]).fields.find(f=>f.key===first.key).value,sentence);
 for(const bad of [[key,first.key],[key,first.key+':'+(start+1)+':'+(start+3)],[first.key+':0:999']])assert.throws(()=>question(bad));
});

test('order quizzes share selected events by ID and sort by a distinguishable start date',()=>{
 const event=(id,date)=>({...record,id,title:id,date,startBounds:SheetData.dateRange(date)});
 const early=event('early','1919-03'),late=event('late','1919-04-01'),other=event('other','1920');
 const shared=parsePlan(JSON.stringify({kind:'order',title:'독립운동',items:[{id:'late'},{id:'early'}]}));
 assert.deepEqual(orderQuizQuestions(shared),[{items:[{id:'late'},{id:'early'}]}]);
 assert.deepEqual(orderQuestions(shared,[other,late,early]),[early,late]);
 assert.throws(()=>orderQuestions(shared,[early,other]),/시작일/);
 assert.throws(()=>orderQuestions(shared,[{...early,approximate:true},late]),/시작일/);
 assert.throws(()=>orderQuestions(shared,[event('early','1919'),late]),/겹칩니다/);
 assert.throws(()=>orderQuestions(shared,[event('early','1919-04-01'),late]),/겹칩니다/);
 assert.throws(()=>orderQuestions(shared,[{...early,title:'late'},late]),/이름이 같은/);
 for(const items of [[{id:'early'}],[{id:'early'},{id:'early'}],[null,{id:'late'}]]){
  assert.throws(()=>parsePlan(JSON.stringify({kind:'order',items})),/퀴즈 구성/);
 }
});

test('one order quiz preserves separate questions and loads the union of their events',()=>{
 const event=(id,date)=>({...record,id,title:id,date,startBounds:SheetData.dateRange(date)});
 const first=event('first','1900'),second=event('second','1910'),third=event('third','1900');
 const questions=[{items:[{id:'second'},{id:'first'}]},{items:[{id:'third'},{id:'second'}]}];
 const share={kind:'order',title:'사건 순서',questions};
 const loaded=parsePlan(JSON.stringify(share));
 assert.deepEqual(loaded,share);
 assert.deepEqual(quizEventIds(loaded),['second','first','third']);
 assert.deepEqual(orderQuizQuestions(loaded).map(q=>orderQuestions(q,[second,third,first])),[[first,second],[third,second]]);
 for(const invalid of [[],[null],[questions[0],{items:[]}],[{items:[{id:'first'},{id:'first'}]}]]){
  assert.throws(()=>parsePlan(JSON.stringify({...share,questions:invalid})),/퀴즈 구성/);
 }
 assert.throws(()=>parsePlan(JSON.stringify({...share,items:questions[0].items})),/퀴즈 구성/);
});

test('insertion quizzes deal distinct selected events and check before, between and after',()=>{
 const events=Array.from({length:7},(_,i)=>{
  const title=`사건 ${i+1}`,date=String(1900+i);
  return {...record,id:`e${i}`,title,date,startBounds:SheetData.dateRange(date)};
 });
 const plan={kind:'insertion',roundCount:2,questionsPerRound:2,items:events.map(({id})=>({id}))};
 const shared=parsePlan(JSON.stringify(plan));
 assert.deepEqual(quizEventIds(shared),events.map(event=>event.id));
 const selected=insertionRecords(shared,events);
 const rounds=dealInsertionRounds(selected,shared.roundCount,shared.questionsPerRound);
 assert.deepEqual(rounds.map(round=>round.length),[3,3]);
 assert.equal(new Set(rounds.flat().map(event=>event.id)).size,6);
 assert(rounds.flat().every(event=>selected.includes(event)));
 const placed=[events[1],events[3]];
 assert.deepEqual([events[0],events[2],events[4]].map(event=>quizInsertionIndex(placed,event)),[0,1,2]);
 for(const changes of [{roundCount:0},{roundCount:1.5},{questionsPerRound:'2'},{questionsPerRound:4},{items:plan.items.slice(0,5)},
  {items:[...plan.items,plan.items[0]]}])assert.throws(()=>parsePlan(JSON.stringify({...plan,...changes})),/퀴즈 구성/);
 assert.throws(()=>insertionRecords(plan,events.slice(0,6)),/시작일/);
 const overlapping=[{...events[0],date:events[1].date,startBounds:events[1].startBounds},...events.slice(1,6)];
 const overlapPlan={...plan,items:overlapping.map(({id})=>({id}))};
 for(const reorder of [undefined,values=>[...values].reverse()]){
  const roundsWithOverlap=dealInsertionRounds(insertionRecords(overlapPlan,overlapping),2,2,reorder);
  assert.equal(new Set(roundsWithOverlap.flat().map(event=>event.id)).size,6);
  assert(roundsWithOverlap.every(round=>orderQuestions({items:round},overlapping).length===3));
 }
 assert.throws(()=>insertionRecords(plan,events.map(event=>({...event,startBounds:events[0].startBounds}))),/겹치지 않는 라운드/);
});

test('person quizzes bind the answer to an unambiguous role in the original event',()=>{
 const role={label:'당시 미국 대통령',name:'해리 트루먼'};
 const event={...record,date:'1947',actors:[role.name,'미국'],people:[role,role,{label:'관련 인물',name:'김구'},{label:'관련 인물',name:'유관순'}],personPool:[
  {label:'관련 인물',name:'김구',year:1947},
  {label:'당시 미국 대통령',name:'해리트루먼',year:1945},
  {label:'당시 미국 대통령',name:'프랭클린 루스벨트',year:1933},
  {label:'당시 미국 대통령',name:'드와이트 아이젠하워',year:1953},
  {label:'관련 인물',name:'드와이트아이젠하워',year:1947},
  {label:'당시 영국 총리',name:'클레멘트 애틀리',year:1945},
  {label:'관련 인물',name:'장제스',year:1940},
 ]};
 const [field]=personFields(event);
 assert.equal(personFields(event).length,1);
 const plan=parsePlan(JSON.stringify({kind:'person',items:[{id:event.id,key:field.key}]}));
 assert.deepEqual(quizEventIds(plan),[event.id]);
 const [question]=personQuestions(plan,[event]);
 assert.equal(question.fields.filter(f=>f.value===role.name).length,1);
 assert.deepEqual(question.blanks,[field.key]);
 assert.deepEqual(question.choices,[role.name,'드와이트 아이젠하워','프랭클린 루스벨트','클레멘트 애틀리']);
 assert.deepEqual(personQuestions(plan,[{...event,personPool:event.personPool.slice(0,3)}])[0].choices,[role.name,'프랭클린 루스벨트']);
 assert.deepEqual(personChoiceFields({...event,personPool:event.personPool.slice(0,2)}),[]);
 assert.throws(()=>personQuestions(plan,[{...event,personPool:event.personPool.slice(0,2)}]),/인물 보기/);
 assert.throws(()=>personQuestions(plan,[{...event,people:[{...role,name:'다른 인물'}]}]));
 assert.throws(()=>parsePlan(JSON.stringify({...plan,items:[...plan.items,...plan.items]})));
});


test('partial title blanks preserve surrounding text, occurrence and legacy whole-title shares',()=>{
 const source={...record,title:'김일성, 북한지역에서 토지개혁 실시'};
 const [title]=quizFields(source,['c']);
 const keyFor=word=>{const start=source.title.indexOf(word);return title.line+':'+start+':'+(start+word.length);};
 const blanks=[keyFor('김일성'),keyFor('토지개혁')];
 const plan={categories:['c'],items:[{id:source.id,blanks}]};
 const shared=parsePlan(JSON.stringify(plan));
 const parts=authoredQuestions(shared,[source])[0].fields.filter(f=>f.label==='사건명');
 assert.equal(parts.map(f=>blanks.includes(f.key)?'□□':f.value).join(''),'□□, 북한지역에서 □□ 실시');
 assert.ok(fieldMatches(parts.find(f=>f.key===blanks[1]),'토지개혁'));
 assert.throws(()=>authoredQuestions(shared,[{...source,title:'북한 토지개혁 실시'}]));
 for(const invalid of [[...blanks,'title'],[title.line+':0:999'],[title.line+'/text0']]){
  assert.throws(()=>authoredQuestions({...plan,items:[{id:source.id,blanks:invalid}]},[source]));
 }
 const legacy=authoredQuestions({...plan,items:[{id:source.id,blanks:['title']}]},[source])[0];
 assert.equal(legacy.fields[0].value,source.title);
});

test('fact highlights retain full-field IDs and pin partial answers to the original text',()=>{
 const source={...record,end:'1920-04-02'};
 const fields=quizFields(source,['c']);
 const part=(value,start,end)=>fields.find(f=>f.value===value).line+':'+start+':'+end;
 const keys=[part('1919',2,4),'end1',part('무단 통치',3,5),part('한반도',0,2),part('유관순',1,3)];
 const plan=parsePlan(JSON.stringify({categories:['c'],items:[{id:source.id,blanks:keys}]}));
 const [q]=authoredQuestions(plan,[source]);
 assert.deepEqual(keys.map(key=>q.fields.find(f=>f.key===key).value),['19','4','통치','한반','관순']);
 assert.equal(q.fields.find(f=>f.key===keys[0]).suffix,'년');
 assert.equal(q.fields.find(f=>f.key==='end1').unit,'월');
 assert.throws(()=>authoredQuestions(plan,[{...source,categories:['다른 통치','독립운동']}]));
 assert.throws(()=>authoredQuestions(plan,[{...source,date:'1929-03-01'}]));
});
