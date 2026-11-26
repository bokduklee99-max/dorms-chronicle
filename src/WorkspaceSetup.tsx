import {useEffect,useMemo,useRef,useState,type FormEvent,type ReactNode} from 'react';
import {CreatorCredit} from './CreatorCredit';
import {ChronicleHeader} from './ChronicleHeader';
import type {EventRecord} from './metro-model';
import {fetchWorkspaceGeography,type readWorkspaceGeography} from './package-content';
import {useSheetHistory} from './use-sheet-history';
import {deleteWorkspace,exploreHref,filterPackage,learningHref,loadWorkspaces,matchesWorkspaceScope,packageName,packageTopics,saveWorkspace,selectWorkspaceEvents,setupHref,viewName,views,workspaceDraft,workspaceSelectionChanges,type Workspace,type WorkspaceDraft} from './workspace-model';
import './workspace.css';

const typeNames = {period:'시기',policy:'정책·법령',event:'사건',context:'배경',publication:'저술·선언'};
const emptySearch = {query:'',startYear:'',endYear:'',categories:[] as string[],type:'',actor:'',lean:'',space:'',verified:false};
const editSteps = ['현재 구성','패키지','카테고리','사건','수업 설정'];

function SelectionChanges({label,items}:{label:string;items:string[]}){
 if(!items.length)return null;
 const list=<ul>{items.map((item,index)=><li key={index}>{item}</li>)}</ul>;
 return items.length>6?<details><summary>{label} {items.length}개</summary>{list}</details>:
  <div><h4>{label} {items.length}개</h4>{list}</div>;
}

function LessonCard({title,description,preview,view,count,timeline,activities,children}:{
 title:string;description?:string;preview:string;view:string;count?:number;timeline:string;activities:string;children?:ReactNode;
}){
 const label=[title,description].filter(Boolean).join(' ');
 return <li>
  <a className="setup-saved-cover" href={timeline} aria-label={label+' 연표 미리보기'}><img src={preview} alt=""/></a>
  <div className="setup-saved-card">
   <div className="setup-saved-meta"><span>{view}</span><span>{count===undefined?'사건 읽는 중…':`사건 ${count}개`}</span></div>
   <h3>{title}</h3>
   {description&&<p>{description}</p>}
  </div>
  <div className="setup-saved-actions">
   <div className="setup-saved-links">
    <a href={timeline} aria-label={label+' 연표 열기'}>연표 열기 <span aria-hidden="true">↗</span></a>
    <a href={activities} aria-label={label+' 학습 콘텐츠 열기'}>학습 콘텐츠 열기 <span aria-hidden="true">↗</span></a>
   </div>
   {children}
  </div>
 </li>;
}

