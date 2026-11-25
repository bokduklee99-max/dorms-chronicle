import {useLayoutEffect,useMemo,useRef,useState} from 'react';
import type {CSSProperties} from 'react';
import {buildStarTimeline,dateAtProgress,placeCategoryRanges,placeCategoryStars} from './constellation-model';
import type {EventRecord,HistoryData} from './metro-model';
import {categoryColors} from './topic-colors';
import './constellation.css';

function gaugePoint(angle: number,radius: number){
 const radians = angle*Math.PI/180;
 return [180+Math.sin(radians)*radius,135-Math.cos(radians)*radius] as const;
}

const gaugeMarks = Array.from({length:29},(_,index) => {
 const major = index%7===0;
 return {angle:-81+index*162/28,major};
});

function scrollBounds(container: HTMLElement,panel: HTMLElement){
 const tail = parseFloat(getComputedStyle(container).paddingBottom);
 const top = parseFloat(getComputedStyle(panel).top);
 return {top,distance:Math.max(1,container.offsetHeight-panel.offsetHeight-tail)};
}

type StarTimeline = ReturnType<typeof buildStarTimeline>;
type VisitStar = (id:string,star:HTMLButtonElement,topicId?:string)=>void;

function StarNode({star,index,x,y,inView=true,active,related,onHover,onFocus,onVisit}:{
 star:StarTimeline['stars'][number]; index:number; x:number; y:number; inView?:boolean; active:boolean; related:boolean;
 onHover:(id:string|null)=>void; onFocus:(id:string|null)=>void; onVisit:VisitStar;
}){
 const {event,categoryIds} = star;
 return <button type="button" className="star-event" aria-haspopup="dialog"
  aria-label={event.date+' '+event.title} aria-hidden={!inView || undefined} tabIndex={inView?0:-1}
  data-active={active} data-bridge={categoryIds.length>1} data-related={related}
  style={{
   left:x,top:y,
   '--star-overlap':Math.max(0,categoryIds.length-1),
   '--twinkle-phase':`-${index%17*.37}s`,
   '--twinkle-period':`${4+index%7*.48}s`,
  } as CSSProperties}
  onPointerEnter={pointer=>{if(pointer.pointerType!=='touch')onHover(event.id);}}
  onPointerLeave={()=>onHover(null)}
  onFocus={()=>onFocus(event.id)} onBlur={()=>onFocus(null)}
  onKeyDown={key=>{if(key.key==='Escape'){onHover(null);onFocus(null);}}}
  onClick={click=>{onHover(null);onFocus(null);onVisit(event.id,click.currentTarget);}}>
  <span aria-hidden="true"/>
 </button>;
}

function StarPreview({event,media,x,y,width,height}:{
 event:EventRecord; media:Record<string,string>; x:number; y:number; width:number; height:number;
}){
 const image = TimelineImage.src(event.media[0]?.url,media);
 return <div className="star-preview" aria-hidden="true"
  style={{left:Math.max(10,Math.min(x+16,width-258)),top:Math.min(y+18,Math.max(4,height-(image?183:85)))}}>
  {image&&<img src={image} alt="" onError={event=>{event.currentTarget.hidden=true;}}/>}
  <time>{event.date}</time>
  <strong>{event.title}</strong>
 </div>;
}

