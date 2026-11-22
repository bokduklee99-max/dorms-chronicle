export type QuizPerson = {label:string;name:string;year?:number};

export type QuizRecord = {
 id:string; title:string; date:string; end?:string; body:string; categories:string[]; categoryIds?:string[]; categoryTypes?:string[]; actors:string[]; place?:string;
 importance?:string;
 people?:QuizPerson[];
 personPool?:QuizPerson[];
 image?:string; approximate?:boolean;
 startBounds?:{start:number;end:number};
};
export type RecordQuestion = {record:QuizRecord; field:'year'|'title'; answer:string};

function words(value:string){
 return value.normalize('NFKC').toLowerCase().replace(/[\s·ᆞ・]/gu,'');
}

export function acceptsAnswer(question:RecordQuestion,input:string){
 const value=words(input);
 return (question.field==='year'?value.replace(/년$/u,''):value)===words(question.answer);
}

export function shuffle<T>(values:T[]):T[]{
 const shuffled=[...values];
 for(let i=shuffled.length-1;i>0;i--){
  const j=Math.floor(Math.random()*(i+1));
  [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];
 }
 return shuffled;
}

export function quizInsertionIndex(placed:QuizRecord[],event:QuizRecord){
 const index=placed.findIndex(record=>record.startBounds!.start>event.startBounds!.end);
 return index<0?placed.length:index;
}

export function recordQuestions(records:QuizRecord[]):RecordQuestion[]{
 const questions:RecordQuestion[]=[];
 for(const record of shuffle(records)){
  const {title,date,body,place,categories,actors}=record;
  if(!title.trim())continue;
  const year=date.match(/^(\d{4})(?:-\d{2}){0,2}$/)?.[1];
  const clues=[body,place,...categories,...actors].filter(Boolean).join(' ');
  const canAskTitle=title.length<=25&&body.trim().length>=10&&!words(clues).includes(words(title));
  const canAskYear=year&&!record.approximate&&![title,clues].some(value=>value.includes(year));
  if(canAskTitle&&(!canAskYear||questions.length%2===1)){
   questions.push({record,field:'title',answer:title});
  }else if(canAskYear){
   questions.push({record,field:'year',answer:year});
  }
  if(questions.length===5)break;
 }
 return questions;
}
