import {forgetSheetToken} from './google-sheet-auth.js';

const api='https://sheets.googleapis.com/v4/spreadsheets';
const tab='제작 중';
const uuid=/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const legacyLabels={events:'사건',categories:'카테고리',relations:'관계',actors:'주체'};
const collections=['categories','events','relations','actors'];
export const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const cellRow=values=>({values:values.map(value=>({userEnteredValue:{stringValue:String(value??'')}}))});
export async function googleSheet(token,path,body){
 const response=await fetch(api+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(20000)});
 if(!response.ok){
  if(response.status===401)forgetSheetToken(token);
  const message={401:'Google 인증이 만료됐습니다. 다시 연결해 주세요.',403:'이 Google 계정의 시트 편집 권한을 확인해 주세요.',404:'공동 초안 시트 주소와 공유 권한을 확인해 주세요.',429:'Google 시트 요청이 많습니다. 잠시 후 다시 시도해 주세요.'};
  throw Object.assign(new Error(message[response.status]||'Google 시트에 반영됐는지 확인하지 못했습니다. 다시 동기화해 주세요.'),{status:response.status});
 }
 return response.json();
}
// Sheets may return relation rows in a different order after an edit.
const byId=(a,b)=>a.id<b.id?-1:a.id>b.id?1:0;
export function sharedContent(draft,actors){
 const {id,name,school,subject,description,categories,events,relations}=draft;
 return {id,name,school,subject,description,spaces:structuredClone(draft.spaces||[]),queue:structuredClone(draft.queue||[]),
  categories:categories.map(c=>({id:c.id,name:c.name,kind:c.kind,start:c.start||'',end:c.end||'',body:c.body||'',spaceIds:[...(c.spaceIds||[])].sort(),members:[...c.members].sort()})),
  events:events.map(e=>({id:e.id,local:true,date:e.date||'',end:e.end||'',title:e.title||'',type:e.type||'',body:e.body||'',media:e.media||'',importance:e.importance||'',source:e.source||'',spaceIds:[...(e.spaceIds||[])].sort(),participants:(e.participants||[]).map(a=>({id:a.id,role:a.role||''})).sort(byId)})),
  relations:relations.map(r=>({id:r.id,fromId:r.fromId,toId:r.toId,fromType:r.fromType,toType:r.toType,kind:r.kind,label:r.label||'',source:r.source||''})).sort(byId),
  actors:actors.map(a=>({id:a.id,title:a.title,kind:a.kind,body:a.body||'',originalName:a.originalName||'',start:a.start||'',end:a.end||'',source:a.source||'',spaceIds:[...(a.spaceIds||[])].sort(),local:!!a.local})).sort(byId)};
}
function clearDeletedLinks(draft,removed){
 const result={...draft,
  categories:draft.categories.map(c=>({...c,members:c.members.filter(id=>!removed('event',id))})),
  relations:draft.relations.filter(r=>!removed(r.fromType,r.fromId)&&!removed(r.toType,r.toId))};
 if(draft.queue)result.queue=draft.queue.filter(item=>!removed(item.kind,item.id)).map(item=>
  removed(item.originKind,item.origin)?{...item,originKind:'package',origin:draft.id}:item);
 return result;
}
export function removeDraftItem(draft,kind,id){
 const field=kind==='category'?'categories':'events';
 return clearDeletedLinks({...draft,[field]:draft[field].filter(row=>row.id!==id)},(type,key)=>type===kind&&key===id);
}
export function mergeChanges(base,local,remote,path='패키지',choice){
 const merged=mergeFields(base,local,remote,path,choice);
 if(merged===local||merged===remote)return merged;
 // A collaborator may have connected another item while this item was being deleted.
 const removed=new Map();
 for(const [kind,field] of [['category','categories'],['event','events']]){
  const kept=new Set(merged[field].map(row=>row.id));
  const ids=new Set(base[field].map(row=>row.id).filter(id=>!kept.has(id)));
  if(ids.size)removed.set(kind,ids);
 }
 return removed.size?clearDeletedLinks(merged,(kind,id)=>removed.get(kind)?.has(id)):merged;
}
function mergeFields(base,local,remote,path,choice){
 if(same(base,local)||same(local,remote))return remote;
 if(same(base,remote))return local;
 if([base,local,remote].every(Array.isArray)){
  const all=[...base,...local,...remote];
  if(all.every(v=>typeof v==='string')){
   return [...new Set([...remote,...local])].filter(v=>!base.includes(v)||(local.includes(v)&&remote.includes(v)));
  }
  if(all.every(v=>v&&typeof v.id==='string')){
   const [b,l,r]=[base,local,remote].map(list=>new Map(list.map(v=>[v.id,v])));
   return [...new Set([...r.keys(),...l.keys()])].map(id=>mergeFields(b.get(id),l.get(id),r.get(id),path+' / '+(l.get(id)?.title||r.get(id)?.name||id),choice)).filter(Boolean);
  }
 }
 if([base,local,remote].every(v=>v&&typeof v==='object'&&!Array.isArray(v))){
  const result={};
  for(const key of new Set([...Object.keys(remote),...Object.keys(local)])){
   const value=mergeFields(base[key],local[key],remote[key],path+' / '+key,choice);
   if(value!==undefined)Object.defineProperty(result,key,{value,enumerable:true,configurable:true,writable:true});
  }
  return result;
 }
 if(choice==='local')return local;
 if(choice==='remote')return remote;
 throw Object.assign(new Error('같은 항목을 함께 수정했습니다. '+path),{conflict:true});
}
export async function readLegacyDraft(token,book){
 if(!/^[\w-]{15,150}$/.test(book))throw Error('공동 작업 링크를 확인해 주세요.');
 const query=new URLSearchParams({ranges:"'"+tab+"'",fields:'namedRanges(namedRangeId,name),sheets(properties(sheetId,gridProperties),data(rowData(values(userEnteredValue))))'});
 const result=await googleSheet(token,'/'+book+'?'+query);
 const sheet=result.sheets?.[0];
 const [header=[],...rows]=(sheet?.data?.[0]?.rowData||[]).map(r=>(r.values||[]).map(c=>c.userEnteredValue?.stringValue??''));
 const [,id,rev,format]=header,version=Number(rev);
 if(format!=='chronicle-studio-1'||!uuid.test(id)||!Number.isSafeInteger(version)||version<1||sheet.properties.sheetId!==0||!result.namedRanges?.some(n=>n.namedRangeId==='draft_'+id.replaceAll('-','')+'_'+version))throw Error('제작실에서 만든 공동 초안 시트인지 확인해 주세요.');
 const records=rows.filter(r=>r.some(Boolean)).map(([kind,,key,...parts])=>{
  const item=JSON.parse(parts.join(''));if(!key||item.id!==key)throw Error('초안 시트의 항목 ID를 확인해 주세요.');
  return {kind,item};
 });
 const meta=records.find(r=>r.kind==='패키지')?.item;
 if(meta?.id!==id||!['name','school','subject','description'].every(k=>typeof meta[k]==='string'))throw Error('초안 기본 정보를 읽지 못했습니다.');
 const content=Object.fromEntries(['id','name','school','subject','description'].map(key=>[key,meta[key]]));
 for(const key of collections)content[key]=records.filter(r=>r.kind===legacyLabels[key]).map(r=>r.item);
 if(records.filter(r=>r.kind==='패키지').length!==1||records.some(r=>r.kind!=='패키지'&&!Object.values(legacyLabels).includes(r.kind)))throw Error('초안의 항목 종류를 확인해 주세요.');
 for(const key of collections){
  const list=content[key];
  if(list.some(r=>typeof r.id!=='string'||!r.id)||new Set(list.map(r=>r.id)).size!==list.length)throw Error('초안에 비어 있거나 중복된 ID가 있습니다.');
 }
 if(content.actors.some(a=>typeof a.title!=='string')||content.relations.some(r=>typeof r.fromId!=='string'||typeof r.toId!=='string'))throw Error('주체와 관계 형식을 확인해 주세요.');
 if(!content.categories.every(c=>Array.isArray(c.members)&&typeof c.name==='string')||!content.events.every(e=>typeof e.date==='string'&&typeof e.title==='string'))throw Error('초안의 사건과 카테고리 형식을 확인해 주세요.');
 return {book,version,content,grid:sheet.properties.gridProperties};
}
