import {useEffect,useRef,useState} from 'react';
import {motion,useMotionValueEvent,useReducedMotion,useScroll} from 'framer-motion';
import {heroPosition,type ChronicleCard} from '../../landing-model';

export default function ScrollMorphHero({cards}:{cards:ChronicleCard[]}){
 const section=useRef<HTMLElement>(null),stage=useRef<HTMLDivElement>(null);
 const [size,setSize]=useState({width:1200,height:800}),[phase,setPhase]=useState('scatter'),[progress,setProgress]=useState(0);
 const reduced=useReducedMotion();
 const {scrollYProgress}=useScroll({target:section,offset:['start start','end end']});
 useMotionValueEvent(scrollYProgress,'change',setProgress);
 useEffect(()=>{
  if(!stage.current)return;
  const observer=new ResizeObserver(([entry])=>setSize({width:entry.contentRect.width,height:entry.contentRect.height}));
  observer.observe(stage.current);return()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  if(reduced){setPhase('circle');return;}
  const line=setTimeout(()=>setPhase('line'),150),circle=setTimeout(()=>setPhase('circle'),1000);
  return()=>{clearTimeout(line);clearTimeout(circle);};
 },[reduced]);
 return <section className="morph-section" ref={section} aria-label="역사 탐색 소개">
  <div className="morph-stage" ref={stage}>
   <div className="orbit-guide" aria-hidden="true" style={{opacity:1-Math.min(progress*3,1)}}/>
   <motion.div className="hero-copy" animate={{y:reduced?0:-Math.min(progress*2.5,1)*size.height*.2}} transition={{type:'spring',stiffness:45,damping:20}}>
    <h1>Dorms'<br/><em>Chronicle</em><span>.</span></h1>
    <p>사건과 인물을 따라 역사의 흐름을 읽다.</p>
    <a className="primary-link" href="/?setup=1">역사 탐색하기 <span aria-hidden="true">↗</span></a>
   </motion.div>
   <div className="orbit-cards">
    {cards.map((card,index)=>{
     const target=heroPosition(index,cards.length,size.width,size.height,reduced?0:progress);
     const position=phase==='scatter'?{x:(index%2?1:-1)*size.width*.6,y:(index%3-1)*size.height*.6,rotate:index*17,scale:.6,opacity:0}:phase==='line'&&progress<.02?{x:(index-(cards.length-1)/2)*85,y:0,rotate:0,scale:.65,opacity:1}:{...target,opacity:1};
     return <motion.a key={card.id} href={card.href} className="orbit-card" tabIndex={progress>.05?-1:0} aria-label={`${card.date} ${card.title}`} initial={false} animate={position} transition={reduced?{duration:0}:{type:'spring',stiffness:48,damping:17}}>
      <span className="orbit-flip"><span className="orbit-front"><img src={card.image} alt="" fetchPriority={index<4?'high':'auto'}/><span>{card.title}</span></span><span className="orbit-back"><time>{card.date}</time><strong>{card.title}</strong><span>사건 살펴보기 ↗</span></span></span>
     </motion.a>;
    })}
   </div>
  </div>
 </section>;
}
