import {parsePlan,type QuizPlan} from './authored-quiz';

export type EditorPosition={step:number;index:number};
export type QuizEdition={id:string; published?:QuizPlan; draft?:QuizPlan; position?:EditorPosition; updated:number};

export function quizLibrary(workspace:string,storage:Storage){
 const prefix='chronicle.quiz-library.v1.'+encodeURIComponent(workspace)+':';
 function list():QuizEdition[]{
  const entries:QuizEdition[]=[];
  for(let i=0;i<storage.length;i++){
   const key=storage.key(i);
   if(!key?.startsWith(prefix))continue;
   try{
    const entry:QuizEdition=JSON.parse(storage.getItem(key)!);
    if(prefix+entry.id===key&&(entry.draft||entry.published))entries.push(entry);
   }catch{continue;}
  }
  const old=storage.getItem('chronicle.teacher-quiz.v1.'+workspace);
  if(old&&!entries.some(entry=>entry.id==='original')){
   try{entries.push({id:'original',updated:0,published:{title:'선생님이 만든 빈칸 퀴즈',...parsePlan(old)}});}catch{/* Ignore incomplete legacy entries. */}
  }
  return entries.sort((a,b)=>b.updated-a.updated);
 }
 function write(entry:QuizEdition){
  storage.setItem(prefix+entry.id,JSON.stringify(entry));
 }
 return {list,write};
}
