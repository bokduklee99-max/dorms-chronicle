import {useId,type ReactNode} from 'react';
import {importanceLabels} from '../swimlane-data.js';

export function EventImportanceGroups<T extends {record:{title:string;date:string;importance?:string}}>({entries,render,renderActions,selection}:{
 entries:T[];render:(entry:T)=>ReactNode;renderActions?:(items:T[],label:string)=>ReactNode;
 selection?:{has:(entry:T)=>boolean;set:(items:T[],checked:boolean)=>void};
}){
 const id=useId();
 if(!entries.length)return <p role="status">검색에 맞는 사건이 없습니다.</p>;

 const levels=new Map([...importanceLabels.keys(), ''].map(level=>[level,[] as T[]]));
 for(const entry of [...entries].sort((a,b)=>a.record.date.localeCompare(b.record.date)||a.record.title.localeCompare(b.record.title,'ko'))){
  const level=entry.record.importance??'';
  (levels.get(level)??levels.get('')!).push(entry);
 }
 const unclassified=levels.get('')!;
 function renderGroup(level:string,label:string,items:T[]){
  const headingId=`${id}-${level||'unclassified'}`;
  const allSelected=selection&&items.length>0&&items.every(selection.has);
  const action=allSelected?'전체 해제':'전체 선택';
  return <div className={level?'author-priority':'author-priority author-priority-unclassified'} key={level} data-level={level||undefined} role="group" aria-labelledby={headingId}>
   <div className="author-priority-head"><h3 className="author-priority-title" id={headingId}>{label}</h3>
    {selection&&<button type="button" aria-label={label+' '+action} disabled={!items.length} onClick={()=>selection.set(items,!allSelected)}>{action}</button>}
   </div>
   {renderActions?.(items,label)}
   <div className="author-priority-items">{items.map(render)}</div>
  </div>;
 }
 return <div className="author-priority-grid">
  {unclassified.length<entries.length&&[...importanceLabels].map(([level,label])=>renderGroup(level,label,levels.get(level)!))}
  {unclassified.length>0&&renderGroup('','중요도 미지정',unclassified)}
 </div>;
}
