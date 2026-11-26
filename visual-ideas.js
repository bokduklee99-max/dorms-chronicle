import {constellationLayout} from './constellation-layout.js';
const ideaData=SheetData.build(SHEET_SNAPSHOT.tables);
const ideaEvents=ideaData.events;
const caseIds={cuba:'evt_385434add32c42afba9da294a27b5b38',korea:'evt_64cecb9d369e40899542363394a3e172',berlin:'evt_117e14c7dc3d478b82e85d88ad66a922',border:'evt_3026cc43b2e346c08e119e764dc3609e'};
let focusId=caseIds.cuba;
const colors=['#4979e8','#df6c46','#21a896','#9a71d2','#d9a532','#cf658b','#72a9b0','#6f8b49','#ac805c','#6682b4','#a65373','#63717b'];
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const topics=ideaData.topics;
const tc=id=>colors[Math.max(0,topics.findIndex(t=>t.topic_id===id))%colors.length];
const label=event=>{
  const t=event.title;
  if(t.includes('Quarantine'))return '쿠바 해상 봉쇄';
  if(t.includes('한국전쟁 발발'))return '한국전쟁 발발';
  if(t.includes('서베를린 봉쇄'))return '베를린 봉쇄';
  if(t.includes('중화인민공화국')&&t.includes('선포'))return '중화인민공화국 선포';
  if(t.includes('국경경비대'))return '중·소 국경 충돌';
  if(t.includes('Hotline'))return '핫라인 개설';
  if(t.includes('협상을 통해'))return '위기 수습 협상';
  const chars=[...t];return chars.length>15?chars.slice(0,14).join('')+'…':t;
};
const tx=(x,y,t,size=16,fill='#40516b',anchor='start')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}">${esc(t)}</text>`;
const ln=(x1,y1,x2,y2,color='#d5dce6',width=2,extra='')=>`<path d="M${x1},${y1}L${x2},${y2}" fill="none" stroke="${color}" stroke-width="${width}" ${extra}/>`;
const rect=(x,y,w,h,fill,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
const dot=(x,y,r,fill,event)=>`<g${event?` data-eid="${esc(event.id)}" tabindex="0" role="button" aria-label="${esc(event.title)}"`:''}><circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"${fill==='#fff'?' stroke="#28394f" stroke-width="2"':''} ${event?.id===focusId?'class="chosen"':''}/>${event?`<title>${esc(event.date+' '+event.title)}</title>`:''}</g>`;
const svg=(body,dark=false)=>`<svg viewBox="0 0 520 280" role="group" xmlns="http://www.w3.org/2000/svg">${rect(0,0,520,280,dark?'var(--chronicle-green)':'#fffefa')}${body}</svg>`;
const focusEvent=()=>ideaEvents.find(e=>e.id===focusId)||ideaEvents[0];
const related=event=>[event,...ideaEvents.filter(e=>e.id!==event.id&&e.directTopicIds.some(id=>event.directTopicIds.includes(id))).sort((a,b)=>Math.abs(a.bounds.start-event.bounds.start)-Math.abs(b.bounds.start-event.bounds.start)).slice(0,5)];

function drawMetro(event){
  const ids=['topic_coldwar_start','topic_korean_war','topic_militarization','topic_germany','topic_detente','topic_reform_opening','topic_cuba_crisis'];
  const names=['냉전의 시작','한국전쟁','군사화','독일문제','데탕트','개혁개방','쿠바위기'];
  const samples=[...new Map([event,...Object.values(caseIds).map(id=>ideaEvents.find(e=>e.id===id)),ideaEvents.find(e=>e.title.includes('중화인민공화국')&&e.title.includes('선포'))].filter(Boolean).map(e=>[e.id,e])).values()].sort((a,b)=>a.bounds.start-b.bounds.start);
  let b='';ids.forEach((id,i)=>{const y=42+i*30;b+=ln(116,y,493,y,tc(id),5)+tx(10,y+5,names[i],15,tc(id));});
  samples.forEach((e,i)=>{const x=135+i*65,ys=ids.map((id,j)=>e.directTopicIds.includes(id)?42+j*30:null).filter(y=>y!==null);if(ys.length>1)b+=ln(x,Math.min(...ys),x,Math.max(...ys),'#28394f',3);for(const y of ys)b+=dot(x,y,7,'#fff',e);b+=tx(x,260,String(e.year),14,'#566176','middle');});
  b+=tx(116,22,'시간의 순서 →',14,'#63717b');return svg(b);
}
function drawWeave(event){
  const countries=[['actor_usa','미국',125],['actor_ussr','소련',240],['actor_cuba','쿠바',355],['none','미연결',470]];
  const sample=[...new Map([...ideaEvents.filter(e=>e.actorIds.length),event].map(e=>[e.id,e])).values()].sort((a,b)=>a.bounds.start-b.bounds.start);
  let b='';countries.forEach(([id,name,x],i)=>{b+=ln(x,42,x,260,colors[i],9,'opacity=".25"')+tx(x,27,name,18,'#e9effb','middle');});
  sample.forEach((e,i)=>{const y=65+i*(182/Math.max(1,sample.length-1)),ids=countries.filter(([id])=>e.actorIds.includes(id));if(!ids.length)ids.push(countries[3]);const xs=ids.map(row=>row[2]),color=e.id===focusId?'#ffb340':'#91b2ed';b+=ln(Math.min(...xs),y,Math.max(...xs),y,color,4)+tx(10,y+5,e.date.slice(0,7),14,'#aabbd3');for(const x of xs)b+=dot(x,y,6,color,e);b+=tx(111,y+21,label(e),13,'#c0cce0');});return svg(b,true);
}
function drawGalaxy(){
  const {anchors,stars}=constellationLayout(ideaEvents,topics);
  let b='';
  for(const {event,groups,x,y} of stars){
    if(groups.length>1)for(const a of groups)b+=ln(x,y,a.x,a.y,'#566d91',1,'opacity=".5"');
    b+=dot(x,y,event.id===focusId?8:3.3,groups[0].color,event);
  }
  for(const a of anchors)b+=tx(a.x,a.y+(a.y<140?-24:32),a.label,14,'#c9d4e7','middle');
  b+=tx(260,143,'범주 사이를 잇는 사건',16,'#f3c56b','middle');
  return svg(b,true);
}
function drawStrata(event){
  let b='';const starts=Array.from({length:10},(_,i)=>1945+i*5),x0=183,w=31;const counts=topics.map(t=>starts.map(start=>ideaEvents.filter(e=>e.year>=start&&e.year<start+5&&e.directTopicIds.includes(t.topic_id)).length));const max=Math.max(...counts.flat());
  topics.forEach((t,i)=>{const y=39+i*17;let name=t.name;if(name.includes('페레스트'))name='냉전 종식';b+=tx(12,y+12,name,13,'#53617a');starts.forEach((start,j)=>{const n=counts[i][j];b+=`<g><title>${esc(t.name)} ${start}~${start+4}: 기록 ${n}개</title>${rect(x0+j*w,y,27,14,n?tc(t.topic_id):'#e9edf3',n?`opacity="${.25+.75*n/max}"`:'')}</g>`;});});
  starts.forEach((start,j)=>{if(j%2===0)b+=tx(x0+j*w+13,265,String(start),13,'#53617a','middle');});const col=Math.floor((event.year-1945)/5);if(col>=0&&col<10)b+=rect(x0+col*w-3,33,33,215,'none','stroke="#182437" stroke-width="2"');return svg(b);
}
function drawRelay(event){
  const min=SheetData.dateRange('1945').start,max=SheetData.dateRange('1993').end,x=stamp=>112+(stamp-min)/(max-min)*392;
  const rows=[['office_us_president','미국 대통령'],['office_ussr_party_first_secretary','소련 제1서기'],['office_ussr_party_general_secretary','소련 서기장'],['office_ussr_president','소련 대통령']];let b='';
  for(const year of [1950,1960,1970,1980,1990])b+=ln(x(SheetData.dateRange(String(year)).start),36,x(SheetData.dateRange(String(year)).start),245,'#dce2eb',1)+tx(x(SheetData.dateRange(String(year)).start),24,String(year),13,'#67758b','middle');
  rows.forEach(([id,name],i)=>{const y=58+i*53;b+=tx(10,y+19,name,14,'#53617a');for(const t of ideaData.tenures.filter(t=>t.officeId===id)){const left=Math.max(112,x(t.start.start)),right=Math.min(505,x(t.end.end));const active=t.start.start<=event.bounds.end&&t.end.end>=event.bounds.start;let name=t.person.replace(/^(해리 |드와이트 |존 F\. |린든 |리처드 |제럴드 |지미 |로널드 |조지 H\. W\. )/,'');b+=`<g><title>${esc(t.person+' '+t.startDate+'~'+t.endDate)}</title>${rect(left,y,Math.max(2,right-left-1),30,active?'#e7a34a':i?'#9a8ac4':'#94b4dd')}${right-left>45?tx((left+right)/2,y+21,name,13,'#182437','middle'):''}</g>`;}});
  if(event.bounds.start>=min&&event.bounds.start<=max)b+=ln(x(event.bounds.start),33,x(event.bounds.start),254,'#ce5a35',2)+tx(504,271,event.date,14,'#ad4829','end');else b+=tx(112,271,'선택한 사건은 표시 기간 밖',14,'#ad4829');return svg(b);
}
function drawPrism(event){
  const sample=related(event),topicIds=[...new Set(sample.flatMap(e=>e.directTopicIds))].slice(0,4);const countries=[...new Set(sample.flatMap(e=>e.actorIds.length?e.actorIds:['none']))];const yAt=(i,n)=>55+i*185/Math.max(1,n-1);let b=tx(15,25,'범주',17)+tx(192,25,'사건',17)+tx(435,25,'국가',17);
  const node=(x,y,w,t,fill='#e8edf5')=>rect(x,y-13,w,26,fill,'rx="3"')+tx(x+7,y+5,t,13,'#28394f');
  sample.forEach((e,i)=>{const y=yAt(i,sample.length);for(const id of e.directTopicIds.filter(id=>topicIds.includes(id))){const ty=yAt(topicIds.indexOf(id),topicIds.length);b+=`<path d="M115 ${ty}C150 ${ty},155 ${y},185 ${y}" fill="none" stroke="${tc(id)}" stroke-width="${e.id===focusId?5:2}" opacity=".65"/>`;}for(const id of e.actorIds.length?e.actorIds:['none']){const cy=yAt(countries.indexOf(id),countries.length);b+=`<path d="M335 ${y}C375 ${y},390 ${cy},427 ${cy}" fill="none" stroke="${e.id===focusId?'#d99536':'#b5c3d7'}" stroke-width="${e.id===focusId?4:2}"/>`;}b+=`<g data-eid="${esc(e.id)}" tabindex="0" role="button" aria-label="${esc(e.title)}"><title>${esc(e.title)}</title>${node(185,y,150,[...label(e)].slice(0,9).join('')+'…',e.id===focusId?'#f2d49f':'#e8edf5')}</g>`;});
  topicIds.forEach((id,i)=>{let name=topics.find(t=>t.topic_id===id)?.name||'냉전';name=[...name].slice(0,7).join('');b+=node(10,yAt(i,topicIds.length),105,name,tc(id)+'25');});countries.forEach((id,i)=>{const name=ideaData.actors.find(a=>a.actor_id===id)?.name||'미연결';b+=node(427,yAt(i,countries.length),85,[...name].slice(0,5).join(''));});return svg(b);
}
function drawFog(){
  let b=tx(260,28,'정보 공개 구조 예시',17,'#b8c5dc','middle');
  [[18,'미국의 시야'],[274,'소련의 시야']].forEach(([x,name],pane)=>{b+=rect(x,46,228,203,'#22334c','rx="8"')+tx(x+18,75,name,19,'#f6f8fc');for(let i=0;i<3;i++){const known=(pane===0?i!==1:i!==0);b+=rect(x+16,93+i*47,196,35,known?'#426da2':'#2d415e','rx="4"')+tx(x+29,116+i*47,known?'알고 있는 정보':'아직 모르는 정보',15,known?'#f5f8ff':'#879ab7');}});b+=ln(260,54,260,251,'#e5ad58',2,'stroke-dasharray="5 5"')+tx(260,271,'같은 날, 서로 다른 정보',16,'#e5bc7b','middle');return svg(b,true);
}
function drawZoom(event){
  const topic=topics.find(t=>t.topic_id===event.directTopicIds[0]);const members=ideaEvents.filter(e=>e.directTopicIds.includes(topic?.topic_id));const month=event.date.length>=7?event.date.slice(0,7):event.date;const count=members.filter(e=>e.date.startsWith(month)).length;const rows=[['냉전 전체',`${ideaEvents.length}개 사건`],[topic?.name||'냉전',`${members.length}개 사건`],[month,`${count}개 기록`],[label(event),event.date]];let b='';
  rows.forEach(([title,sub],i)=>{const left=18+i*38,y=23+i*61,w=484-i*60;const fill=['#e4e9f2','#ccd9ed','#99b5df','#3c67a4'][i];b+=rect(left,y,w,48,fill,'rx="4"')+tx(left+14,y+21,[...title].slice(0,17).join(''),i===3?15:17,i===3?'#fff':'#28394f')+tx(left+14,y+40,sub,13,i===3?'#e5ecf8':'#5c6c84');if(i<3)b+=ln(left+22,y+49,left+60,y+60,'#7285a2',2);});return svg(b);
}
function renderIdeas(){
  const event=focusEvent();
  document.querySelector('#current').textContent=`${event.date}  ${event.title}${event.actorIds.length?'':' (국가 관계는 아직 미입력)'}`;
  document.querySelectorAll('[data-case]').forEach(button=>button.setAttribute('aria-pressed',String(caseIds[button.dataset.case]===focusId)));
  for(const [id,render] of Object.entries({metro:drawMetro,weave:drawWeave,galaxy:drawGalaxy,strata:drawStrata,relay:drawRelay,prism:drawPrism,fog:drawFog,zoom:drawZoom}))document.getElementById(id).innerHTML=render(event);
}
document.addEventListener('click',event=>{const target=event.target.closest('[data-case],[data-eid]');if(!target)return;focusId=target.dataset.eid||caseIds[target.dataset.case];renderIdeas();});
document.addEventListener('keydown',event=>{const target=event.target.closest('[data-eid]');if(target&&['Enter',' '].includes(event.key)){event.preventDefault();focusId=target.dataset.eid;renderIdeas();}});
if(ideaEvents.length!==167||new Set(ideaEvents.map(e=>e.id)).size!==167||Object.values(caseIds).some(id=>!ideaEvents.some(e=>e.id===id)))throw new Error('Invalid concept source data');
renderIdeas();
