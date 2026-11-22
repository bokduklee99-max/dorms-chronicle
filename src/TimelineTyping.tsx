import {useEffect,useMemo,useRef,useState} from 'react';
import type {QuizRecord} from './record-quiz';
import {categoriesOf,clueMask} from './authored-quiz';
import {QuizFeedback,QuizResultDialog} from './QuizFeedback';
import {QuizActorList,QuizDialog,preventCompositionSubmit} from './QuizDialog';
import {QuizShareLink} from './QuizShareLink';

function typedName(value:string){
 return value.normalize('NFKC').toLowerCase().replace(/[\s\p{P}]/gu,'');
}

function Journey({name,events,practice,finish,onFinish}:{name:string;events:QuizRecord[];practice:boolean;finish:string;onFinish:()=>void}){
 const [index,setIndex]=useState(0),[typed,setTyped]=useState('');
 const [firstTry,setFirstTry]=useState(0),[assisted,setAssisted]=useState(false);
 const [feedback,setFeedback]=useState<boolean|null>(null),[popup,setPopup]=useState(false),[hintOpen,setHintOpen]=useState(false);
 const field=useRef<HTMLInputElement>(null),rail=useRef<HTMLOListElement>(null);
 const event=events[index];
 useEffect(()=>{
  const list=rail.current,stop=list?.children[index] as HTMLElement|undefined;
  if(list&&stop)list.scrollBy({left:stop.getBoundingClientRect().left-list.getBoundingClientRect().left-(list.clientWidth-stop.offsetWidth)/2});
 },[index]);
 useEffect(()=>{
  if(popup||hintOpen)return;
  if(feedback===true)field.current?.form?.querySelector<HTMLButtonElement>('.primary')?.focus();
  else field.current?.focus({preventScroll:true});
 },[feedback,index,popup,hintOpen]);
 const mask=useMemo(()=>event?clueMask([{key:'title',label:'사건명',value:event.title}]):(s:string)=>s,[event]);
 function submit(){
  if(!typed.trim()||feedback!==null)return;
  const correct=typedName(typed)===typedName(event.title);
  if(correct&&!assisted)setFirstTry(n=>n+1);
  if(!correct)setAssisted(true);
  setFeedback(correct);setPopup(true);
 }
 function dismiss(){
  setPopup(false);
  if(feedback===false){setFeedback(null);setTyped('');}
 }
 function proceed(){
  if(feedback){setIndex(i=>i+1);setAssisted(false);}
  setTyped('');setFeedback(null);setPopup(false);
 }
 if(!event)return <QuizResultDialog title={name+' 노선 완주'} close={onFinish} wide
  actions={<button className="button primary" onClick={onFinish}>{finish}</button>}>
  <p className="quiz-score"><strong>{firstTry}</strong> / {events.length}개 첫 입력 정답</p>
  <ol className="quiz-review-list">{events.map(r=><li key={r.id}><b>{r.title}</b><p><time dateTime={r.date}>{r.date}</time></p></li>)}</ol>
 </QuizResultDialog>;
 return <><section className="typing-map" aria-label="사건 노선도"><header><h2>{name}</h2><span>{index+1} / {events.length}역</span></header>
  <ol ref={rail} tabIndex={0} aria-label="날짜순 사건">{events.map((r,i)=><li key={r.id} data-passed={i<index} aria-current={i===index?'step':undefined}>
   <time>{r.date}</time><b>{i<index||practice?r.title:i===index?'현재 역':'미도착'}</b></li>)}</ol>
 </section>
 <form key={event.id} className="typing-turn" onSubmit={e=>{e.preventDefault();if(feedback===true)proceed();else submit();}}>
  <time>{event.date}</time><h3>{practice?event.title:'이 역의 사건명은 무엇인가요?'}</h3>
  {!practice&&<>{event.body&&<p className="typing-clue">{mask(event.body)}</p>}
   {(event.place||event.actors.length>0)&&<dl className="quiz-facts">
    {event.place&&<div><dt>공간</dt><dd>{mask(event.place)}</dd></div>}
    {event.actors.length>0&&<QuizActorList>{[...new Set(event.actors)].map(name=><li key={name}>{mask(name)}</li>)}</QuizActorList>}</dl>}</>}
  <label>사건명<input ref={field} readOnly={feedback===true} value={typed} onChange={e=>setTyped(e.target.value)} autoComplete="off" spellCheck={false}
   onKeyDown={preventCompositionSubmit}/></label>
  <footer>{!practice&&feedback!==true&&<button type="button" className="button secondary" aria-haspopup="dialog" onClick={()=>{setAssisted(true);setHintOpen(true);}}>사건명 보기</button>}
   <button className="button primary" disabled={!typed.trim()}>{feedback===true?(index+1===events.length?'완주 기록':'다음 역'):'정답 확인'}</button></footer>
 </form>
 {hintOpen&&<QuizResultDialog title="이 역의 사건명" close={()=>setHintOpen(false)}
  actions={<button type="button" className="button primary" onClick={()=>setHintOpen(false)}>입력으로 돌아가기</button>}>
  <p className="quiz-answer-text">{event.title}</p>
 </QuizResultDialog>}
 {popup&&feedback!==null&&<QuizFeedback correct={feedback} submitted={typed} answer={event.title} nextLabel={!feedback?'다시 입력':index+1===events.length?'완주 기록':'다음 역'} onNext={proceed} onDismiss={dismiss}/>}
 </>;
}

