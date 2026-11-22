import type {QuizRecord} from './record-quiz';

export type BlankQuizPlan={kind?:'blank'; title?:string; categories:string[]; items:{id:string; blanks:string[]}[]};
export type OrderQuestion={items:{id:string}[]};
export type OrderQuizPlan={kind:'order'; title?:string}&(
 {questions:OrderQuestion[]; items?:never}|{items:OrderQuestion['items']; questions?:never}
);
export type PersonQuizPlan={kind:'person'; title?:string; items:{id:string;key:string}[]};
export type InsertionQuizPlan={kind:'insertion'; title?:string; items:OrderQuestion['items']; roundCount:number; questionsPerRound:number};
export type QuizPlan=BlankQuizPlan|OrderQuizPlan|PersonQuizPlan|InsertionQuizPlan;
export type QuizField={key:string; label:string; value:string; unit?:string; suffix?:string; wholeKey?:string; line?:string; offset?:number};
export const emptyPlan=():BlankQuizPlan=>({categories:[],items:[]});

export function parsePlan(raw:string):QuizPlan {
 const data:QuizPlan=JSON.parse(raw);
 const invalid=()=>Error('퀴즈 구성을 확인해 주세요.');
 const strings=(value:unknown):value is string[]=>Array.isArray(value)&&value.every(s=>typeof s==='string'&&s.trim().length>0)&&new Set(value).size===value.length;
 const validItems=(items:OrderQuestion['items'])=>Array.isArray(items)&&strings(items.map(item=>item?.id));
 if(!data||(data.title!==undefined&&typeof data.title!=='string'))throw invalid();
 if(data.kind==='person'){
  if(!validItems(data.items)||!data.items.length||!data.items.every(item=>typeof item.key==='string'&&item.key.startsWith('person-')))throw invalid();
 }else if(data.kind==='order'){
  if(data.questions!==undefined&&(data.items!==undefined||!Array.isArray(data.questions)||!data.questions.length))throw invalid();
  if(!orderQuizQuestions(data).every(question=>question&&validItems(question.items)&&question.items.length>=2))throw invalid();
 }else if(data.kind==='insertion'){
  if(!validItems(data.items)||insertionEventCount(data)>data.items.length)throw invalid();
 }else if((data.kind!==undefined&&data.kind!=='blank')||!strings(data.categories)||!data.categories.length||!validItems(data.items)||!data.items.length||
    !data.items.every(item=>strings(item.blanks)&&item.blanks.length))throw invalid();
 return data;
}

export function orderQuizQuestions(plan:OrderQuizPlan):OrderQuestion[]{
 return plan.questions??[{items:plan.items}];
}

export function quizEventIds(plan:QuizPlan){
 const items=plan.kind==='order'?orderQuizQuestions(plan).flatMap(question=>question.items):plan.items;
 return [...new Set(items.map(item=>item.id))];
}

export function categoriesOf(r:QuizRecord){
 return r.categories.length?r.categories.map((name,i)=>({id:r.categoryIds?.[i]??name,name,type:r.categoryTypes?.[i]??''})):[{id:'@none',name:'카테고리 미지정',type:''}];
}

// Keep individual text selections attached to their value if sheet rows or participants are reordered.
function textKey(group:string,value:string){
 let hash=2166136261;
 for(const c of value)hash=Math.imul(hash^c.codePointAt(0)!,16777619);
 return group+'-'+(hash>>>0).toString(36);
}

function passageFields(value:string,line:string,label:string,blanks:string[],wholeKey=line):QuizField[]{
 const fields:QuizField[]=[];
 const add=(key:string,start:number,end:number)=>fields.push({key,line,wholeKey,offset:start,label,value:value.slice(start,end)});
 const ranges=blanks.filter(key=>key.startsWith(line+':')).map(key=>{
  const [start,end]=key.slice(line.length+1).split(':');
  return {key,start:Number(start),end:Number(end)};
 }).filter(({key,start,end})=>Number.isInteger(start)&&Number.isInteger(end)&&start>=0&&start<end&&end<=value.length&&
   key===line+':'+start+':'+end&&value.slice(start,end).trim()).sort((a,b)=>a.start-b.start);
 if(!ranges.length||blanks.includes(wholeKey)){add(wholeKey,0,value.length);return fields;}
 let cursor=0;
 for(const {key,start,end} of ranges){
  if(start<cursor)continue;
  if(start>cursor)add(line+'/text'+cursor,cursor,start);
  add(key,start,end);
  cursor=end;
 }
 if(cursor<value.length)add(line+'/text'+cursor,cursor,value.length);
 return fields;
}

