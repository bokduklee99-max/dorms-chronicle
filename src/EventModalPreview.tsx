import {useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {EventDetail} from './EventDetail';
import type {HistoryData} from './metro-model';

type PreviewProps = {eventId:string; data:HistoryData; media:Record<string,string>};

function EventModalPreview({eventId,data,media}:PreviewProps) {
 const dialog = useRef<HTMLDialogElement>(null);
 const trigger = useRef<HTMLButtonElement>(null);
 const [open,setOpen] = useState(false);
 const [activeId,setActiveId] = useState(eventId);
 const [topicId,setTopicId] = useState<string|null>(null);
 const event = data.events.find(row => row.id === eventId);
 if (!event) return null;
 const modalEvent = data.events.find(row => row.id === activeId) ?? event;
 const detail = {data,media,topicId,onTopicChange:setTopicId};

 function openModal(id:string) {
  setActiveId(id);
  dialog.current?.showModal();
  setOpen(true);
 }

 return <>
  <div className="event-preview-heading">
   <h3>사건 모달 미리보기</h3>
   <button type="button" ref={trigger} className="preview-action" onClick={() => openModal(eventId)}>모달로 열기</button>
  </div>
  <div className="event-dialog-panel event-preview-panel">
   <EventDetail {...detail} event={event} titleId="preview-event-title" onVisit={openModal} autoFocus={false}/>
  </div>
  <dialog ref={dialog} className="event-dialog-panel event-preview-dialog" aria-labelledby="demo-event-title" onClose={() => {
   setOpen(false);
   trigger.current?.focus({preventScroll:true});
  }}>
   <button type="button" className="preview-action event-preview-close" aria-label="사건 모달 닫기" onClick={() => dialog.current?.close()}>닫기</button>
   {open&&<EventDetail {...detail} event={modalEvent} titleId="demo-event-title" onVisit={setActiveId}/>}
  </dialog>
 </>;
}

export function mountEventModalPreview(container:HTMLElement,media:PreviewProps['media']) {
 const root = createRoot(container);
 return (eventId?:string,data?:HistoryData) => {
  root.render(eventId&&data ? <EventModalPreview key={eventId} eventId={eventId} data={data} media={media}/> : null);
 };
}
