import type {ReactNode} from 'react';
import {QuizDialog} from './QuizDialog';

export function QuizResultDialog({title,correct,children,actions,close,wide=false}:{title:string;correct?:boolean;children:ReactNode;actions:ReactNode;close:()=>void;wide?:boolean}){
 return <QuizDialog title={title} close={close} className={`quiz-outcome ${wide?'quiz-summary':'quiz-feedback'}`}
  tone={correct===undefined?undefined:correct?'correct':'incorrect'}>
  <div className="quiz-outcome-body">{children}</div>
  <footer className="quiz-outcome-actions">{actions}</footer>
 </QuizDialog>;
}

export function QuizFeedback({correct,submitted,answer,nextLabel,onNext,onDismiss}:{correct:boolean;submitted:string;answer:string;nextLabel:string;onNext:()=>void;onDismiss:()=>void}){
 return <QuizResultDialog title={correct?'맞았어요':'오답이에요'} correct={correct} close={onDismiss}
  actions={<button type="button" className="button primary" onClick={onNext}>{nextLabel}</button>}>
  <dl className="quiz-answer-review">
   <div className="quiz-answer-key"><dt>정답</dt><dd>{answer}</dd></div>
   {!correct&&<div><dt>내 답</dt><dd>{submitted}</dd></div>}
  </dl>
 </QuizResultDialog>;
}

