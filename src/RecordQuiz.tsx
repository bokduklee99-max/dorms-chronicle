import {createRoot} from 'react-dom/client';
import type {QuizRecord} from './record-quiz';
import {TimelineTyping,type SharedRoute} from './TimelineTyping';
import {TeacherQuiz} from './TeacherQuiz';
import type {QuizPlan} from './authored-quiz';

export function mountRecordQuiz(host:HTMLElement,records:QuizRecord[],workspace:string,packageId:string,shared?:QuizPlan,route?:SharedRoute){
 const root=createRoot(host);
 root.render(route?<TimelineTyping records={records} packageId={packageId} shared={route}/>:
  <TeacherQuiz records={records} workspace={workspace} packageId={packageId} shared={shared}/>);
}
