'use strict';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const icons = {
  timeline:'<path d="M5 4v16M9 6h10M9 12h7M9 18h10"/><circle cx="5" cy="6" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="18" r="1"/>',
  game:'<rect x="3" y="6" width="12" height="15" rx="2"/><path d="M8 6V3h12v15h-5M7 11h4M7 15h4"/>',
  library:'<path d="M3 4h7a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H3zM13 7a3 3 0 0 1 3-3h5v15h-4a4 4 0 0 0-4 2"/>',
  right:'<path d="m10 7 5 5-5 5"/>',
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
let lastTables;
let syncing = false;
const sheetCacheKey = `yeonpyo-sheet-${SHEET_CONFIG.id}-v4`;
function validateAppTables(tables) {
  if(!Array.isArray(tables.event_relations)&&!(Array.isArray(tables.countries)&&Array.isArray(tables.tenure_periods)&&Array.isArray(tables.categories)))throw new Error('새 시트 형식이 아직 게시되지 않았습니다.');
  return SheetData.build(SheetData.scopePackage('cold-war',tables));
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
const state = {tab:'timeline',year:1962,eventId:'cuba',filter:'all'};
let toastTimer;
let game = null;
const selectedEvent = () => allEvents().find(event => event.id === state.eventId) || EVENTS[0];

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#toast').hidden = true; },3500);
}

function mediaHTML(event) {
  const media = (event.media || []).map(asset => {
    const src = TimelineImage.src(asset.url), credit = TimelineImage.credit(src);
    const caption = [escapeHTML(asset.caption || ''), credit && `${escapeHTML(credit.by)} · <a href="${escapeHTML(credit.licenseUrl)}" target="_blank" rel="noreferrer">${escapeHTML(credit.license)}</a> · 화면용 WebP 변환`].filter(Boolean).join(' · ');
    return src ? `<figure><a href="${escapeHTML(asset.url)}" target="_blank" rel="noreferrer"><img src="${escapeHTML(src)}" alt="${escapeHTML(asset.caption || asset.title)}" loading="lazy" referrerpolicy="no-referrer"></a>${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>` : `<a class="detail-source" href="${escapeHTML(asset.url)}" target="_blank" rel="noreferrer">${escapeHTML(asset.title || '이미지 원본 보기')}${icon('external')}</a>`;
  }).join('');
  return media?`<div class="event-media">${media}</div>`:'';
}

function detailHTML(event) {
  const media=mediaHTML(event);
  return `<p class="event-date">${icon('calendar')}${escapeHTML(event.date)}${event.endDate ? ` ~ ${escapeHTML(event.endDate)}` : ''}${event.reviewStatus === 'draft' ? ' · 초안' : ''}</p>
    <h2>${escapeHTML(event.title)}</h2>${event.place ? `<p class="event-place">${icon('pin')}${escapeHTML(event.place)}${event.locationPrecision && event.locationPrecision !== 'exact_site' ? ' · 대표 위치' : ''}</p>` : ''}
    ${event.description ? `<p class="event-description">${escapeHTML(event.description)}</p>` : ''}
    ${event.leaders?.length ? `<div class="event-leaders">${event.leaders.map(leader => `<span>${escapeHTML(leader)}</span>`).join('')}</div>` : ''}
    ${event.leaderTags?.length ? `<div class="source-tags"><p>원본 지도자 태그</p>${event.leaderTags.map(tag=>`<span>${escapeHTML(tag)}</span>`).join('')}</div>` : ''}
    ${media}
    ${event.question ? `<div class="inquiry"><p>${icon('question')}함께 생각하기</p><blockquote>${escapeHTML(event.question)}</blockquote></div>` : ''}
    ${event.custom || event.source ? `<div class="detail-actions">${event.custom ? '<p class="detail-source">이 브라우저에 저장한 사건</p>' : `<a class="detail-source" href="${escapeHTML(event.source)}" target="_blank" rel="noreferrer">원본 사건 보기 ${icon('external')}</a>`}</div>` : ''}`;
}

function setTab(tab, focus = false) {
  if (!['timeline','game','library'].includes(tab)) return;
  state.tab = tab;
  $$('[role="tab"]').forEach(button => {
    const active = button.dataset.tab === tab;
    button.setAttribute('aria-selected',String(active));
    button.tabIndex = active ? 0 : -1;
    $(`#panel-${button.dataset.tab}`).hidden = !active;
    if (active && focus) button.focus();
  });
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
  if (state.tab === 'timeline') renderTimeline();
}

function renderTimeline() {
  const events = allEvents().filter(event => state.filter === 'all' || event.topicIds?.includes(state.filter));
  if(events.length&&!events.some(event=>event.id===state.eventId)){state.eventId=events[0].id;state.year=events[0].year;}
  $$('[data-filter]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.filter === state.filter)));
  const mapTopics=state.filter==='all'?viewData.topics.map(t=>t.topic_id):[state.filter];
  $('#timeline-atlas').href='/history-map.html?'+new URLSearchParams(mapTopics.map(id=>['topic',id]));
  const extra=$('#other-topic-buttons [aria-pressed="true"]');
  $('#more-topics').textContent=extra?extra.textContent:'다른 주제';
  $('#more-topics').classList.toggle('has-selection',Boolean(extra));
  $('#timeline-list').innerHTML = events.map(event => `<div class="timeline-event ${event.id === state.eventId ? 'active' : ''}"><span class="timeline-year">${event.year}</span><button data-event="${escapeHTML(event.id)}" aria-pressed="${event.id === state.eventId}"><h3>${escapeHTML(event.title)}</h3><p><span>${escapeHTML(event.place)}</span><span>${escapeHTML(event.category)}</span></p></button></div>`).join('') || '<p class="timeline-empty">이 분류에 해당하는 사건이 없어요.</p>';
  $('#timeline-detail').innerHTML = events.length ? detailHTML(selectedEvent()) : '<p>이 분류에 해당하는 사건이 없어요.</p>';
  renderReadingMode();
}

function renderLibrary() {
  const query = $('#library-search').value.trim().toLocaleLowerCase();
  const events = allEvents().filter(event => `${event.title} ${event.place} ${event.year}`.toLocaleLowerCase().includes(query));
  $('#library-count').textContent = `${EVENTS.length}개의 시트 사건${customEvents.length ? ` · 이 브라우저에 저장한 사건 ${customEvents.length}개` : ''}`;
  $('#library-body').innerHTML = events.map(event => `<tr><td>${escapeHTML(event.date)}</td><td>${escapeHTML(event.title)}${event.example ? ' (예시)' : ''}</td><td>${escapeHTML(event.place)}</td><td>${escapeHTML(event.category)}</td><td><button data-library-event="${escapeHTML(event.id)}" aria-label="${escapeHTML(event.title)} 연표에서 보기">${icon('right')}</button></td></tr>`).join('');
  $('#library-empty').hidden = events.length > 0;
}

function restartGame() {
  $('#game-popup').close();
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
  $('#game-instruction').textContent=game.complete?'사건들이 어떻게 이어지는지 연표에서 살펴보세요.':locked?'정답 위치에 사건을 놓았어요. 다음 사건을 이어서 놓아보세요.':'새 사건이 들어갈 틈을 고르세요.';
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
}

function showGamePopup({title,correct,body,nextLabel}) {
  const popup=$('#game-popup');
  if(correct===undefined)delete popup.dataset.tone;
  else popup.dataset.tone=correct?'correct':'incorrect';
  $('#game-popup-mark').hidden=correct===undefined;
  $('#game-popup-mark').textContent=correct?'✓':'×';
  $('#game-popup-title').textContent=title;
  $('#game-popup-body').innerHTML=body;
  $('#game-popup-next').textContent=nextLabel;
  popup.scrollTop=0;
  popup.showModal();
  $('#game-popup-title').focus({preventScroll:true});
}

function answerGame(gap) {
  if(!game||game.answer||game.complete||!Number.isInteger(gap)||gap<0||gap>game.placed.length)return;
  const current=game.queue[game.round],actual=insertionIndex(game.placed,current);
  const correct=gap===actual;
  const submitted=gapLabel(gap,game.placed),answer=gapLabel(actual,game.placed);
  if(correct) game.score+=10;
  game.answer={correct,chosen:gap,actual};
  game.placed.splice(actual,0,current);
  renderGame();
  const next=$('#next-game');
  next.focus({preventScroll:true});
  showGamePopup({title:correct?'맞았어요':'오답이에요',correct,nextLabel:next.textContent,
    body:`<dl class="quiz-answer-review"><div class="quiz-answer-key"><dt>정답</dt><dd>${escapeHTML(answer)} · ${escapeHTML(current.date)}</dd></div>${correct?'':`<div><dt>내 답</dt><dd>${escapeHTML(submitted)}</dd></div>`}</dl>${current.description?`<p class="quiz-answer-note">${escapeHTML(current.description)}</p>`:''}`});
}

function applyTables(tables) {
  const next=validateAppTables(tables);
  savePrediction();
  viewData=next;
  EVENTS=next.events; lastTables=JSON.stringify(tables);
  const years=[...next.years,...customEvents.map(event=>event.year)];
  if(!allEvents().some(event=>event.id===state.eventId))state.eventId=EVENTS.find(event=>event.legacyId===state.eventId)?.id || EVENTS.find(event=>event.year>=state.year)?.id || EVENTS.at(-1).id;
  state.year=selectedEvent().year;
  if(state.filter!=='all'&&!next.topics.some(topic=>topic.topic_id===state.filter))state.filter='all';
  const topicButtons=topics=>topics.map(topic=>`<button data-filter="${escapeHTML(topic.topic_id)}" aria-pressed="false">${escapeHTML(topic.name)}</button>`).join('');
  $('.timeline-filters').innerHTML='<button data-filter="all" aria-pressed="true">전체</button>'+topicButtons(next.topics.slice(0,4))+'<button id="more-topics" popovertarget="topic-picker" aria-expanded="false">다른 주제</button>';
  $('#other-topic-buttons').innerHTML=topicButtons(next.topics.slice(4));
  const min=Math.min(...years),max=Math.max(...years);
  $('#date-span').textContent=min===max?String(min):`${min}~${max}`;
  renderLibrary();
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
    const tables=await SheetData.readPublishedTables(SheetData.parseCSV(await response.text()),SHEET_CONFIG);
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
  const tabs = {timeline:['timeline','연표'],game:['game','줄 세우기'],library:['library','데이터']};
  for (const [tab,[symbol,label]] of Object.entries(tabs)) $(`#tab-${tab}`).innerHTML = icon(symbol)+label;
  $('#theme-button').innerHTML = icon('moon');
  $('#fullscreen-button').innerHTML = icon('expand')+'<span>수업 화면</span>';
  $('#restart-game').innerHTML = icon('restart')+'처음부터';
  $('#search-icon').innerHTML = icon('search');
  $$('[data-sheet-link]').forEach(link=>link.href=SHEET_CONFIG.url);
  let tables=SHEET_SNAPSHOT.tables;
  try {const saved=JSON.parse(localStorage.getItem(sheetCacheKey));if(saved?.tables){validateAppTables(saved.tables);tables=saved.tables;}}catch{}
  applyTables(tables);
  if(storageError)toast('브라우저에 저장했던 사건을 읽지 못했어요. 시트 데이터는 계속 볼 수 있어요.');
  if(['localhost','127.0.0.1','[::1]'].includes(location.hostname)){
    $('#sheet-status').textContent=`저장된 시트 · ${EVENTS.length}개 사건`;
    return;
  }
  syncSheet();
  setInterval(()=>{if(!document.hidden)syncSheet();},60000);
}

document.addEventListener('click',event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.tab) setTab(button.dataset.tab);
  if (button.dataset.go) setTab(button.dataset.go);
  if (button.dataset.event) selectEvent(button.dataset.event);
  if (button.dataset.filter) {savePrediction();state.filter=button.dataset.filter;if($('#topic-picker').matches(':popover-open'))$('#topic-picker').hidePopover();renderTimeline();}
  if (button.dataset.libraryEvent) {selectEvent(button.dataset.libraryEvent);state.filter='all';setTab('timeline');}
  if (button.hasAttribute('data-gap')) answerGame(Number(button.dataset.gap));
});
$('.main-tabs').addEventListener('keydown',event => {
  const tabs=$$('[role="tab"]'); const index=tabs.indexOf(document.activeElement); if(index<0) return;
  const next = event.key==='ArrowRight' ? (index+1)%tabs.length : event.key==='ArrowLeft' ? (index+tabs.length-1)%tabs.length : event.key==='Home' ? 0 : event.key==='End' ? tabs.length-1 : null;
  if(next===null) return; event.preventDefault();setTab(tabs[next].dataset.tab,true);
});
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
$('#restart-game').addEventListener('click',restartGame);
$('#next-game').addEventListener('click',()=>{
  if(!game||!game.answer||game.complete)return;
  $('#game-popup').close();
  if(game.round===game.queue.length-1)game.complete=true;
  else{game.round++;game.answer=null;}
  renderGame();
  const next=$('#game-board .insertion-gap')||$('#game-result-timeline');
  next.focus({preventScroll:true});
  if(game.complete)showGamePopup({title:'줄 세우기 결과',nextLabel:'연표에서 이어 보기',
    body:`<p class="quiz-score"><strong>${game.score/10}</strong> / ${game.queue.length}문제 정답</p>`});
});
$('#game-popup-close').addEventListener('click',()=>$('#game-popup').close());
$('#game-popup-next').addEventListener('click',()=>{
  if(game?.complete){$('#game-popup').close();$('#game-result-timeline').click();}
  else $('#next-game').click();
});
$('#game-result-timeline').addEventListener('click',()=>{selectEvent(game.queue.at(-1).id);state.filter='all';setTab('timeline');});

