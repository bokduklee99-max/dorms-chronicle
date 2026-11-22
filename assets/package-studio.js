import {mountStudioComments} from './studio-comments.js';
import {mountStudioGrid} from './studio-grid.js';
import {fetchStudioCatalog,studioCatalog} from './studio-catalog.js';
import {loadGoogleIdentity,authorizeRelationSheet,restoreDraftToken,rememberDraftAccount,rememberedAccount,forgetDraftAccount} from './google-sheet-auth.js';
import {sharedContent,same,mergeChanges,readLegacyDraft,googleSheet} from './studio-cloud.js';
import {studioDraftDirectory} from './studio-library.js';
import {publishDraft,readDraft,createDraft,writeDraft} from './studio-publish.js';
import {googleClientId} from '../metro/assets/studio-client.js';

const studio=document.querySelector('#studio');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => crypto.randomUUID();
const button = (text, act, attr='') => `<button type="button" data-act="${act}" ${attr}>${text}</button>`;
let libraryItems=new Map(),libraryState='loading',listRequest=0,grid=null,publicCatalog=null;
const publishedIds=new Set();
const directory={group:'shared',lastId:''};
function fresh(){return {id:uid(),name:'',school:'',subject:'',description:'',events:[],categories:[],relations:[],actors:[]};}
let draft=fresh();
const requestedBook=new URL(location.href).searchParams.get('draft');
let pendingBook=requestedBook,token='',syncing=null,saveTimer,sharedMessage='',busy=false,conflict=false,composing=false;
const catalog={actor:{},event:{},place:{}},opened=new Map();
function studioAuth(choose=false){
 const subject=rememberedAccount(googleClientId,pendingBook||draft.cloud?.book);
 return authorizeRelationSheet(googleClientId,{studio:true,subject,choose});
}
const notes=mountStudioComments(studio,{
 config:SHEET_CONFIG,token:()=>token,
 authenticate:async()=>token=await studioAuth(),
 reveal:key=>grid?.revealNote(key),
 showRegistration(){
  cloudStatus('댓글을 함께 보려면 이 패키지를 공동 초안으로 등록해 주세요.');
  studio.querySelector('.studio-sharing [data-act=cloud-connect]')?.focus();
 }
});
function content(){return sharedContent(draft,draft.actors||[]);}
function packageList(){
 const entries=new Map(libraryItems);
 for(const p of [...opened.values(),draft])if(p.name&&!p.cloud)entries.set(p.id,{id:p.id,name:p.name,school:p.school,course:p.subject,local:true});
 return [...entries.values()].filter(p=>!publishedIds.has(p.id));
}
function installCatalog(source){
 publicCatalog=source;Object.assign(catalog,source.catalog);
 for(const p of source.editions)publishedIds.add(p.id);
 updateDirectoryView();
 grid?.refreshSearch();
}
function updateDirectoryView(){
 if(pendingBook&&publishedIds.has(pendingBook)&&!busy){leavePublished(pendingBook);return;}
 if(pendingBook&&!busy)draw();else grid?.refreshLibrary();
}
function leavePublished(id,message='게시가 끝난 패키지입니다.'){
 publishedIds.add(id);libraryItems.delete(id);opened.delete(id);pendingBook=null;
 if(draft.id===id&&draft.cloud&&!same(content(),draft.cloud.base)){
  draft.closed=true;clearTimeout(saveTimer);draw();return;
 }
 begin(draft.id===id?fresh():draft);say(message);
}
async function switchGrid(id,create){
 if(busy)return;
 const current=draft;
 if(syncing){await syncing;if(current!==draft||draft.closed||busy)return;}
 if(draft.cloud&&!same(content(),draft.cloud.base)&&!await runSync()){if(!draft.closed)say('현재 초안을 저장한 뒤 다시 선택해 주세요.');return;}
 if(current!==draft||draft.closed)return;
 if(draft.name&&!draft.cloud)opened.set(draft.id,draft);
 if(create){begin({...fresh(),name:create.name,subject:create.course,school:create.school,description:create.description});return;}
 if(!id){begin(fresh());void refreshLibrary();return;}
 if(publishedIds.has(id)){leavePublished(id);return;}
 if(opened.has(id)){begin(opened.get(id));return;}
 directory.group='shared';pendingBook=id;draw();
 await connectCloud({restore:true});
}
function connectUrl(book){
 const url=new URL('./data-explorer.html',location.href);
 url.hash='package-studio'+(book?'?'+new URLSearchParams({draft:book}):'');
 return url;
}
function cloudBar(){
 const c=draft.cloud;
 const status=sharedMessage||(c?'Google 시트에 연결됨':'이 탭에서만 작성 중');
 return `<div class="studio-sharing"><p role="status" id="cloud-status">${esc(status)}</p><div>${c?
  `<a href="https://docs.google.com/spreadsheets/d/${encodeURIComponent(SHEET_CONFIG.id)}/edit#gid=${SHEET_CONFIG.packageSheetId}" target="_blank" rel="noreferrer">원본 시트 ↗</a>${button('공동 작업 링크 복사','cloud-link')}${button(token?'동기화':'Google 다시 연결','cloud-connect')}${button('이 초안 연결 해제','cloud-disconnect')}`:
  button('공동 초안으로 등록','cloud-connect')}${conflict?button('충돌한 항목에 내 수정 적용','cloud-keep')+button('충돌한 항목에 시트 수정 적용','cloud-remote'):''}</div></div>`;
}
function refreshCloudBar(){
 const bar=studio.querySelector('.studio-sharing');
 if(bar)bar.outerHTML=cloudBar();
}
function cloudStatus(message){sharedMessage=message;const el=studio.querySelector('#cloud-status');if(el)el.textContent=message;}
function scheduleSync(){
 if(!draft.cloud||conflict||busy)return;
 if(!same(draft.cloud.base,content())){
  cloudStatus(token?'작성 중 · 저장 대기':'현재 화면에 수정됨 · Google 연결 필요');
  clearTimeout(saveTimer);
  if(token)saveTimer=setTimeout(()=>runSync(),900);
 }
}
function redrawShared(){
 const field=document.activeElement,row=field?.closest('[data-row]')?.dataset.row,key=field?.dataset.field;
 const start=field?.selectionStart,end=field?.selectionEnd,preview=grid?.previewState();
 draw(grid?.sheetView());
 if(preview){grid.preview(preview.layout,preview.category);return;}
 if(row&&key){
  const input=grid.focusCell(row,key);
  if(typeof start==='number'&&input?.setSelectionRange)input.setSelectionRange(start,end);
 }
}
async function syncCurrent(choice){
 const item=draft,c=item.cloud,remote=await readDraft(token,SHEET_CONFIG,c.book);
 if(item!==draft||composing)return;
 if(remote.published){leavePublished(remote.book,'다른 작성자가 패키지를 게시했습니다.');return;}
 if(remote.content.id!==item.id)throw Error('공동 초안의 패키지 ID가 다릅니다.');
 const local=content();
 const merged=mergeChanges(c.base,local,remote.content,'패키지',choice);
 const result=same(merged,remote.content)?remote:await writeDraft(token,SHEET_CONFIG,remote,merged);
 if(item!==draft)return;
 const current=content();
 const pending=mergeChanges(local,current,result.content);
 const changed=!same(current,pending);
 Object.assign(item,pending);
 c.version=result.version;c.base=result.content;
 conflict=false;
 cloudStatus(same(pending,c.base)?'작성 중 · 시트에 저장됨':'작성 중 · 저장 대기');
 if(changed)redrawShared();
 refreshCloudBar();
 if(!same(pending,c.base))scheduleSync();
 return result;
}
async function runSync(choice){
 if(syncing)return syncing;
 if(!token||!draft.cloud||draft.closed||pendingBook||draft.cloud.book!==draft.id||composing||grid?.isEditingDialogOpen()||(conflict&&!choice))return;
 syncing=(async()=>{
  for(let attempt=0;attempt<2;attempt++){
   try{return await syncCurrent(choice);}
   catch(e){
    if(e.status===400&&attempt===0)continue;
    if(e.status===401)token='';
    conflict=!!e.conflict;
    cloudStatus(e.message||'시트 연결을 확인해 주세요.');refreshCloudBar();
    return;
   }
  }
 })().finally(()=>{syncing=null;});
 return syncing;
}
async function connectCloud({restore=false,choose=false}={}){
 if(busy)return;busy=true;studio.inert=true;
 try{
  const source=pendingBook||draft.cloud?.book;
  const nextToken=restore?await restoreDraftToken(googleClientId,source):await studioAuth(choose);
  if(!nextToken)return;
  token=nextToken;
  let remote;
  if(source){
   try{remote=await readDraft(token,SHEET_CONFIG,source);}
   catch(e){
    if(!/^[\w-]{15,150}$/.test(source)||!e.message.includes('공동 초안을 찾지'))throw e;
    const legacy=await readLegacyDraft(token,source);
    remote=await createDraft(token,SHEET_CONFIG,sharedContent(legacy.content,legacy.content.actors));
   }
  }else remote=await createDraft(token,SHEET_CONFIG,content());
  if(remote.published){leavePublished(remote.book);return;}
  if(remote.tables?.주체_공간)installCatalog(studioCatalog(remote.tables));
  const item=draft.cloud?.book===remote.book?draft:{...(draft.id===remote.book?draft:fresh()),...remote.content,
   cloud:{book:remote.book,base:remote.content,version:remote.version}};
  rememberDraftAccount(googleClientId,item.id,token);
  if(source&&source!==item.id)rememberDraftAccount(googleClientId,source,token);
  pendingBook=null;opened.delete(item.id);libraryItems.set(item.id,{id:item.id,name:item.name,school:item.school,course:item.subject});begin(item);
  await runSync();
 }catch(e){
  if(e.status===401)token='';
  if(e.published){leavePublished(pendingBook||draft.id);return;}
  cloudStatus(e.message);say(e.message);
 }
 finally{busy=false;studio.inert=false;if(pendingBook)draw();else refreshCloudBar();}
}
function say(message){document.querySelector('#notice').textContent=message;}
function begin(item){
 const switching=item.id!==draft.id||Boolean(pendingBook);
 clearTimeout(saveTimer);conflict=false;sharedMessage='';draft=item;
 if(item.name){directory.group=item.cloud?'shared':'local';directory.lastId=item.id;}
 if(window.frameElement){
  const link=connectUrl(item.cloud?.book);
  window.frameElement.dataset.draft=item.cloud?.book||'';
  parent.document.getElementById('studio-link').href=link.hash;
  if(parent.location.hash.startsWith('#package-studio'))parent.history.replaceState(null,'',link);
 }
 for(const event of draft.events){event.date=eventDate(event.date);event.end=eventDate(event.end);}
 say('');draw();
 if(switching){
  const destination=item.name?studio.querySelector('#gs-name'):studio.querySelector('#gs-start [role=region]:not([hidden]) [data-recent]')||studio.querySelector('#gs-start h1');
  destination?.focus({preventScroll:true});
  if(window.frameElement&&!window.frameElement.hidden&&parent.location.hash.startsWith('#package-studio')){
   parent.scrollTo({top:0,behavior:'instant'});
   if(!item.name&&destination?.matches('.gs-library-item'))destination.scrollIntoView({block:'nearest',behavior:'instant'});
  }
 }
}
function eventDate(value=''){
 const raw=String(value??'').trim();
 const compact=/^(\d{4})(\d{2})(\d{2})?$/.exec(raw);
 return compact?compact.slice(1).filter(Boolean).join('-'):raw;
}
async function refreshLibrary(authenticate=false){
 const request=++listRequest;
 libraryState='loading';grid?.refreshLibrary();
 try{
  if(authenticate)token=await studioAuth();
  let rows;
  if(token){
   const result=await googleSheet(token,'/'+SHEET_CONFIG.id+'/values/'+encodeURIComponent('패키지'));
   rows=result.values||[];
  }else{
   const url=new URL('https://docs.google.com/spreadsheets/d/'+SHEET_CONFIG.id+'/export');
   url.search=new URLSearchParams({format:'csv',gid:String(SHEET_CONFIG.packageSheetId)});
   const response=await fetch(url,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('공동 초안 목록을 불러오지 못했습니다.');
   rows=SheetData.parseCSV(await response.text(),true);
  }
  if(request!==listRequest)return;
  const directory=studioDraftDirectory(rows);
  libraryItems=directory.drafts;for(const id of directory.published)publishedIds.add(id);
  libraryState='ready';updateDirectoryView();
 }catch(e){
  if(request!==listRequest)return;
  if(e.status===401)token='';
  libraryState='error';grid?.refreshLibrary();if(authenticate)say(e.message);
 }
}
function draw(sheetView){
 grid?.dispose();grid=null;
 if(pendingBook||draft.closed||!draft.cloud)notes.bind(null);
 if(draft.closed){
  studio.innerHTML='<section class="shared-entry"><h1>공동 초안 게시 완료</h1><p>다른 작성자가 게시했습니다. 이 탭에 남은 수정 내용을 파일로 보관하세요.</p><div>'+button('수정 사본 내려받고 목록으로','download-changes')+'</div></section>';return;
 }
 if(pendingBook){
  const entry=libraryItems.get(pendingBook);
  const remembered=rememberedAccount(googleClientId,pendingBook);
  const actions=button(remembered?'이전 계정으로 열기':'Google로 공동 초안 열기','cloud-connect')+
   (remembered||sharedMessage?button('다른 계정으로 열기','cloud-choose'):'');
  studio.innerHTML='<section class="shared-entry"><nav aria-label="현재 패키지 위치">'+button('← 공동 초안 목록','cancel-pending')+'</nav><h1>'+esc(entry?.name||'공동 초안 열기')+'</h1><p>함께 작성하려면 원본 시트를 편집할 수 있는 Google 계정으로 연결하세요.</p><div>'+actions+'</div><p id="cloud-status" role="status">'+esc(sharedMessage)+'</p></section>';return;
 }
 studio.innerHTML='<div id="studio-grid-host"></div>';
 grid=mountStudioGrid(studio.querySelector('#studio-grid-host'),{
  draft,catalog,sheetView,directory,library:packageList,libraryState:()=>libraryState,refresh:refreshLibrary,empty:()=>!draft.name&&!draft.cloud,
  packageNames:()=>[...packageList(),...(publicCatalog?.editions||[])],
  change:changes=>{Object.assign(draft,changes);scheduleSync();},
  open:id=>void switchGrid(id),create:values=>void switchGrid(null,values),normalizeDate:eventDate,publish:finish
 });
 if(draft.name)studio.querySelector('#gs-sharing').innerHTML=cloudBar();
 notes.bind(draft.cloud?.book||null);
}
async function finish(){
 if(busy||!grid.validateForPublish())return;
 if(!draft.cloud){
  await connectCloud();
  if(!draft.cloud||conflict)return;
 }
 busy=true;studio.inert=true;clearTimeout(saveTimer);
 try{
  token=await studioAuth();
  await syncing;
  const synced=await runSync();
  if(!synced)return;
  if(!same(content(),synced.content)){cloudStatus('수정 내용을 동기화한 뒤 다시 업로드해 주세요.');return;}
  studio.inert=false;
  if(!grid.validateForPublish())return;
  studio.inert=true;
  cloudStatus('수업용 시트에 업로드 중');
  const release=await publishDraft(token,SHEET_CONFIG,{book:synced.book,version:synced.version,content:synced.content});
  Object.assign(draft,release.content);draft.cloud.base=release.content;
  leavePublished(release.book,'‘'+draft.name+'’ 패키지를 게시했습니다.');
  void refreshLibrary();void fetchStudioCatalog().then(installCatalog).catch(()=>{});
 }catch(e){
  if(e.published){leavePublished(draft.id);return;}
  if(e.status===401)token='';
  cloudStatus(e.message);say(e.message);
 }finally{busy=false;studio.inert=false;refreshCloudBar();}
}
async function disconnectDraft(){
 const book=draft.cloud?.book;
 if(!book||busy)return;
 await switchGrid(null);
 if(draft.cloud)return;
 forgetDraftAccount(googleClientId,book,token||undefined);token='';
}
studio.addEventListener('click',ev=>{
 const b=ev.target.closest('[data-act]');if(!b)return;
 if(!b.closest('.studio-sharing,.shared-entry'))return;
 const act=b.dataset.act;
 if(act==='download-changes'){
  const url=URL.createObjectURL(new Blob([JSON.stringify(content(),null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=draft.name+'-미반영-수정.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  begin(fresh());void refreshLibrary();return;
 }
 if(act==='cancel-pending'){pendingBook=null;begin(draft);if(draft.name)void switchGrid(null);return;}
 if(act==='cloud-disconnect'){void disconnectDraft();return;}
 if(act==='cloud-connect'||act==='cloud-choose'){connectCloud({choose:act==='cloud-choose'});return;}
 if(act==='cloud-keep'||act==='cloud-remote'){runSync(act==='cloud-keep'?'local':'remote');return;}
 if(act==='cloud-link'){
  const link=String(connectUrl(draft.cloud.book));
  navigator.clipboard.writeText(link).then(()=>say('공동 작업 링크를 복사했습니다. 원본 시트 편집 권한이 있는 선생님과 공유하세요.')).catch(()=>prompt('공동 작업 링크',link));return;
 }
});
loadGoogleIdentity();
studio.addEventListener('compositionstart',()=>{composing=true;});
studio.addEventListener('compositionend',()=>{composing=false;scheduleSync();});
setInterval(()=>{if(!busy&&!document.hidden)runSync();},7000);
setInterval(()=>{if(!document.hidden&&!draft.name&&!pendingBook&&libraryState==='ready')void refreshLibrary();},30000);
window.addEventListener('online',()=>{if(!busy)runSync();});
window.addEventListener('beforeunload',e=>{
 if(opened.size||(draft.cloud&&!same(content(),draft.cloud.base))||(!draft.cloud&&draft.name)){e.preventDefault();e.returnValue='';}
});
void refreshLibrary();
try{
 const response=await fetch('./assets/studio-catalog.json');
 if(response.ok)installCatalog(studioCatalog(await response.json()));
}catch{/* The live catalog can still supply package data. */}
draw();
if(pendingBook)void connectCloud({restore:true});
void fetchStudioCatalog().then(source=>{if(!token)installCatalog(source);}).catch(()=>{
 if(!publicCatalog)say('원본 목록을 읽지 못했습니다. Google 시트 연결을 확인해 주세요.');
});
if(window.frameElement){
 new ResizeObserver(()=>{const height=Math.ceil(document.body.getBoundingClientRect().height);if(height)window.frameElement.style.height=height+'px';}).observe(document.body);
}
