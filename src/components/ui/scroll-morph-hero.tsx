import {useEffect,useRef,useState} from 'react';
import {motion,useMotionValueEvent,useReducedMotion,useScroll} from 'framer-motion';
import {heroPosition,type ChronicleCard} from '../../landing-model';

export default function ScrollMorphHero({cards}:{cards:ChronicleCard[]}){
 const section=useRef<HTMLElement>(null),stage=useRef<HTMLDivElement>(null);
 const [size,setSize]=useState({width:0,height:0}),[progress,setProgress]=useState(0);
 const [flipped,setFlipped]=useState<string|null>(null);
 const reduced=useReducedMotion();
 const {scrollYProgress}=useScroll({target:section,offset:['start start','end end']});
 useMotionValueEvent(scrollYProgress,'change',setProgress);
 useEffect(()=>{
  if(!stage.current)return;
  const observer=new ResizeObserver(([entry])=>setSize({width:entry.contentRect.width,height:entry.contentRect.height}));
  observer.observe(stage.current);return()=>observer.disconnect();
 },[]);
 return <section className="morph-section" ref={section} aria-label="역사 탐색 소개">
  <div className="morph-stage" ref={stage}>
   <div className="orbit-guide" aria-hidden="true" style={{opacity:1-Math.min(progress*3,1)}}/>
   <motion.div className="hero-copy" animate={{y:reduced?0:-Math.min(progress*2.5,1)*size.height*.2}} transition={{type:'spring',stiffness:45,damping:20}}>
    <h1>DoRms'<br/><em>Chronicle</em><span>.</span></h1>
    <p>사건과 인물을 따라 역사의 흐름을 읽다.</p>
    <a className="primary-link" href="/?setup=1">역사 탐색하기 <span aria-hidden="true">↗</span></a>
   </motion.div>
   <div className="orbit-cards">
    {size.width>0&&cards.map((card,index)=>{
     const target=heroPosition(index,cards.length,size.width,size.height,reduced?0:progress);
     const summaryId=`orbit-summary-${card.id}`;
     return <motion.a key={card.id} href={card.href} className="orbit-card" tabIndex={progress>.05?-1:0} aria-label={`${card.date} ${card.title}`} aria-describedby={summaryId}
      data-flipped={flipped===card.id||undefined} initial={reduced?false:{...target,opacity:0}} animate={{...target,opacity:1}} transition={reduced?{duration:0}:{type:'spring',stiffness:48,damping:17}}
      onClick={event=>{
       if(event.detail>0&&window.matchMedia('(hover:none)').matches&&flipped!==card.id){
        event.preventDefault();setFlipped(card.id);
       }
      }}>
      <span className="orbit-flip">
       <span className="orbit-front"><img src={card.image} alt="" fetchPriority={index<4?'high':'auto'}/><span>{card.title}</span></span>
       <span className="orbit-back"><time dateTime={card.date}>{card.date.replaceAll('-','.')}</time><span id={summaryId} className="orbit-summary">{card.summary}</span><span className="orbit-more" aria-hidden="true">↗</span></span>
      </span>
     </motion.a>;
    })}
   </div>
  </div>
 </section>;
}
