import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {QuizActorList,QuizDialog} from './QuizDialog';
import {QuizResultDialog} from './QuizFeedback';
import {shuffle,type QuizRecord} from './record-quiz';

export function OrderBoard({title,records,close,next,progress}:{title:string;records:QuizRecord[];close:()=>void;next?:()=>void;progress?:{current:number;total:number}}){
 const [deck,setDeck]=useState(()=>shuffle(records));
 const [slots,setSlots]=useState<(QuizRecord|null)[]>(()=>records.map(()=>null));
 const [selected,setSelected]=useState<QuizRecord|null>(null);
 const [detail,setDetail]=useState<QuizRecord|null>(null);
 const [phase,setPhase]=useState<'playing'|'moving'|'review'>('playing');
 const [resultDismissed,setResultDismissed]=useState(false);
 const [message,setMessage]=useState('');
 const [over,setOver]=useState<number|null>(null);
 const axis=useRef<HTMLOListElement>(null);
 const heading=useRef<HTMLHeadingElement>(null);
 const dragging=useRef<QuizRecord|null>(null);
 const placedIndex=useRef<number|null>(null);
 useLayoutEffect(()=>{
  if(placedIndex.current===null)return;
  axis.current?.children[placedIndex.current]?.querySelector('button')?.focus({preventScroll:true});
  placedIndex.current=null;
 },[slots]);
 const [scroll,setScroll]=useState({back:false,forward:false});
 const graded=phase==='review';
 const showResult=graded&&!resultDismissed;
 const locked=phase!=='playing';
 useEffect(()=>{
  if(phase!=='moving'&&!showResult)heading.current?.focus({preventScroll:true});
 },[phase,showResult]);
 useEffect(()=>{
  const line=axis.current!;
  function update(){setScroll({back:line.scrollLeft>1,forward:line.scrollLeft+line.clientWidth<line.scrollWidth-1});}
  const observer=new ResizeObserver(update);
  observer.observe(line);line.addEventListener('scroll',update);
  return ()=>{observer.disconnect();line.removeEventListener('scroll',update);};
 },[]);
 function page(direction:number){
  const line=axis.current;
  if(line)line.scrollBy({left:direction*line.clientWidth*0.85});
 }
 const placed=new Set(slots.flatMap(slot=>slot?[slot.id]:[]));
 const remaining=deck.filter(record=>!placed.has(record.id));
 const hits=slots.filter((record,i)=>record?.id===records[i].id).length;
 const allCorrect=hits===records.length;
 const submittedPositions=new Map(slots.map((record,index)=>[record?.id,index+1]));

 useLayoutEffect(()=>{
  if(phase!=='moving')return;
  const line=axis.current!;
  const destinations=new Map(records.map((record,index)=>[record.id,index]));
  const animations:Animation[]=[];
  for(const [from,record] of slots.entries()){
   if(!record)continue;
   const to=destinations.get(record.id)!;
   if(from===to)continue;
   const card=line.children[from].querySelector<HTMLElement>('.order-card')!;
   const distance=line.children[to].getBoundingClientRect().left-line.children[from].getBoundingClientRect().left;
   const lift=to>from?-14:12;
   animations.push(card.animate([
    {transform:'translate(0,0)',backgroundColor:'#ffebca'},
    {transform:`translate(${distance/2}px,${lift}px)`,backgroundColor:'#ffebca',offset:.5},
    {transform:`translate(${distance}px,0)`,backgroundColor:'#fffef6'}
   ],{duration:850,delay:150,easing:'ease-in-out',fill:'both'}));
  }
  let active=true;
  Promise.all(animations.map(animation=>animation.finished)).then(()=>{
   if(active)setPhase('review');
  }).catch(()=>{/* Closing the board cancels the animation. */});
  return ()=>{active=false;animations.forEach(animation=>animation.cancel());};
 },[phase,records,slots]);

 function grade(){
  if(locked||placed.size!==records.length)return;
  setSelected(null);setMessage('');
  setPhase(allCorrect||window.matchMedia('(prefers-reduced-motion: reduce)').matches?'review':'moving');
 }
 function choose(record:QuizRecord){
  setSelected(selected?.id===record.id?null:record);
  setMessage('');
 }
 function place(record:QuizRecord,index:number){
  if(locked)return;
  const previous=slots.findIndex(slot=>slot?.id===record.id);
  const next=[...slots];
  if(previous>=0)next[previous]=slots[index];
  next[index]=record;
  placedIndex.current=index;
  setSlots(next);setSelected(null);setOver(null);
  setMessage(`${record.title}, ${index+1}번째에 배치했습니다.`);

 }
 function reset(){
  setResultDismissed(false);
  setDeck(shuffle(records));setSlots(records.map(()=>null));setSelected(null);setPhase('playing');setMessage('');
  axis.current?.scrollTo({left:0});
 }
 function card(record:QuizRecord,index?:number){
  const active=selected?.id===record.id;
  return <div className="order-card" data-selected={active}>
   <button type="button" className="order-card-name" aria-pressed={graded?undefined:active}
    draggable={!locked} onDragStart={event=>{
     dragging.current=record;setSelected(record);event.dataTransfer.effectAllowed='move';
     event.dataTransfer.setData('text/plain',record.title);
    }} onDragEnd={()=>{dragging.current=null;setOver(null);}}
    onClick={()=>{if(graded)setDetail(record);else if(locked)return;else if(index!==undefined&&selected)place(selected,index);else choose(record);}}>
    <strong>{record.title}</strong>
   </button>
   <div className="order-card-foot">{graded&&<time dateTime={record.date}>{record.date}</time>}
    <button type="button" disabled={phase==='moving'} aria-label={record.title+' 사건 기록 보기'} onClick={()=>setDetail(record)}>기록 보기</button>
   </div>
  </div>;
 }
 return <QuizDialog title={title} close={close} className="order-dialog" progress={progress}>
  <section className="order-surface" aria-label="사건 배치 칠판">
   <header className="order-heading"><h3 ref={heading} tabIndex={-1}>{graded?(allCorrect?'모두 맞혔어요':'정답 순서'):'사건 순서 맞추기'}</h3>
    <p role="status">{graded?`정답 ${hits}개 · 오답 ${records.length-hits}개`:`${placed.size} / ${records.length}개 배치`}</p>
   </header>
   <p className="order-instruction">{graded?'사건이 일어난 순서입니다.':phase==='moving'?'틀린 사건이 제자리로 이동합니다.':selected?`‘${selected.title}’을 놓을 자리를 누르세요.`:'사건 카드를 고른 뒤 시간선 위의 자리를 누르세요.'}</p>
   <div className="order-direction"><span>먼저 → 나중</span>
    {(scroll.back||scroll.forward)&&<div><button type="button" aria-label="앞쪽 자리 보기" disabled={!scroll.back} onClick={()=>page(-1)}>←</button>
     <button type="button" aria-label="뒤쪽 자리 보기" disabled={!scroll.forward} onClick={()=>page(1)}>→</button></div>}
   </div>
   <ol ref={axis} className="order-axis" data-phase={phase} aria-label={graded?'정답 시간선':'사건 시간선'}>
    {(graded?records:slots).map((record,index)=><li key={index} data-over={over===index}
     onDragOver={event=>{if(dragging.current&&!locked){event.preventDefault();event.dataTransfer.dropEffect='move';setOver(index);}}}
     onDrop={event=>{event.preventDefault();if(dragging.current)place(dragging.current,index);dragging.current=null;}}>
     <span className="order-tick">{index+1}</span>
     {record?card(record,index):<button className="order-slot" type="button" aria-label={(index+1)+'번째 자리에 놓기'}
      disabled={!selected} onClick={()=>{if(selected)place(selected,index);}}>사건 놓기</button>}
    </li>)}
   </ol>
   <span className="sr-only" role="status">{message}</span>
  </section>
  {!graded&&remaining.length>0&&<section className="order-deck"><h3>배치할 사건</h3>
   <div>{remaining.map(record=><div key={record.id}>{card(record)}</div>)}</div>
  </section>}
  <footer className="quiz-footer order-controls" data-review={graded}>
   {graded?<><button className="button secondary" onClick={()=>setResultDismissed(false)}>내 배치 확인</button><button className="button secondary" onClick={reset}>다시 풀기</button><button className="button primary" onClick={next??close}>{next?'다음 문항':'마치기'}</button></>:
    <>{selected&&<button className="button secondary" onClick={()=>setSelected(null)}>선택 해제</button>}
     <button className="button primary" disabled={locked||placed.size!==records.length} onClick={grade}>정답 확인</button></>}
  </footer>
  {showResult&&<QuizResultDialog title={allCorrect?'순서가 모두 맞았어요':'순서가 달라요'} correct={allCorrect} close={()=>setResultDismissed(true)} wide
   actions={<><button className="button secondary" onClick={reset}>다시 풀기</button><button className={next?'button secondary':'button primary'} onClick={()=>setResultDismissed(true)}>시간선에서 보기</button>
    {next&&<button className="button primary" onClick={next}>다음 문항</button>}</>}>
   <div className="quiz-solution-heading">
    <h3>정답 순서</h3><p>{records.length}개 중 <strong>{hits}개</strong> 정답</p>
   </div>
   <ol className="quiz-order-solution" role="list" aria-label="정답 순서">{records.map((record,index)=>{
    const submitted=submittedPositions.get(record.id);
    return <li key={record.id}>
     <span className="quiz-solution-position" aria-hidden="true">{index+1}</span>
     <div><strong>{record.title}</strong><time dateTime={record.date}>{record.date}</time></div>
     {submitted!==index+1&&<span className="quiz-solution-mismatch">내 배치 {submitted}번</span>}
    </li>;
   })}</ol>
  </QuizResultDialog>}
  {detail&&<QuizDialog title={detail.title} close={()=>setDetail(null)} className="order-record">
   <div className="order-detail">
    {graded&&<time dateTime={detail.date}>{detail.date}</time>}
    {detail.body&&<p>{detail.body}</p>}
    {(detail.place||detail.actors.length>0||detail.categories.length>0)&&<dl className="quiz-facts">
     {detail.place&&<div><dt>장소</dt><dd>{detail.place}</dd></div>}
     {detail.actors.length>0&&<QuizActorList>{[...new Set(detail.actors)].map(name=><li key={name}>{name}</li>)}</QuizActorList>}
     {detail.categories.length>0&&<div><dt>카테고리</dt><dd>{detail.categories.join(' · ')}</dd></div>}
    </dl>}
    {detail.image&&/^(https?:\/\/|\/(?!\/))/i.test(detail.image)&&<img className="quiz-photo" src={detail.image} alt={detail.title+' 관련 자료'} onError={e=>{e.currentTarget.hidden=true;}}/>}
    {!graded&&!detail.body&&!detail.place&&!detail.categories.length&&!detail.actors.length&&!detail.image&&<p>추가로 등록된 사건 설명이 없습니다.</p>}
   </div>
   {!graded&&<footer className="quiz-footer"><button type="button" className="button primary" onClick={()=>{setSelected(detail);setDetail(null);setMessage('');}}>이 사건 배치하기</button></footer>}
  </QuizDialog>}
 </QuizDialog>;
}
