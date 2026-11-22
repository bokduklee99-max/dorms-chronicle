import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {PlanPlayer,QuizTypeCard} from './TeacherQuiz';
import {exampleQuizzes} from './example-quizzes';
import type {QuizPlan} from './authored-quiz';
import type {QuizRecord} from './record-quiz';

function ExampleActivities({records}:{records:QuizRecord[]}){
 const [playing,setPlaying]=useState<QuizPlan>();
 return <>
  <section className="quiz-workbench" aria-label="학습 콘텐츠">{exampleQuizzes.map(({label,description,kind,plan})=>
   <QuizTypeCard key={kind} kind={kind} title={label} description={description} poster={'/assets/quiz-previews/example-'+kind+'.webp'}>
    <button type="button" className="button primary" aria-label={label+' 풀기'} onClick={()=>setPlaying(plan)}>풀어보기</button>
   </QuizTypeCard>
  )}</section>
  {playing&&<PlanPlayer plan={playing} records={records} close={()=>setPlaying(undefined)}/>}
 </>;
}

export function mountExampleActivities(host:HTMLElement,records:QuizRecord[]){
 createRoot(host).render(<ExampleActivities records={records}/>);
}
