import type {ReactNode} from 'react';
import type {EventRecord} from './metro-model';

export type WorkspaceEventChange={event:EventRecord}&(
 {visible:boolean}|{category:string;focusLane?:string;undo:()=>void}|{categoryRestored:true;focusLane?:string}
);
type Props={hiddenEvents:EventRecord[];change:WorkspaceEventChange|null;error:string;
 onRestore:(id:string)=>void;manageHidden:boolean;
 pen?:{active:boolean;select:(active:boolean)=>void;canUndo:boolean;undo:()=>void}};

function ToolIcon({path}:{path:string}){
 return <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none"
  stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={path}/></svg>;
}

export function WorkspaceRoomEditor({hiddenEvents,change,error,onRestore,manageHidden,pen}:Props){
 const restoreList=<ul>{hiddenEvents.map(event=><li key={event.id}>
  <div className="room-event-name">
   <strong>{event.title}</strong><time dateTime={event.date}>{event.date}</time>
  </div>
  <button type="button" aria-label={`${event.title} 다시 표시`} onClick={()=>onRestore(event.id)}>다시 표시</button>
 </li>)}</ul>;
 const hidden=manageHidden?(hiddenEvents.length?restoreList:<p>숨긴 사건이 없어요.</p>):!pen?.active&&!!hiddenEvents.length&&<details>
   <summary aria-label={pen?`숨긴 사건 ${hiddenEvents.length}개`:undefined}>
    {pen&&<ToolIcon path="m3 3 18 18M10.2 10.2a2.5 2.5 0 0 0 3.6 3.6M6.4 6.4A15 15 0 0 0 2 12s3.7 6 10 6a11 11 0 0 0 5.6-1.6M10 6.2A11 11 0 0 1 12 6c6.3 0 10 6 10 6a15 15 0 0 1-2.2 2.7"/>}
    <span className="room-hidden-title">숨긴 사건</span><span className="room-hidden-count">{hiddenEvents.length}개</span>
   </summary>
   {restoreList}
  </details>;
 const feedback=(error||(!pen?.active&&change))&&<div className="room-edit-feedback" data-error={!!error||undefined}>
   {error?<p role="alert">{error}</p>:change&&<>
    <p className="room-event-name" role="status"><strong>{change.event.title}</strong>
     <span>{'category' in change?`${change.category}에 배치했어요.`:
      'categoryRestored' in change?'분류 이동을 되돌렸어요.':change.visible?'다시 표시했어요.':'이 방에서 숨겼어요.'}</span>
    </p>
    {'undo' in change&&<button type="button" onClick={change.undo} aria-label={pen?'분류 이동 되돌리기':undefined} title={pen?'분류 이동 되돌리기':undefined}>
     {pen?<ToolIcon path="M10 5 5 10l5 5m-5-5h9a5 5 0 0 1 0 10h-3"/>:'되돌리기'}
    </button>}
   </>}
  </div>;
 return <section id="room-editor" className={pen?'room-editor room-editor-bar':'room-editor'} aria-label={pen?'스윔레인 편집':undefined} aria-labelledby={pen?undefined:'room-editor-title'}>
  {pen?<><div className="room-edit-tools" role="group" aria-label="편집 도구">
   <button type="button" aria-label="사건 편집" title="사건 편집" aria-pressed={!pen.active} onClick={()=>pen.select(false)}>
    <ToolIcon path="m4 4 16 8-7 1.5-2 6.5z"/><span>사건 편집</span>
   </button>
   <button type="button" aria-label="펜" title="펜" aria-pressed={pen.active} onClick={()=>pen.select(true)}>
    <ToolIcon path="m15 6 3 3M5 19l4-1 11-11a2.1 2.1 0 0 0-3-3L6 15z"/><span>펜</span>
   </button>
   <button type="button" aria-label="마지막 획 지우기" title="마지막 획 지우기" disabled={!pen.active||!pen.canUndo} onClick={pen.undo}>
    <ToolIcon path="m8 19-4-4a2 2 0 0 1 0-3l8-8a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-7 7zm-1-10 8 8m-2 2h8"/>
   </button>
  </div>{feedback}{hidden}</>:<>
   <h2 id="room-editor-title">{manageHidden?'숨긴 사건 관리':'사건 편집'}</h2>
   {hidden}{feedback}
  </>}
 </section>;
}

export function WorkspaceEventCard({event,children,onHide}:{event:Pick<EventRecord,'id'|'title'>;children:ReactNode;onHide?:(id:string)=>void}){
 if(!onHide)return children;
 return <div className="room-event-card" data-workspace-event={event.id}>{children}<button type="button" className="room-event-hide"
  aria-label={`${event.title} 숨기기`} title="이 방에서 숨기기" onClick={()=>onHide(event.id)}>×</button></div>;
}
