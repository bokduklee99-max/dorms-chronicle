import {useEffect,useId,useLayoutEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {QuizFeedback,QuizResultDialog} from './QuizFeedback';
import {QuizActorList,QuizDialog,preventCompositionSubmit} from './QuizDialog';
import {QuizShareLink} from './QuizShareLink';
import {EventImportanceGroups} from './EventImportanceGroups';
import {quizLibrary,type EditorPosition,type QuizEdition} from "./quiz-library";
import {shuffle,type QuizRecord} from './record-quiz';
import {PersonQuizEditor} from './PersonQuizEditor';
import {OrderBoard} from './OrderBoard';
import {InsertionPlayer} from './InsertionQuiz';
import {authoredQuestions,categoriesOf,clueMask,emptyPlan,fieldMatches,insertionRecords,orderQuestions,orderQuizQuestions,personChoiceFields,personQuestions,quizFields,type BlankQuizPlan,type InsertionQuizPlan,type OrderQuizPlan,type QuizField,type QuizPlan} from './authored-quiz';

type Item=ReturnType<typeof authoredQuestions>[number]&{choices?:string[]};
const toggle=(values:string[],value:string)=>values.includes(value)?values.filter(v=>v!==value):[...values,value];
const insertionTitle='하나씩 끼워넣기';

function numberBlanks(items:Item[]){
 let number=0;
 return items.map(({fields,blanks})=>new Map(fields.filter(f=>blanks.includes(f.key)).map(f=>[f.key,++number])));
}

function factGroups(fields:QuizField[],prefix:string){
 const groups=new Map<string,QuizField[]>();
 for(const field of fields){
  const key=field.wholeKey??field.key;
  if(!key.startsWith(prefix))continue;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key)!.push(field);
 }
 return [...groups.values()];
}

function QuizLine({items,index,move,displayClue=(f)=>f.value+(f.unit??'')}:{items:Item[];index:number;move?:(i:number)=>void;displayClue?:(f:QuizField,id:string)=>string}){
 const rail=useRef<HTMLOListElement>(null);
 useEffect(()=>{
  const list=rail.current,node=list?.children[index] as HTMLElement|undefined;
  if(list&&node)list.scrollBy({left:node.getBoundingClientRect().left-list.getBoundingClientRect().left-(list.clientWidth-node.offsetWidth)/2});
 },[index]);
 return <section className="teacher-line" aria-label="출제 사건 연표">
  <header><strong>사건 연표</strong>{move&&<span>{index+1} / {items.length}</span>}</header>
  <ol ref={rail} tabIndex={0} aria-label="시간순 사건">{items.map(({record,fields,blanks},i)=>{
   const display=(f:QuizField)=>(!move&&blanks.includes(f.key)?'□□'+(f.unit??''):displayClue(f,record.id))+(f.suffix??'');
   const labels=(prefix:string)=>factGroups(fields,prefix).map(parts=>parts.map(display).join(''));
   const parts=<><small>{labels('start').join(' ')}</small><b>{fields.filter(f=>f.label==='사건명').map(display).join('')}</b><span className="line-categories">{labels('category-').join(' · ')||'카테고리 미지정'}</span></>;
   return <li key={record.id} aria-current={i===index?'step':undefined}>{move?<button onClick={()=>move(i)}>{parts}</button>:parts}</li>;
  })}</ol>
 </section>;
}

type PassageEdit={numbers:ReadonlyMap<string,number>;toggle:(key:string)=>void};

