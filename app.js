'use strict';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const icons = {
  timeline:'<path d="M5 4v16M9 6h10M9 12h7M9 18h10"/><circle cx="5" cy="6" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="18" r="1"/>',
  map:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16"/>',
  game:'<rect x="3" y="6" width="12" height="15" rx="2"/><path d="M8 6V3h12v15h-5M7 11h4M7 15h4"/>',
  library:'<path d="M3 4h7a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H3zM13 7a3 3 0 0 1 3-3h5v15h-4a4 4 0 0 0-4 2"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',left:'<path d="m14 7-5 5 5 5"/>',right:'<path d="m10 7 5 5-5 5"/>',
  play:'<path d="m9 5 10 7-10 7z"/>',pause:'<path d="M9 5v14M15 5v14"/>',
  pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0z"/><circle cx="12" cy="10" r="2"/>',
  calendar:'<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 11h16"/>',
  question:'<path d="M8.5 8a3.5 3.5 0 1 1 5.8 2.6C12 12 12 12 12 14M12 17v.1"/><circle cx="12" cy="12" r="10"/>',
  expand:'<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>',
  moon:'<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
  restart:'<path d="M3 4v6h6M4 9a8 8 0 1 1 1 9"/>',plus:'<path d="M12 5v14M5 12h14"/>',
  external:'<path d="M14 3h7v7M10 14 21 3M21 14v6H4V3h6"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
let KEY_YEARS = [];
let lastTables;
let syncing = false;
const sheetCacheKey = `yeonpyo-sheet-${SHEET_CONFIG.id}-v4`;
function validateAppTables(tables) {
  if(!Array.isArray(tables.event_relations)&&!(Array.isArray(tables.countries)&&Array.isArray(tables.tenure_periods)&&Array.isArray(tables.categories)))throw new Error('새 시트 형식이 아직 게시되지 않았습니다.');
  return SheetData.build(tables);
}
const storageKey = 'yeonpyo-coldwar-events-v1';
let customEvents = [];
let storageError = false;
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
  if (!Array.isArray(saved)) throw new Error('Invalid saved events');
  customEvents = saved.filter(event => event && typeof event.id === 'string' && /^custom-[\w-]+$/.test(event.id) && Number.isInteger(event.year) && event.year >= 1945 && event.year <= 1991 && ['title','place','description'].every(key => typeof event[key] === 'string' && event[key].trim() && event[key].length <= (key === 'description' ? 500 : key === 'title' ? 60 : 30))).map(event => ({id:event.id,year:event.year,date:String(event.year),title:event.title,place:event.place,description:event.description,category:'변화',point:null,question:'이 사건은 냉전의 흐름에서 어떤 의미를 가질까요?',custom:true}));
  customEvents = customEvents.filter((event,index,list) => list.findIndex(item => item.id === event.id) === index);
} catch { storageError = true; }
const allEvents = () => [...EVENTS,...customEvents].sort((a,b) => a.year-b.year || a.date.localeCompare(b.date,'ko',{numeric:true}));
const state = {tab:'map',year:1962,eventId:'cuba',region:'world',filter:'all',zoom:1,playing:false};
let playTimer;
let toastTimer;
let game = null;
const selectedEvent = () => allEvents().find(event => event.id === state.eventId) || EVENTS[0];
const regionViews = {world:[0,0,954,410],europe:[415,43,260,185],asia:[650,60,250,190]};
const project = ([longitude,latitude]) => [(longitude+180)*2.65,(85-latitude)*2.65];

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#toast').hidden = true; },3500);
}

