import {useRef,useState} from 'react';
import {QuizResultDialog} from './QuizFeedback';

export function QuizShareLink({url,label,close}:{url:string;label:string;close:()=>void}){
 const field=useRef<HTMLInputElement>(null);
 const [notice,setNotice]=useState('');
 async function copy(){
  try{
   await navigator.clipboard.writeText(url);
   setNotice('링크를 복사했습니다.');
  }catch{
   field.current?.focus();
   field.current?.select();
   setNotice('선택된 링크를 복사해 주세요.');
  }
 }
 return <QuizResultDialog title="학생용 링크" close={close}
  actions={<button type="button" className="button primary" onClick={copy}>링크 복사</button>}>
  <label className="quiz-link-field">{label}<input ref={field} readOnly value={url} onFocus={e=>e.target.select()}/></label>
  <p role="status" className="quiz-copy-status">{notice}</p>
 </QuizResultDialog>;
}
