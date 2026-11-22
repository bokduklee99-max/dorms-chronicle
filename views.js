'use strict';
// Reading modes share the same validated sheet data.
const reading={mode:'standard',countryBasis:'actors',networkBasis:'topics',decade:null,cursor:null,start:null,filter:null,openId:null,edgeId:null};
const relationLabels={causes:'원인이 된다',responds_to:'대응한다',part_of:'일부다'};
let viewData={actors:[],tenures:[],relations:[]};
const predictionKey='yeonpyo-predictions-v1';
let predictions={};
let predictionStorageError=false;
try {
  const saved=JSON.parse(localStorage.getItem(predictionKey)||'{}');
  if(!saved||Array.isArray(saved)||typeof saved!=='object')throw new Error();
  predictions=Object.fromEntries(Object.entries(saved).filter(([key,value])=>/^.+\|\d{4}-\d{2}-\d{2}$/.test(key)&&typeof value==='string'&&value.length<=1000));
}catch{predictionStorageError=true;}
const readingEvents=()=>EVENTS.filter(event=>state.filter==='all'||event.topicIds.includes(state.filter));
const predictionId=()=>`${state.filter}|${reading.cursor}`;

function savePrediction() {
  if(reading.mode!=='reveal'||!reading.cursor||$('#timeline-reveal').hidden)return;
  const value=$('#reveal-prediction').value;
  if(predictions[predictionId()]===value||(!value&&!predictions[predictionId()]))return;
  predictions[predictionId()]=value;
  try{if(predictionStorageError)throw new Error();localStorage.setItem(predictionKey,JSON.stringify(predictions));$('#reveal-note-status').textContent='이 브라우저에 예측을 저장했어요.';}
  catch{$('#reveal-note-status').textContent='예측을 저장하지 못했어요. 화면을 닫기 전에 따로 복사해 주세요.';}
}