function mediaHTML(event) {
  const media = (event.media || []).map(asset => {
    const src = SHEET_MEDIA[asset.url] || (/\.(png|jpe?g|webp|gif)(?:[?#]|$)/i.test(asset.url) ? asset.url : '');
    return src ? `<figure><a href="${escapeHTML(asset.url)}" target="_blank" rel="noreferrer"><img src="${escapeHTML(src)}" alt="${escapeHTML(asset.caption || asset.title)}" loading="lazy" referrerpolicy="no-referrer"></a>${asset.caption ? `<figcaption>${escapeHTML(asset.caption)}</figcaption>` : ''}</figure>` : `<a class="detail-source" href="${escapeHTML(asset.url)}" target="_blank" rel="noreferrer">${escapeHTML(asset.title || '이미지 원본 보기')}${icon('external')}</a>`;
  }).join('');
  return media?`<div class="event-media">${media}</div>`:'';
}

function detailHTML(event, view) {
  const media=mediaHTML(event);
  return `<p class="event-date">${icon('calendar')}${escapeHTML(event.date)}${event.endDate ? ` ~ ${escapeHTML(event.endDate)}` : ''}${event.reviewStatus === 'draft' ? ' · 초안' : ''}</p>
    <h2>${escapeHTML(event.title)}</h2>${event.place ? `<p class="event-place">${icon('pin')}${escapeHTML(event.place)}${event.locationPrecision && event.locationPrecision !== 'exact_site' ? ' · 대표 위치' : ''}</p>` : ''}
    ${event.description ? `<p class="event-description">${escapeHTML(event.description)}</p>` : ''}
    ${event.leaders?.length ? `<div class="event-leaders">${event.leaders.map(leader => `<span>${escapeHTML(leader)}</span>`).join('')}</div>` : ''}
    ${event.leaderTags?.length ? `<div class="source-tags"><p>원본 지도자 태그</p>${event.leaderTags.map(tag=>`<span>${escapeHTML(tag)}</span>`).join('')}</div>` : ''}
    ${media}
    ${event.question ? `<div class="inquiry"><p>${icon('question')}함께 생각하기</p><blockquote>${escapeHTML(event.question)}</blockquote></div>` : ''}
    <div class="detail-actions"><button class="button ${view === 'map' ? 'primary' : 'secondary'}" data-go="${view === 'map' ? 'timeline' : 'map'}">${view === 'map' ? '연표에서 맥락 보기' : '이 시점 지도 보기'}${icon('arrow')}</button>${event.custom ? '<p class="detail-source">이 브라우저에 저장한 사건</p>' : event.source ? `<a class="detail-source" href="${escapeHTML(event.source)}" target="_blank" rel="noreferrer">원본 사건 보기 ${icon('external')}</a>` : ''}</div>`;
}

function setTab(tab, focus = false) {
  if (!['map','timeline','game','library'].includes(tab)) return;
  if (state.tab === 'map' && tab !== 'map') stopPlayback();
  state.tab = tab;
  $$('[role="tab"]').forEach(button => {
    const active = button.dataset.tab === tab;
    button.setAttribute('aria-selected',String(active));
    button.tabIndex = active ? 0 : -1;
    $(`#panel-${button.dataset.tab}`).hidden = !active;
    if (active && focus) button.focus();
  });
  if (tab === 'map') renderMap();
  if (tab === 'timeline') {
    renderTimeline();
    const active=$('.timeline-event.active'),list=$('#timeline-list');
    if(active) list.scrollTop=active.offsetTop-list.offsetTop-list.clientHeight/3;
  }
  if (tab === 'library') renderLibrary();
  if (tab === 'game' && !game) restartGame();
  if(tab!=='timeline')savePrediction();
}

function selectEvent(id) {
  const event = allEvents().find(item => item.id === id);
  if (!event) return;
  state.eventId = id;
  state.year = event.year;
  renderMap();
  if (state.tab === 'timeline') renderTimeline();
}

function setYear(year) {
  state.year = Math.max(KEY_YEARS[0],Math.min(KEY_YEARS.at(-1),Number(year)));
  const events = allEvents();
  const nearest = events.filter(event => event.year <= state.year).at(-1) || events[0];
  if (selectedEvent().year !== state.year) state.eventId = nearest.id;
  renderMap();
}

function drawMap() {
  const svg = $('#world-map');
  const grid = [];
  for (let longitude=-150;longitude<=150;longitude+=30) {
    const [x] = project([longitude,0]); grid.push(`<path d="M${x} 0V390"/>`);
  }
  for (let latitude=-60;latitude<=60;latitude+=30) {
    const [,y] = project([0,latitude]); grid.push(`<path d="M0 ${y}H954"/>`);
  }
  svg.innerHTML = `<defs><pattern id="divided-germany" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="var(--map-west)"/><path d="M0 0h2.5v5H0z" fill="var(--map-east)"/></pattern></defs><g class="map-grid">${grid.join('')}</g><g id="countries">${window.WORLD.map(country => `<path id="country-${country.id}" data-country="${country.id}" class="country" d="${country.d}"><title>${escapeHTML(country.name)}</title></path>`).join('')}</g><g id="map-labels"></g><g id="map-pins"></g>`;
}

function renderMap() {
  $('#map-title').textContent = `${state.year}년의 세계`;
  $('#year-output').textContent = `${state.year}년`;
  $('#year-slider').value = state.year;
  $$('#year-ticks button').forEach(button => button.setAttribute('aria-pressed',String(Number(button.dataset.year) === state.year)));
  $$('[data-region]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.region === state.region)));
  const base = regionViews[state.region];
  const width = base[2]/state.zoom, height = base[3]/state.zoom;
  $('#world-map').setAttribute('viewBox',`${base[0]+(base[2]-width)/2} ${base[1]+(base[3]-height)/2} ${width} ${height}`);
  $('#zoom-in').disabled = state.zoom >= 2.5;
  $('#zoom-out').disabled = state.zoom <= 1;
  $$('.country').forEach(path => {
    const id = path.dataset.country;
    const bloc = blocAt(id,state.year);
    path.setAttribute('class',`country ${bloc}${SOVIET.includes(id) && state.year < 1991 ? ' soviet' : ''}`);
    path.style.fill = id === 'DEU' && state.year >= 1955 && state.year < 1990 ? 'url(#divided-germany)' : '';
  });
  const labels = [
    {point:[-103,39],name:'미국',class:'large west-label'},
    {point:[85,59],name:state.year < 1991 ? '소련' : '러시아',class:'large east-label'},
    {point:[102,32],name:'중국'}, {point:[-107,60],name:'캐나다'},
    {point:[-51,-12],name:'브라질'}, {point:[135,-25],name:'오스트레일리아'},
    {point:[79,20],name:'인도'}, {point:[12,25],name:'아프리카'},
    {point:[-148,7],name:'태평양',ocean:true}, {point:[-31,17],name:'대서양',ocean:true}
  ];
  $('#map-labels').innerHTML = labels.map(label => { const [x,y] = project(label.point); return `<text x="${x}" y="${y}" class="${label.ocean ? 'ocean-label' : 'country-label'} ${label.class || ''}">${label.name}</text>`; }).join('');
  const markers = [];
  const seen = [];
  // A selected event wins when several nearby events share a city.
  const candidates = [selectedEvent(),...allEvents().filter(event => Math.abs(event.year-state.year)<=2)];
  for (const event of candidates) {
    if (!event.point) continue;
    if (seen.some(point => Math.hypot(point[0]-event.point[0],point[1]-event.point[1])<8)) continue;
    seen.push(event.point);
    const [x,y] = project(event.point);
    const bounds = $('#world-map').getBoundingClientRect();
    const scale = bounds.width && bounds.height ? 1/Math.min(bounds.width/width,bounds.height/height) : 1;
    const size = 44*scale;
    const selected = state.eventId === event.id;
    markers.push(`<foreignObject x="${x-size/2}" y="${y-size/2}" width="${size}" height="${size}" overflow="visible"><div xmlns="http://www.w3.org/1999/xhtml" style="transform:scale(${scale});transform-origin:top left"><button class="map-pin ${selected ? 'selected' : ''}" data-event="${escapeHTML(event.id)}" aria-label="${escapeHTML(`${event.year}년 ${event.title}`)}" aria-pressed="${selected}"></button></div></foreignObject>`);
    if (selected) markers.push(`<text x="${x+22*scale}" y="${y+4*scale}" class="pin-caption" style="font-size:${12*scale}px">${escapeHTML(event.place)}</text>`);
  }
  $('#map-pins').innerHTML = markers.join('');
  const note = state.year < 1991 ? '현대 국경으로 단순화한 진영 예시' : '소련 해체와 독립국을 현대 국경으로 표현한 예시';
  $('#map-caption').textContent = `${note}${state.year >= 1955 && state.year < 1990 ? ', 독일 빗금은 동서 분단' : ''}${selectedEvent().point ? '' : ' · 선택한 사건의 장소 미입력'}`;
  $('#map-detail').innerHTML = detailHTML(selectedEvent(),'map');
  const nearby = allEvents().filter(event => event.id !== state.eventId).sort((a,b) => Math.abs(a.year-state.year)-Math.abs(b.year-state.year)).slice(0,3).sort((a,b)=>a.year-b.year);
  $('#nearby-events').innerHTML = nearby.map(event => `<button class="nearby-event" data-event="${escapeHTML(event.id)}"><span class="event-year">${event.year}</span><span class="event-name">${escapeHTML(event.title)}<small>${escapeHTML(event.place)}</small></span>${icon('right')}</button>`).join('');
}

function renderTimeline() {
  const events = allEvents().filter(event => state.filter === 'all' || event.topicIds?.includes(state.filter));
  if(events.length&&!events.some(event=>event.id===state.eventId)){state.eventId=events[0].id;state.year=events[0].year;}
  $$('[data-filter]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.filter === state.filter)));
  const extra=$('#other-topic-buttons [aria-pressed="true"]');
  $('#more-topics').textContent=extra?extra.textContent:'다른 주제';
  $('#more-topics').classList.toggle('has-selection',Boolean(extra));
  $('#timeline-list').innerHTML = events.map(event => `<div class="timeline-event ${event.id === state.eventId ? 'active' : ''}"><span class="timeline-year">${event.year}</span><button data-event="${escapeHTML(event.id)}" aria-pressed="${event.id === state.eventId}"><h3>${escapeHTML(event.title)}</h3><p><span>${escapeHTML(event.place)}</span><span>${escapeHTML(event.category)}</span></p></button></div>`).join('') || '<p class="timeline-empty">이 분류에 해당하는 사건이 없어요.</p>';
  $('#timeline-detail').innerHTML = events.length ? detailHTML(selectedEvent(),'timeline') : '<p>이 분류에 해당하는 사건이 없어요.</p>';
  renderReadingMode();
}

function stopPlayback() {
  clearInterval(playTimer);
  state.playing = false;
  $('#play-years').innerHTML = icon('play');
  $('#play-years').setAttribute('aria-label','시간 흐름 재생');
  $('#play-years').setAttribute('aria-pressed','false');
}

function moveYear(direction) {
  const next = direction > 0 ? KEY_YEARS.find(year => year > state.year) : [...KEY_YEARS].reverse().find(year => year < state.year);
  if (next !== undefined) setYear(next);
}

function renderLibrary() {
  const query = $('#library-search').value.trim().toLocaleLowerCase();
  const events = allEvents().filter(event => `${event.title} ${event.place} ${event.year}`.toLocaleLowerCase().includes(query));
  $('#library-count').textContent = `${EVENTS.length}개의 시트 사건${customEvents.length ? ` · 이 브라우저에 저장한 사건 ${customEvents.length}개` : ''}`;
  $('#library-body').innerHTML = events.map(event => `<tr><td>${escapeHTML(event.date)}</td><td>${escapeHTML(event.title)}${event.example ? ' (예시)' : ''}</td><td>${escapeHTML(event.place)}</td><td>${escapeHTML(event.category)}</td><td><button data-library-event="${escapeHTML(event.id)}" aria-label="${escapeHTML(event.title)} 연표에서 보기">${icon('right')}</button></td></tr>`).join('');
  $('#library-empty').hidden = events.length > 0;
}

function restartGame() {
  const queue=SheetData.gamePool(EVENTS);
  const ready=queue.length>=6;
  $('#game-empty').hidden=ready;
  $('#game-content').hidden=!ready;
  if(!ready){game=null;return;}
  for(let i=queue.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[queue[i],queue[j]]=[queue[j],queue[i]];}
  const anchor=queue.pop();
  game={queue:queue.slice(0,5),placed:[anchor],anchorId:anchor.id,round:0,score:0,answer:null,complete:false};
  renderGame();
}

function gapLabel(index,placed) {
  if(index===0) return `${placed[0].title} 이전`;
  if(index===placed.length) return `${placed.at(-1).title} 이후`;
  return `${placed[index-1].title} 다음, ${placed[index].title} 이전`;
}

function renderGame() {
  const current=game.queue[game.round] || game.placed.at(-1);
  const locked=Boolean(game.answer)||game.complete;
  $('#game-round').textContent=game.complete?'5 / 5 완료':`${game.round+1} / ${game.queue.length}`;
  $('#game-score').textContent=`${game.score}점`;
  $('#game-title').textContent=game.complete?'냉전의 흐름을 연결했어요':'이 사건은 어디에 들어갈까요?';
  $('#game-prompt-label').textContent=game.complete?'최종 결과':'이번에 놓을 사건';
  $('#game-prompt-title').textContent=game.complete?`${game.score/10}문제 정답, ${game.score}점`:current.title;
  $('#game-prompt-place').textContent=game.complete?'5문제, 총 50점':current.place;
  $('#game-revealed-date').hidden=!game.answer||game.complete;
  $('#game-revealed-date').textContent=current.date;
  $('#game-instruction').textContent=game.complete?'사건들이 어떻게 이어지는지 연표에서 살펴보세요.':locked?'정답 위치에 사건을 놓았어요. 다음 사건을 이어서 놓아보세요.':'새 사건이 들어갈 틈을 고르세요.';
  $('.game-context').classList.toggle('game-complete',game.complete);
  $('.game-map').hidden=!current.point;
  if(current.point){
    const [x,y]=project(current.point);
    $('#game-map').innerHTML=`<g>${window.WORLD.map(country=>`<path class="country game-land" d="${country.d}"/>`).join('')}</g><g transform="translate(${x} ${y})"><circle class="game-location-halo" r="16"/><circle class="game-location-dot" r="5"/></g>`;
    $('#game-map').setAttribute('aria-label',`${current.place}에 위치한 출제 사건, 현대 국경 기준`);
  }
  $('.game-context').classList.toggle('no-location',!current.point);
  const nodes=[];
  for(let gap=0;gap<=game.placed.length;gap++){
    if(!locked) nodes.push(`<button class="insertion-gap" data-gap="${gap}" aria-label="${escapeHTML(gapLabel(gap,game.placed))}에 놓기">${icon('plus')}<span>${gap===0?'이전':gap===game.placed.length?'이후':'사이'}</span></button>`);
    if(gap<game.placed.length){
      const event=game.placed[gap];
      nodes.push(`<div class="placed-event${game.answer&&event.id===current.id?' just-placed':''}"><time>${escapeHTML(event.date)}</time><h3>${escapeHTML(event.shortTitle || event.title)}</h3>${event.id===game.anchorId?'<span class="anchor-label">기준 사건</span>':''}</div>`);
    }
  }
  $('#game-board').innerHTML=nodes.join('');
  $('#next-game').hidden=!game.answer||game.complete;
  $('#next-game').textContent=game.round===game.queue.length-1?'결과 보기':'다음 사건';
  $('#game-result-timeline').hidden=!game.complete;
  const feedback=$('#game-feedback');
  feedback.className=game.answer?(game.answer.correct?'success':'error'):'';
  feedback.innerHTML=game.complete?'':game.answer?`<strong>${game.answer.correct?'맞았어요. 10점을 얻었어요.':'다른 위치예요. 정답 위치에 놓았어요.'}</strong><p>${escapeHTML(current.date)}, ${escapeHTML(current.description)}</p>`:'';
}

function answerGame(gap) {
  if(!game||game.answer||game.complete||!Number.isInteger(gap)||gap<0||gap>game.placed.length)return;
  const current=game.queue[game.round],actual=insertionIndex(game.placed,current);
  const correct=gap===actual;
  if(correct) game.score+=10;
  game.answer={correct,chosen:gap,actual};
  game.placed.splice(actual,0,current);
  renderGame();
  $('#next-game').focus({preventScroll:true});
}

function applyTables(tables) {
  const next=validateAppTables(tables);
  savePrediction();
  stopPlayback();
  viewData=next;
  EVENTS=next.events; lastTables=JSON.stringify(tables);
  KEY_YEARS=[...new Set([...next.years,...customEvents.map(event=>event.year)])].sort((a,b)=>a-b);
  if(!allEvents().some(event=>event.id===state.eventId))state.eventId=EVENTS.find(event=>event.year>=state.year)?.id || EVENTS.at(-1).id;
  state.year=selectedEvent().year;
  if(state.filter!=='all'&&!next.topics.some(topic=>topic.topic_id===state.filter))state.filter='all';
  const commonTopics=new Set(['topic_coldwar_start','topic_korean_war','topic_cuba_crisis','topic_detente']);
  const topicButtons=topics=>topics.map(topic=>`<button data-filter="${escapeHTML(topic.topic_id)}" aria-pressed="false">${escapeHTML(topic.name)}</button>`).join('');
  $('.timeline-filters').innerHTML='<button data-filter="all" aria-pressed="true">전체</button>'+topicButtons(next.topics.filter(topic=>topic.parent_topic_id&&commonTopics.has(topic.topic_id)))+'<button id="more-topics" popovertarget="topic-picker" aria-expanded="false">다른 주제</button>';
  $('#other-topic-buttons').innerHTML=topicButtons(next.topics.filter(topic=>topic.parent_topic_id&&!commonTopics.has(topic.topic_id)));
  const min=KEY_YEARS[0],max=KEY_YEARS.at(-1);
  $('#date-span').textContent=min===max?String(min):`${min}~${max}`;
  $('#year-slider').min=min;$('#year-slider').max=max;
  const ticks=[...new Set([min,...[1945,1962,1975].filter(year=>year>min&&year<max),max])];
  $('#year-ticks').innerHTML=ticks.map(year=>`<button data-year="${year}" aria-pressed="${year===state.year}" style="left:${(year-min)/(max-min||1)*100}%">${year}</button>`).join('');
  renderMap();renderLibrary();
  if(state.tab==='timeline')renderTimeline();
  const wasPlaying=Boolean(game)&&!game.complete;
  game=null;
  if(state.tab==='game')restartGame();
  if(wasPlaying)toast('시트 데이터가 바뀌어 게임을 새로 준비했어요.');
}

async function syncSheet() {
  if(syncing)return;
  const drafts=()=>EVENTS.filter(event=>event.reviewStatus==='draft').length;
  if(!SHEET_CONFIG.feedUrl){$('#sheet-status').textContent=`공개 연결 준비 중 · 저장된 ${EVENTS.length}개 사건`;return;}
  syncing=true;$('#refresh-sheet').disabled=true;
  $('#sheet-status').textContent='시트에서 읽는 중…';
  try {
    const feedUrl=new URL(SHEET_CONFIG.feedUrl);
    feedUrl.searchParams.set('v',String(Math.floor(Date.now()/60000)));
    const response=await fetch(feedUrl,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error(`시트 응답 ${response.status}`);
    const tables=SheetData.decodeFeed(SheetData.parseCSV(await response.text()));
    validateAppTables(tables);
    if(JSON.stringify(tables)!==lastTables)applyTables(tables);
    try{localStorage.setItem(sheetCacheKey,JSON.stringify({tables}));}catch{}
    $('#sheet-status').textContent=`시트 연결됨 · ${EVENTS.length}개 사건${drafts()?` · 초안 ${drafts()}개`:''}`;
    $('#sheet-status').removeAttribute('title');
  } catch(error) {
    $('#sheet-status').textContent=`시트를 읽지 못해 저장된 ${EVENTS.length}개 사건을 보여줍니다.`;
    $('#sheet-status').title=error.message;
  } finally {syncing=false;$('#refresh-sheet').disabled=false;}
}

function initialize() {
  const tabs = {timeline:['timeline','연표'],map:['map','지도'],game:['game','줄 세우기'],library:['library','데이터']};
  for (const [tab,[symbol,label]] of Object.entries(tabs)) $(`#tab-${tab}`).innerHTML = icon(symbol)+label;
  $('#theme-button').innerHTML = icon('moon');
  $('#fullscreen-button').innerHTML = icon('expand')+'<span>수업 화면</span>';
  $('#previous-year').innerHTML = icon('left');
  $('#next-year').innerHTML = icon('right');
  $('#restart-game').innerHTML = icon('restart')+'처음부터';
  $('#search-icon').innerHTML = icon('search');
  $$('[data-sheet-link]').forEach(link=>link.href=SHEET_CONFIG.url);
  let tables=SHEET_SNAPSHOT.tables;
  try {const saved=JSON.parse(localStorage.getItem(sheetCacheKey));if(saved?.tables){validateAppTables(saved.tables);tables=saved.tables;}}catch{}
  drawMap();applyTables(tables);
  if(storageError)toast('브라우저에 저장했던 사건을 읽지 못했어요. 시트 데이터는 계속 볼 수 있어요.');
  syncSheet();
}

document.addEventListener('click',event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.tab) setTab(button.dataset.tab);
  if (button.dataset.go) setTab(button.dataset.go);
  if (button.dataset.event) {stopPlayback();selectEvent(button.dataset.event);}
  if (button.dataset.year) {stopPlayback();setYear(button.dataset.year);}
  if (button.dataset.region) {state.region=button.dataset.region;state.zoom=1;renderMap();}
  if (button.dataset.filter) {savePrediction();state.filter=button.dataset.filter;if($('#topic-picker').matches(':popover-open'))$('#topic-picker').hidePopover();renderTimeline();}
  if (button.dataset.libraryEvent) {selectEvent(button.dataset.libraryEvent);state.filter='all';setTab('timeline');}
  if (button.hasAttribute('data-gap')) answerGame(Number(button.dataset.gap));
});
$('.main-tabs').addEventListener('keydown',event => {
  const tabs=$$('[role="tab"]'); const index=tabs.indexOf(document.activeElement); if(index<0) return;
  const next = event.key==='ArrowRight' ? (index+1)%tabs.length : event.key==='ArrowLeft' ? (index+tabs.length-1)%tabs.length : event.key==='Home' ? 0 : event.key==='End' ? tabs.length-1 : null;
  if(next===null) return; event.preventDefault();setTab(tabs[next].dataset.tab,true);
});
$('#year-slider').addEventListener('input',event => {stopPlayback();setYear(event.target.value);});
$('#previous-year').addEventListener('click',()=>{stopPlayback();moveYear(-1);});
$('#next-year').addEventListener('click',()=>{stopPlayback();moveYear(1);});
$('#play-years').addEventListener('click',()=>{
  if(state.playing) return stopPlayback();
  if(state.year>=KEY_YEARS.at(-1)) setYear(KEY_YEARS[0]);
  state.playing=true;$('#play-years').innerHTML=icon('pause');$('#play-years').setAttribute('aria-label','시간 흐름 일시 정지');$('#play-years').setAttribute('aria-pressed','true');
  playTimer=setInterval(()=>{moveYear(1);if(state.year>=KEY_YEARS.at(-1))stopPlayback();},1600);
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPlayback();});
window.addEventListener('resize',()=>{if(state.tab==='map')renderMap();});
$('#zoom-in').addEventListener('click',()=>{state.zoom=Math.min(2.5,state.zoom+.5);renderMap();});
$('#zoom-out').addEventListener('click',()=>{state.zoom=Math.max(1,state.zoom-.5);renderMap();});
$('#timeline-map-button').addEventListener('click',()=>setTab('map'));
$('#theme-button').addEventListener('click',()=>{
  const dark=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=dark?'dark':'light';
  $('#theme-button').innerHTML=icon(dark?'sun':'moon');$('#theme-button').setAttribute('aria-label',dark?'밝은 화면으로 전환':'어두운 화면으로 전환');
});
$('#fullscreen-button').addEventListener('click',async()=>{
  try {if(document.fullscreenElement) await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
  catch {toast('이 브라우저에서는 전체 화면을 열 수 없어요.');}
});
document.addEventListener('fullscreenchange',()=>{$('#fullscreen-button').innerHTML=icon('expand')+`<span>${document.fullscreenElement?'전체 화면 닫기':'수업 화면'}</span>`;});
$('#library-search').addEventListener('input',renderLibrary);
$('#clear-search').addEventListener('click',()=>{$('#library-search').value='';renderLibrary();$('#library-search').focus();});
$('#refresh-sheet').addEventListener('click',syncSheet);
$('#reveal-from-current').addEventListener('click',()=>startReveal());
$('#reveal-from-first').addEventListener('click',()=>startReveal(true));
$('#reveal-next-day').addEventListener('click',()=>advanceReveal());
$('#reveal-next-record').addEventListener('click',()=>advanceReveal(true));
$('#reveal-prediction').addEventListener('change',savePrediction);
$('#topic-picker').addEventListener('toggle',event=>$('#more-topics')?.setAttribute('aria-expanded',String(event.newState==='open')));
window.addEventListener('pagehide',savePrediction);
setInterval(()=>{if(!document.hidden)syncSheet();},60000);
$('#restart-game').addEventListener('click',restartGame);
$('#next-game').addEventListener('click',()=>{
  if(!game||!game.answer||game.complete)return;
  if(game.round===game.queue.length-1){game.complete=true;}else{game.round++;game.answer=null;}
  renderGame();
  const next=$('#game-board .insertion-gap')||$('#game-result-timeline');
  next.focus({preventScroll:true});
});
$('#game-result-timeline').addEventListener('click',()=>{selectEvent(game.queue.at(-1).id);state.filter='all';setTab('timeline');});
initialize();