function bodyFields(body:string,blanks:string[]):QuizField[]{
 const fields:QuizField[]=[];
 const occurrences=new Map<string,number>();
 for(const value of body.split(/\n+/).map(line=>line.trim()).filter(Boolean)){
  const base=textKey('body',value);
  const occurrence=occurrences.get(base)??0;
  occurrences.set(base,occurrence+1);
  const line=occurrence?base+'~'+occurrence:base;
  fields.push(...passageFields(value,line,'사건 내용',blanks));
 }
 return fields;
}

export function quizFields(record:QuizRecord,categories:string[],blanks:string[]=[]):QuizField[]{
 const fields=passageFields(record.title,textKey('title',record.title),'사건명',blanks,'title');
 fields.push(...bodyFields(record.body,blanks));
 function addFact(key:string,label:string,value:string,unit?:string){
  const parts=passageFields(value,textKey(key,value),label,blanks,key);
  if(unit){
   if(parts.length===1&&parts[0].key===key)parts[0].unit=unit;
   else parts[parts.length-1].suffix=unit;
  }
  fields.push(...parts);
 }
 for(const [key,date,label] of [['start',record.date,'시작'],['end',record.end,'종료']] as const){
  if(!date)continue;
  date.split('-').forEach((part,i)=>{
   const unit=['년','월','일'][i];
   addFact(key+i,label+' '+['연도','월','일'][i],String(Number(part)),unit);
  });
 }
 const texts=(group:string,label:string,values:string[])=>{
  for(const value of new Set(values.map(v=>v.trim()).filter(Boolean)))addFact(textKey(group,value),label,value);
 };
 for(const c of categoriesOf(record))if(c.id!=='@none'&&categories.includes(c.id))addFact('category-'+c.id,'카테고리',c.name);
 texts('place','공간',(record.place||'').split(/,\s*/));
 texts('actor','참여 주체',record.actors);
 return fields;
}

export function authoredQuestions(plan:BlankQuizPlan,records:QuizRecord[]){
 const byId=new Map(records.map(r=>[r.id,r]));
 return plan.items.map(({id,blanks})=>{
  const record=byId.get(id);
  if(!record||!categoriesOf(record).some(c=>plan.categories.includes(c.id)))throw Error('선택한 사건이나 카테고리가 변경되었습니다.');
  const fields=quizFields(record,plan.categories,blanks);
  if(!blanks.length||blanks.some(key=>!fields.some(f=>f.key===key&&!(f.line&&key.startsWith(f.line+'/text')))))throw Error('선택한 빈칸의 원본 자료가 변경되었습니다.');
  return {record,fields,blanks};
 }).sort((a,b)=>a.record.date.localeCompare(b.record.date)||a.record.title.localeCompare(b.record.title,'ko'));
}

export function personFields(record:QuizRecord):QuizField[]{
 const byLabel=new Map<string,Set<string>>();
 for(const {label,name} of record.people??[]){
  if(!label.trim()||!name.trim())continue;
  const names=byLabel.get(label)??new Set<string>();
  names.add(name);byLabel.set(label,names);
 }
 return [...byLabel].flatMap(([label,names])=>{
  if(names.size!==1)return [];
  const [value]=names;
  return [{label,value,key:textKey('person',JSON.stringify([label,value]))}];
 });
}

function answerKey(value:string){
 return value.normalize('NFKC').toLowerCase().replace(/[\s·ᆞ・]/gu,'');
}

export function personChoices(record:QuizRecord,target:QuizField){
 const choices=[target.value];
 const seen=new Set([target.value,...record.actors,...(record.people??[]).map(person=>person.name)].map(answerKey));
 const year=Number(record.date.slice(0,4));
 const distance=(candidateYear?:number)=>candidateYear?Math.abs(candidateYear-year):Infinity;
 const candidates=[...(record.personPool??[])].sort((a,b)=>Number(b.label===target.label)-Number(a.label===target.label)||
  distance(a.year)-distance(b.year)||a.name.localeCompare(b.name,'ko'));
 for(const candidate of candidates){
  const key=answerKey(candidate.name);
  if(!key||seen.has(key))continue;
  choices.push(candidate.name);
  seen.add(key);
  if(choices.length===4)break;
 }
 return choices;
}

export function personChoiceFields(record:QuizRecord){
 return personFields(record).filter(target=>personChoices(record,target).length>=2);
}

export function personQuestions(plan:PersonQuizPlan,records:QuizRecord[]){
 const byId=new Map(records.map(record=>[record.id,record]));
 return plan.items.map(({id,key})=>{
  const record=byId.get(id);
  const target=record&&personFields(record).find(field=>field.key===key);
  if(!record||!target)throw Error('사건의 인물 기록이 바뀌었습니다. 문항을 다시 선택해 주세요.');
  const choices=personChoices(record,target);
  if(choices.length<2)throw Error('정답과 구분되는 다른 인물 보기가 필요합니다.');
  const fields=quizFields(record,categoriesOf(record).map(c=>c.id)).filter(f=>!(f.key.startsWith('actor-')&&f.value===target.value));
  return {record,fields:[...fields,target],blanks:[key],choices};
 }).sort((a,b)=>a.record.date.localeCompare(b.record.date));
}

