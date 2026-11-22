import {useId,useLayoutEffect,useRef,type KeyboardEvent,type ReactNode} from 'react';

export function QuizDialog({title,close,children,className='',tone,progress}:{title:string;close:()=>void;children:ReactNode;className?:string;tone?:'correct'|'incorrect';progress?:{current:number;total:number}}){
 const ref=useRef<HTMLDialogElement>(null),heading=useRef<HTMLHeadingElement>(null);
 const label=useId();
 useLayoutEffect(()=>{
  const dialog=ref.current!;
  dialog.showModal();
  heading.current?.focus({preventScroll:true});
  return ()=>dialog.close();
 },[]);
 return <dialog ref={ref} className={`record-quiz ${className}`} data-tone={tone} aria-labelledby={label}
  onCancel={event=>{event.preventDefault();event.stopPropagation();close();}}>
  <header className="quiz-tools">
   {tone&&<span className="quiz-outcome-mark" aria-hidden="true">{tone==='correct'?'✓':'×'}</span>}
   <h2 ref={heading} id={label} tabIndex={-1}>{title}</h2>
   {progress&&<div className="quiz-progress">
    <span aria-hidden="true">{progress.current} / {progress.total}</span>
    <progress value={progress.current} max={progress.total} aria-label={`${progress.total}문항 중 ${progress.current}번 문항`}/>
   </div>}
   <button type="button" className="quiz-close" aria-label="닫기" onClick={close}>×</button>
  </header>
  {children}
 </dialog>;
}

export function preventCompositionSubmit(event:KeyboardEvent){
 if(event.key==='Enter'&&(event.nativeEvent.isComposing||event.nativeEvent.keyCode===229))event.preventDefault();
}

export function QuizActorList({children}:{children:ReactNode}){
 return <div className="quiz-actor-row">
  <dt>참여 주체</dt>
  <dd><ul className="quiz-actors" role="list">{children}</ul></dd>
 </div>;
}
