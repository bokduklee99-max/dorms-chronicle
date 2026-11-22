import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {PlanPlayer,QuizIntroduction} from './TeacherQuiz';
import {japanSnapshot} from './classroom-workspace';
import {workspaceDraft} from './workspace-model';
import {exampleQuizzes} from './example-quizzes';
import type {QuizPlan} from './authored-quiz';
import type {QuizRecord} from './record-quiz';
import type {SheetParser} from './package-content';

declare const SheetData:SheetParser;

function Activities(){
 const [records,setRecords]=useState<QuizRecord[]>();
 const [failed,setFailed]=useState(false);
 const [attempt,setAttempt]=useState(0);
 const [playing,setPlaying]=useState<QuizPlan>();
 useEffect(()=>{
  let active=true;
  japanSnapshot(workspaceDraft('','japan'),SheetData.dateRange).then(
   value=>{if(active)setRecords(value);},()=>{if(active)setFailed(true);}
  );
  return ()=>{active=false;};
 },[attempt]);
 return <>
  {!records&&<p role="status">{failed?<>학습 콘텐츠를 불러오지 못했습니다. <button onClick={()=>{setFailed(false);setAttempt(n=>n+1);}}>다시 열기</button></>:'퀴즈를 불러오는 중입니다.'}</p>}
  <div className="quiz-workbench">{exampleQuizzes.map(({label,description,kind,plan})=><article className="quiz-type" key={kind}>
   <QuizIntroduction kind={kind} title={label} description={description} poster={'/assets/quiz-previews/example-'+kind+'.webp'}/>
   <div className="quiz-type-content"><h2>{label}</h2><p>{description}</p>
    <button type="button" className="button primary" aria-label={label+' 풀기'} disabled={!records} onClick={()=>setPlaying(plan)}>풀어보기</button>
   </div>
  </article>)}</div>
  {playing&&records&&<PlanPlayer plan={playing} records={records} close={()=>setPlaying(undefined)}/>}
 </>;
}

function ExampleLesson(){
 const [activities,setActivities]=useState(()=>location.hash==='#activities');
 useEffect(()=>{
  const navigate=()=>setActivities(location.hash==='#activities');
  window.addEventListener('hashchange',navigate);
  return ()=>window.removeEventListener('hashchange',navigate);
 },[]);
 return <>
  <nav className="sample-switch" aria-label="수업 예시 보기">
   <a href="#timeline" aria-current={!activities?'page':undefined}>연표</a>
   <a href="#activities" aria-current={activities?'page':undefined}>학습 콘텐츠</a>
  </nav>
  {activities?<section aria-label="학습 콘텐츠"><Activities/></section>:
   <iframe title="일제강점기와 독립운동 연표" src="/metro/?sample=japan"/>}
 </>;
}

createRoot(document.getElementById('example-lesson')!).render(<ExampleLesson/>);
