'use strict';
(() => {
  let data=SheetData.build(SHEET_SNAPSHOT.tables),events=[],topics=[],start=1968,end=1973,mode='time',selected='',topic='',bridges=false,frame=0,tourTimer=0;
  let positions=new Map(),target,els=new Map(),edges=[];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const palette=['#d6e887','#ac9ce7','#f09b7b','#78c9c4','#8aaee8','#d3a2bd','#e0bc79','#b0bace'];
  const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const color=id=>palette[Math.max(0,topics.findIndex(t=>t.topic_id===id))%palette.length];
  function headline(e){return e.shortTitle.replace(/\([^)]*\)/g,'').replace(/\b(Treaty of Moscow|Basic Treaty|Paris Peace Accord)\b/g,'').replace(/\s+/g,' ').trim();}
  const short=e=>{const s=headline(e);return [...s].slice(0,20).join('')+([...s].length>20?'…':'');};
  function stopTour(){clearTimeout(tourTimer);tourTimer=0;$('#tour').textContent='전환 시연';}
  function setMode(value){mode=value;document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));$('#scene-note').textContent=mode==='time'?'연도별 날짜순 · 월·일 미상은 해당 기간의 첫 위치에 표시합니다.':'선은 원본의 주제 분류를 나타냅니다. 인과관계·지리적 거리를 뜻하지 않습니다.';animate();$('#announcement').textContent=mode==='time'?'시간순으로 사건을 배치했습니다.':'주제별로 사건을 모았습니다. 여러 주제에 속한 사건은 무리 사이에 놓입니다.';}
  function mount(){
    cancelAnimationFrame(frame);
    events=data.events.filter(e=>e.year>=start&&e.year<=end).sort((a,b)=>a.bounds.start-b.bounds.start||a.id.localeCompare(b.id));
    const ids=new Set(events.flatMap(e=>e.directTopicIds));topics=data.topics.filter(t=>ids.has(t.topic_id));
    if(!events.some(e=>e.id===selected))selected=events.find(e=>e.directTopicIds.length>1)?.id||events[0]?.id||'';
    topic='';bridges=false;$('#bridges').setAttribute('aria-pressed','false');
    target=LensLayout.layout(events,topics,mode,start,end);
    positions=new Map([...target.positions].map(([id,p])=>[id,{...p}]));
    $('#scene').setAttribute('viewBox',`0 0 ${target.width} ${target.height}`);
    $('#scene').style.minWidth=Math.max(830,target.width*.8)+'px';
    $('#period-label').textContent=`${start}—${end} · ${events.length}개 사건`;
    $('#time-axis').innerHTML=Array.from({length:end-start+1},(_,i)=>{const x=38+i*(target.width-76)/(end-start+1)+(target.width-76)/(end-start+1)/2;return `<text x="${x}" y="55" fill="#b6c5da" font-size="21" text-anchor="middle">${start+i}</text><path d="M${x} 77V${target.height-25}" stroke="#304056" stroke-dasharray="2 7"/>`;}).join('');
    $('#topic-axis').innerHTML=target.anchors.map(a=>`<g class="topic-label" data-topic="${esc(a.topic_id)}" role="button" tabindex="0" aria-label="${esc(a.name)} 강조"><ellipse cx="${a.x}" cy="${a.y+100}" rx="155" ry="120" fill="${color(a.topic_id)}" opacity=".035"/><text x="${a.x}" y="${a.y}" fill="${color(a.topic_id)}" text-anchor="middle">${esc(a.name==='냉전'?'냉전 전반':a.name)}</text></g>`).join('');
    $('#topic-buttons').innerHTML=`<button data-topic="" aria-pressed="true">전체</button>`+topics.map(t=>`<button data-topic="${esc(t.topic_id)}" aria-pressed="false" style="--color:${color(t.topic_id)}"><i></i>${esc(t.name==='냉전'?'냉전 전반':t.name)}</button>`).join('');
    $('#nodes').innerHTML=events.map(e=>{const title=short(e),chars=[...title],first=chars.slice(0,11).join(''),second=chars.slice(11).join('');return `<g class="node" data-event="${e.id}" role="button" tabindex="0" aria-label="${esc(e.date+' '+e.title)}"><title>${esc(e.date+' '+e.title)}</title><rect class="card" width="142" height="52" rx="6"/><rect width="3" height="34" x="0" y="9" rx="1" fill="${color(e.directTopicIds[0])}"/><text class="date" x="10" y="14">${esc(e.date)}</text><text class="label" x="10" y="30">${esc(first)}<tspan x="10" dy="15">${esc(second)}</tspan></text>${e.directTopicIds.length>1?'<circle cx="132" cy="10" r="3" fill="#f1a77f"/>':''}</g>`;}).join('');
    els=new Map([...document.querySelectorAll('[data-event]')].map(el=>[el.dataset.event,el]));
    $('#links').innerHTML=events.flatMap(e=>e.directTopicIds.map(id=>`<path class="link" data-from="${id}" data-to="${e.id}" stroke="${color(id)}"/>`)).join('');
    edges=[...document.querySelectorAll('.link')];paint();highlight();detail();
    if(!events.length)$('#announcement').textContent='이 시기에 등록된 사건이 없습니다.';
  }
  function paint(){
    for(const [id,el] of els){const p=positions.get(id);el.setAttribute('transform',`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);}
    for(const edge of edges){const a=target.anchors.find(a=>a.topic_id===edge.dataset.from),p=positions.get(edge.dataset.to);if(a&&p){const x=p.x+71,y=p.y+26;edge.setAttribute('d',`M${a.x},${a.y+12} Q${a.x},${(a.y+y)/2} ${x},${y}`);}}
    $('#time-axis').style.opacity=mode==='time'?'1':'0';$('#topic-axis').style.opacity=mode==='topics'?'1':'0';$('#topic-axis').style.pointerEvents=mode==='topics'?'auto':'none';$('#links').style.opacity=mode==='topics'?'1':'0';
    $('#time-axis').setAttribute('aria-hidden',String(mode!=='time'));$('#topic-axis').setAttribute('aria-hidden',String(mode!=='topics'));
    document.querySelectorAll('.topic-label').forEach(el=>el.setAttribute('tabindex',mode==='topics'?'0':'-1'));
  }
  function animate(){
    cancelAnimationFrame(frame);target=LensLayout.layout(events,topics,mode,start,end);
    if(reduced.matches){positions=target.positions;paint();return;}
    const from=new Map([...positions].map(([id,p])=>[id,{...p}])),began=performance.now();
    function tick(now){const t=Math.min(1,(now-began)/1250),ease=t<.5?16*t**5:1-(-2*t+2)**5/2;
      events.forEach((e,i)=>{const a=from.get(e.id),b=target.positions.get(e.id),arc=Math.sin(Math.PI*t)*Math.sin(i*2.4)*28;positions.set(e.id,{x:a.x+(b.x-a.x)*ease,y:a.y+(b.y-a.y)*ease+arc});});paint();if(t<1)frame=requestAnimationFrame(tick);
    }frame=requestAnimationFrame(tick);
  }
  function highlight(){
    for(const e of events){const el=els.get(e.id);el.classList.toggle('selected',e.id===selected);el.classList.toggle('dim',Boolean((topic&&!e.directTopicIds.includes(topic))||(bridges&&e.directTopicIds.length<2)));el.setAttribute('aria-pressed',String(e.id===selected));}
    edges.forEach(el=>el.classList.toggle('highlight',Boolean((topic&&el.dataset.from===topic)||(!topic&&el.dataset.to===selected))));
    document.querySelectorAll('#topic-buttons button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.topic===topic)));
  }
  function detail(){
    const e=events.find(e=>e.id===selected);if(!e){$('#detail').innerHTML='<h2>이 시기의 기록이 없습니다.</h2>';return;}
    const countries=[['actor_usa','미국'],['actor_ussr','소련']];
    const leaderRows=countries.map(([id,name])=>{const leaders=HistoryViews.leadersDuring(data.tenures,id,e.bounds);return `<div class="leader"><b>${name}</b><div>${leaders.map(t=>`${esc(t.person)}<small>${esc(t.title)} · ${esc(t.startDate)}~${esc(t.endDate)}</small>`).join('')||'재임 자료 없음'}</div></div>`;}).join('');
    const images=e.media.map(m=>{
      const src=TimelineImage.src(m.url),credit=TimelineImage.credit(src);
      const caption=[esc(m.caption||''),credit&&`${esc(credit.by)} · <a href="${esc(credit.licenseUrl)}" target="_blank" rel="noreferrer">${esc(credit.license)}</a> · 화면용 WebP 변환`].filter(Boolean).join(' · ');
      return `<figure class="media"><a href="${esc(m.url)}" target="_blank" rel="noreferrer">${src?`<img src="${esc(src)}" alt="${esc(m.title)}" loading="lazy">`:'이미지 출처 ↗'}</a>${caption?`<figcaption>${caption}</figcaption>`:''}</figure>`;
    }).join('');
    $('#detail').innerHTML=`<p class="detail-date">${esc(e.date)}</p><h2>${esc(e.title)}</h2>${e.reviewStatus==='verified'?'':'<p class="review">원본 기록 · 검토 전</p>'}<p class="summary">${esc(e.description||'')}</p><div class="badges">${e.directTopicIds.map(id=>`<span style="--color:${color(id)}">${esc(data.topics.find(t=>t.topic_id===id)?.name||id)}</span>`).join('')}</div>${images}<div class="leaders"><h3>이 시점의 재임자</h3>${leaderRows}<p style="font-size:12px;line-height:1.6;color:#68707b">재임 기간 기준이며, 이 사건의 직접 참여 여부와는 구분됩니다.${e.date.length<10?' 사건 날짜의 알려진 범위와 겹치는 재임자를 표시합니다.':''}</p></div><a href="${esc(SHEET_CONFIG.url)}" target="_blank" rel="noreferrer">시트에서 원본 보기 ↗</a>`;
    $('#detail').querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{img.alt='이미지를 불러올 수 없습니다. 링크로 원본을 확인하세요.';},{once:true}));
  }
  document.addEventListener('click',ev=>{
    const b=ev.target.closest('button,[data-event],.topic-label');if(!b)return;
    if(b.dataset.mode){stopTour();setMode(b.dataset.mode);}
    if(b.dataset.period){stopTour();[start,end]=b.dataset.period.split(',').map(Number);document.querySelectorAll('[data-period]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));const title=b.textContent;$('#inquiry').textContent=`왜 서로 다른 사건들이 ‘${title}’ 안에서 만날까?`;$('#prompt').textContent=`${start}~${end}년의 사건을 시간과 주제로 따라가 보세요.`;mount();}
    if(b.hasAttribute('data-topic')){topic=b.dataset.topic===topic?'':b.dataset.topic;highlight();$('#announcement').textContent=topic?`${data.topics.find(t=>t.topic_id===topic)?.name} 관련 사건 ${events.filter(e=>e.directTopicIds.includes(topic)).length}개 강조`:'전체 사건 표시';}
    if(b.dataset.event){selected=b.dataset.event;highlight();detail();$('#announcement').textContent=events.find(e=>e.id===selected).title;}
  });
  $('#scene').addEventListener('keydown',ev=>{if(['Enter',' '].includes(ev.key)&&ev.target.matches('[role=button]')){ev.preventDefault();ev.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
  $('#bridges').addEventListener('click',()=>{bridges=!bridges;$('#bridges').setAttribute('aria-pressed',String(bridges));highlight();$('#announcement').textContent=bridges?`여러 주제에 걸친 사건 ${events.filter(e=>e.directTopicIds.length>1).length}개 강조`:'전체 사건 표시';});
  $('#tour').addEventListener('click',()=>{if(tourTimer){stopTour();return;}setMode('time');$('#tour').textContent='시연 멈추기';tourTimer=setTimeout(()=>{setMode('topics');tourTimer=setTimeout(()=>{topic=topics.find(t=>t.topic_id==='topic_detente')?.topic_id||topics[0]?.topic_id||'';highlight();stopTour();},1700);},1600);});
  reduced.addEventListener('change',()=>{if(reduced.matches){cancelAnimationFrame(frame);positions=target.positions;paint();}});
  mount();
  // shortcut: Load once per visit; use the main app for periodic synchronization.
  (async()=>{try{const response=await fetch(SHEET_CONFIG.feedUrl+'&v='+Math.floor(Date.now()/60000),{credentials:'omit',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('feed');const fresh=SheetData.build(SheetData.scopePackage('cold-war',await SheetData.readPublishedTables(SheetData.parseCSV(await response.text()),SHEET_CONFIG)));if(JSON.stringify(data)!==JSON.stringify(fresh)){stopTour();data=fresh;mount();}$('#data-status').textContent='공개 시트 연결됨';}catch{$('#data-status').textContent='저장된 시트 데이터 · 실시간 연결 실패';}})();
})();