export type SharedRoute={category:string;practice:boolean;ids:string[]};

export function TimelineTyping({records,packageId,shared}:{records:QuizRecord[];packageId:string;shared?:SharedRoute}){
 const routes=useMemo(()=>{
  const grouped=new Map<string,{name:string;events:QuizRecord[]}>();
  const included=shared ? new Set(shared.ids) : null;
  const sorted=records.filter(r=>(!included||included.has(r.id))&&r.date&&typedName(r.title)).sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title,'ko'));
  for(const record of sorted)for(const category of categoriesOf(record)){
   if(!grouped.has(category.id))grouped.set(category.id,{name:category.name,events:[]});
   grouped.get(category.id)!.events.push(record);
  }
  return grouped;
 },[records,shared]);
 const [opened,setOpened]=useState(false);
 const [route,setRoute]=useState(shared?.category??''),[practice,setPractice]=useState(shared?.practice??false),[running,setRunning]=useState(false);
 const selected=routes.get(route);
 const [share,setShare]=useState(false);
 const canStart=shared?selected?.events.length===shared.ids.length:routes.size>0;
 const url=new URL('classroom.html',location.href);
 url.searchParams.set('typing',packageId);
 if(selected)url.hash=encodeURIComponent(JSON.stringify({category:route,practice,ids:selected.events.map(r=>r.id)}));
 return <><section className="quiz-intro typing-intro"><div><h2>{shared&&selected?selected.name+' · 연표 타이핑':'연표 타이핑'}</h2>
  <p>{shared?(canStart?(practice?'보고 따라 치기':'사건명 맞히기')+' · 사건 '+shared.ids.length+'개':'원본 사건이 변경되어 공유된 노선을 열 수 없습니다.'):routes.size?'수업 카테고리를 골라 사건명을 입력하며 연표를 완주하세요.':'날짜와 사건명이 있는 사건을 수업에 추가해 주세요.'}</p></div>
  <button className="button primary" disabled={!canStart} onClick={()=>{setRunning(!!shared);setOpened(true);}}>{shared?'타이핑 시작':'노선 고르기'}</button></section>
  {opened&&<QuizDialog title="연표 타이핑" className="typing-dialog" close={()=>setOpened(false)}>
   {running&&selected?<Journey name={selected.name} events={selected.events} practice={practice} finish={shared?'마치기':'노선 다시 고르기'} onFinish={()=>shared?setOpened(false):setRunning(false)}/>:
    <section className="typing-setup"><fieldset><legend>카테고리 노선</legend><div className="author-choices">{[...routes].map(([id,{name,events}])=>
     <button key={id} aria-pressed={route===id} onClick={()=>setRoute(id)}>{name} <small>{events.length}역</small></button>)}</div></fieldset>
    <fieldset><legend>풀이 방식</legend><div className="author-choices"><button aria-pressed={!practice} onClick={()=>setPractice(false)}>사건명 맞히기</button><button aria-pressed={practice} onClick={()=>setPractice(true)}>보고 따라 치기</button></div></fieldset>
    <footer><div className="author-actions"><button type="button" className="button secondary" disabled={!selected} aria-haspopup="dialog" onClick={()=>setShare(true)}>학생용 링크</button>
     <button className="button primary" disabled={!selected} onClick={()=>setRunning(true)}>출발</button></div></footer>
    {share&&selected&&<QuizShareLink key={url.href} label="이 노선의 학생용 링크" url={url.href} close={()=>setShare(false)}/>}</section>}
  </QuizDialog>}</>;
}