async function startClassroom(){
  const query=new URLSearchParams(location.search);
  const typingPackage=query.get('typing');
  const sharedPackage=typingPackage||query.get('quiz');
  const example=!sharedPackage&&!query.has('workspace')&&query.get('sample')==='japan';
  if(!query.has('workspace')&&!sharedPackage&&!example){initialize();return;}
  $('#panel-timeline').hidden=true;$('.main-tabs').hidden=true;
  $('.data-actions').hidden=true;
  $('.site-header').hidden=true;
  $('#lesson-nav').hidden=false;
  $('.lesson-nav-links').hidden=Boolean(sharedPackage);
  document.body.classList.add('lesson-classroom');
  const heading=sharedPackage||example?'학습 콘텐츠':'퀴즈 출제실';
  $('.page-heading h1').textContent=heading;
  const context=$('.page-heading .breadcrumb');
  function showContext(school,subject){
    const parts=[school,subject].filter(Boolean);
    context.textContent=parts.join(' · ');
    context.hidden=!parts.length;
    document.title=[...parts,heading,'Dorms’ Chronicle'].join(' · ');
  }
  showContext();
  const status=$('#sheet-status');
  status.textContent='수업 자료를 불러오는 중입니다.';
  status.dataset.pending='true';
  function lessonError(message,retry=false){
    delete status.dataset.pending;
    status.textContent=message;
    if(retry){
      const button=document.createElement('button');
      button.className='text-button';
      button.textContent='다시 불러오기';
      button.onclick=()=>location.reload();
      status.append(' ',button);
    }
  }
  let workspace, mountRecordQuiz, sharedPlan, sharedRoute;
  try{
    const entry=await import('/metro/assets/classroom-workspace.js?v=quiz-feedback-1');
    if(example){
      showContext('', '일제강점기와 독립운동');
      const timeline=$('#lesson-timeline-link');
      timeline.href='/metro/?sample=japan';
      timeline.hidden=false;
      const records=await entry.exampleJapanRecords(SheetData);
      entry.mountExampleActivities($('#lesson-activity'),records);
      status.hidden=true;
      return;
    }
    const {classroomWorkspace}=entry;
    mountRecordQuiz=entry.mountRecordQuiz;
    if(sharedPackage){
      try{
        const payload=decodeURIComponent(location.hash.slice(1));
        if(typingPackage){
          const route=JSON.parse(payload);
          if(!route||typeof route.category!=='string'||!route.category||typeof route.practice!=='boolean'||!Array.isArray(route.ids)||
            !route.ids.length||!route.ids.every(id=>typeof id==='string'&&id.length)||new Set(route.ids).size!==route.ids.length)throw Error();
          sharedRoute=route;
        }else sharedPlan=entry.parsePlan(payload);
      }
      catch{lessonError('학생용 퀴즈 링크가 불완전합니다. 선생님이 보낸 링크 전체를 열어 주세요.');return;}
    }
    workspace=classroomWorkspace(query.get('workspace'),sharedPackage,sharedRoute?.ids??(sharedPlan?entry.quizEventIds(sharedPlan):undefined));
  }catch{
    lessonError('학습 콘텐츠를 열지 못했습니다.',true);return;
  }
  if(!workspace){lessonError('이 브라우저에 저장된 수업을 찾을 수 없습니다. 수업 목록에서 열어 주세요.');return;}
  if(!sharedPackage){
    const timeline=$('#lesson-timeline-link');
    timeline.href=workspace.timelineHref;
    timeline.hidden=false;
  }
  showContext(workspace.school);
  workspace.packageName(SHEET_CONFIG,SheetData.parseCSV).then(name=>{
    if(name)showContext(workspace.school,name);
  }).catch(()=>{});
  try{
    const records=await workspace.records(SHEET_CONFIG,SheetData,SHEET_SNAPSHOT.tables);
    mountRecordQuiz($('#lesson-activity'),records,query.get('workspace'),workspace.packageId,sharedPlan,sharedRoute);
    $('#sheet-status').hidden=true;
  }catch{
    lessonError('수업 자료를 불러오지 못했습니다.',true);
  }
}
startClassroom();
window.addEventListener('hashchange',()=>{
  const query=new URLSearchParams(location.search);
  if(query.has('quiz')||query.has('typing'))location.reload();
});
