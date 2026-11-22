import {useMemo,useState} from 'react';
import {QuizDialog} from './QuizDialog';
import {EventImportanceGroups} from './EventImportanceGroups';
import {personChoiceFields,type PersonQuizPlan} from './authored-quiz';
import type {QuizRecord} from './record-quiz';

type Props={
 records:QuizRecord[];initial:PersonQuizPlan;close:()=>void;
 save:(plan:PersonQuizPlan)=>void;saveDraft:(plan:PersonQuizPlan)=>void;preview:(plan:PersonQuizPlan)=>void;
};

export function PersonQuizEditor({records,initial,close,save,saveDraft,preview}:Props){
 const [plan,setPlan]=useState(initial);
 const [query,setQuery]=useState('');
 const [error,setError]=useState('');
 const rows=useMemo(()=>records.map(record=>({record,fields:personChoiceFields(record)}))
  .filter(row=>row.fields.length),[records]);
 const selected=new Map(plan.items.map(item=>[item.id,item.key]));
 const valid=plan.items.filter(item=>rows.some(({record,fields})=>record.id===item.id&&fields.some(f=>f.key===item.key)));
 const stale=valid.length!==plan.items.length;
 const ready=!!plan.title?.trim()&&valid.length>0&&!stale;
 const search=query.trim().toLocaleLowerCase();
 const visible=rows.filter(({record,fields})=>[record.title,record.date,...fields.map(f=>f.value)].some(v=>v.toLocaleLowerCase().includes(search)));
 function update(next:PersonQuizPlan){
  setPlan(next);
  try{saveDraft(next);setError('');}catch{setError('초안을 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.');}
 }
 function choose(id:string,key:string){
  const items=plan.items.filter(item=>item.id!==id);
  if(selected.get(id)!==key)items.push({id,key});
  update({...plan,items});
 }
 return <QuizDialog title="관련 인물 퀴즈 만들기" close={close} className="teacher-dialog quiz-editor">
  <section className="author-picker">
   <label className="quiz-name-field">퀴즈 제목<input required maxLength={100} value={plan.title??''} onChange={e=>update({...plan,title:e.target.value})}/></label>
   <h2>사건별로 정답 인물을 고르세요</h2>
   <label className="quiz-search">사건·인물 검색<input type="search" value={query} placeholder="사건명, 연도 또는 인물 이름" onChange={e=>setQuery(e.target.value)}/></label>
   <div className="person-question-list"><EventImportanceGroups entries={visible} selection={{
    has:({record,fields})=>fields.some(f=>f.key===selected.get(record.id)),
    set:(items,checked)=>{
     const next=new Map(selected);
     for(const {record,fields} of items){
      if(!checked)next.delete(record.id);
      else if(!fields.some(f=>f.key===next.get(record.id))){
       const answer=fields.find(f=>f.value.toLocaleLowerCase().includes(search))??fields[0];
       next.set(record.id,answer.key);
      }
     }
     update({...plan,items:Array.from(next,([id,key])=>({id,key}))});
    }
   }} render={({record,fields})=><section key={record.id}>
    <h4>{record.title}</h4><time>{record.date}</time>
    <div className="author-choices">{fields.map(f=><button type="button" key={f.key} aria-pressed={selected.get(record.id)===f.key} onClick={()=>choose(record.id,f.key)}>
     <span>{f.label}</span><strong>{f.value}</strong>
    </button>)}</div>
   </section>}/></div>
   {stale&&<button className="button secondary" onClick={()=>update({...plan,items:valid})}>출제할 수 없는 문항 제외</button>}
   {error&&<p role="alert">{error}</p>}
  </section>
  <footer className="quiz-footer"><strong role="status">{valid.length}문항 선택</strong>
   <div className="author-actions"><button className="button secondary" disabled={!ready} onClick={()=>preview(plan)}>칠판 미리보기</button>
    <button className="button primary" disabled={!ready} onClick={()=>{
     try{save({...plan,title:plan.title?.trim()});}catch{setError('퀴즈를 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.');}
    }}>출제 완료</button></div>
  </footer>
 </QuizDialog>;
}