function CategoryConstellation({range,stars,media,detailOpen,onClose,onVisit}:{
 range:StarTimeline['ranges'][number]; stars:StarTimeline['stars']; media:Record<string,string>;
 detailOpen:boolean; onClose:()=>void; onVisit:VisitStar;
}){
 const dialog = useRef<HTMLDialogElement>(null);
 const sky = useRef<HTMLDivElement>(null);
 const [size,setSize] = useState({width:0,height:0});
 const [hovered,setHovered] = useState<string|null>(null);
 const [focused,setFocused] = useState<string|null>(null);
 const {category,first,last} = range;
 const topicId = category.topic_id;
 const {width,height} = size;
 const points = useMemo(() => placeCategoryStars(stars,topicId,width,height),[stars,topicId,width,height]);
 const active = points.find(({event})=>event.id===(hovered||focused));

 useLayoutEffect(() => {
  const panel = dialog.current, field = sky.current;
  if (!panel || !field) return;
  panel.showModal();
  const measure = () => setSize({width:field.clientWidth,height:field.clientHeight});
  const observer = new ResizeObserver(measure);
  observer.observe(field);
  measure();
  return () => {observer.disconnect();panel.close();};
 },[]);

 return <dialog ref={dialog} className="star-category-dialog" aria-labelledby="star-category-title" onClose={onClose}>
  <div className="star-category-scene" inert={detailOpen}>
   <header className="star-category-heading">
    <div><h2 id="star-category-title">{category.name}</h2>
     <p>{first.event.date}{first.event.date!==last.event.date&&` – ${last.event.date}`}</p></div>
    <button type="button" aria-label="별자리 닫기" onClick={()=>dialog.current?.close()}>×</button>
   </header>
   <div className="star-sky" ref={sky}>
    <div className="star-dust" aria-hidden="true"/>
    <svg className="star-network" width={width} height={height} aria-hidden="true">
     {points.slice(1).map(({event,x,y},index)=><line key={event.id} className="star-link lit"
      x1={points[index].x} y1={points[index].y} x2={x} y2={y}/>)}
    </svg>
    {points.map((star,index)=><StarNode key={star.event.id} star={star} index={index} x={star.x} y={star.y}
     active={active===star} related onHover={setHovered} onFocus={setFocused}
     onVisit={(id,button)=>onVisit(id,button,topicId)}/>)}
    {active&&!detailOpen&&<StarPreview key={active.event.id} event={active.event} media={media} x={active.x} y={active.y} width={width} height={height}/>}
   </div>
  </div>
 </dialog>;
}

