import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {koreanHistory} from './korean-history';
import {useColdWarData} from './use-cold-war-data';
import {deleteWorkspace,exploreHref,filterPackage,loadWorkspaces,packageName,packages,packageTopics,packageViews,saveWorkspace,setupHref,viewName,workspaceDraft,type Workspace,type WorkspaceDraft} from './workspace-model';
import './workspace.css';

function toggle(values:string[],id:string){
 return values.includes(id)?values.filter(value=>value!==id):[...values,id];
}

export function WorkspaceSetup(){
 const params = new URLSearchParams(location.search);
 const [saved,setSaved] = useState(()=>loadWorkspaces());
 const [draft,setDraft] = useState(()=>saved.find(item=>item.id===params.get('workspace'))??workspaceDraft('', 'cold-war',params.get('view')));
 const [editing,setEditing] = useState(()=>params.has('workspace')||params.has('view')||params.has('event'));
 const [deleting,setDeleting] = useState<Workspace|null>(null);
 const [query,setQuery] = useState('');
 const [notice,setNotice] = useState('');
 const [error,setError] = useState('');
 const editor = useRef<HTMLDialogElement>(null);
 const confirmDelete = useRef<HTMLDialogElement>(null);
 const newButton = useRef<HTMLButtonElement>(null);
 const eventList = useRef<HTMLDivElement>(null);
 const {data:coldWar} = useColdWarData();
 const korea = useMemo(()=>koreanHistory(window.HistorySource.data.tenures),[]);
 const data = draft.packageId==='cold-war'?coldWar:korea;
 const topics = packageTopics(data);
 const selected = filterPackage(data,draft.hiddenTopics,draft.hiddenEvents);
 const selectedTopics = packageTopics(selected);
 const available = filterPackage(data,draft.hiddenTopics,[]).events;
 const availableIds = new Set(available.map(event=>event.id));
 const search = query.trim().toLowerCase();
 const events = data.events.filter(event=>availableIds.has(event.id)&&`${event.date} ${event.title}`.toLowerCase().includes(search));
 const years = data.events.map(event=>event.year);
 const actorCount = new Set(data.events.flatMap(event=>event.actorIds)).size;
 const resetEventScroll = ()=>{if(eventList.current)eventList.current.scrollTop=0;};
 const clearFeedback = ()=>{setNotice('');setError('');};

 useEffect(()=>{if(editing)editor.current?.showModal();else editor.current?.close();},[editing]);
 useEffect(()=>{if(deleting)confirmDelete.current?.showModal();else confirmDelete.current?.close();},[deleting]);

 function load(workspace:WorkspaceDraft){
  setDraft(workspace);
  setQuery('');
  clearFeedback();
  resetEventScroll();
 }
 function closeEditor(){
  setEditing(false);
  history.replaceState(null,'',setupHref());
 }
 function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  setNotice('');
  if(!draft.school.trim()||!selected.events.length){
   setError(!draft.school.trim()?'학교명을 입력해 주세요.':'탐색할 사건을 하나 이상 선택해 주세요.');
   event.currentTarget.querySelector<HTMLElement>(!draft.school.trim()?'#school-name':'#event-search')?.focus();
   return;
  }
  try {
   const workspace = saveWorkspace(draft);
   load(workspace);
   setSaved(loadWorkspaces());
   const submitter = (event.nativeEvent as SubmitEvent).submitter;
   if(submitter?.getAttribute('value')==='explore'){
    const eventId = new URLSearchParams(location.search).get('event');
    location.assign(exploreHref(workspace,selected.events.find(item=>item.id===eventId)?.id));
   } else {
    closeEditor();
    setNotice('구성을 저장했어요.');
   }
  } catch { setError('이 브라우저에 저장할 수 없어요. 저장 공간이나 브라우저 설정을 확인해 주세요.'); }
 }
 function remove(){
  if(!deleting)return;
  try {
   deleteWorkspace(deleting.id);
   setSaved(loadWorkspaces());
   setDeleting(null);
   setNotice('구성을 삭제했어요.');
   confirmDelete.current?.close();
   newButton.current?.focus();
  } catch {setError('구성을 삭제하지 못했어요. 브라우저 설정을 확인해 주세요.');}
 }

 return <>
  <header className="landing-nav setup-nav"><a className="wordmark" href="/">Dorms' Chronicle<span aria-hidden="true">✳</span></a><nav aria-label="주요 메뉴"><a href="/data-explorer.html">데이터 탐색</a><a className="setup-back" href="/">← 처음으로</a></nav></header>
  <main className="setup-page">
   <div className="setup-intro"><h1>나의 <em>역사 탐색.</em></h1><button ref={newButton} className="setup-action" type="button" onClick={()=>{load(workspaceDraft());setEditing(true);}}>새 구성 만들기 <span aria-hidden="true">＋</span></button></div>
   <section className="setup-saved" aria-labelledby="setup-saved-title">
    <div className="setup-section-heading"><h2 id="setup-saved-title">저장한 구성</h2><span>{saved.length}개</span></div>
    <ul>{saved.map(item=>{
     const packageLabel=packageName(item.packageId);
     const itemData=item.packageId==='cold-war'?coldWar:korea;
     const count=filterPackage(itemData,item.hiddenTopics,item.hiddenEvents).events.length;
     return <li key={item.id}>
      <a className="setup-saved-cover" href={exploreHref(item)} aria-label={`${item.school} ${packageLabel} 열기`}><img src={`/assets/view-previews/${item.view}.jpg`} alt=""/></a>
      <div className="setup-saved-card">
       <div className="setup-saved-meta"><span>{viewName(item.view)}</span><span>사건 {count}개</span></div>
       <h3>{packageLabel}</h3><p>{item.school}</p>
      </div>
      <div className="setup-saved-actions">
       <a href={exploreHref(item)} className="setup-open" aria-label={`${item.school} ${packageLabel} 열기`}>열기 <span aria-hidden="true">↗</span></a>
       <button type="button" aria-label={`${item.school} ${packageLabel} 편집`} onClick={()=>{
        load(item);history.replaceState(null,'',setupHref({workspace:item.id}));setEditing(true);
       }}>편집</button>
       <button type="button" className="setup-delete" aria-label={`${item.school} ${packageLabel} 삭제`} onClick={()=>{clearFeedback();setDeleting(item);}}>삭제</button>
      </div>
     </li>;
    })}</ul>
    {!saved.length&&<p className="setup-empty">새 구성을 만들어 탐색을 시작하세요.</p>}
    {notice&&<p className="setup-feedback" role="status">{notice}</p>}
   </section>
  </main>
  <dialog ref={editor} className="setup-dialog" aria-labelledby="setup-editor-title" onCancel={closeEditor} onClose={closeEditor}>
   <form className="setup-layout" onSubmit={save} onChange={clearFeedback}>
    <div className="setup-dialog-heading"><h2 id="setup-editor-title">{'id' in draft?'구성 편집':'새 구성 만들기'}</h2><button type="button" className="setup-close" aria-label="닫기" onClick={closeEditor}>×</button></div>
    <div className="setup-editor-body">
     <div className="setup-settings">
      <div><label className="setup-label" htmlFor="school-name">학교명</label><input id="school-name" className="setup-input" placeholder="학교 이름 입력" value={draft.school} required maxLength={100} onChange={event=>setDraft({...draft,school:event.target.value})}/></div>
      <fieldset className="setup-package">
       <legend className="setup-label">데이터 패키지</legend>
       <div className="setup-options">{packages.map(pkg=><button type="button" key={pkg.id} aria-pressed={pkg.id===draft.packageId} onClick={()=>{
        if(pkg.id===draft.packageId)return;
        const previous=saved.find(item=>item.school.toLowerCase()===draft.school.trim().normalize().toLowerCase()&&item.packageId===pkg.id);
        setDraft(previous??workspaceDraft(draft.school,pkg.id,draft.view));
        setQuery('');clearFeedback();resetEventScroll();
       }}>{pkg.name}</button>)}</div>
       <dl className="setup-package-details">
        <div><dt>수록 기간</dt><dd><span>{years.length?`${Math.min(...years)}–${Math.max(...years)}`:'—'}</span></dd></div>
        <div><dt>수록 내용</dt><dd className="setup-package-counts"><span>사건 {data.events.length}개</span><span>카테고리 {topics.length}개</span><span>관련 주체 {actorCount}개</span></dd></div>
        <div><dt>카테고리</dt><dd className="setup-package-topics">{topics.map(topic=><span key={topic.topic_id}>{topic.name}</span>)}</dd></div>
        <div><dt>출처</dt><dd>{draft.packageId==='cold-war'?<a href={window.HistorySource.config.url} target="_blank" rel="noreferrer">냉전 공개 데이터 시트 ↗</a>:<><a href="https://contents.history.go.kr/" target="_blank" rel="noreferrer">국사편찬위원회 ↗</a><a href="https://theme.archives.go.kr/next/" target="_blank" rel="noreferrer">국가기록원 ↗</a></>}</dd></div>
       </dl>
      </fieldset>
      <fieldset className="setup-view">
       <legend>화면 탐색</legend>
       <div className="setup-view-choices">{packageViews(draft.packageId).map(view=><label key={view.id}>
        <input type="radio" name="initial-view" value={view.id} checked={draft.view===view.id} onChange={()=>setDraft({...draft,view:view.id})}/><span>{view.name}</span>
       </label>)}</div>
      </fieldset>
      <section className="setup-selection" aria-label="선택한 구성 미리보기">
       <div className="setup-selection-image"><img src={`/assets/view-previews/${draft.view}.jpg`} width={750} height={300} alt={`${viewName(draft.view)} 화면 예시`}/>{draft.packageId==='korean-history'&&<span>냉전 데이터 화면 예시</span>}</div>
       <div className="setup-selection-copy" aria-live="polite"><h3>{packageName(draft.packageId)}</h3>{draft.school.trim()&&<p>{draft.school}</p>}<p>{viewName(draft.view)}</p><p className="setup-selection-count">사건 {selected.events.length}개 선택 · 카테고리 {selectedTopics.length}개</p></div>
      </section>
     </div>
     <section className="setup-content" aria-labelledby="content-section">
      <div className="setup-content-heading"><h2 id="content-section">표시할 사건</h2><button type="button" className="setup-subtle" onClick={()=>{setDraft({...draft,hiddenTopics:[],hiddenEvents:[]});clearFeedback();resetEventScroll();}}>전체 선택</button></div>
      <h3 id="topic-label" className="sr-only">카테고리</h3>
      <div className="setup-options setup-topics" role="group" aria-labelledby="topic-label">{topics.map(topic=><button type="button" key={topic.topic_id} aria-pressed={!draft.hiddenTopics.includes(topic.topic_id)} onClick={()=>{setDraft({...draft,hiddenTopics:toggle(draft.hiddenTopics,topic.topic_id)});clearFeedback();resetEventScroll();}}>{topic.name}</button>)}</div>
      <label className="sr-only" htmlFor="event-search">사건명이나 연도 검색</label><input id="event-search" className="setup-input" type="search" placeholder="사건명이나 연도 검색" value={query} onChange={event=>{setQuery(event.target.value);resetEventScroll();}}/>
      <div ref={eventList} className="setup-events" role="region" aria-label="표시할 사건 목록" tabIndex={0}>
       {events.length>0&&<div className="setup-list-heading" aria-hidden="true"><span/><span>날짜</span><span>사건명</span><span>카테고리</span></div>}
       {events.map(event=><label key={event.id}>
        <input type="checkbox" checked={!draft.hiddenEvents.includes(event.id)} onChange={()=>setDraft({...draft,hiddenEvents:toggle(draft.hiddenEvents,event.id)})}/><time dateTime={event.date}>{event.date}</time><span>{event.title}</span>
        <span className="setup-event-topics">{topics.filter(topic=>event.directTopicIds.includes(topic.topic_id)).map(topic=><span className="setup-event-chip" key={topic.topic_id}>{topic.name}</span>)}</span>
       </label>)}
       {!events.length&&<p className="setup-help">{available.length?'검색 결과가 없어요.':'표시할 카테고리를 선택해 주세요.'}</p>}
      </div>
     </section>
    </div>
    <footer className="setup-editor-footer">
     {error&&<p className="setup-feedback" role="alert">{error}</p>}
     <button type="submit" value="save" className="setup-save-only">구성만 저장</button><button type="submit" value="explore" className="setup-action">저장하고 열기 <span aria-hidden="true">↗</span></button>
    </footer>
   </form>
  </dialog>
  <dialog ref={confirmDelete} className="setup-dialog setup-confirm" aria-labelledby="setup-delete-title" onClose={()=>setDeleting(null)}>
   <h2 id="setup-delete-title">구성을 삭제할까요?</h2><p>{deleting?.school} · {deleting&&packageName(deleting.packageId)}</p>
   {error&&<p className="setup-feedback" role="alert">{error}</p>}
   <div><button type="button" className="setup-save-only" onClick={()=>setDeleting(null)}>취소</button><button type="button" className="setup-action" onClick={remove}>삭제</button></div>
  </dialog>
 </>;
}