function selectedOrderRecords(plan:OrderQuestion,records:QuizRecord[]){
 const byId=new Map(records.map(record=>[record.id,record]));
 return plan.items.map(({id})=>{
  const record=byId.get(id);
  if(!record?.startBounds||record.approximate)throw Error('시작일을 확인할 수 있는 사건을 선택하세요.');
  return {record,bounds:record.startBounds};
 });
}

export function orderQuestions(plan:OrderQuestion,records:QuizRecord[]){
 if(plan.items.length<2)throw Error('사건을 2개 이상 선택하세요.');
 const selected=selectedOrderRecords(plan,records).sort((a,b)=>a.bounds.start-b.bounds.start);
 if(new Set(selected.map(({record})=>record.title.trim())).size!==selected.length)throw Error('이름이 같은 사건은 하나만 선택하세요.');
 for(let i=1;i<selected.length;i++){
  const earlier=selected[i-1],later=selected[i];
  if(earlier.bounds.end>=later.bounds.start)throw Error(`‘${earlier.record.title}’과 ‘${later.record.title}’의 시작일이 겹칩니다. 둘 중 하나를 다른 사건으로 바꿔 주세요.`);
 }
 return selected.map(({record})=>record);
}

export function insertionEventCount({roundCount,questionsPerRound}:InsertionQuizPlan){
 if(!Number.isSafeInteger(roundCount)||roundCount<1||!Number.isSafeInteger(questionsPerRound)||questionsPerRound<1)return Infinity;
 return roundCount*(questionsPerRound+1);
}

export function insertionRecords(plan:InsertionQuizPlan,records:QuizRecord[]){
 const needed=insertionEventCount(plan);
 if(!Number.isSafeInteger(needed))throw Error('라운드 수와 문제 수를 1 이상의 정수로 입력하세요.');
 if(plan.items.length<needed)throw Error(`기준 사건까지 ${needed}개가 필요해요. 사건을 더 고르거나 문제 수를 줄여 주세요.`);
 if(new Set(plan.items.map(item=>item.id)).size!==plan.items.length)throw Error('같은 사건을 두 번 고를 수 없습니다.');
 const selected=selectedOrderRecords(plan,records).map(({record})=>record);
 dealInsertionRounds(selected,plan.roundCount,plan.questionsPerRound);
 return selected;
}

export function dealInsertionRounds(records:QuizRecord[],roundCount:number,questionsPerRound:number,randomize?:(records:QuizRecord[])=>QuizRecord[]){
 const size=questionsPerRound+1;
 function deal(candidates:QuizRecord[]){
  let remaining=candidates;
  const rounds:QuizRecord[][]=[];
  for(let i=0;i<roundCount;i++){
   const round:QuizRecord[]=[];
   const unused:QuizRecord[]=[];
   for(const event of remaining){
    const {start,end}=event.startBounds!;
    if(round.length<size&&!round.some(placed=>placed.title.trim()===event.title.trim()||
     (placed.startBounds!.start<=end&&start<=placed.startBounds!.end)))round.push(event);
    else unused.push(event);
   }
   if(round.length<size)return;
   rounds.push(round);
   remaining=unused;
  }
  return rounds;
 }
 const random=randomize&&deal(randomize(records));
 if(random)return random;
 // Earliest finishes leave more room for the remaining events if a random draw stalls.
 const ordered=[...records].sort((a,b)=>a.startBounds!.end-b.startBounds!.end||a.startBounds!.start-b.startBounds!.start);
 const rounds=deal(ordered);
 if(!rounds)throw Error('날짜가 겹치지 않는 라운드를 충분히 구성하지 못했어요. 사건을 더 고르거나 라운드 수나 문제 수를 줄여 주세요.');
 return randomize?rounds.map(randomize):rounds;
}

export function fieldMatches(field:QuizField,input:string){
 const value=answerKey(input);
 if(!field.unit)return value!==''&&value===answerKey(field.value);
 const number=value.endsWith(field.unit)?value.slice(0,-1):value;
 return /^\d+$/.test(number)&&Number(number)===Number(field.value);
}

export function clueMask(fields:QuizField[]){
 const phrases=fields.map(f=>f.value+(f.unit&&f.unit!=='년'?f.unit:''));
 const escaped=[...new Set(phrases)].sort((a,b)=>b.length-a.length).map(s=>Array.from(s.normalize('NFKC').replace(/\s/gu,'')).map(c=>c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('\\s*')).filter(Boolean);
 const pattern=escaped.length?new RegExp(escaped.join('|'),'giu'):null;
 return (text:string)=>pattern?text.normalize('NFKC').replace(pattern,'□□'):text;
}