export function WorkspaceSetup(){
 const params = new URLSearchParams(location.search);
 const {packages,packageData,categoryMetadata,pending} = useSheetHistory();
 const [saved,setSaved] = useState(()=>loadWorkspaces());
 const [draft,setDraft] = useState<WorkspaceDraft>(()=>saved.find(item=>item.id===params.get('workspace'))??workspaceDraft());
 const [editing,setEditing] = useState(()=>'id' in draft);
 const [step,setStep] = useState(0);
 const [review,setReview] = useState(false);
 const [returnStep,setReturnStep] = useState(0);
 const [allEvents,setAllEvents] = useState(false);
 const packageDrafts = useRef(new Map<string,WorkspaceDraft>());
 const [deleting,setDeleting] = useState<Workspace|null>(null);
 const [filters,setFilters] = useState(emptySearch);
 const [actorQuery,setActorQuery] = useState('');
 const [spaceQuery,setSpaceQuery] = useState('');
 const [geography,setGeography] = useState<ReturnType<typeof readWorkspaceGeography>|null>();
 const actorPicker = useRef<HTMLDetailsElement>(null);
 const spacePicker = useRef<HTMLDetailsElement>(null);
 const [notice,setNotice] = useState('');
 const [error,setError] = useState('');
 const editor = useRef<HTMLDialogElement>(null);
 const stepHeading = useRef<HTMLHeadingElement>(null);
 const confirmDelete = useRef<HTMLDialogElement>(null);
 const newButton = useRef<HTMLButtonElement>(null);
 const eventList = useRef<HTMLDivElement>(null);
 const data = packageData(draft.packageId);
 const original = 'id' in draft?saved.find(item=>item.id===draft.id):undefined;
 const selectionChanges = useMemo(()=>editing&&original&&!pending?
  workspaceSelectionChanges(packageData(original.packageId),original,data,draft):null,[data,draft,editing,original,packageData,pending]);
 const school = draft.school.trim().normalize();
 const settingsChanges = original?[
  {label:'패키지',before:packageName(packages,original.packageId),after:packageName(packages,draft.packageId),changed:original.packageId!==draft.packageId},
  {label:'학교명',before:original.school,after:school||'미입력',changed:original.school!==school},
  {label:'처음 열 화면',before:viewName(original.view),after:viewName(draft.view),changed:original.view!==draft.view}
 ].filter(change=>change.changed):[];
 const changed = !!selectionChanges&&(settingsChanges.length>0||[selectionChanges.categories,selectionChanges.events].some(group=>group.added.length||group.removed.length));
 const topics = packageTopics(data);
 const categoryChoices = topics.map(topic=>{
  const row = categoryMetadata.get(topic.topic_id);
  const metadata = row?.packageId===draft.packageId?row:undefined;
  const dates = metadata?.type==='period'&&metadata.startDate&&metadata.endDate?` ${metadata.startDate}–${metadata.endDate}`:'';
  return {...topic,type:metadata?.type??'',dates};
 });
 const categoryGroups = [
  {label:'시기 분류',choices:categoryChoices.filter(topic=>topic.type==='period')},
  {label:'사건군',choices:categoryChoices.filter(topic=>topic.type==='arc')},
  {label:'주제',choices:categoryChoices.filter(topic=>topic.type==='theme')},
  {label:categoryChoices.some(topic=>['period','arc','theme'].includes(topic.type))?'미분류':'',choices:categoryChoices.filter(topic=>!['period','arc','theme'].includes(topic.type))}
 ].filter(group=>group.choices.length);
 const selected = filterPackage(data,draft.hiddenTopics,draft.hiddenEvents,draft.includedEvents);
 const selectedIds = new Set(selected.events.map(event=>event.id));
 const visibleTopics = new Set(topics.filter(topic=>!draft.hiddenTopics.includes(topic.topic_id)).map(topic=>topic.topic_id));
 const eventScope = allEvents?data.events:data.events.filter(event=>selectedIds.has(event.id)||event.directTopicIds.some(id=>visibleTopics.has(id)));
 const {config,SheetData} = window.HistorySource;
 const {actorFilterOptions,filterActorEvents} = SheetData;
 const {groups,leans} = actorFilterOptions(data.events,data.actors);
 const actorGroups = groups.map(([name,actors])=>({name,actors:actors.filter(actor=>actor.name.toLowerCase().includes(actorQuery.trim().toLowerCase()))})).filter(group=>group.actors.length);
 const eventSpaceIds = (event:EventRecord) => [
  ...(geography?.byEvent.get(event.id)??[]),...(geography?.byEvent.get(event.legacyId??'')??[]),
 ];
 const spaceIds = new Set(data.events.flatMap(eventSpaceIds));
 const spaceSearch = spaceQuery.trim().toLowerCase();
 const availableSpaces = geography?.spaces.filter(space=>spaceIds.has(space.id))??[];
 const spaceChoices = availableSpaces.filter(space=>[space.name,space.alias].some(name=>name.toLowerCase().includes(spaceSearch)));
 const spaceGroups = [
  {type:'area',name:'권역'}, {type:'point',name:'장소'}, {type:'line',name:'경계·노선'},
 ].map(group=>({...group,spaces:spaceChoices.filter(space=>space.type===group.type)})).filter(group=>group.spaces.length);
 const subjectEvents = filterActorEvents(eventScope,data.actors,filters.actor && 'actor:'+filters.actor);
 const query = filters.query.trim().toLowerCase();
 const categoryIds = categoryGroups.map(group=>group.choices.map(choice=>choice.topic_id).filter(id=>filters.categories.includes(id))).filter(group=>group.length);
 const startYear = filters.startYear.length===4?Number(filters.startYear):-Infinity;
 const endYear = filters.endYear.length===4?Number(filters.endYear):Infinity;
 const events = filterActorEvents(subjectEvents,data.actors,filters.lean && 'lean:'+filters.lean).filter(event=>
  matchesWorkspaceScope(event,startYear,endYear,categoryIds)&&(!filters.type||event.eventType===filters.type)&&
  (!filters.space||eventSpaceIds(event).includes(filters.space))&&
  (!filters.verified||event.reviewStatus==='verified')&&(!query||[event.date,event.endDate,event.title].join(' ').toLowerCase().includes(query))
 );
 const hasSearch = filters.categories.length>0||filters.query||filters.startYear||filters.endYear||filters.type||filters.actor||filters.lean||filters.space||filters.verified;
 const types = new Set(data.events.map(event=>event.eventType));
 const years = data.events.map(event=>event.year);
 const endYears = data.events.map(event=>event.endDate?Number(event.endDate.slice(0,4)):event.year);
 const matchedSelected = events.filter(event=>selectedIds.has(event.id)).length;
 function updateFilters(update:Partial<typeof emptySearch>){
  setFilters(current=>({...current,...update}));
  resetEventScroll();
 }
 function chooseCategory(id:string){
  setFilters(current=>{
   const categories = current.categories.includes(id)?current.categories.filter(selected=>selected!==id):[...current.categories,id];
   return {...current,categories};
  });
  resetEventScroll();
 }
 function toggleLessonCategory(id:string){
  setDraft(current=>({...current,hiddenTopics:current.hiddenTopics.includes(id)?
   current.hiddenTopics.filter(topic=>topic!==id):[...current.hiddenTopics,id]}));
  setFilters(current=>({...current,categories:current.categories.filter(topic=>topic!==id)}));
 }
 function chooseActor(id:string){
  updateFilters({actor:id});
  setActorQuery('');
  if(actorPicker.current){
   actorPicker.current.open=false;
   actorPicker.current.querySelector('summary')?.focus();
  }
 }
 function chooseSpace(id:string){
  updateFilters({space:id});
  setSpaceQuery('');
  if(spacePicker.current){
   spacePicker.current.open=false;
   spacePicker.current.querySelector('summary')?.focus();
  }
 }
 function chooseEvents(records:EventRecord[],include:boolean){
  setDraft(current=>selectWorkspaceEvents(current,records,include));
  clearFeedback();
 }
 const resetEventScroll = ()=>{if(eventList.current)eventList.current.scrollTop=0;};
 const clearFeedback = ()=>{setNotice('');setError('');};

 useEffect(()=>{if(editing)editor.current?.showModal();else editor.current?.close();},[editing]);
 useEffect(()=>{
  if(!editing)return;
  editor.current?.scrollTo(0,0);
  stepHeading.current?.focus({preventScroll:true});
 },[editing,step,review]);
 useEffect(()=>{if(deleting)confirmDelete.current?.showModal();else confirmDelete.current?.close();},[deleting]);
 useEffect(()=>{
  if(!editing)return;
  let cancelled=false;
  fetchWorkspaceGeography(config,SheetData.parseCSV).then(
   value=>{if(!cancelled)setGeography(value);},
   ()=>{if(!cancelled)setGeography(previous=>previous??null);}
  );
  return ()=>{cancelled=true;};
 },[editing,config,SheetData]);
 function resetSearch(){
  setFilters(emptySearch);
  setAllEvents(false);
  setActorQuery('');
  setSpaceQuery('');
  if(actorPicker.current)actorPicker.current.open=false;
  if(spacePicker.current)spacePicker.current.open=false;
  clearFeedback();
  resetEventScroll();
 }
 function editWorkspace(workspace:Workspace){
  packageDrafts.current.clear();
  setDraft(workspace);
  resetSearch();
  setStep(0);
  setReview(false);
  history.replaceState(null,'',setupHref({workspace:workspace.id}));
  setEditing(true);
 }
 function switchPackage(packageId:string){
  if(packageId===draft.packageId)return;
  packageDrafts.current.set(draft.packageId,draft);
  const target=packageData(packageId);
  const previous=packageDrafts.current.get(packageId);
  setDraft({...draft,packageId,
   hiddenTopics:previous?.hiddenTopics??target.topics.map(topic=>topic.topic_id),
   hiddenEvents:previous?.hiddenEvents??target.events.map(event=>event.legacyId??event.id),
   includedEvents:previous?.includedEvents??[]});
  resetSearch();
 }
 function go(next:number){
  setReview(false);
  setStep(next);
  clearFeedback();
 }
 function reviewChanges(){
  if(!changed)return;
  setReturnStep(step);
  setReview(true);
  clearFeedback();
 }
 function closeEditor(){
  setEditing(false);
  history.replaceState(null,'',setupHref());
 }
 function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  setNotice('');
  if(!review)return;
  if(!packages.some(pkg=>pkg.id===draft.packageId)){
   setError('시트에 등록된 패키지를 선택해 주세요.');
   return;
  }
  if(!original||!changed||!school||!selected.events.length)return;
  try {
   const workspace = saveWorkspace(draft);
   setDraft(workspace);
   setSaved(loadWorkspaces());
   const submitter = (event.nativeEvent as SubmitEvent).submitter;
   if(submitter?.getAttribute('value')==='explore'){
    const eventId = new URLSearchParams(location.search).get('event');
    location.assign(exploreHref(workspace,selected.events.find(item=>item.id===eventId||item.legacyId===eventId)?.id));
   } else {
    closeEditor();
    setNotice('수업을 저장했어요.');
   }
  } catch { setError('이 브라우저에 저장할 수 없어요. 저장 공간이나 브라우저 설정을 확인해 주세요.'); }
 }
 function remove(){
  if(!deleting)return;
  try {
   deleteWorkspace(deleting.id);
   setSaved(loadWorkspaces());
   setDeleting(null);
   setNotice('수업을 삭제했어요.');
   confirmDelete.current?.close();
   newButton.current?.focus();
  } catch {setError('수업을 삭제하지 못했어요. 브라우저 설정을 확인해 주세요.');}
 }

 return <>
  <ChronicleHeader><a href="/">← 처음으로</a></ChronicleHeader>
  <main className="setup-page">
   <div className="setup-intro"><h1>나의 <em>역사 탐색.</em></h1><button ref={newButton} className="setup-action" type="button" onClick={()=>location.assign(setupHref()+'&lesson=new')}>새 수업 만들기 <span aria-hidden="true">＋</span></button></div>
   <section className="setup-saved" aria-labelledby="setup-saved-title">
    <div className="setup-section-heading"><h2 id="setup-saved-title">수업 목록</h2><span>{saved.length+1}개</span></div>
    <ul>
     <LessonCard title="일제강점기와 독립운동" view="수업 예시 · 기본 연표" count={145}
      preview="/assets/view-previews/example-japan.jpg" timeline="/metro/?sample=japan" activities="/classroom.html?sample=japan"/>
     {saved.map(item=>{
      const packageLabel=packageName(packages,item.packageId);
      const itemData=packageData(item.packageId);
      const count=filterPackage(itemData,item.hiddenTopics,item.hiddenEvents,item.includedEvents).events.length;
      return <LessonCard key={item.id} title={item.school} description={packageLabel} view={viewName(item.view)} count={pending?undefined:count}
       preview={`/assets/view-previews/${item.view}.jpg`} timeline={exploreHref(item)} activities={learningHref(item)}>
       <div className="setup-saved-manage">
        <button type="button" aria-label={`${item.school} ${packageLabel} 편집`} onClick={()=>editWorkspace(item)}>편집</button>
        <button type="button" className="setup-delete" aria-label={`${item.school} ${packageLabel} 삭제`} onClick={()=>{clearFeedback();setDeleting(item);}}>삭제</button>
       </div>
      </LessonCard>;
     })}
    </ul>
    {notice&&<p className="setup-feedback" role="status">{notice}</p>}
   </section>
  </main>
  <footer className="landing-footer"><CreatorCredit/></footer>
  <dialog ref={editor} className="setup-dialog setup-editor" aria-labelledby="setup-editor-title" onCancel={closeEditor} onClose={closeEditor}>
   <form className="setup-layout" onSubmit={save} onChange={clearFeedback} noValidate>
    <header className="setup-editor-header">
     <div className="setup-dialog-heading"><h2 id="setup-editor-title">수업 편집</h2><button type="button" className="setup-close" aria-label="닫기" onClick={closeEditor}>×</button></div>
     <nav className="setup-edit-steps" aria-label="수업 편집 단계">{editSteps.map((label,index)=>
      <button key={label} type="button" aria-current={!review&&step===index?'step':undefined} onClick={()=>go(index)}>
       {index>0&&<span aria-hidden="true">{index} </span>}{label}
      </button>)}</nav>
    </header>
    <div className="setup-editor-body">
     {review&&selectionChanges?<section className="setup-edit-pane setup-review" aria-labelledby="edit-step-title">
      <h3 id="edit-step-title" ref={stepHeading} tabIndex={-1}>저장할 변경</h3>
      {(selectionChanges.events.added.length>0||selectionChanges.events.removed.length>0)&&
       <p>사건 {selectedIds.size-selectionChanges.events.added.length+selectionChanges.events.removed.length}개 → {selectedIds.size}개</p>}
      {settingsChanges.length>0&&<dl>{settingsChanges.map(change=><div key={change.label}>
       <dt>{change.label}</dt><dd>{change.before} <span aria-label="에서">→</span> {change.after}</dd>
      </div>)}</dl>}
      <SelectionChanges label="추가할 카테고리" items={selectionChanges.categories.added}/>
      <SelectionChanges label="제외할 카테고리" items={selectionChanges.categories.removed}/>
      <SelectionChanges label="추가할 사건" items={selectionChanges.events.added}/>
      <SelectionChanges label="제외할 사건" items={selectionChanges.events.removed}/>
      {!changed&&<p>변경된 내용이 없습니다.</p>}
      {!school&&<p className="setup-review-error">학교명을 입력해 주세요. <button type="button" className="setup-subtle" onClick={()=>go(4)}>수업 설정</button></p>}
      {!selected.events.length&&<p className="setup-review-error">사건을 하나 이상 선택해 주세요. <button type="button" className="setup-subtle" onClick={()=>go(3)}>사건 편집</button></p>}
      <div className="setup-review-actions">
       <button type="submit" value="save" className="setup-save-only" disabled={!changed||!school||!selected.events.length}>수업 저장</button>
       <button type="submit" value="explore" className="setup-action" disabled={!changed||!school||!selected.events.length}>저장하고 열기 <span aria-hidden="true">↗</span></button>
      </div>
     </section>:step===0?<section className="setup-edit-overview" aria-labelledby="edit-step-title">
      <div className="setup-edit-summary">
       <h3 id="edit-step-title" ref={stepHeading} tabIndex={-1}>{packageName(packages,draft.packageId)}</h3>
       <p>{school||'학교명 미입력'} · {viewName(draft.view)}</p>
      </div>
      <ul>{[
       years.length?`${Math.min(...years)}–${Math.max(...endYears)}년`:'',
       pending?'읽는 중…':`${visibleTopics.size}개`,
       pending?'읽는 중…':`${selectedIds.size}개`,
       viewName(draft.view),
      ].map((value,index)=><li key={editSteps[index+1]}>
       <button type="button" onClick={()=>go(index+1)}><strong>{editSteps[index+1]}</strong><span>{value}</span><span aria-hidden="true">→</span></button>
      </li>)}</ul>
     </section>:step===1?<section className="setup-edit-pane" aria-labelledby="edit-step-title">
       <h3 id="edit-step-title" ref={stepHeading} tabIndex={-1}>데이터 패키지</h3>
       <div className="setup-options setup-packages">{packages.map(pkg=>
        <button type="button" key={pkg.id} disabled={pending} aria-pressed={pkg.id===draft.packageId} onClick={()=>switchPackage(pkg.id)}>
         {pkg.name}{(pkg.schoolLevel||pkg.subject)&&<small>{[pkg.schoolLevel,pkg.subject].filter(Boolean).join(' · ')}</small>}
        </button>
       )}</div>
       {!packages.length&&<p className="setup-help">시트에 등록된 패키지가 없어요.</p>}
       <p className="setup-range">다른 패키지에서는 카테고리와 사건을 새로 고릅니다.</p>
     </section>:step===2?<section className="setup-edit-pane" aria-labelledby="edit-step-title">
      <h3 id="edit-step-title" ref={stepHeading} tabIndex={-1}>카테고리 편집</h3>
      {pending?<p role="status">카테고리를 읽는 중입니다.</p>:categoryGroups.map(({label,choices})=><fieldset key={label} className="setup-edit-categories">
       <legend>{label||'카테고리'}</legend><div className="setup-edit-choices">
        {choices.map(({topic_id,name,dates})=><label key={topic_id}>
         <input type="checkbox" checked={visibleTopics.has(topic_id)} onChange={()=>toggleLessonCategory(topic_id)}/>
         {name}{dates&&<span className="setup-category-dates">{dates}</span>}
        </label>)}
       </div>
      </fieldset>)}
      {!pending&&!categoryGroups.length&&<p className="setup-help">이 패키지에 연결된 카테고리가 없어요.</p>}
     </section>:step===4?<section className="setup-edit-pane setup-settings" aria-labelledby="edit-step-title">
      <h3 id="edit-step-title" ref={stepHeading} tabIndex={-1}>수업 설정</h3>
      <div><label className="setup-label" htmlFor="school-name">학교명</label><input id="school-name" className="setup-input" placeholder="학교 이름 입력" value={draft.school} required maxLength={100} onChange={event=>setDraft({...draft,school:event.target.value})}/></div>
      <fieldset className="setup-view">
       <legend>처음 열 화면</legend>
       <div className="setup-view-choices">{views.map(view=><label key={view.id}>
        <input type="radio" name="initial-view" value={view.id} checked={draft.view===view.id} onChange={()=>setDraft({...draft,view:view.id})}/><span>{view.name}</span>
       </label>)}</div>
      </fieldset>
     </section>:<section className="setup-edit-pane setup-content" aria-labelledby="edit-step-title">
      <div className="setup-content-heading"><h3 id="edit-step-title" ref={stepHeading} tabIndex={-1}>사건 편집</h3>
       {hasSearch&&<button type="button" className="setup-subtle" onClick={()=>{updateFilters(emptySearch);setActorQuery('');setSpaceQuery('');}}>검색 초기화</button>}
      </div>
      {pending?<p role="status">사건을 읽는 중입니다.</p>:<>
      <div className="setup-options setup-event-scope" role="group" aria-label="사건 범위">
       <button type="button" aria-pressed={!allEvents} onClick={()=>{setAllEvents(false);resetEventScroll();}}>선택한 카테고리</button>
       <button type="button" aria-pressed={allEvents} onClick={()=>{setAllEvents(true);resetEventScroll();}}>전체 사건</button>
      </div>
      <label className="sr-only" htmlFor="event-search">사건명이나 연도 검색</label><input id="event-search" className="setup-input" type="search" placeholder="사건명이나 연도 검색" value={filters.query} onChange={event=>updateFilters({query:event.target.value})}/>
      <details className="setup-actor">
      <summary>세부 검색{hasSearch&&<span className="setup-more-active">검색 조건 적용 중</span>}</summary>
      <fieldset className="setup-filter">
       <legend>사건 연도</legend>
       <div className="setup-year-inputs">
        <input className="setup-input" aria-label="시작 연도" inputMode="numeric" maxLength={4} placeholder="시작 연도" value={filters.startYear} onChange={event=>updateFilters({startYear:event.target.value.replace(/\D/g,'')})}/>
        <span aria-hidden="true">–</span>
        <input className="setup-input" aria-label="종료 연도" inputMode="numeric" maxLength={4} placeholder="종료 연도" value={filters.endYear} onChange={event=>updateFilters({endYear:event.target.value.replace(/\D/g,'')})}/>
       </div>
       {startYear>endYear&&<p className="setup-help" role="status">종료 연도는 시작 연도보다 같거나 늦어야 해요.</p>}
      </fieldset>
      {categoryGroups.length>0&&<fieldset className="setup-filter">
       <legend>카테고리</legend>
       {categoryGroups.map(({label,choices})=><div className="setup-category-group" key={label} role="group" aria-label={label||undefined}>
        {label&&<p>{label}</p>}
        <div className="setup-options setup-topics">
         {choices.map(({topic_id,name,dates})=><button type="button" key={topic_id} aria-pressed={filters.categories.includes(topic_id)} onClick={()=>chooseCategory(topic_id)}>{name}{dates&&<span className="setup-category-dates">{dates}</span>}</button>)}
        </div>
       </div>)}
      </fieldset>}
      {([
       ['type','사건 유형',Object.entries(typeNames).filter(([key])=>types.has(key as EventRecord['eventType']))],
       ['lean','주체의 성향',leans.map(lean=>[lean,lean])]
      ] as const).map(([key,label,choices])=>choices.length>0&&<fieldset className="setup-filter" key={key}>
       <legend>{label}</legend><div className="setup-options setup-topics">
        {choices.map(([value,name])=><button type="button" key={value} aria-pressed={filters[key]===value} onClick={()=>updateFilters({[key]:filters[key]===value?'':value})}>{name}</button>)}
       </div>
      </fieldset>)}
      {groups.length>0&&<details ref={actorPicker} className="setup-actor">
       <summary>관련 주체 · {data.actors.find(actor=>actor.actor_id===filters.actor)?.name??'전체'}</summary>
       <input className="setup-input" type="search" aria-label="주체 이름 검색" placeholder="주체 이름 검색" value={actorQuery} onChange={event=>setActorQuery(event.target.value)}/>
       <div className="setup-actor-options setup-options">
        <button type="button" aria-pressed={!filters.actor} onClick={()=>chooseActor('')}>전체 주체</button>
        {actorGroups.map(({name,actors})=><fieldset key={name} className="setup-filter"><legend>{name}</legend><div className="setup-options setup-topics">
         {actors.map(actor=><button type="button" key={actor.actor_id} aria-pressed={filters.actor===actor.actor_id} onClick={()=>chooseActor(actor.actor_id)}>{actor.name}</button>)}
        </div></fieldset>)}
        {!actorGroups.length&&<p>일치하는 주체가 없어요.</p>}
       </div>
      </details>}
      {availableSpaces.length>0&&<details ref={spacePicker} className="setup-actor">
       <summary>관련 공간 · {availableSpaces.find(space=>space.id===filters.space)?.name??'전체'}</summary>
       <input className="setup-input" type="search" aria-label="공간 이름 검색" placeholder="공간 이름이나 옛 이름 검색" value={spaceQuery} onChange={event=>setSpaceQuery(event.target.value)}/>
       <div className="setup-actor-options setup-options">
        <button type="button" aria-pressed={!filters.space} onClick={()=>chooseSpace('')}>전체 공간</button>
        {spaceGroups.map(({name,spaces})=><fieldset key={name} className="setup-filter"><legend>{name}</legend><div className="setup-options setup-topics">
         {spaces.map(space=><button type="button" key={space.id} aria-pressed={filters.space===space.id} onClick={()=>chooseSpace(space.id)}>{space.name}</button>)}
        </div></fieldset>)}
        {!spaceGroups.length&&<p className="setup-help">일치하는 공간이 없어요.</p>}
       </div>
      </details>}
      {geography===null&&<p className="setup-help">관련 공간을 불러오지 못했어요.</p>}
      {data.events.some(event=>event.reviewStatus==='draft')&&<label className="setup-verified"><input type="checkbox" checked={filters.verified} onChange={event=>updateFilters({verified:event.target.checked})}/>검토 완료만 보기</label>}
      </details>
      <div className="setup-results"><h3 aria-live="polite">검색 결과 {events.length}개</h3><div>
       <button type="button" disabled={matchedSelected===events.length} onClick={()=>chooseEvents(events,true)}>검색 결과 모두 포함</button>
       <button type="button" disabled={!matchedSelected} onClick={()=>chooseEvents(events,false)}>검색 결과 모두 제외</button>
      </div></div>
      <div ref={eventList} className="setup-events" role="region" aria-label="표시할 사건 목록" tabIndex={0}>
       {events.length>0&&<div className="setup-list-heading" aria-hidden="true"><span/><span>날짜</span><span>사건명</span><span>카테고리</span></div>}
       {events.map(event=>{
        const checked=selectedIds.has(event.id);
        return <label key={event.id}>
        <input type="checkbox" checked={checked} onChange={()=>chooseEvents([event],!checked)}/><span className="setup-event-date"><time dateTime={event.date}>{event.date}</time>{event.endDate&&<time dateTime={event.endDate}>{event.endDate}</time>}</span><span>{event.title}</span>
        <span className="setup-event-topics">{topics.filter(topic=>event.directTopicIds.includes(topic.topic_id)).map(topic=><span className="setup-event-chip" key={topic.topic_id}>{topic.name}</span>)}</span>
       </label>})}
       {!events.length&&<p className="setup-help">{!data.events.length?'이 패키지에 연결된 사건이 없어요.':
        !eventScope.length?'카테고리를 선택하거나 전체 사건을 열어 주세요.':'검색 결과가 없어요.'}</p>}
      </div>
      </>}
     </section>}
    </div>
    <footer className="setup-editor-footer">
     {error&&<p className="setup-feedback" role="alert">{error}</p>}
     <strong className="setup-total" aria-live="polite">{pending?'사건 읽는 중…':`선택한 사건 ${selectedIds.size}개`}</strong>
     <div className="setup-edit-actions">
      {review?<button type="button" className="setup-save-only" onClick={()=>go(returnStep)}>계속 편집</button>:<>
       {step>0&&<button type="button" className="setup-save-only" onClick={()=>go(step-1)}>← 이전</button>}
       {step>0&&step<4&&<button type="button" className="setup-save-only" onClick={()=>go(step+1)}>{editSteps[step+1]} →</button>}
       <button type="button" className="setup-action" disabled={!changed} onClick={reviewChanges}>변경 확인</button>
      </>}
     </div>
    </footer>
   </form>
  </dialog>
  <dialog ref={confirmDelete} className="setup-dialog setup-confirm" aria-labelledby="setup-delete-title" onClose={()=>setDeleting(null)}>
   <h2 id="setup-delete-title">수업을 삭제할까요?</h2><p>{deleting?.school} · {deleting&&packageName(packages,deleting.packageId)}</p>
   {error&&<p className="setup-feedback" role="alert">{error}</p>}
   <div><button type="button" className="setup-save-only" onClick={()=>setDeleting(null)}>취소</button><button type="button" className="setup-action" onClick={remove}>삭제</button></div>
  </dialog>
 </>;
}