function renderReadingMode() {
  $('.app-shell').dataset.reading=reading.mode;
  const headings={standard:['사건을 따라 냉전 읽기','같은 시기, 서로 다른 곳에서 일어난 일'],countries:['같은 해, 각국에서는','국가별 사건과 당시 재임자를 나란히 살펴보세요.'],network:['한 사건에서 다른 사건으로','사건을 눌러 연결을 따라가 보세요.'],reveal:['그날에는 다음 일을 알 수 없었어요','기록을 하루씩 열고, 다음 상황을 예상해 보세요.']};
  const [title,intro]=headings[reading.mode];
  $('#timeline-heading').textContent=title;$('#timeline-intro').textContent=intro;
  $$('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===reading.mode)));
  for(const name of Object.keys(headings))$(`#timeline-${name}`).hidden=name!==reading.mode;
  if(reading.mode==='countries')renderCountries();
  if(reading.mode==='network')renderNetwork();
  if(reading.mode==='reveal')renderReveal();
}

function renderCountries() {
  const events=readingEvents();
  const decades=[...new Set(events.map(event=>Math.floor(event.year/10)*10))];
  if(!decades.includes(reading.decade))reading.decade=decades.find(decade=>decade===Math.floor(state.year/10)*10)??decades[0];
  $('#decade-buttons').innerHTML=decades.map(decade=>`<button data-decade="${decade}" aria-pressed="${decade===reading.decade}">${decade}년대</button>`).join('');
  $$('[data-country-basis]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.countryBasis===reading.countryBasis)));
  const result=HistoryViews.countryRows(events,viewData.actors,viewData.tenures,reading.decade,reading.countryBasis);
  $('#country-note').textContent=reading.countryBasis==='tags'?'원본 지도자 태그로 나눴어요. 사건의 참여국을 뜻하지는 않아요.':'시트에 연결된 국가를 표시해요. 같은 사건은 여러 국가에 함께 나올 수 있어요.';
  $('#country-board').innerHTML=result.columns.length?`<table class="country-table"><thead><tr><th scope="col">연도</th>${result.columns.map(column=>`<th scope="col">${escapeHTML(column.name)}</th>`).join('')}</tr></thead><tbody>${result.rows.map(row=>`<tr><th scope="row">${row.year}</th>${row.cells.map(cell=>`<td>${cell.leaders.length?`<div class="year-leaders">${cell.leaders.map(leader=>`${leader.source?`<a href="${escapeHTML(leader.source)}" target="_blank" rel="noreferrer">`:'<div>'}${escapeHTML(leader.title)} ${escapeHTML(leader.person)}<span>${escapeHTML(leader.startDate)} ~ ${escapeHTML(leader.endDate||'종료 미입력')}</span>${leader.source?'</a>':'</div>'}`).join('')}</div>`:''}${cell.events.map(event=>`<button class="country-event" data-event="${escapeHTML(event.id)}" aria-pressed="${event.id===state.eventId}"><time>${escapeHTML(event.date)}</time><strong>${escapeHTML(event.shortTitle)}</strong></button>`).join('')}</td>`).join('')}</tr>`).join('')}</tbody></table>`:'<div class="empty-state"><h3>이 시기의 사건이 없어요</h3><p>다른 주제를 골라보세요.</p></div>';
  $('#country-detail').innerHTML=detailHTML(selectedEvent());
}

function renderNetwork() {
  const events=readingEvents();
  const graph=HistoryViews.network(events,viewData.relations,state.eventId,reading.networkBasis);
  $$('[data-network-basis]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.networkBasis===reading.networkBasis)));
  const prefix=reading.networkBasis==='topics'?'같은 주제를 공유하는 연결이에요. 인과관계를 뜻하지는 않아요.':'화살표는 등록된 관계의 방향이에요. 선의 글자를 눌러 근거를 읽을 수 있어요.';
  $('#network-note').textContent=prefix+(graph.total>6?` 연결된 사건 ${graph.total}개 중 가까운 6개를 보여줘요.`:'');
  $('#network-evidence').hidden=true;
  if(!graph.center){$('#network-board').innerHTML='<p class="empty-state">연결을 살펴볼 사건이 없어요.</p>';$('#network-detail').innerHTML='';return;}
  $('#network-detail').innerHTML=detailHTML(graph.center);
  if(!graph.nodes.length){$('#network-board').innerHTML=`<div class="empty-state"><h3>${reading.networkBasis==='relations'?'등록된 사건 관계가 없어요':'같은 주제의 다른 사건이 없어요'}</h3>${reading.networkBasis==='relations'?'':'<p>다른 주제나 사건을 골라보세요.</p>'}</div>`;return;}
  const slots=[[30,22],[350,22],[670,22],[30,462],[350,462],[670,462]];
  const positions=new Map([[graph.center.id,[480,312]],...graph.nodes.map((node,index)=>[node.id,[slots[index][0]+130,slots[index][1]+68]])]);
  const edges=graph.edges.map((edge,index)=>{
    const [x1,y1]=positions.get(edge.from),[x2,y2]=positions.get(edge.to);
    const label=edge.type==='shared_topic'?edge.topics.map(id=>viewData.topics.find(topic=>topic.topic_id===id)?.name||id).join(', '):relationLabels[edge.type];
    const dx=x2-x1,dy=y2-y1,trim=Math.min(130/Math.abs(dx),68/Math.abs(dy));
    return `<path class="graph-edge" d="M${x1+dx*trim} ${y1+dy*trim}L${x2-dx*trim} ${y2-dy*trim}"${edge.type==='shared_topic'?'':' marker-end="url(#relation-arrow)"'}/><foreignObject x="${(x1+x2)/2-90}" y="${(y1+y2)/2-20+index%2*4}" width="180" height="44">${edge.type==='shared_topic'?`<span class="graph-edge-label">${escapeHTML(label)}</span>`:`<button class="graph-edge-label" data-relation="${escapeHTML(edge.id)}" aria-label="${escapeHTML(label)} 근거 보기">${escapeHTML(label)}</button>`}</foreignObject>`;
  }).join('');
  const nodeHTML=(event,x,y,center=false)=>`<foreignObject x="${x}" y="${y}" width="260" height="136"><button class="network-node${center?' center-node':''}" data-event="${escapeHTML(event.id)}" aria-pressed="${center}"><time>${escapeHTML(event.date)}</time><strong>${escapeHTML(event.shortTitle)}</strong></button></foreignObject>`;
  $('#network-board').innerHTML=`<svg viewBox="0 0 960 620" role="group" aria-label="${escapeHTML(graph.center.title)} 중심의 사건 관계망"><defs><marker id="relation-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z"/></marker></defs>${edges}${nodeHTML(graph.center,350,244,true)}${graph.nodes.map((event,index)=>nodeHTML(event,...slots[index])).join('')}</svg>`;
  const evidence=viewData.relations.find(row=>row.id===reading.edgeId);
  if(evidence&&graph.edges.some(row=>row.id===evidence.id)){
    const from=EVENTS.find(event=>event.id===evidence.from),to=EVENTS.find(event=>event.id===evidence.to);
    $('#network-evidence').hidden=false;
    $('#network-evidence').innerHTML=`<h3>${escapeHTML(from.shortTitle)} → ${escapeHTML(to.shortTitle)}</h3><p>${escapeHTML(evidence.notes||relationLabels[evidence.type])}</p>${evidence.citation?`<p>${escapeHTML(evidence.citation)}</p>`:''}${evidence.source?`<a href="${escapeHTML(evidence.source)}" target="_blank" rel="noreferrer">연결 근거 읽기${icon('external')}</a>`:''}`;
  }
}

function startReveal(fromFirst=false) {
  savePrediction();
  const groups=HistoryViews.exactDays(readingEvents());
  reading.cursor=(fromFirst?groups[0]:groups.find(group=>SheetData.dateRange(group.date).start>=selectedEvent().bounds.start)||groups.at(-1))?.date||null;
  reading.start=reading.cursor;reading.filter=state.filter;reading.openId=null;
  renderReveal();
}

function renderReveal() {
  const events=readingEvents(),groups=HistoryViews.exactDays(events);
  const eligible=groups.reduce((count,group)=>count+group.events.length,0);
  $('#reveal-precision').textContent=`일자가 있는 사건 ${eligible}개${events.length>eligible?`, 일자가 불확실한 ${events.length-eligible}개는 제외`:''}`;
  $('#reveal-empty').hidden=Boolean(groups.length);$('#reveal-content').hidden=!groups.length;
  if(!groups.length){reading.cursor=null;return;}
  if(!reading.cursor||reading.filter!==state.filter){startReveal();return;}
  if(reading.cursor>groups.at(-1).date)reading.cursor=groups.at(-1).date;
  const opened=HistoryViews.revealAt(groups,reading.cursor,reading.start);
  const [year,month,day]=reading.cursor.split('-');
  $('#reveal-date').innerHTML=`<span class="day-year">${year}년</span><strong>${Number(month)}월 ${Number(day)}일</strong>`;
  const card=event=>`<article class="revealed-event"><h3>${escapeHTML(event.shortTitle)}</h3><button class="text-button" data-reveal-open="${escapeHTML(event.id)}" aria-expanded="${reading.openId===event.id}">${reading.openId===event.id?'설명 닫기':'원문 설명 보기'}</button>${reading.openId===event.id?`<div class="revealed-description"><p class="view-note">원문 설명에는 이후 상황이 담길 수 있어요.</p><p class="event-description">${escapeHTML(event.description||'원문 설명이 없어요.')}</p>${mediaHTML(event)}${event.source?`<a class="detail-source" href="${escapeHTML(event.source)}" target="_blank" rel="noreferrer">원본 사건 보기</a>`:''}</div>`:''}</article>`;
  $('#reveal-events').innerHTML=opened.today.map(card).join('')||'<p class="no-record">오늘 날짜로 등록된 새 기록은 없어요.</p>';
  const noteDates=Object.keys(predictions).filter(key=>key.startsWith(state.filter+'|')).map(key=>key.slice(key.lastIndexOf('|')+1)).filter(date=>date>=reading.start&&date<reading.cursor);
  const history=[...new Set([...opened.past.map(group=>group.date),...noteDates])].sort().reverse().map(date=>opened.past.find(group=>group.date===date)||{date,events:[]});
  $('#reveal-history').innerHTML=history.map(group=>`<section><time>${escapeHTML(group.date)}</time>${group.events.map(card).join('')}${predictions[`${state.filter}|${group.date}`]?`<p class="saved-prediction">내 예측<br>${escapeHTML(predictions[`${state.filter}|${group.date}`])}</p>`:''}</section>`).join('')||'<p class="no-record">다음 날을 열면 앞선 기록이 이곳에 남아요.</p>';
  $('#reveal-prediction').value=predictions[predictionId()]||'';
  $('#reveal-next-day').disabled=!opened.next;$('#reveal-next-record').disabled=!opened.next;
  $('#reveal-next-day').textContent=opened.next?'다음 날 공개':'마지막 기록까지 읽었어요';
}

function advanceReveal(skip=false) {
  savePrediction();
  const opened=HistoryViews.revealAt(HistoryViews.exactDays(readingEvents()),reading.cursor);
  if(!opened.next)return;
  reading.cursor=skip?opened.next:HistoryViews.nextDay(reading.cursor);reading.openId=null;
  renderReveal();
}

document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.view){savePrediction();reading.mode=button.dataset.view;renderTimeline();}
  if(button.dataset.countryBasis){reading.countryBasis=button.dataset.countryBasis;renderCountries();}
  if(button.dataset.decade){reading.decade=Number(button.dataset.decade);renderCountries();}
  if(button.dataset.networkBasis){reading.networkBasis=button.dataset.networkBasis;reading.edgeId=null;renderNetwork();}
  if(button.dataset.relation){reading.edgeId=button.dataset.relation;renderNetwork();}
  if(button.dataset.revealOpen){
    const allowed=HistoryViews.exactDays(readingEvents()).filter(group=>group.date>=reading.start&&group.date<=reading.cursor).flatMap(group=>group.events);
    if(allowed.some(event=>event.id===button.dataset.revealOpen)){savePrediction();reading.openId=reading.openId===button.dataset.revealOpen?null:button.dataset.revealOpen;renderReveal();}
  }
});