function PassagePicker({fields,numbers,toggle}:{fields:QuizField[]}&PassageEdit){
 const isTitle=fields[0].label==='사건명';
 const wholeKey=fields[0].wholeKey!;
 const value=fields.map(f=>f.value).join('');
 const [notice,setNotice]=useState('');
 const input=useRef<HTMLTextAreaElement>(null);
 const descriptionId=useId();
 const descriptions=fields.flatMap(f=>numbers.has(f.key)?[`${numbers.get(f.key)}번, ${f.value}`]:[]);
 function mark(start:number,end:number){
  const collapsed=start===end;
  // A tap on the trailing half of the last letter puts the caret after the word.
  if(collapsed&&start>0&&!/[\p{L}\p{N}\p{M}]/u.test(value.charAt(start))&&/[\p{L}\p{N}\p{M}]/u.test(value.charAt(start-1))){
   start--;end=start;
  }
  const segment=fields.find(f=>start>=f.offset!&&start<f.offset!+f.value.length);
  const selected=segment&&numbers.has(segment.key)&&end<=segment.offset!+segment.value.length?segment:undefined;
  if(selected){
   toggle(selected.key);setNotice(selected.value+' 빈칸 해제');return;
  }
  if(collapsed){
   if(!segment)return;
   const offset=segment.offset!;
   const word=[...segment.value.matchAll(/[\p{L}\p{N}\p{M}]+(?:[·’'-][\p{L}\p{N}\p{M}]+)*/gu)].find(m=>offset+m.index<=start&&start<offset+m.index+m[0].length);
   if(!word)return;
   start=offset+word.index;end=start+word[0].length;
  }
  const raw=value.slice(start,end),phrase=raw.trim();
  if(!phrase)return;
  start+=raw.length-raw.trimStart().length;end=start+phrase.length;
  if(fields.some(f=>numbers.has(f.key)&&start<f.offset!+f.value.length&&end>f.offset!)){
   setNotice('이미 표시한 구절을 먼저 해제하세요.');return;
  }
  toggle(start===0&&end===value.length?wholeKey:fields[0].line+':'+start+':'+end);
  setNotice(phrase+' 빈칸 지정');
 }
 function apply(input:HTMLTextAreaElement){
  const {selectionStart,selectionEnd}=input;
  mark(selectionStart,selectionEnd);
  input.setSelectionRange(selectionStart,selectionStart);
 }
 return <div className="passage-picker">
  <div className="passage-surface">
   <div className="passage-ink" aria-hidden="true">{fields.map(f=>numbers.has(f.key)?
    <mark key={f.key} data-blank-number={numbers.get(f.key)}>{f.value}</mark>:<span key={f.key}>{f.value}</span>)}</div>
   <textarea ref={input} readOnly spellCheck={false} aria-label={fields[0].label+' 빈칸 지정'} aria-describedby={descriptions.length?'passage-keys '+descriptionId:'passage-keys'} value={value}
    onClick={e=>apply(e.currentTarget)} onKeyDown={e=>{
     if(e.key==='Enter'){e.preventDefault();apply(e.currentTarget);}
    }}/>
  </div>
  {descriptions.length>0&&<span id={descriptionId} className="sr-only">{descriptions.join(' · ')}</span>}
  {isTitle&&fields.length===1&&!numbers.has(wholeKey)&&<button type="button" className="passage-whole" onClick={()=>{
   toggle(wholeKey);setNotice('사건명 전체 빈칸 지정');input.current?.focus();
  }}>사건명 전체 가리기</button>}
  <span className="sr-only" role="status">{notice}</span>
 </div>;
}

function RecordSheet({item,cell,number,showImage,editPassage}:{item:Item;cell:(field:QuizField)=>ReactNode;number:number;showImage:boolean;editPassage?:PassageEdit}){
 const {record,fields}=item;
 const lines=new Map<string,QuizField[]>();
 const titleParts=fields.filter(f=>f.label==='사건명');
 for(const f of fields)if(f.line&&f.label==='사건 내용'){
  if(!lines.has(f.line))lines.set(f.line,[]);
  lines.get(f.line)!.push(f);
 }
 const group=(prefix:string)=>factGroups(fields,prefix).map(parts=>{
  const key=parts[0].wholeKey??parts[0].key;
  const last=parts[parts.length-1];
  const Field=prefix==='actor-'?'li':editPassage?'div':'span';
  return <Field className={editPassage?'fact-passage':'auth-field'} key={key}>
   {editPassage?<><PassagePicker fields={parts} {...editPassage}/>{last.unit??last.suffix}</>:
    parts.map(f=><span key={f.key}>{cell(f)}{f.suffix}</span>)}
  </Field>;
 });
 const person=fields.find(f=>f.key.startsWith('person-'));
 const facts=[['end','종료일'],['category-','카테고리'],['place-','공간'],['actor-','참여 주체']];
 if(!person)facts.unshift(['start',record.end?'시작일':'날짜']);
 const details=facts.map(([key,label])=>{
  const values=group(key);
  return values.length>0&&(key==='actor-'?<QuizActorList key={key}>{values}</QuizActorList>:
   <div key={key}><dt>{label}</dt><dd>{values}{key==='start'&&record.approximate?'경':''}</dd></div>);
 });
 const Title=person?'h3':'h2';
 return <article className={person?'auth-record person-record':'auth-record'} key={record.id}>
  <header className="quiz-record-head">
   {person?<time dateTime={record.date}>{group('start')}{record.approximate?'경':''}</time>:editPassage&&<p>사건 {number}</p>}
   {editPassage?
   <PassagePicker fields={titleParts} {...editPassage}/>:
   <Title>{titleParts.map(f=><span key={f.key}>{cell(f)}</span>)}</Title>}</header>
  <div className="quiz-record-body">
   {person&&<fieldset className="person-answer">
    <legend className="sr-only">{person.label}</legend><span aria-hidden="true">{person.label}</span>{cell(person)}
   </fieldset>}
   {lines.size>0&&<section><h3>사건 내용</h3><div className="auth-prose">{[...lines].map(([line,parts])=>editPassage?
    <PassagePicker key={line} fields={parts} {...editPassage}/>:
    <p key={line}>{parts.map(f=><span key={f.key}>{cell(f)}</span>)}</p>
   )}</div></section>}
   {details.some(Boolean)&&<dl className="quiz-facts">{details}</dl>}
   {showImage&&record.image&&/^(https?:\/\/|\/(?!\/))/i.test(record.image)&&<img className="quiz-photo" src={record.image} alt="사건 관련 자료" onError={e=>e.currentTarget.hidden=true}/>}
  </div>
 </article>;
}

function QuizPlayer({items,close,title,person=false}:{items:Item[];close:()=>void;title:string;person?:boolean}){
 const [index,setIndex]=useState(0),[text,setText]=useState('');
 const [responses,setResponses]=useState<{key:string;id:string;text:string;correct:boolean}[]>([]);
 const choiceSets=useMemo(()=>items.map(question=>question.choices&&shuffle(question.choices)),[items]);
 const numbers=useMemo(()=>numberBlanks(items),[items]);
 const blankId=useId();
 const item=items[index],finished=!item;
 const here=responses.filter(r=>r.id===item?.record.id);
 const blanks=item?.fields.filter(f=>item.blanks.includes(f.key))??[];
 const active=blanks[here.length];
 const input=useRef<HTMLInputElement>(null),next=useRef<HTMLButtonElement>(null);
 const [feedback,setFeedback]=useState(false);
 useEffect(()=>{
  if(!feedback&&!finished)(input.current??next.current)?.focus({preventScroll:person||!active});
 },[index,here.length,active,feedback,finished,person]);
 const displayClue=useMemo(()=>{
  const answers=items.flatMap(q=>q.fields.filter(f=>q.blanks.includes(f.key)));
  const mask=clueMask(answers);
  const bodyMask=clueMask(answers.filter(f=>f.label!=='사건 내용'||f.key===f.line));
  const contexts=new Map<string,Map<string,(s:string)=>string>>();
  for(const q of items){
   const byLine=new Map<string,(s:string)=>string>();
   for(const f of q.fields){
    if(!f.line||f.label==='사건 내용'||f.key===f.wholeKey||!q.blanks.includes(f.key)||byLine.has(f.line))continue;
    const own=q.fields.filter(part=>part.line===f.line);
    byLine.set(f.line,clueMask(answers.filter(answer=>!own.includes(answer))));
   }
   contexts.set(q.record.id,byLine);
  }
  return (f:QuizField,id:string)=>{
   const apply=f.label==='사건 내용'?bodyMask:contexts.get(id)?.get(f.line??'')??mask;
   return apply(f.value+(f.unit??''));
  };
 },[items]);
 const total=items.reduce((n,q)=>n+q.blanks.length,0);
 const last=here.at(-1);
 const lastField=blanks[here.length-1];
 const currentField=active??lastField;
 const currentNumber=currentField&&numbers[index].get(currentField.key);
 const nextLabel=active?'다음 빈칸':index+1===items.length?'결과 보기':'다음 사건';
 function advance(){setFeedback(false);if(!active)setIndex(index+1);}
 function cell(f:QuizField){
  if(!item.blanks.includes(f.key))return displayClue(f,item.record.id);
  const graded=here.find(r=>r.key===f.key);
  const choices=choiceSets[index];
  if(choices)return <div className="person-options">{choices.map((name,i)=>{
   const result=graded?(name===f.value?'correct':name===graded.text?'incorrect':undefined):undefined;
   return <label key={name} className="person-option" data-result={result}>
    <input type="radio" name="person-answer" value={name} ref={i===0?input:undefined}
     checked={name===(graded?.text??text)} disabled={!!graded} onChange={()=>setText(name)}/>
    <span>{name}</span>
    {result&&<span className="person-option-result">{result==='correct'?'정답':'내 답'}</span>}
   </label>;
  })}</div>;
  const current=f.key===active?.key;
  return <span className="numbered-blank">
   <span className="blank-number" id={current?blankId:undefined}>{numbers[index].get(f.key)}<span className="sr-only">번 문항</span></span>
   {graded?<span className={'solved '+(graded.correct?'right':'wrong')}>{f.value}{f.unit}</span>:
    current?<><input ref={input} className="auth-answer" onKeyDown={preventCompositionSubmit} aria-label={f.label+' 정답'} aria-describedby={blankId} value={text} autoComplete="off" inputMode={f.unit?'numeric':'text'} onChange={e=>setText(e.target.value)} placeholder={f.label} style={f.unit?{width:'8ch'}:f.line?{width:'min(100%, '+Math.max(6,Math.min(16,f.value.length+1))+'em)'}:undefined}/>{f.unit}</>:
    <span className="pending-blank" aria-label={f.label+' 빈칸'}>□□ {f.unit}</span>}
  </span>;
 }
 function grade(){
  if(feedback||!active||!text.trim())return;
  const correct=fieldMatches(active,text);
  setResponses([...responses,{id:item.record.id,key:active.key,text,correct}]);
  setFeedback(true);setText('');
 }
 if(finished)return <QuizResultDialog title={person?'관련 인물 퀴즈 결과':'빈칸 퀴즈 결과'} close={close} wide
  actions={<button className="button primary" onClick={close}>마치기</button>}>
  <p className="quiz-score"><strong>{responses.filter(r=>r.correct).length}</strong> / {total}개 정답</p>
  <ol className="quiz-review-list">{items.map((q,i)=><li key={q.record.id}><b>{q.record.title}</b>{responses.filter(r=>r.id===q.record.id).map(r=>{
   const f=q.fields.find(f=>f.key===r.key)!;
   return <p key={r.key}>{!person&&`${numbers[i].get(r.key)}번 `}{f.label} · {r.correct?'정답':`내 답 ${r.text} → 정답`} {f.value}{f.unit}</p>;
  })}</li>)}</ol>
 </QuizResultDialog>;
 return <QuizDialog title={title} close={close} className={person?'quiz-player person-player':'quiz-player'}
  progress={{current:index+1,total:items.length}}>
  {!person&&items.length>1&&<QuizLine items={items} index={index} displayClue={displayClue}/>}
    <form key={item.record.id} onSubmit={e=>{e.preventDefault();grade();}}>
     <RecordSheet item={item} cell={cell} number={index+1} showImage={!active}/>
     <footer className="quiz-footer">{!person&&total>1&&<p>빈칸 {currentNumber} / {total}</p>}
      {active?<button className="button primary" type="submit" disabled={!text.trim()}>정답 확인</button>:<button type="button" ref={next} className="button primary" onClick={advance}>{nextLabel}</button>}
     </footer>
    </form>
  {feedback&&last&&lastField&&<QuizFeedback correct={last.correct} submitted={last.text} answer={lastField.value+(lastField.unit||'')}
   nextLabel={nextLabel} onNext={advance} onDismiss={()=>setFeedback(false)}/>}
 </QuizDialog>;
}

function QuizEventPicker({records,selected,setSelected,search,setSearch}:{records:QuizRecord[];selected:ReadonlySet<string>;setSelected:(ids:Set<string>)=>void;search:string;setSearch:(query:string)=>void}){
 const query=search.trim().toLocaleLowerCase();
 const matching=records.filter(r=>(r.title+' '+r.date).toLocaleLowerCase().includes(query)).map(record=>({record}));
 const allSelected=matching.length>0&&matching.every(({record})=>selected.has(record.id));
 function select(ids:string[],checked:boolean){
  const next=new Set(selected);
  for(const id of ids){if(checked)next.add(id);else next.delete(id);}
  setSelected(next);
 }
 return <><div className="quiz-event-tools">
   <label className="quiz-search">사건 검색<input type="search" placeholder="사건명 또는 날짜" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   <button type="button" className="button secondary" disabled={!matching.length} onClick={()=>select(matching.map(({record})=>record.id),!allSelected)}>
    {query?'검색 결과 ':''}{allSelected?'모두 해제':'모두 선택'}
   </button>
  </div>
  <div className="author-event-list"><EventImportanceGroups entries={matching} selection={{
   has:({record})=>selected.has(record.id),
   set:(items,checked)=>select(items.map(({record})=>record.id),checked)
  }} render={({record})=><label key={record.id}>
   <input type="checkbox" checked={selected.has(record.id)} onChange={e=>select([record.id],e.target.checked)}/><b>{record.title}</b><time>{record.date}</time>
  </label>}/></div></>;
}

function OrderEditor({records,initial,save,saveDraft,close}:{records:QuizRecord[];initial:OrderQuizPlan;save:(plan:OrderQuizPlan)=>void;saveDraft:(plan:OrderQuizPlan)=>void;close:()=>void}){
 const [plan,setPlan]=useState(()=>({kind:'order' as const,title:initial.title,questions:orderQuizQuestions(initial)}));
 const [index,setIndex]=useState(0),[preview,setPreview]=useState(false),[error,setError]=useState(''),[search,setSearch]=useState('');
 const available=useMemo(()=>records.filter(r=>r.startBounds&&!r.approximate).sort((a,b)=>a.startBounds!.start-b.startBounds!.start),[records]);
 const items=plan.questions[index].items;
 const ids=new Set(items.map(item=>item.id));
 const availableIds=new Set(available.map(r=>r.id));
 const availableSelection=items.filter(item=>availableIds.has(item.id));
 const checked=useMemo(()=>plan.questions.map(question=>{
  try{return {records:orderQuestions(question,available),error:''};}
  catch(e){return {records:[],error:(e as Error).message};}
 }),[plan.questions,available]);
 const invalid=checked.findIndex(question=>question.error);
 const problem=checked[index].error||(invalid>=0?`${invalid+1}번 문항을 확인해 주세요.`:'');
 const ready=!!plan.title?.trim()&&invalid===-1;
 function update(next:typeof plan){
  setPlan(next);
  try{saveDraft(next);setError('');}catch{setError('초안을 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.');}
 }
 function chooseQuestion(next:number){setIndex(next);setSearch('');}
 function updateItems(next:typeof items){
  update({...plan,questions:plan.questions.map((question,i)=>i===index?{items:next}:question)});
 }
 return <><QuizDialog title="사건 순서 퀴즈 만들기" className="teacher-dialog quiz-editor" close={close}>
  <section className="author-picker">
   <label className="quiz-name-field">퀴즈 제목 (필수)<input required maxLength={100} value={plan.title||''} onChange={e=>update({...plan,title:e.target.value})} placeholder="학생에게 보여줄 퀴즈 제목"/></label>
   <div className="order-question-bar">
    <div className="author-choices" role="group" aria-label="문항 선택">{plan.questions.map((_,i)=>
     <button key={i} type="button" aria-pressed={i===index} onClick={()=>chooseQuestion(i)}>{i+1}번 문항</button>)}</div>
    <button className="button secondary" type="button" onClick={()=>{
     update({...plan,questions:[...plan.questions,{items:[]}]});chooseQuestion(plan.questions.length);
    }}>문항 추가</button>
   </div>
   <div className="order-question-heading"><h2>{index+1}번 문항의 사건</h2>
    {plan.questions.length>1&&<button className="button secondary" type="button" aria-label={`${index+1}번 문항 삭제`} onClick={()=>{
     const questions=plan.questions.filter((_,i)=>i!==index);
     update({...plan,questions});chooseQuestion(Math.min(index,questions.length-1));
    }}>문항 삭제</button>}
   </div>
   <QuizEventPicker records={available} selected={ids} search={search} setSearch={setSearch} setSelected={next=>updateItems([...next].map(id=>({id})))}/>
   {availableSelection.length<items.length&&<button type="button" className="button secondary" onClick={()=>updateItems(availableSelection)}>출제할 수 없는 사건 제외</button>}
   {error&&<p role="alert">{error}</p>}
  </section>
  <footer className="quiz-footer"><div role="status"><strong>{ids.size}개 선택</strong>{problem&&<p>{problem}</p>}</div>
   <div className="author-actions"><button type="button" className="button secondary" disabled={!ready} onClick={()=>setPreview(true)}>칠판 미리보기</button>
    <button type="button" className="button primary" disabled={!ready} onClick={()=>{
     try{save({...plan,title:plan.title?.trim()});}catch{setError('퀴즈를 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.');}
    }}>출제 완료</button></div>
  </footer>
 </QuizDialog>{preview&&<OrderPlayer title={quizTitle(plan)} questions={checked.map(question=>question.records)} close={()=>setPreview(false)}/>}</>;
}

function InsertionEditor({records,initial,save,saveDraft,close}:{records:QuizRecord[];initial:InsertionQuizPlan;save:(plan:InsertionQuizPlan)=>void;saveDraft:(plan:InsertionQuizPlan)=>void;close:()=>void}){
 const [plan,setPlan]=useState(initial);
 const [search,setSearch]=useState('');
 const [error,setError]=useState('');
 const [preview,setPreview]=useState(false);
 const available=useMemo(()=>records.filter(record=>record.startBounds&&!record.approximate),[records]);
 const ids=new Set(plan.items.map(item=>item.id));
 const availableIds=new Set(available.map(record=>record.id));
 const availableSelection=plan.items.filter(item=>availableIds.has(item.id));
 const checked=useMemo(()=>{
  try{return {records:insertionRecords(plan,records),error:''};}
  catch(e){return {records:[],error:(e as Error).message};}
 },[plan,records]);
 const ready=!!plan.title?.trim()&&!checked.error;
 function update(next:InsertionQuizPlan){
  setPlan(next);
  try{saveDraft(next);setError('');}catch{setError('초안을 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.');}
 }
 return <><QuizDialog title={`${insertionTitle} 만들기`} className="teacher-dialog quiz-editor" close={close}>
  <section className="author-picker">
   <label className="quiz-name-field">퀴즈 제목 (필수)<input required maxLength={100} value={plan.title??''} onChange={e=>update({...plan,title:e.target.value})}/></label>
   <div className="insertion-settings">
    <label className="quiz-name-field">라운드 수<input type="number" min="1" step="1" value={plan.roundCount||''} onChange={e=>update({...plan,roundCount:e.target.valueAsNumber||0})}/></label>
    <label className="quiz-name-field">라운드당 문제 수<input type="number" min="1" step="1" value={plan.questionsPerRound||''} onChange={e=>update({...plan,questionsPerRound:e.target.valueAsNumber||0})}/></label>
   </div>
   <QuizEventPicker records={available} selected={ids} search={search} setSearch={setSearch} setSelected={next=>update({...plan,items:[...next].map(id=>({id}))})}/>
   {availableSelection.length<plan.items.length&&<button type="button" className="button secondary" onClick={()=>update({...plan,items:availableSelection})}>출제할 수 없는 사건 제외</button>}
   {error&&<p role="alert">{error}</p>}
  </section>
  <footer className="quiz-footer"><div role="status"><strong>사건 {ids.size}개 선택</strong><p>{checked.error||'라운드마다 기준 사건 1개와 문제를 무작위로 뽑아요.'}</p></div>
   <div className="author-actions"><button type="button" className="button secondary" disabled={!ready} onClick={()=>setPreview(true)}>칠판 미리보기</button>
    <button type="button" className="button primary" disabled={!ready} onClick={()=>{
     try{save({...plan,title:plan.title?.trim()});}catch{setError('퀴즈를 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.');}
    }}>출제 완료</button></div>
  </footer>
 </QuizDialog>{preview&&<InsertionPlayer title={quizTitle(plan)} records={checked.records} roundCount={plan.roundCount} questionsPerRound={plan.questionsPerRound} close={()=>setPreview(false)}/>}</>;
}

function QuizEditor({records,initial,position,save,saveDraft,close}:{records:QuizRecord[];initial:BlankQuizPlan;position?:EditorPosition;save:(p:BlankQuizPlan)=>void;saveDraft:(p:BlankQuizPlan,position:EditorPosition)=>void;close:()=>void}){
 const [plan,setPlanState]=useState(initial),[requestedStep,setStep]=useState(position?.step??0),[requestedIndex,setIndex]=useState(position?.index??0),[error,setError]=useState('');
 const [preview,setPreview]=useState(false),[search,setSearch]=useState('');
 function setPlan(next:BlankQuizPlan,at:EditorPosition={step,index}){
  setPlanState(next);
  try{saveDraft(next,at);setError('');}catch{setError('초안을 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.');}
 }
 const ordered=useMemo(()=>[...records].sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title,'ko')),[records]);
 const categoryGroups=useMemo(()=>{
  type Choice=ReturnType<typeof categoriesOf>[number]&{count:number};
  const choices=new Map<string,Choice>();
  for(const record of ordered)for(const category of categoriesOf(record)){
   const existing=choices.get(category.id);
   if(existing)existing.count++;
   else choices.set(category.id,{...category,count:1});
  }
  const labels:Record<string,string>={period:'시기',arc:'사건군',theme:'주제'};
  const groups=new Map<string,Choice[]>();
  for(const label of Object.values(labels))groups.set(label,[]);
  for(const category of choices.values()){
   const label=labels[category.type]||category.type||'유형 미지정';
   if(!groups.has(label))groups.set(label,[]);
   groups.get(label)!.push(category);
  }
  return [...groups].filter(([,options])=>options.length);
 },[ordered]);
 const available=ordered.filter(r=>categoriesOf(r).some(c=>plan.categories.includes(c.id)));
 const chosen=new Map(plan.items.map(item=>[item.id,item.blanks]));
 const items=available.filter(r=>chosen.has(r.id)).map(record=>{
  const fields=quizFields(record,plan.categories,chosen.get(record.id));
  return {record,fields,blanks:chosen.get(record.id)!.filter(key=>fields.some(f=>f.key===key))};
 });
 const step=requestedStep===2&&items.length?2:requestedStep>=1&&available.length?1:0;
 const index=Math.min(requestedIndex,Math.max(items.length-1,0));
 const stepHeading=useRef<HTMLHeadingElement>(null);
 const previousStep=useRef(step);
 useLayoutEffect(()=>{
  if(step===previousStep.current)return;
  previousStep.current=step;
  const heading=stepHeading.current;
  const dialog=heading?.closest('dialog');
  if(dialog)dialog.scrollTop=0;
  heading?.focus({preventScroll:true});
 },[step]);
 const item=items[index];
 const assigned=items.reduce((total,item)=>total+item.blanks.length,0);
 const ready=!!plan.title?.trim()&&items.length>0&&items.every(q=>q.blanks.length);
 const toggleBlank=(key:string)=>setPlan({...plan,items:plan.items.map(q=>q.id===item.record.id?{...q,blanks:toggle(item.blanks,key)}:q)});
 function selectCategory(id:string){
  const next=toggle(plan.categories,id);
  const availableIds=new Set(ordered.filter(r=>categoriesOf(r).some(c=>next.includes(c.id))).map(r=>r.id));
  setPlan({...plan,categories:next,items:plan.items.filter(q=>availableIds.has(q.id))});
 }
 const advance=(n:number)=>{setStep(n);setIndex(0);if(plan.title?.trim())setPlan(plan,{step:n,index:0});};
 const move=(i:number)=>{setIndex(i);setPlan(plan,{step,index:i});};
 return <><QuizDialog title="빈칸 퀴즈 만들기" className="teacher-dialog quiz-editor" close={close}>
  <nav className="author-steps" aria-label="출제 단계">{['카테고리','사건','빈칸 지정'].map((label,i)=><button key={label} aria-current={step===i?'step':undefined} disabled={i>0&&(!plan.title?.trim()||(i===1?!available.length:!items.length))} onClick={()=>advance(i)}>{label}</button>)}</nav>
  {step<2?<section key={step} className="author-picker">
   {step===0&&<label className="quiz-name-field">퀴즈 제목 (필수)<input required maxLength={100} value={plan.title||''} onChange={e=>setPlan({...plan,title:e.target.value})} placeholder="학생에게 보여줄 퀴즈 제목"/></label>}
   <h2 tabIndex={-1} ref={stepHeading}>{step===0?'출제할 카테고리':'출제할 사건'}</h2>
   {step===0?<div className="author-category-groups">{categoryGroups.map(([label,options])=>
    <fieldset key={label}><legend>{label}</legend><div className="author-choices">{options.map(({id,name,count})=>
     <button key={id} type="button" aria-pressed={plan.categories.includes(id)} onClick={()=>selectCategory(id)}><span>{name}</span><small>{count}건</small></button>
    )}</div></fieldset>
   )}</div>:
   <QuizEventPicker records={available} selected={new Set(chosen.keys())} search={search} setSearch={setSearch} setSelected={next=>setPlan({...plan,items:[...next].map(id=>({id,blanks:chosen.get(id)??[]}))})}/>}
  </section>:
  <><h2 className="sr-only" tabIndex={-1} ref={stepHeading}>빈칸 지정</h2><QuizLine items={items} index={index} move={move}/>
   <p className="mask-hint">단어를 누르거나 구절을 드래그해 빈칸을 만드세요. <mark>표시한 부분</mark>을 다시 누르면 해제됩니다.</p>
   <span className="sr-only" id="passage-keys">키보드에서는 방향키로 이동하거나 Shift와 방향키로 구절을 선택한 뒤 Enter를 누르세요.</span>
   <RecordSheet item={item} number={index+1} showImage editPassage={{numbers:numberBlanks(items)[index],toggle:toggleBlank}} cell={f=>f.value}/>
  </>}
  <footer className="quiz-footer">{step===0?<span>{plan.categories.length}개 선택</span>:step===1?<span>{items.length}개 사건 선택</span>:<span>빈칸 {assigned}개 · {items.filter(q=>q.blanks.length).length} / {items.length}개 사건</span>}
   {step<2?<button className="button primary" onClick={()=>advance(step+1)} disabled={step===0?!available.length||!plan.title?.trim():!items.length}>{step===0?'사건 선택':'빈칸 지정'}</button>:
    <div className="author-actions">{items.length>1&&<button type="button" disabled={!index} onClick={()=>move(index-1)}>← 이전 사건</button>}
     {index+1<items.length?<button type="button" onClick={()=>move(index+1)}>다음 사건 →</button>:null}
     <button type="button" disabled={!ready} onClick={()=>setPreview(true)}>칠판 미리보기</button>
     <button className="button primary" disabled={!ready} onClick={()=>{
      try{save({title:plan.title?.trim(),categories:plan.categories,items:items.map(q=>({id:q.record.id,blanks:q.blanks}))});}catch{setError('퀴즈를 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.');}
     }}>출제 완료</button></div>}
  </footer>{error&&<p role="alert">{error}</p>}
 </QuizDialog>{preview&&<QuizPlayer title="칠판 미리보기" items={items} close={()=>setPreview(false)}/>}</>;
}

function isPlayable(plan:QuizPlan|undefined,records:QuizRecord[]){
 if(!plan)return false;
 try{
  if(plan.kind==='person')return personQuestions(plan,records).length>0;
  if(plan.kind==='insertion')return insertionRecords(plan,records).length>0;
  if(plan.kind==='order'){
   const questions=orderQuizQuestions(plan);
   return questions.length>0&&questions.every(question=>orderQuestions(question,records).length>0);
  }
  return authoredQuestions(plan,records).length>0;
 }catch{return false;}
}

function quizTitle(plan:QuizPlan){
 if(plan.title)return plan.title;
 if(plan.kind==='insertion')return insertionTitle;
 return plan.kind==='person'?'관련 인물 퀴즈':plan.kind==='order'?'사건 순서 퀴즈':'빈칸 퀴즈';
}

function quizSummary(plan:QuizPlan){
 if(plan.kind==='person')return `관련 인물 퀴즈 · ${plan.items.length}문항`;
 if(plan.kind==='insertion')return `${insertionTitle} · ${plan.roundCount}라운드 × ${plan.questionsPerRound}문제`;
 if(plan.kind==='order'){
  const questions=orderQuizQuestions(plan);
  return questions.length===1?`사건 순서 퀴즈 · 사건 ${questions[0].items.length}개`:`사건 순서 퀴즈 · ${questions.length}문항`;
 }
 return `빈칸 퀴즈 · 사건 ${plan.items.length}개 · 빈칸 ${plan.items.reduce((n,q)=>n+q.blanks.length,0)}개`;
}

function draftHint(plan:QuizPlan,records:QuizRecord[],published:boolean){
 if(!plan.title?.trim())return '퀴즈 제목을 입력해 주세요.';
 if(plan.kind==='person'){
  if(!plan.items.length)return '문제에 낼 인물을 골라 주세요.';
 }else if(plan.kind==='insertion'){
  try{insertionRecords(plan,records);}catch(e){return (e as Error).message;}
 }else if(plan.kind==='order'){
  const incomplete=orderQuizQuestions(plan).findIndex(question=>question.items.length<2);
  if(incomplete>=0)return `${incomplete+1}번 문항에 사건을 2개 이상 골라 주세요.`;
 }else{
  if(!plan.categories.length)return '출제할 카테고리를 골라 주세요.';
  const total=plan.items.length;
  if(!total)return '출제할 사건을 골라 주세요.';
  const pending=plan.items.filter(item=>!item.blanks.length).length;
  if(pending===total)return `사건 ${total}개를 골랐어요. 빈칸을 지정해 주세요.`;
  if(pending)return `사건 ${total}개 중 ${pending}개에 빈칸을 더 지정해 주세요.`;
 }
 if(!isPlayable(plan,records))return '선택한 사건과 문항 구성을 확인해 주세요.';
 return published?'수정한 내용을 미리 보고 다시 출제할 수 있어요.':'미리 보고 출제할 수 있어요.';
}

function OrderPlayer({title,questions,close}:{title:string;questions:QuizRecord[][];close:()=>void}){
 const [index,setIndex]=useState(0);
 return <OrderBoard key={index} title={title} records={questions[index]} close={close}
  progress={questions.length>1?{current:index+1,total:questions.length}:undefined}
  next={index+1<questions.length?()=>setIndex(index+1):undefined}/>;
}

function PlanPlayer({plan,records,close}:{plan:QuizPlan;records:QuizRecord[];close:()=>void}){
 const title=quizTitle(plan);
 if(plan.kind==='person')return <QuizPlayer title={title} items={personQuestions(plan,records)} close={close} person/>;
 if(plan.kind==='insertion')return <InsertionPlayer title={title} records={insertionRecords(plan,records)} roundCount={plan.roundCount} questionsPerRound={plan.questionsPerRound} close={close}/>;
 return plan.kind==='order'?<OrderPlayer title={title} questions={orderQuizQuestions(plan).map(question=>orderQuestions(question,records))} close={close}/>:
  <QuizPlayer title={title} items={authoredQuestions(plan,records)} close={close}/>;
}

function SharedQuiz({plan,records}:{plan:QuizPlan;records:QuizRecord[]}){
 const [playing,setPlaying]=useState(false);
 const ready=useMemo(()=>isPlayable(plan,records),[plan,records]);
 return <><section className="quiz-intro"><div><h2>{quizTitle(plan)}</h2>
  <p>{ready?quizSummary(plan):'원본 사건이 변경되어 이 퀴즈를 열 수 없습니다.'}</p></div>
  <button className="button primary" disabled={!ready} onClick={()=>setPlaying(true)}>{plan.kind==='order'||plan.kind==='insertion'?'칠판 열기':'퀴즈 시작'}</button>
 </section>{playing&&ready&&<PlanPlayer plan={plan} records={records} close={()=>setPlaying(false)}/>}</>;
}

function QuizIntroduction({kind,title,description}:{kind:'blank'|'order'|'person'|'insertion';title:string;description:string}){
 const [open,setOpen]=useState(false);
 const descriptionId=useId();
 const label=title+' 소개 영상';
 return <><button className="quiz-type-preview" type="button" aria-label={label+' 보기'} aria-haspopup="dialog" onClick={()=>setOpen(true)}>
  <img src={'/assets/quiz-previews/'+kind+'.png'} width="1080" height="824" alt=""/>
  <span className="quiz-intro-play"><span aria-hidden="true">▶</span> 소개 영상</span>
 </button>{open&&<QuizDialog title={label} close={()=>setOpen(false)} className="quiz-video-dialog">
  <video controls autoPlay playsInline aria-label={label} aria-describedby={descriptionId} src={'/assets/quiz-previews/'+kind+'.mp4'}/>
  <p id={descriptionId} className="sr-only">{description}</p>
 </QuizDialog>}</>;
}

function QuizLibrary({records,workspace,packageId}:{records:QuizRecord[];workspace:string;packageId:string}){
 const load=()=>{try{return quizLibrary(workspace,localStorage).list();}catch{return [];}};
 const [entries,setEntries]=useState<QuizEdition[]>(load);
 const [editor,setEditor]=useState<QuizEdition|null>(null);
 const [playing,setPlaying]=useState<QuizPlan|null>(null);
 const [sharing,setSharing]=useState<QuizPlan|null>(null);
 const initial=editor?.draft??editor?.published;
 const canPerson=useMemo(()=>records.some(record=>personChoiceFields(record).length>0),[records]);
 const canOrder=records.filter(record=>record.startBounds&&!record.approximate).length>=2;
 useEffect(()=>{
  const refresh=()=>setEntries(load());
  window.addEventListener('storage',refresh);
  return ()=>window.removeEventListener('storage',refresh);
 },[workspace]);
 function store(plan:QuizPlan,publish:boolean,position?:EditorPosition){
  if(!editor)return;
  const entry:QuizEdition=publish?{id:editor.id,published:plan,updated:Date.now()}:{...editor,draft:plan,position,updated:Date.now()};
  quizLibrary(workspace,localStorage).write(entry);
  setEntries(previous=>[entry,...previous.filter(q=>q.id!==entry.id)]);
  if(publish){setEditor(null);setPlaying(plan);}
 }
 function shareUrl(plan:QuizPlan){
  const url=new URL('classroom.html',location.href);
  url.searchParams.set('quiz',packageId);
  url.hash=encodeURIComponent(JSON.stringify(plan));
  return url.href;
 }
 return <>
  <section className="quiz-workbench" aria-label="새 퀴즈">
   <article className="quiz-type">
    <QuizIntroduction kind="blank" title="빈칸 퀴즈" description="교사가 봉오동 전투를 고르고 사건명을 가립니다. 학생은 날짜와 기록을 읽고 빈칸에 봉오동 전투를 입력해 정답을 확인합니다."/>
    <div className="quiz-type-content">
     <h2>빈칸 퀴즈</h2>
     <p>{records.length?'사건명, 날짜, 본문의 빈칸에 답을 입력합니다.':'수업 설정에서 출제할 사건을 선택하세요.'}</p>
     <button className="button primary" disabled={!records.length} onClick={()=>setEditor({id:crypto.randomUUID(),updated:0})}>빈칸 퀴즈 만들기</button>
    </div>
   </article>
   <article className="quiz-type">
    <QuizIntroduction kind="order" title="사건 순서 퀴즈" description="교사가 세 사건을 한 문항에 넣습니다. 학생은 대한 광복회, 봉오동 전투, 광주 학생 항일 운동을 차례로 시간선에 놓고 채점합니다."/>
    <div className="quiz-type-content">
     <h2>사건 순서 퀴즈</h2>
     <p>{canOrder?'사건 카드를 칠판 시간선에 일어난 순서대로 놓습니다.':'시작일이 확인된 사건이 두 개 이상 필요합니다.'}</p>
     <button className="button primary" disabled={!canOrder} onClick={()=>setEditor({id:crypto.randomUUID(),updated:0,draft:{kind:'order',questions:[{items:[]}]}})}>사건 순서 퀴즈 만들기</button>
    </div>
   </article>
   <article className="quiz-type">
    <QuizIntroduction kind="person" title="관련 인물 퀴즈" description="교사가 의열단 결성의 정답 인물로 김원봉을 지정합니다. 학생은 사건 기록을 읽고 보기에서 김원봉을 선택한 뒤 채점합니다."/>
    <div className="quiz-type-content">
     <h2>관련 인물 퀴즈</h2>
     <p>{canPerson?'사건을 읽고 보기에서 관련 인물이나 당시 지도자를 고릅니다.':'정답과 구분되는 인물 보기를 만들 자료가 필요합니다.'}</p>
     <button className="button primary" disabled={!canPerson} onClick={()=>setEditor({id:crypto.randomUUID(),updated:0,draft:{kind:'person',title:'관련 인물 퀴즈',items:[]}})}>관련 인물 퀴즈 만들기</button>
    </div>
   </article>
   <article className="quiz-type">
    <QuizIntroduction kind="insertion" title={insertionTitle} description="교사가 한 라운드에 두 문제를 내도록 정하고 사건 세 개를 선택합니다. 학생은 대한 광복회와 광주 학생 항일 운동 사이에 봉오동 전투를 넣고 결과를 확인합니다."/>
    <div className="quiz-type-content">
     <h2>{insertionTitle}</h2>
     <p>{canOrder?'새 사건이 들어갈 틈을 고르며 시간선을 완성합니다.':'시작일이 확인된 사건이 두 개 이상 필요합니다.'}</p>
     <button type="button" className="button primary" disabled={!canOrder} onClick={()=>setEditor({id:crypto.randomUUID(),updated:0,draft:{kind:'insertion',title:insertionTitle,items:[],roundCount:2,questionsPerRound:2}})}>{insertionTitle} 만들기</button>
    </div>
   </article>
  </section>
  <section className="quiz-library" aria-labelledby="quiz-library-heading">
   <h2 id="quiz-library-heading">내 퀴즈</h2>
   {!entries.length?<p className="library-empty">아직 만든 퀴즈가 없어요.</p>:<ul role="list">{entries.map(entry=>{
    const plan=entry.draft??entry.published!;
    const published=entry.published;
    const live=published&&isPlayable(published,records)?published:null;
    const editLabel=entry.draft?(published?'이어서 수정':'이어서 작성'):'수정';
    return <li key={entry.id} className="library-card">
     <div className="library-card-main">
      <div>
       <h3>{plan.title?.trim()||'제목 없는 퀴즈'}</h3>
       {entry.draft?<p className="library-draft-hint">{draftHint(entry.draft,records,!!published)}</p>:
        <p>{quizSummary(plan)}</p>}
       {published&&!live&&<p className="library-source-notice">원본 자료가 바뀌었어요. 퀴즈 구성을 확인해 주세요.</p>}
      </div>
      {live?<button className="button primary library-play" type="button" aria-haspopup="dialog" onClick={()=>setPlaying(live)}>칠판 열기</button>:
       <button className="button secondary" type="button" aria-haspopup="dialog" onClick={()=>setEditor(entry)}>{editLabel}</button>}
     </div>
     {live&&<div className="library-card-tools">
      <button type="button" aria-haspopup="dialog" onClick={()=>setEditor(entry)}>{editLabel}</button>
      <button type="button" aria-haspopup="dialog" onClick={()=>setSharing(live)}>학생용 링크</button>
     </div>}
    </li>;
   })}</ul>}
  </section>
  {editor&&(initial?.kind==='person'?
   <PersonQuizEditor key={editor.id} records={records} initial={initial} close={()=>setEditor(null)} saveDraft={p=>store(p,false)} save={p=>store(p,true)} preview={setPlaying}/>:initial?.kind==='insertion'?
   <InsertionEditor key={editor.id} records={records} initial={initial} close={()=>setEditor(null)} saveDraft={p=>store(p,false)} save={p=>store(p,true)}/>:initial?.kind==='order'?
   <OrderEditor key={editor.id} records={records} initial={initial} close={()=>setEditor(null)} saveDraft={p=>store(p,false)} save={p=>store(p,true)}/>:
   <QuizEditor key={editor.id} records={records} position={editor.position} initial={initial??emptyPlan()} close={()=>setEditor(null)} saveDraft={(p,at)=>store(p,false,at)} save={p=>store(p,true)}/>)}
  {playing&&<PlanPlayer plan={playing} records={records} close={()=>setPlaying(null)}/>}
  {sharing&&<QuizShareLink url={shareUrl(sharing)} label={quizTitle(sharing)} close={()=>setSharing(null)}/>}
 </>;
}

export function TeacherQuiz({records,workspace,packageId,shared}:{records:QuizRecord[];workspace:string;packageId:string;shared?:QuizPlan}){
 return shared?<SharedQuiz records={records} plan={shared}/>:<QuizLibrary records={records} workspace={workspace} packageId={packageId}/>;
}