export function Constellation({data,media,detailOpen,onVisit}:{
 data:HistoryData;
 media:Record<string,string>;
 detailOpen:boolean;
 onVisit:VisitStar;
}){
 const timeline = useMemo(() => buildStarTimeline(data.events,data.topics),[data]);
 const section = useRef<HTMLElement>(null);
 const stage = useRef<HTMLDivElement>(null);
 const sky = useRef<HTMLDivElement>(null);
 const categoryDeck = useRef<HTMLDivElement>(null);
 const categoryTrigger = useRef<HTMLButtonElement>(null);
 const seekPosition = useRef<{scrollY:number;progress:number}|null>(null);
 const [size,setSize] = useState({width:0,height:0});
 const [deckWidth,setDeckWidth] = useState(0);
 const [progress,setProgress] = useState(0);
 const [hovered,setHovered] = useState<string|null>(null);
 const [focused,setFocused] = useState<string|null>(null);
 const [pointedCategory,setPointedCategory] = useState<string|null>(null);
 const [focusedCategory,setFocusedCategory] = useState<string|null>(null);
 const [selectedCategory,setSelectedCategory] = useState<string|null>(null);
 const [modalCategory,setModalCategory] = useState<string|null>(null);
 const modalRange = timeline.ranges.find(({category})=>category.topic_id===modalCategory);
 const hasStars = timeline.stars.length>0;
 const width = size.width;
 const fieldWidth = Math.max(7000,width*6);
 const travel = fieldWidth-width;
 const pad = Math.min(width*.11,100);
 const offset = progress*travel;
 const xAt = (along:number) => pad+along*(fieldWidth-pad*2);
 const yAt = (height:number) => size.height*height;
 const active = timeline.stars.find(star => star.event.id===(hovered||focused));
 const activeX = active ? xAt(active.along)-offset : 0;
 const activeY = active ? yAt(active.height) : 0;
 const activeVisible = !!active && width>0 && activeX>=0 && activeX<=width;
 const categoryRanges = useMemo(() => placeCategoryRanges(timeline.ranges,deckWidth),[timeline.ranges,deckWidth]);
 const categoryRows = categoryRanges.reduce((rows,range) => Math.max(rows,range.row+1),0);
 const inspectedCategory = pointedCategory || (!hovered && focusedCategory) || selectedCategory;
 const litCategories = inspectedCategory ? [inspectedCategory] : activeVisible ? active.categoryIds : [];
 const firstYear = dateAtProgress(timeline.start,timeline.end,0).year;
 const lastYear = dateAtProgress(timeline.start,timeline.end,1).year;
 const yearMarks = useMemo(() => Array.from({length:lastYear-firstYear},(_,index) => {
  const year = firstYear+index+1;
  const position = (Date.UTC(year,0,1)-timeline.start)/Math.max(1,timeline.end-timeline.start);
  return {year,position};
 }).filter(({position})=>position>0&&position<1),[firstYear,lastYear,timeline.start,timeline.end]);
 const date = dateAtProgress(timeline.start,timeline.end,progress);
 const month = String(date.month).padStart(2,'0');
 const [gaugeX,gaugeY] = gaugePoint(-81+progress*162,93);

 useLayoutEffect(() => {
  const container = section.current, panel = stage.current, field = sky.current;
  if (!container || !panel || !field) return;
  let bounds = scrollBounds(container,panel);
  const update = () => {
   const target = seekPosition.current;
   if (target && target.scrollY===window.scrollY) {
    setProgress(target.progress);
    return;
   }
   seekPosition.current = null;
   setProgress(Math.min(1,Math.max(0,(bounds.top-container.getBoundingClientRect().top)/bounds.distance)));
  };
  const observer = new ResizeObserver(() => {
   bounds = scrollBounds(container,panel);
   setSize({width:field.clientWidth,height:field.clientHeight});
   setDeckWidth(categoryDeck.current?.clientWidth ?? 0);
   update();
  });
  observer.observe(field);
  observer.observe(panel);
  observer.observe(container);
  if (categoryDeck.current) observer.observe(categoryDeck.current);
  window.addEventListener('scroll',update,{passive:true});
  update();
  return () => {
   window.removeEventListener('scroll',update);
   observer.disconnect();
  };
 },[hasStars]);

 function seek(next:number){
  const container = section.current, panel = stage.current;
  if (!container || !panel) return;
  const {top,distance} = scrollBounds(container,panel);
  window.scrollTo({top:window.scrollY+container.getBoundingClientRect().top-top+next*distance,behavior:'instant'});
  // Keep the requested date when the browser rounds the scroll position to a pixel.
  seekPosition.current = {scrollY:window.scrollY,progress:next};
  setProgress(next);
 }

 if (!hasStars) return <section id="panel-constellation" role="tabpanel" aria-labelledby="tab-constellation"><p>표시할 사건이 없습니다.</p></section>;

 return <section ref={section} id="panel-constellation" role="tabpanel" aria-labelledby="tab-constellation" className="star-timeline">
  <div ref={stage} className="star-stage" data-filtered={litCategories.length>0}>
   <div className="star-axis">
    <div ref={categoryDeck} className="star-category-deck" role="group" aria-label="카테고리"
     style={{'--rows':deckWidth ? categoryRows : 6} as CSSProperties}>
     {deckWidth>0&&categoryRanges.map(({category,first,last,start,end,label,labelX,left,right,row})=>{
      const id = category.topic_id;
      const color = categoryColors[data.topics.indexOf(category)%categoryColors.length];
      const dates = first.event.date===last.event.date ? first.event.date : first.event.date+' – '+last.event.date;
      const title = category.name+' · '+dates;
      const selected = id===selectedCategory;
      return <button key={id} type="button" className="star-category" aria-haspopup="dialog" aria-pressed={selected} aria-label={title} title={title}
       data-related={litCategories.includes(id)} style={{left,width:right-left,'--row':row,'--category-color':color} as CSSProperties}
       onPointerEnter={event=>{if(event.pointerType!=='touch')setPointedCategory(id);}} onPointerLeave={()=>setPointedCategory(null)}
       onFocus={event=>{if(event.currentTarget.matches(':focus-visible'))setFocusedCategory(id);}} onBlur={()=>setFocusedCategory(null)}
       onClick={click=>{
        categoryTrigger.current = click.currentTarget;
        setSelectedCategory(selected ? null : id);
        seek(first.along);
        setModalCategory(id);
       }}>
       <i className="star-category-bar" style={{left:start-left,width:end-start}} aria-hidden="true"/>
       <span style={{left:labelX-left}}>{label}</span>
      </button>;
     })}
     {categoryRanges.filter(({category})=>litCategories.includes(category.topic_id))
      .flatMap(({category,start,end,row})=>[...new Set([start,end])].map(x=><i key={category.topic_id+':'+x}
       className="star-range-guide" style={{left:x,'--row':row} as CSSProperties} aria-hidden="true"/>))}
    </div>
    <div className="star-scrubber" style={{'--progress':`${progress*100}%`} as CSSProperties}>
     <div className="star-ruler" aria-hidden="true">
      {yearMarks.map(({year,position})=><b key={year} data-major={year%5===0} style={{left:`${position*100}%`}}/>)}
      <i/>
     </div>
     <input type="range" min="0" max="1000" value={Math.round(progress*1000)}
      aria-label="연표 위치" aria-valuetext={`${date.year}년 ${date.month}월`}
      onChange={event=>{setHovered(null);seek(Number(event.target.value)/1000);}}/>
    </div>
    <div className="star-axis-labels" aria-hidden="true">
     <span>{firstYear}</span>
     {yearMarks.filter(({year,position})=>year%10===0&&position>.08&&position<.92).map(({year,position})=>
      <span key={year} className="star-axis-year" style={{left:`${position*100}%`}}>{year}</span>)}
     <span>{lastYear}</span>
    </div>
   </div>
   <div className="star-frame">
    <div className="star-gauge">
     <svg viewBox="0 0 360 135" aria-hidden="true">
      <path d="M60 120 A121 121 0 0 1 300 120" fill="none" stroke="#373531"/>
      {gaugeMarks.map(({angle,major})=>{
       const [x1,y1]=gaugePoint(angle,116),[x2,y2]=gaugePoint(angle,major?103:109);
       return <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke={major?'#a9a18e':'#504d45'}/>;
      })}
      <circle cx={gaugeX} cy={gaugeY} r="2" fill="#d9c49d"/>
     </svg>
     <time dateTime={`${date.year}-${month}`}><strong>{date.year}</strong><span> / {month}</span></time>
    </div>
    <div className="star-sky" ref={sky}>
     <div className="star-dust" aria-hidden="true" style={{transform:`translateX(${-progress*24}%)`}}/>
     <div className="star-space" style={{width:fieldWidth,transform:`translateX(${-offset}px)`}}>
      <svg className="star-network" width={fieldWidth} height={size.height} aria-hidden="true">
       {timeline.links.map(({categoryId,from,to})=><line key={categoryId+':'+to.event.id}
        x1={xAt(from.along)} y1={yAt(from.height)} x2={xAt(to.along)} y2={yAt(to.height)}
        className={litCategories.includes(categoryId)?'star-link lit':'star-link'} pathLength={100}/>)}
      </svg>
      {timeline.stars.map((star,index)=>{
       const {event,along,height,categoryIds} = star;
       const x = xAt(along);
       const inView = width>0 && x-offset>=17 && x-offset<=width-17;
       return <StarNode key={event.id} star={star} index={index} x={x} y={yAt(height)} inView={inView}
        active={activeVisible&&active===star} related={litCategories.some(id=>categoryIds.includes(id))}
        onHover={setHovered} onFocus={setFocused} onVisit={onVisit}/>;
      })}
     </div>
     {activeVisible&&active&&<StarPreview key={active.event.id} event={active.event} media={media} x={activeX} y={activeY} width={width} height={size.height}/>}
    </div>
   </div>
  </div>
  {modalRange&&<CategoryConstellation range={modalRange} stars={timeline.stars} media={media} detailOpen={detailOpen}
   onClose={()=>{setModalCategory(null);categoryTrigger.current?.focus({preventScroll:true});}} onVisit={onVisit}/>}
 </section>;
}
