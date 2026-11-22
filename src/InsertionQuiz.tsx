import {Fragment,useEffect,useRef,useState,type CSSProperties} from 'react';
import {QuizDialog} from './QuizDialog';
import {QuizFeedback,QuizResultDialog} from './QuizFeedback';
import {dealInsertionRounds} from './authored-quiz';
import {quizInsertionIndex,shuffle,type QuizRecord} from './record-quiz';

function gapLabel(placed:QuizRecord[],index:number){
 const before=placed[index-1],after=placed[index];
 if(!before)return `‘${after.title}’ 이전`;
 if(!after)return `‘${before.title}’ 이후`;
 return `‘${before.title}’과 ‘${after.title}’ 사이`;
}

export function InsertionPlayer({title,records,roundCount,questionsPerRound,close}:{
 title:string;records:QuizRecord[];roundCount:number;questionsPerRound:number;close:()=>void;
}){
 const [rounds]=useState(()=>dealInsertionRounds(records,roundCount,questionsPerRound,shuffle));
 const [round,setRound]=useState(0);
 const [scores,setScores]=useState<number[]>([]);
 const last=round+1===rounds.length;
 if(scores.length>round)return <QuizResultDialog title={last?'게임 결과':`${round+1}라운드 결과`} close={close} wide
  actions={<button type="button" className="button primary" onClick={last?close:()=>setRound(round+1)}>{last?'마치기':`${round+2}라운드 시작`}</button>}>
  <p className="quiz-score"><strong>{last?scores.reduce((sum,score)=>sum+score,0):scores[round]}</strong> / {last?roundCount*questionsPerRound:questionsPerRound}문제 정답</p>
  {last&&roundCount>1&&<ol className="insertion-scores" aria-label="라운드별 결과">{scores.map((score,i)=><li key={i}><span>{i+1}라운드</span><strong>{score} / {questionsPerRound}</strong></li>)}</ol>}
 </QuizResultDialog>;
 return <InsertionRound key={round} title={title} cards={rounds[round]} round={round+1} totalRounds={roundCount} close={close}
  finish={score=>setScores([...scores,score])}/>;
}

function InsertionRound({title,cards,round,totalRounds,finish,close}:{
 title:string;cards:QuizRecord[];round:number;totalRounds:number;finish:(score:number)=>void;close:()=>void;
}){
 const [placed,setPlaced]=useState([cards[0]]);
 const [question,setQuestion]=useState(1);
 const [score,setScore]=useState(0);
 const [answer,setAnswer]=useState<{correct:boolean;submitted:string;answer:string;show:boolean}|null>(null);
 const prompt=useRef<HTMLHeadingElement>(null);
 const next=useRef<HTMLButtonElement>(null);
 const current=cards[question];
 const total=cards.length-1;
 const nextLabel=question===total?'라운드 결과 보기':'다음 사건';

 useEffect(()=>{prompt.current?.focus();},[question]);
 useEffect(()=>{if(answer&&!answer.show)next.current?.focus();},[answer]);

 function place(index:number){
  if(answer)return;
  const actual=quizInsertionIndex(placed,current);
  const correct=index===actual;
  setAnswer({correct,submitted:gapLabel(placed,index),answer:`${gapLabel(placed,actual)} · ${current.date}`,show:true});
  if(correct)setScore(score+1);
  setPlaced([...placed.slice(0,actual),current,...placed.slice(actual)]);
 }

 function advance(){
  if(question===total){finish(score);return;}
  setAnswer(null);
  setQuestion(question+1);
 }

 return <QuizDialog title={title} close={close} className="insertion-dialog" progress={{current:question,total}}>
  <div className="insertion-prompt">
   <div><p>{round} / {totalRounds}라운드</p><p>{score}개 정답</p></div>
   <h3 ref={prompt} tabIndex={-1}>{current.title}</h3>
  </div>
  <section className="insertion-timeline" aria-label="사건 시간선">
   <div className="insertion-direction"><span>이른 사건</span><span>늦은 사건</span></div>
   <div className="insertion-scroll">
    <div className="insertion-track" data-review={!!answer} style={{'--placed-count':placed.length} as CSSProperties}>
     {Array.from({length:placed.length+1},(_,i)=>{
      const event=placed[i];
      return <Fragment key={event?.id??'last'}>
       {!answer&&<button type="button" className="insertion-choice" aria-label={`${i+1}번 자리, ${gapLabel(placed,i)}에 놓기`} onClick={()=>place(i)}>
        {i+1}</button>}
       {event&&<div className="insertion-event" data-new={answer&&event.id===current.id?true:undefined}>
        <strong>{event.title}</strong><time dateTime={event.date}>{event.date}</time>
       </div>}
      </Fragment>;
     })}
    </div>
   </div>
   <p className="insertion-instruction">{answer?'사건을 정답 위치에 놓았어요.':'새 사건이 들어갈 자리를 고르세요.'}</p>
  </section>
  {answer&&<footer className="quiz-footer"><button type="button" className="button primary" ref={next} onClick={advance}>{nextLabel}</button></footer>}
  {answer?.show&&<QuizFeedback {...answer} nextLabel={nextLabel} onNext={advance} onDismiss={()=>setAnswer({...answer,show:false})}/>}
 </QuizDialog>;
}
