import {postComment,readThreads} from './studio-comment-store.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(value,min,max)=>Math.max(min,Math.min(value,max));
const dateFormat=new Intl.DateTimeFormat('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
function author(post){return post.author?.displayName||(post.author?.me?'나':'Google 사용자');}
function postTime(post){
 const date=new Date(post.createTime);
 return Number.isFinite(+date)?'<time datetime="'+date.toISOString()+'">'+esc(dateFormat.format(date))+'</time>':'';
}
function postHtml(post){
 const name=esc(author(post));
 if(!post.content&&['RESOLVE','REOPEN'].includes(post.commentAction)){
  const action=post.commentAction==='RESOLVE'?'댓글을 해결했습니다.':'댓글을 다시 열었습니다.';
  return '<article class="sc-history"><span>'+name+' 님이 '+action+'</span>'+postTime(post)+'</article>';
 }
 return '<article class="sc-post"><span class="sc-avatar" aria-hidden="true">'+esc(Array.from(author(post))[0])+'</span><div><header><strong>'+name+'</strong>'+postTime(post)+'</header><p>'+esc(post.content)+'</p></div></article>';
}
function threadSummary(t){
 const replies=t.replies.filter(p=>p.content).length;
 return '<button type="button" class="sc-summary" data-thread="'+esc(t.id)+'"><strong>'+esc(t.anchor.label)+'</strong><span class="sc-excerpt">'+esc(t.post.content)+'</span><span class="sc-meta"><span>'+esc(author(t.post))+'</span>'+postTime(t.post)+(replies?'<span>답글 '+replies+'</span>':'')+'</span></button>';
}

export function mountStudioComments(studio,host){
 const layer=document.createElement('div');layer.id='studio-comment-layer';
 layer.innerHTML=`<div class="sc-pins"></div><span class="sc-draft-pin" aria-hidden="true" hidden>＋</span>
  <dialog class="sc-panel" aria-labelledby="sc-heading">
   <header class="sc-heading">
    <button type="button" class="sc-icon" data-sc="list" aria-label="댓글 목록으로" title="댓글 목록으로">←</button>
    <h2 id="sc-heading"></h2>
    <button type="button" data-sc="refresh">새로고침</button>
    <button type="button" data-sc="resolve">해결</button><button type="button" data-sc="reopen">다시 열기</button>
    <button type="button" class="sc-icon" data-sc="close" aria-label="댓글 창 닫기" title="닫기">×</button>
   </header>
   <p class="sc-location"></p>
   <div class="sc-filters" role="group" aria-label="댓글 상태">
    <button type="button" data-sc="filter-0">진행 중 <span></span></button>
    <button type="button" data-sc="filter-1">해결됨 <span></span></button>
   </div>
   <div class="sc-body"></div>
   <p class="sc-status" role="status"></p>
   <form hidden><label for="sc-text">댓글 내용</label><textarea id="sc-text" rows="3" required></textarea><button type="submit">댓글 등록</button></form>
  </dialog>`;
 document.body.append(layer);
 const q=selector=>layer.querySelector(selector);
 const panel=q('dialog'),pins=q('.sc-pins'),body=q('.sc-body'),input=q('textarea'),form=q('form'),feedback=q('.sc-status');
 const submit=form.querySelector('[type=submit]');
 let book=null,threads=[],picking=false,mode='',activeId='',anchor=null,finished=false,sending=false,loading=false;
 let generation=0,readId=0,frame=0,loadError='',ready=false,dirty=false,returnTo=null;
 const drafts=new Map();
 const current=()=>threads.find(t=>t.id===activeId);
 const elementFor=key=>studio.querySelector('[data-note-key="'+CSS.escape(key)+'"]');
 const control=()=>studio.querySelector('[data-note-act=list]');
 function updateTools(){
  const tools=studio.querySelector('.gs-note-tools');if(!tools)return;
  tools.hidden=false;
  tools.querySelector('[data-note-act=list]').hidden=!book;
  const pick=tools.querySelector('[data-note-act=pick]');
  pick.setAttribute('aria-pressed',String(picking));
  pick.textContent=picking?'댓글 위치 선택 중 · 취소':'＋ 댓글 달기';
  tools.querySelector('[data-note-count]').textContent=ready?String(threads.filter(t=>!t.resolved).length):'';
  studio.classList.toggle('sc-picking',picking);
 }
 function draftKey(){return JSON.stringify([book,mode==='new'?anchor?.key:activeId]);}
 function stash(){if(!form.hidden&&dirty){drafts.set(draftKey(),input.value);dirty=false;}}
 function close(focus=true){
  stash();mode='';picking=false;if(panel.open)panel.close();anchor=null;activeId='';updateTools();
  if(focus)(returnTo?.isConnected?returnTo:control())?.focus({preventScroll:true});
  schedule();
 }
 function start(next,id='',at=null){
  if(sending)return;
  stash();picking=false;mode=next;activeId=id;anchor=at;feedback.textContent=mode==='list'?loadError:'';
  input.value=drafts.get(draftKey())||'';dirty=false;
  render();updateTools();position();
  if(!panel.open)panel.showModal();
  body.scrollTop=0;
  (mode==='new'?input:mode==='list'?q('[aria-pressed=true]'):q('[data-sc=list]')).focus({preventScroll:true});
 }
 function render(){
  const t=current(),list=mode==='list',isNew=mode==='new';
  panel.dataset.mode=mode;
  q('h2').textContent=list?'댓글 목록':isNew?'새 댓글':'댓글';
  q('.sc-location').textContent=list?'':(anchor||t?.anchor)?.label||'';
  q('[data-sc=list]').hidden=list;
  q('[data-sc=refresh]').hidden=!list;
  q('[data-sc=resolve]').hidden=!t||t.resolved;
  q('[data-sc=reopen]').hidden=!t||!t.resolved;
  q('.sc-filters').hidden=!list;
  if(list){
   const shown=threads.filter(item=>item.resolved===finished);
   for(const [i,filter] of q('.sc-filters').querySelectorAll('button').entries()){
    filter.setAttribute('aria-pressed',String(finished===!!i));
    filter.querySelector('span').textContent=ready?String(threads.filter(item=>item.resolved===!!i).length):'';
   }
   const focused=document.activeElement?.dataset.thread;
   body.innerHTML=shown.length?shown.map(threadSummary).join(''):loadError?'':'<p class="sc-empty">'+(!ready?'댓글을 불러오는 중입니다.':finished?'해결된 댓글이 없습니다.':'아직 댓글이 없습니다.')+'</p>';
   if(focused)body.querySelector('[data-thread="'+CSS.escape(focused)+'"]')?.focus({preventScroll:true});
  }else body.innerHTML=t?[t.post,...t.replies].map(postHtml).join(''):'';
  form.hidden=list||(!isNew&&(!t||t.resolved));
  q('label').textContent=isNew?'댓글 내용':'답글';
  input.rows=isNew?4:2;
  input.placeholder=isNew?'이 위치에 남길 의견을 적으세요.':'답글을 입력하세요.';
  submit.textContent=isNew?'댓글 등록':'답글 등록';
  for(const el of panel.querySelectorAll('button,textarea'))el.disabled=sending;
  submit.disabled=sending||!input.value.trim();
  schedule();
 }
 function paintPins(){
  pins.innerHTML=threads.filter(t=>!t.resolved).map((t,i)=>'<button type="button" class="sc-pin" hidden data-thread="'+esc(t.id)+'" aria-label="'+esc(t.anchor.label+' 댓글 '+(i+1))+'">'+(i+1)+'</button>').join('');
  updateTools();if(mode)render();schedule();
 }
 async function refresh(interactive=false){
  if(!book||(!interactive&&(!host.token()||loading||sending)))return;
  const serial=++readId,scope=generation;loading=true;
  try{
   const token=interactive?await host.authenticate():host.token();
   if(scope!==generation||serial!==readId)return;
   const next=await readThreads(token,host.config,book);
   if(scope!==generation||serial!==readId)return;
   const change=!ready||!!loadError||JSON.stringify(next)!==JSON.stringify(threads);
   threads=next;ready=true;loadError='';
   if(change){if(feedback.textContent&&mode==='list')feedback.textContent='';paintPins();}
  }catch(error){
   if(scope!==generation||serial!==readId)return;
   loadError=error.message;if(mode==='list')render();
   if(mode)feedback.textContent=loadError;
  }finally{if(scope===generation&&serial===readId)loading=false;}
 }
 function pinPoint(at){
  const el=at&&elementFor(at.key);if(!el||!el.getClientRects().length)return null;
  const rect=el.getBoundingClientRect();
  const x=rect.left+rect.width*at.x,y=rect.top+rect.height*at.y;
  for(let parent=el.parentElement;parent&&parent!==studio;parent=parent.parentElement){
   if(parent.scrollWidth<=parent.clientWidth&&parent.scrollHeight<=parent.clientHeight)continue;
   const css=getComputedStyle(parent),box=parent.getBoundingClientRect();
   if((/(auto|scroll|hidden|clip)/.test(css.overflowX)&&(x<box.left||x>box.right))||
      (/(auto|scroll|hidden|clip)/.test(css.overflowY)&&(y<box.top||y>box.bottom)))return null;
  }
  return {x,y};
 }
 function position(){
  const draftPin=q('.sc-draft-pin'),point=mode==='new'&&pinPoint(anchor);
  draftPin.hidden=!point;
  if(point){draftPin.style.left=point.x+scrollX+'px';draftPin.style.top=point.y+scrollY+'px';}
  if(!book)return;
  const offsets=new Map();
  for(const pin of pins.children){
   const t=threads.find(item=>item.id===pin.dataset.thread),point=pinPoint(t?.anchor);
   pin.hidden=!point;if(!point)continue;
   const group=Math.round(point.x/22)+':'+Math.round(point.y/22),offset=offsets.get(group)||0;
   offsets.set(group,offset+1);pin.style.left=clamp(point.x+scrollX+offset*17,0,document.documentElement.clientWidth-25)+'px';pin.style.top=Math.max(0,point.y+scrollY-10)+'px';
  }
  if(!mode)return;
  // The editor iframe is as tall as its content. Center the dialog in the visible portion.
  const embedding=window.frameElement?.getBoundingClientRect(),hostWindow=embedding?parent:window;
  const viewport=hostWindow.visualViewport,offset=(viewport?.offsetTop||0)-(embedding?.top||0);
  const top=Math.max(0,offset),bottom=Math.min(innerHeight,offset+(viewport?.height||hostWindow.innerHeight));
  if(bottom<=top)return;
  panel.style.top=(top+bottom)/2+'px';
  panel.style.setProperty('--sc-room',Math.max(1,bottom-top-16)+'px');
 }
 function schedule(){if(!frame&&(book||!q('.sc-draft-pin').hidden))frame=requestAnimationFrame(()=>{frame=0;position();});}
 function openThread(id){
  const t=threads.find(item=>item.id===id);if(!t||sending)return;
  host.reveal(t.anchor.key);
  const el=elementFor(t.anchor.key);
  el?.scrollIntoView({block:'nearest',inline:'nearest'});
  start('thread',id);
  if(!el)feedback.textContent='현재 화면에 원래 위치가 없습니다.';
 }
 function pickElement(target,event){
  if(!book||sending)return;
  const wire=target.closest('[data-wire-id]'),el=(wire&&elementFor('relation|'+encodeURIComponent(wire.dataset.wireId)))||target.closest('[data-note-key]');
  if(!el)return;
  const rect=el.getBoundingClientRect(),fraction=(value,base,size)=>Math.round(clamp((value-base)/(size||1),0,1)*1000)/1000;
  const point=event?.detail>0&&!wire;
  let label=el.dataset.noteLabel||'패키지';
  if(!event&&target.matches('textarea,input[type=text],input:not([type])')){
   const quote=target.value.slice(target.selectionStart??0,target.selectionEnd??0).trim().slice(0,45);
   if(quote)label=label.slice(0,40)+' · “'+quote+'”';
  }
  const at={key:el.dataset.noteKey,label:label.slice(0,90),x:point?fraction(event.clientX,rect.left,rect.width):.5,y:point?fraction(event.clientY,rect.top,rect.height):.5};
  returnTo=target.closest('button,input,textarea,select')||control();start('new','',at);
 }
 studio.addEventListener('click',event=>{
  const button=event.target.closest('[data-note-act]');
  if(button&&!book){
   event.preventDefault();event.stopImmediatePropagation();host.showRegistration();return;
  }
  if(!book||sending||(!button&&!picking))return;
  event.preventDefault();event.stopImmediatePropagation();
  if(!button){pickElement(event.target,event);return;}
  returnTo=button;
  if(button.dataset.noteAct==='list'){start('list');void refresh();return;}
  const next=!picking;close(false);picking=next;updateTools();
 },true);
 for(const name of ['pointerdown','pointerup','mousedown'])studio.addEventListener(name,event=>{
  if(picking&&!event.target.closest('[data-note-act]')){event.preventDefault();event.stopImmediatePropagation();}
 },true);
 document.addEventListener('keydown',event=>{
  if(!book||event.isComposing||sending)return;
  if(event.key==='Escape'&&(picking||mode)){event.preventDefault();close();return;}
  if(studio.contains(event.target)&&!event.target.closest('dialog,[data-note-act]')&&
   ((event.altKey&&(event.ctrlKey||event.metaKey)&&event.code==='KeyM')||(picking&&event.key==='Enter'))){
   event.preventDefault();event.stopImmediatePropagation();pickElement(event.target);
  }
 },true);
 async function save(action){
  if(sending||!book)return;
  const scope=generation,first=mode==='new',key=draftKey(),id=book,thread=activeId,at=anchor,text=input.value;
  sending=true;render();feedback.textContent='저장 중…';
  ++readId;loading=false;
  let saved;
  try{
   const token=await host.authenticate();
   if(scope!==generation)return;
   saved=await postComment(token,host.config,id,{anchor:first?at:null,thread,text,action});
  }catch(error){if(scope===generation)feedback.textContent=error.message;}
  finally{if(scope===generation){sending=false;render();}}
  if(scope!==generation||!saved)return;
  if(action)stash();
  else{drafts.delete(key);input.value='';dirty=false;}
  mode='thread';activeId=saved;anchor=first?at:null;feedback.textContent='';
  await refresh();
  if(scope===generation){
   render();body.scrollTop=body.scrollHeight;
   if(current())(action?q(current().resolved?'[data-sc=reopen]':'[data-sc=resolve]'):input).focus({preventScroll:true});
   else if(!loadError){start('list');feedback.textContent='저장했습니다. 목록을 새로고침해 확인하세요.';}
  }
 }
 layer.addEventListener('click',event=>{
  const target=event.target.closest('button');if(!target||sending)return;
  if(target.dataset.thread){returnTo=target.classList.contains('sc-pin')?target:control();openThread(target.dataset.thread);return;}
  switch(target.dataset.sc){
   case 'close':close();break;
   case 'list':start('list');void refresh();break;
   case 'filter-0':case 'filter-1':finished=target.dataset.sc==='filter-1';render();body.scrollTop=0;break;
   case 'refresh':void refresh(true);break;
   case 'resolve':case 'reopen':void save(target.dataset.sc==='resolve'?'RESOLVE':'REOPEN');break;
  }
 });
 panel.addEventListener('cancel',event=>{event.preventDefault();if(!sending)close();});
 input.addEventListener('input',()=>{dirty=true;submit.disabled=sending||!input.value.trim();});
 form.addEventListener('submit',event=>{event.preventDefault();if(input.value.trim())void save();});
 input.addEventListener('keydown',event=>{if(!event.isComposing&&event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();form.requestSubmit();}});
 const observer=new MutationObserver(schedule);observer.observe(studio,{childList:true,subtree:true});
 new ResizeObserver(schedule).observe(studio);
 document.addEventListener('scroll',schedule,true);window.addEventListener('resize',schedule);
 if(window.frameElement)parent.addEventListener('scroll',schedule,{passive:true});
 const viewport=(window.frameElement?parent:window).visualViewport;
 viewport?.addEventListener('resize',schedule);viewport?.addEventListener('scroll',schedule);
 setInterval(()=>{if(book&&!document.hidden&&!window.frameElement?.hidden&&!loadError)void refresh();},15000);
 return {bind(id){
  if(id===book){updateTools();schedule();return;}
  close(false);++generation;++readId;book=id;threads=[];ready=false;loading=false;sending=false;finished=false;loadError='';
  pins.replaceChildren();updateTools();if(book)void refresh();
 }};
}
