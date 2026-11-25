import {importanceLabels,loadSwimlane,swimlaneDateRange,eventPeriods,packTimelineItems,cardRelationPaths,relationChain} from '../swimlane-data.js';
import {getSwimlaneEmbed,setupSwimlaneModal} from './swimlane-modal.js';

const $=id=>document.getElementById(id);
const make=(tag,cls='',label='')=>Object.assign(document.createElement(tag),{className:cls,textContent:label});
const button=(label,click,cls='')=>{
 const node=make('button',cls,label);
 node.type='button';
 node.addEventListener('click',click);
 return node;
};
const svg=(tag,attrs)=>{const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
 for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);
 return node;
};
const DAY=86400000;
const iso=t=>new Date(t).toISOString().slice(0,10);
const monthOf=t=>new Date(t).getUTCFullYear()*12+new Date(t).getUTCMonth();
const monthStart=m=>Date.UTC(Math.floor(m/12),m%12,1);
const bounds=value=>swimlaneDateRange(value,SheetData.dateRange);
const params=new URLSearchParams(location.search);
const frame=window.frameElement;
async function init(){
 const embed=frame&&getSwimlaneEmbed(frame);
 const pkg=params.get('package')==='cold-war'?'cold-war':'japan';
 const data=frame?.lessonSwimlane??await loadSwimlane(SHEET_CONFIG,SheetData,pkg);
 const {events,categories,actors,relations,periods}=data;
 if(!events.length)throw Error('표시할 수업 사건이 없습니다.');
 const levels=new Set(events.map(event=>event.importance));
 for(const [level,label] of importanceLabels){
  if(levels.has(level))$('importance-key').append(make('span','level-'+level,label));
 }
 const {open}=setupSwimlaneModal(data,frame);
 const all=[...events,...categories,...actors];
 const records=new Map(all.map(record=>[record.id,record]));
 const role=new Map([...events.map(e=>[e.id,'event']),...categories.map(c=>[c.id,'category']),...actors.map(a=>[a.id,'actor'])]);
 const intervals=new Map(all.flatMap(record=>{
  const date=record.date||record.start;
  if(!date&&!record.end)return [];
  return [[record.id,{start:date?bounds(date).start:-Infinity,end:record.end?bounds(record.end).end+DAY:date?bounds(date).end+DAY:Infinity}]];
 }));
 const times=[...intervals.values()].flatMap(i=>[i.start,i.end-1]).filter(Number.isFinite);
 const firstYear=new Date(Math.min(...times)).getUTCFullYear(),lastYear=new Date(Math.max(...times)).getUTCFullYear();
 const min=firstYear*12,max=(lastYear+1)*12;
 const counts=new Map();
 for(const e of events){const y=Number(e.date.slice(0,4));counts.set(y,(counts.get(y)??0)+1);}
 const maxCount=Math.max(...counts.values());
 const requested=params.get('focus');
 const initial=/^\d{4}-(0[1-9]|1[0-2])$/.test(requested)?bounds(requested).start:null;
 let anchor=initial??Math.min(...events.map(e=>intervals.get(e.id).start)),size=initial?1:frame?.hasAttribute('data-package-draft')?0:36;
 let customRange=false,emptyLanes=false,selected='',relationFocus=null,preferred=null,anchors=new Map(),start,end,ticks,plotWidth;
 const labels={cause:'원인·계기',shift:'전환·변화',action:'활동·실행',succession:'계승',integration:'통합·편입',split:'분열·개편',background:'구조적 배경'};
 const kindLabel={period:'시기별 사건',arc:'사건군',theme:'주제'};
 const title=r=>r.title||r.name;
 const x=t=>Math.max(0,Math.min(plotWidth,(t-start)/(end-start)*plotWidth));
 const intersects=i=>i&&i.start<end&&i.end>start;
 const labelDate=r=>[r.date||r.start,r.end].filter(Boolean).join(' – ');
 let wheelRemainder=0;
 function setWindow(t,months,custom=false){anchor=t;size=months;customRange=custom;selected='';preferred=null;wheelRemainder=0;render();}
 function panMonths(months){
  const begin=monthOf(start),span=monthOf(end)-begin;
  const next=Math.max(min,Math.min(max-span,begin+months));
  if(next!==begin)setWindow(monthStart(next),size,true);
 }
 const viewport=$('ticks').closest('.viewport');
 viewport.addEventListener('wheel',event=>{
  if(event.ctrlKey||event.defaultPrevented)return;
  const horizontal=Math.abs(event.deltaX)>Math.abs(event.deltaY);
  if(!horizontal&&(embed?.outerFrame||event.target.closest?.('.rail, .axis > strong')))return;
  const direction=horizontal?event.deltaX:event.deltaY;
  if(!direction)return;
  if(direction<0?monthOf(start)<=min:monthOf(end)>=max){
   wheelRemainder=0;
   return;
  }
  event.preventDefault();
  const pixels=direction*(event.deltaMode===1?16:event.deltaMode===2?viewport.clientWidth:1);
  if(Math.sign(wheelRemainder)!==Math.sign(pixels))wheelRemainder=0;
  const total=wheelRemainder+pixels;
  const months=Math.trunc(total/64);
  if(months)panMonths(months);
  wheelRemainder=total%64;
 },{passive:false});
 viewport.addEventListener('keydown',event=>{
  if(event.target!==viewport||event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
  event.preventDefault();
  panMonths(event.key==='ArrowLeft'?-1:1);
 });
 const ey=lastYear-firstYear+1;
 $('extent').textContent=firstYear+'–'+lastYear+' · 사건 '+events.length+'개';
 for(let y=firstYear;y<=lastYear;y++){
  const b=button('',()=>setWindow(Date.UTC(y,0),12));
  b.setAttribute('aria-label',y+'년 확대');b.title=y+'년 · 시작 사건 '+(counts.get(y)??0)+'개';
  const bar=make('i');bar.style.height=Math.max(2,Math.round((counts.get(y)??0)/maxCount*27))+'px';b.append(bar);$('overview').append(b);
  const step=ey>90?25:ey>24?10:5;
  if(y===firstYear||y===lastYear||(y%step===0&&y-firstYear>=ey*.07&&lastYear-y>=ey*.07)){
   const tick=make('span','',y);tick.style.left=(y===firstYear?0:y===lastYear?100:(y-firstYear+.5)/ey*100)+'%';$('ruler').append(tick);
  }
 }
 const extentStart=monthStart(min),extentEnd=monthStart(max);
 const eraOverview=$('era-overview');
 const eraItems=periods.filter(p=>p.start||p.end).map(p=>{
  const from=p.start?bounds(p.start).start:extentStart;
  const until=p.end?bounds(p.end).end+DAY:extentEnd;
  const b=button('',()=>{setWindow(from,36);select(p.id,anchors.get(p.id)?.[0]);},'overview-era');
  const dateText=value=>/^\d{4}$/.test(value)?value+'년':value;
  const dates=p.start&&p.end?dateText(p.start)+' – '+dateText(p.end):
   p.start?dateText(p.start)+'부터':dateText(p.end)+'까지';
  const caption=make('span','era-caption');
  caption.append(make('b','',p.name),make('span','era-years',dates));
  b.append(make('i','era-stroke'),caption);
  eraOverview.append(b);
  return {b,caption,from,until};
 });
 function layoutEraOverview(){
  const width=eraOverview.clientWidth;
  if(!width)return;
  const items=eraItems.map(({b,caption,from,until})=>{
   const left=(from-extentStart)/(extentEnd-extentStart)*width;
   const right=(until-extentStart)/(extentEnd-extentStart)*width;
   const labelWidth=caption.getBoundingClientRect().width;
   const labelLeft=Math.min(left,width-labelWidth);
   const start=Math.min(left,labelLeft);
   const end=Math.max(right,labelLeft+labelWidth);
   b.style.marginLeft=start+'px';
   b.style.width=(end-start)+'px';
   b.style.setProperty('--bar-left',(left-start)+'px');
   b.style.setProperty('--bar-width',(right-left)+'px');
   return {b,start,end:end+8};
  });
  for(const {b,track} of packTimelineItems(items))b.style.gridRow=String(track+1);
 }
 const viewportMark=make('i','window');$('overview').append(viewportMark);
 const overview=$('overview');
 overview.title='클릭해 연도로 이동하거나 드래그해 볼 구간을 정하세요.';
 const monthAt=clientX=>{
  const r=overview.getBoundingClientRect();
  return Math.min(max-1,Math.max(min,min+Math.floor((clientX-r.left)/r.width*(max-min))));
 };
 let drag=null,ignoreClick=false;
 overview.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  ignoreClick=false;
  const m=monthAt(e.clientX),left=monthOf(start),right=monthOf(end);
  const bounds=viewportMark.getBoundingClientRect();
  const mode=Math.abs(e.clientX-bounds.left)<5?'left':Math.abs(e.clientX-bounds.right)<5?'right':
    m>=left&&m<right&&right-left<max-min?'pan':'select';
  drag={x:e.clientX,m,left,right,mode,moved:false,from:left,to:right};
 });
 overview.addEventListener('pointermove',e=>{
  if(!drag||Math.abs(e.clientX-drag.x)<4&&!drag.moved)return;
  overview.setPointerCapture(e.pointerId);
  drag.moved=true;
  const m=monthAt(e.clientX),width=drag.right-drag.left;
  if(drag.mode==='pan'){
   drag.from=Math.max(min,Math.min(max-width,drag.left+m-drag.m));drag.to=drag.from+width;
  }else if(drag.mode==='left'){drag.from=Math.min(m,drag.right-1);}
  else if(drag.mode==='right'){drag.to=Math.max(m+1,drag.left+1);}
  else{drag.from=Math.min(m,drag.m);drag.to=Math.max(m,drag.m)+1;}
  Object.assign(viewportMark.style,{left:100*(drag.from-min)/(max-min)+'%',width:100*(drag.to-drag.from)/(max-min)+'%'});
 });
 overview.addEventListener('pointerup',()=>{
  if(drag?.moved){ignoreClick=true;setWindow(monthStart(drag.from),drag.to-drag.from,true);}
  drag=null;
 });
 overview.addEventListener('pointercancel',()=>{drag=null;render();});
 overview.addEventListener('click',e=>{if(ignoreClick){e.stopPropagation();ignoreClick=false;}},true);
 for(const [months,label] of [[0,'전체'],[120,'10년'],[36,'3년'],[12,'1년'],[1,'1개월']]){
  const b=button(label,()=>{const t=intervals.get(selected)?.start;setWindow(Number.isFinite(t)?t:anchor,months);});b.dataset.months=months;$('zoom').append(b);
 }
 $('jump').min=firstYear+'-01';$('jump').max=lastYear+'-12';
 $('jump').onchange=()=>{
  if(!$('jump').value||!$('jump').validity.valid)return;
  setWindow(bounds($('jump').value).start,1);
  $('month-panel').hidePopover();
 };
 $('prev').onclick=()=>setWindow(monthStart(Math.max(min,monthOf(start)-size)),size,customRange);
 $('next').onclick=()=>setWindow(monthStart(monthOf(end)),size,customRange);
 $('empty-lanes').onclick=()=>{emptyLanes=!emptyLanes;$('empty-lanes').setAttribute('aria-pressed',String(emptyLanes));render();};
 $('relations').textContent='전체 관계 '+relations.length+'건';$('relations').onclick=()=>open('all');
 function addAnchor(id,node){
  if(!anchors.has(id))anchors.set(id,[]);
  anchors.get(id).push(node);
 }
 function select(id,node){selected=id;relationFocus=null;preferred=node;paintSelection();drawEdges();}
 function openRecord(record,node){
  select(record.id,node);
  open(role.get(record.id),record);
 }
 function row(name,kind,record){
  const line=make('div','row lane');
  const rail=record?button('',()=>openRecord(record,rail),'rail'):make('div','rail');
  if(kind)rail.append(make('small','',kind));
  rail.append(make('b','',name));
  if(record){rail.dataset.record=record.id;addAnchor(record.id,rail);}
  const track=make('div','track');line.append(rail,track);$('lanes').append(line);
  for(const tick of ticks){const grid=make('i','tick');grid.style.left=x(tick.t)+'px';track.append(grid);}
  return track;
 }
 function periodLane(){
  const track=row('시기','',null);track.classList.add('era-track');
  const items=periods.map(p=>({p,start:p.start?bounds(p.start).start:-Infinity,end:p.end?bounds(p.end).end+DAY:Infinity})).filter(intersects);
  if(!items.length){track.append(make('span','no-period','이 구간에 등록된 시기 없음'));return;}
  const packed=packTimelineItems(items);
  track.style.minHeight=29*Math.max(...packed.map(item=>item.track+1))+8+'px';
  for(const item of packed){
   const {p,track:level}=item;
   const bar=button(p.name,()=>openRecord(p,bar),'era');
   bar.dataset.record=p.id;bar.title=p.name+' '+labelDate(p);bar.setAttribute('aria-label',bar.title);
   Object.assign(bar.style,{left:x(item.start)+'px',width:Math.max(3,x(item.end)-x(item.start))+'px',top:5+level*29+'px'});
   track.append(bar);addAnchor(p.id,bar);
  }
 }
 function eventButton(record){
  const mark=button('',()=>openRecord(record,mark),'event');
  mark.dataset.record=record.id;
  const kind=record.end?'기간':'시점';
  const level=importanceLabels.get(record.importance);
  if(level)mark.dataset.importance=record.importance;
  mark.title=[kind,labelDate(record),title(record),level].filter(Boolean).join(' · ');
  mark.setAttribute('aria-label',mark.title);
  mark.append(make('b','',title(record)));
  return mark;
 }
 function drawBand(track,heading,items){
  if(!items.length)return;
  const section=make('section','lane-band');
  section.append(make('h3','band-heading',heading));
  const body=make('div','band-items');
  section.append(body);track.append(section);
  const blocks=[],years=new Map();
  for(const r of items){
   const date=r.date||r.start;
   const mark=eventButton(r);
   const interval=intervals.get(r.id),left=x(interval.start),right=x(interval.end);
   if(!r.end&&/^\d{4}$/.test(date)){
    if(!years.has(date)){
     const group=make('div','year-events');group.append(make('h4','',date+'년'));
     body.append(group);
     const width=Math.min(plotWidth,Math.max(132,Math.min(240,right-left-6)));
     const groupLeft=Math.min(left,plotWidth-width);
     group.style.width=width+'px';group.style.left=groupLeft+'px';
     years.set(date,group);blocks.push({node:group,start:groupLeft,end:groupLeft+width+5});
    }
    years.get(date).append(mark);addAnchor(r.id,mark);continue;
   }
   const duration=Boolean(r.end);
   mark.prepend(make('time','',labelDate(r)));
   mark.classList.add(duration?'span-event':'point-event');
   body.append(mark);addAnchor(r.id,mark);
   const width=mark.offsetWidth;
   // A month-only record belongs to its month, without implying a specific day.
   const point=date.length===7?(left+right)/2:left;
   const dotX=Math.max(4,Math.min(point,plotWidth-4));
   const labelLeft=Math.max(0,Math.min(duration?left:dotX-8,plotWidth-width));
   mark.style.left=labelLeft+'px';
   if(duration){
    const pin=make('i','pin duration');
    pin.setAttribute('aria-hidden','true');mark.append(pin);
    pin.style.left=(left-labelLeft)+'px';
    pin.style.width=Math.max(2,right-left)+'px';
    pin.classList.toggle('continues',interval.end>end);
    pin.classList.toggle('began-earlier',interval.start<start);
   }else{
    const dot=make('i','date-dot');
    dot.setAttribute('aria-hidden','true');dot.style.left=(dotX-labelLeft)+'px';mark.append(dot);
   }
   blocks.push({node:mark,start:duration?Math.min(labelLeft,left):Math.min(labelLeft,dotX-4),
    end:Math.max(labelLeft+width,duration?right:dotX+4)+5,above:duration?0:13});
  }
  const packed=packTimelineItems(blocks);
  const heights=[],headroom=[];
  for(const {node,track:level,above=0} of packed){
   heights[level]=Math.max(heights[level]||0,node.offsetHeight);
   headroom[level]=Math.max(headroom[level]||0,above);
  }
  const offsets=[];let height=4;
  for(const [level,h] of heights.entries()){
   height+=headroom[level];offsets.push(height);height+=h+9;
  }
  for(const {node,track:level} of packed)node.style.top=offsets[level]+'px';
  body.style.height=height+'px';
 }
 function drawLane(name,kind,record,items){
  const visible=items.filter(r=>intersects(intervals.get(r.id)));
  if(!items.length||(!visible.length&&!emptyLanes))return;
  const track=row(name,kind,record);
  if(!visible.length){track.classList.add('quiet');return;}
  const actor=role.get(visible[0].id)==='actor';
  drawBand(track,actor?'존속 시작':'시점 사건',visible.filter(r=>!r.end));
  drawBand(track,actor?'존속 기간':'기간 사건',visible.filter(r=>r.end));
 }
 const drawnEndpoints=new Map();
 function drawEdges(){
  drawnEndpoints.clear();
  const layer=$('edges');layer.replaceChildren();
  const defs=svg('defs',{});layer.append(defs);
  for(const [id,color] of [['normal','#487a70'],['active','#a94929']]){
   const tip=svg('marker',{id,viewBox:'0 0 10 10',refX:10,refY:5,markerWidth:8,markerHeight:8,markerUnits:'userSpaceOnUse',orient:'auto'});
   tip.append(svg('path',{d:'M0 0 L10 5 L0 10Z',fill:color}));defs.append(tip);
   const dot=svg('marker',{id:id+'-start',viewBox:'0 0 8 8',refX:4,refY:4,markerWidth:7,markerHeight:7,markerUnits:'userSpaceOnUse'});
   dot.append(svg('circle',{cx:4,cy:4,r:3,fill:color}));defs.append(dot);
  }
  const origin=layer.getBoundingClientRect(),boxes=new Map();
  function box(node){
   if(!boxes.has(node)){
    const r=(node.matches('.rail')?node.querySelector('b'):node).getBoundingClientRect();
    boxes.set(node,{left:r.left-origin.left,right:r.right-origin.left,top:r.top-origin.top,bottom:r.bottom-origin.top});
   }
   return boxes.get(node);
  }
  const candidates=id=>selected===id&&preferred?.isConnected?[preferred]:anchors.get(id)||[];
  const isActive=r=>relationFocus?.relationIds.has(r.id)||selected===r.fromId||selected===r.toId;
  const links=[];
  for(const rel of [...relations].sort((a,b)=>Number(isActive(a))-Number(isActive(b)))){
   let nearest=Infinity,pair;
   for(const from of candidates(rel.fromId))for(const to of candidates(rel.toId)){
    const a=box(from),b=box(to);
    const distance=Math.hypot((a.left+a.right-b.left-b.right)/2,(a.top+a.bottom-b.top-b.bottom)/2);
    if(distance>=nearest)continue;
    nearest=distance;
    pair={from,to};
   }
   if(!pair)continue;
   drawnEndpoints.set(rel,pair);
   const {from,to}=pair;
   const sameGroup=from.parentElement===to.parentElement&&from.parentElement.matches('.year-events');
   links.push({id:rel.id,rel,from:box(from),to:box(to),sameGroup});
  }
  const paths=cardRelationPaths(links,origin.width);
  for(const [i,{rel}] of links.entries()){
   const d=paths[i];
   const pressed=rel.id===relationFocus?.id;
   const active=isActive(rel),marker=active?'active':'normal';
   const path=svg('path',{class:'edge '+(rel.status==='draft'?'draft ':'')+(active?'focus':selected||relationFocus?'muted':''),d,'marker-start':'url(#'+marker+'-start)','marker-end':'url(#'+marker+')','data-relation':rel.id});
   const hit=svg('path',{class:'edge-hit',d,role:'button',tabindex:0,'data-relation':rel.id,'aria-pressed':String(pressed),'aria-label':rel.fromName+' → '+rel.toName});
   hit.onclick=()=>{
    relationFocus=pressed?null:{id:rel.id,...relationChain(relations,rel)};
    selected='';preferred=null;
    paintSelection();drawEdges();
    layer.querySelector('.edge-hit[data-relation="'+CSS.escape(rel.id)+'"]')?.focus({preventScroll:true});
   };
   hit.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!e.repeat)hit.onclick();}};
   layer.append(path,hit);
   if(pressed||(!relationFocus&&active)){
    const mid=path.getPointAtLength(path.getTotalLength()/2);
    const label=svg('text',{class:'edge-label',x:mid.x,y:mid.y-3});label.textContent=labels[rel.kind]||rel.label;layer.append(label);
   }
  }
 }
 function follow(id,node){
  const r=records.get(id);if(!r)return;
  node??=anchors.get(id)?.[0];
  if(!node){
   const i=intervals.get(id);
   if(!i){open(role.get(id),r);return;}
   anchor=Number.isFinite(i.start)?i.start:i.end-DAY;render();node=anchors.get(id)?.[0];
  }
  if(!node){open(role.get(id),r);return;}
  select(id,node);
  node.scrollIntoView({block:'center',inline:'nearest'});
 }
 function paintSelection(){
  const panel=$('selection');panel.replaceChildren();
  for(const node of $('lanes').querySelectorAll('button[data-record]')){
   node.setAttribute('aria-pressed',String(node.dataset.record===selected));
   node.toggleAttribute('data-chain',relationFocus?.recordIds.has(node.dataset.record)??false);
  }
  const r=records.get(selected);if(!r)return;
  const head=make('div','selection-head');head.append(make('small','',labelDate(r)),make('b','',title(r)),button('상세 보기',()=>open(role.get(selected),r)));
  const related=relations.filter(rel=>rel.fromId===selected||rel.toId===selected);
  panel.append(head);
  if(related.length){
   const nav=make('div','neighbors');
   for(const rel of related){
    const out=rel.fromId===selected,other=out?rel.toId:rel.fromId;
    const peer=records.get(other),i=intervals.get(other);
    const where=i?.end<=start?'이전 구간 · ':i?.start>=end?'다음 구간 · ':'';
    const word=labels[rel.kind]||rel.label||'관계';
    nav.append(button(where+(out?'→ ':'← ')+(peer?title(peer):out?rel.toName:rel.fromName)+' · '+word,()=>peer?follow(other,drawnEndpoints.get(rel)?.[out?'to':'from']):open('relation',rel)));
   }
   panel.append(nav);
  }
 }
 function render(){
  const span=Math.min(size||max-min,max-min);
  const focus=Math.min(Math.max(monthOf(anchor),min),max-1);
  const begin=Math.max(min,Math.min(size===1||customRange?focus:Math.floor(focus/12)*12,max-span));
  start=monthStart(begin);end=monthStart(begin+span);
  plotWidth=$('ticks').clientWidth;if(plotWidth<30)return;
  $('range').textContent=span===1?iso(start).slice(0,7).replace('-','년 ')+'월':span===12&&begin%12===0?iso(start).slice(0,4)+'년':iso(start).slice(0,7)+' — '+iso(end-DAY).slice(0,7);
  $('pick-month').setAttribute('aria-label',$('range').textContent+' · 연월 선택');
  $('jump').value=iso(monthStart(focus)).slice(0,7);$('prev').disabled=begin<=min;$('next').disabled=begin+span>=max;
  for(const b of $('zoom').children)b.setAttribute('aria-pressed',String(+b.dataset.months===size));
  Object.assign(viewportMark.style,{left:100*(begin-min)/(max-min)+'%',width:100*span/(max-min)+'%'});
  ticks=[];
  if(span===1){
   const step=plotWidth>700?2:plotWidth>350?5:7;
   for(let d=0;start+d*DAY<end;d+=step)ticks.push({t:start+d*DAY,label:(d+1)+'일'});
  }else{
   const step=span<=12?(plotWidth<430?2:1):span<=36?(plotWidth<430?6:3):12*Math.ceil(span/12/Math.max(3,Math.floor(plotWidth/65)));
   const tickOrigin=Math.min(12,step);
   for(let m=Math.ceil(begin/tickOrigin)*tickOrigin;m<begin+span;m+=step)ticks.push({t:monthStart(m),label:m%12===0?Math.floor(m/12)+'년':m%12+1+'월'});
  }
  $('ticks').replaceChildren();for(const tick of ticks){if(plotWidth-x(tick.t)<34&&tick.t!==start)continue;
   const el=span===1?make('span','',tick.label):button(tick.label,()=>setWindow(tick.t,span<=36?1:12),'axis-jump');
   el.style.left=x(tick.t)+2+'px';$('ticks').append(el);}
  $('lanes').replaceChildren();anchors=new Map();preferred=null;
  periodLane();
  for(const c of categories){
   const items=events.filter(e=>c.kind==='period'?(!e.arcs.length&&!e.themes.length&&eventPeriods(e).includes(c.name)):c.kind==='arc'?e.arcs.includes(c.name):e.themes.includes(c.name));
   drawLane(c.name,kindLabel[c.kind],c,items);
  }
  drawLane('미분류','',null,events.filter(e=>!e.arcs.length&&!e.themes.length&&!eventPeriods(e).length));
  drawLane('존속 시작일','관계 주체',null,actors.filter(a=>a.start));
  if(!events.some(e=>intersects(intervals.get(e.id))))$('lanes').append(make('p','empty','이 구간에 기록된 수업 사건이 없습니다.'));
  paintSelection();drawEdges();
 }
 const main=document.querySelector('main');
 function fitFrame(){
  if(!frame)return;
  frame.style.height=Math.ceil(main.getBoundingClientRect().height+3)+'px';
  if(embed.outerFrame){
   const {outerFrame,showroom}=embed;
   const border=outerFrame.offsetHeight-outerFrame.clientHeight;
   outerFrame.style.height=Math.ceil(showroom.getBoundingClientRect().height+border)+'px';
  }
 }
 if(frame){
  // The lesson page owns scrolling, so keep the axis at its visible top edge.
  const axis=document.querySelector('.axis');
  const pinAxis=()=>axis.style.setProperty('--axis-top',Math.max(0,-embed.bounds().top)+'px');
  embed.scrollWindow.addEventListener('scroll',pinAxis,{passive:true});
  window.addEventListener('pagehide',()=>embed.scrollWindow.removeEventListener('scroll',pinAxis),{once:true});
  pinAxis();
 }
 $('status').textContent='';fitFrame();render();
 new ResizeObserver(()=>{if($('ticks').clientWidth!==plotWidth)render();fitFrame();}).observe(main);
 new ResizeObserver(layoutEraOverview).observe(eraOverview);
 document.fonts.ready.then(()=>{layoutEraOverview();render();fitFrame();});
}
init().catch(error=>{$('status').textContent='스윔레인을 불러오지 못했습니다. '+error.message;});
