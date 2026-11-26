import {cellRow,googleSheet,sharedContent,same} from './studio-cloud.js';

const keys={패키지:['패키지ID'],사건:['사건ID'],카테고리:['카테고리ID'],주체:['주체ID'],관계:['관계ID'],
 사건_패키지:['사건ID','패키지ID'],사건_카테고리:['사건ID','카테고리ID'],사건_주체:['사건ID','주체ID'],사건_공간:['사건ID','공간ID'],카테고리_공간:['카테고리ID','공간ID']};
const reviewColumn='제작실 보완정보';
const markKey=id=>isUuid(id)?id.replaceAll('-',''):'key_'+Array.from(new TextEncoder().encode(id),n=>n.toString(16).padStart(2,'0')).join('');
function optional(tab,values,tables){
 return Object.fromEntries(Object.entries(values).filter(([k,v])=>v||tables[tab]?.[0]?.includes(k)).map(([k,v])=>[k,v||'']));
}
function extraData(d,tables){
 const queue=d.queue||[],spaces=d.spaces||[],actorPlaces=(d.actors||[]).filter(a=>a.spaceIds?.length&&queue.some(r=>r.kind==='actor'&&r.id===a.id)).map(a=>[a.id,a.spaceIds]);
 // Keep citations from older drafts when their destination has no event citation column.
 const eventSources=tables.사건?.[0]?.includes('출처')?[]:d.events.filter(e=>e.source).map(e=>[e.id,e.source]);
 return queue.length||spaces.length||actorPlaces.length||eventSources.length?JSON.stringify({queue,spaces,actorPlaces,...(eventSources.length?{eventSources}:{})}):'';
}
function extras(row){
 const data=row?.[reviewColumn]?JSON.parse(row[reviewColumn]):{};
 return {queue:data.queue||[],spaces:data.spaces||[],actorPlaces:new Map(data.actorPlaces||[]),eventSources:new Map(data.eventSources||[])};
}
function existingRoleKeys(tables){
 return new Set(readTable(tables.사건_주체||[[]]).filter(r=>r.작성상태!=='작성 중'&&!r.역할).map(r=>JSON.stringify([r.사건ID,r.주체ID])));
}
function rowsFor(d,published=true,tables={}){
 const unassigned=published?existingRoleKeys(tables):new Set();
 const {id,categories,events,relations,actors}=d;
 return {
  패키지:[{패키지ID:id,패키지명:d.name,학교급:d.school,과목:d.subject,설명:d.description,...optional('패키지',{[reviewColumn]:extraData(d,tables)},tables)}],
  사건:events.map(e=>({사건ID:e.id,날짜:e.date,종료일:e.end,사건명:e.title,사건유형:e.type,내용:e.body,이미지:e.media,...optional('사건',{중요도:e.importance},tables),...(tables.사건?.[0]?.includes('출처')?{출처:e.source||''}:{})})),
  카테고리:categories.map(c=>({카테고리ID:c.id,패키지ID:id,카테고리명:c.name,카테고리유형:c.kind,시작일:c.start,종료일:c.end,설명:c.body})),
  주체:actors.map(a=>({주체ID:a.id,주체명:a.title,구분:a.kind,소개:a.body,...optional('주체',{원어명:a.originalName,'존속 시작일':a.start,'존속 종료일':a.end,출처:a.source},tables)})),
  관계:relations.map(r=>({관계ID:r.id,패키지ID:id,출발유형:r.fromType,출발ID:r.fromId,도착유형:r.toType,도착ID:r.toId,관계유형:r.kind,라벨:r.label,...optional('관계',{설명:r.body,출처:r.source},tables)})),
  사건_패키지:events.map(e=>({사건ID:e.id,패키지ID:id})),
  사건_카테고리:categories.flatMap(c=>c.members.map(사건ID=>({사건ID,카테고리ID:c.id}))),
  사건_주체:events.flatMap(e=>(e.participants||[]).map(a=>({사건ID:e.id,주체ID:a.id,역할:a.role||(published&&!unassigned.has(JSON.stringify([e.id,a.id]))?'related':'')}))),
  사건_공간:events.flatMap(e=>(e.spaceIds||[]).map(공간ID=>({사건ID:e.id,공간ID}))),
  카테고리_공간:categories.flatMap(c=>(c.spaceIds||[]).map(공간ID=>({카테고리ID:c.id,공간ID})))
 };
}
function ids(records,field){return new Set(records.map(r=>r[field]));}
export function publicationRequests(d,config,tables,previouslyPublished){
 const desired=rowsFor(d,true,tables),current={};
 for(const records of Object.values(desired))for(const row of records)row.작성상태='게시됨';
 for(const [tab,fields] of Object.entries(keys)){
  const [headers,...values]=tables[tab]||[];
  const required=new Set([...fields,...Object.keys(desired[tab][0]||{})]);
  if(!headers||[...required].some(k=>!headers.includes(k)))throw Error(tab+' 탭의 열 이름을 확인해 주세요.');
  current[tab]=values.map((cells,index)=>({...Object.fromEntries(headers.map((h,i)=>[h,String(cells[i]??'')])),index:index+1})).filter(r=>r[fields[0]]);
 }
 const ownedEvents=ids(current.사건_패키지.filter(r=>r.패키지ID===d.id),'사건ID');
 const sharedEvents=ids(current.사건_패키지.filter(r=>r.패키지ID!==d.id),'사건ID');
 const ownedCategories=ids(current.카테고리.filter(r=>r.패키지ID===d.id),'카테고리ID');
 const externalReferences=new Set(current.관계.filter(r=>r.패키지ID!==d.id).flatMap(r=>[r.출발ID,r.도착ID]));
 for(const r of current.사건_카테고리)if(!ownedCategories.has(r.카테고리ID))sharedEvents.add(r.사건ID);
 if(!previouslyPublished&&current.패키지.some(r=>r.패키지ID===d.id))throw Error('같은 ID의 패키지가 이미 원본에 있습니다.');
 const events=ids(d.events,'id'),categories=ids(d.categories,'id'),actors=ids(d.actors,'id');
 const previousExtra=extras(current.패키지.find(r=>r.패키지ID===d.id));
 const ownedActors=new Set(previousExtra.queue.filter(r=>r.kind==='actor').map(r=>r.id));
 const targets={event:events,category:categories,actor:actors};
 const existingActors=ids(current.주체,'주체ID');
 const spaces=ids((tables.공간||[]).slice(1).map(row=>({id:row[tables.공간[0].indexOf('공간ID')]})),'id');
 for(const p of d.spaces||[])spaces.add(p.id);
 if(d.categories.some(c=>c.members.some(id=>!events.has(id)))||d.events.some(e=>e.participants?.some(a=>!actors.has(a.id)))||
   d.relations.some(r=>!(targets[r.fromType]||actors).has(r.fromId)||!(targets[r.toType]||actors).has(r.toId))||
   [...d.events,...d.categories].some(x=>x.spaceIds?.some(id=>!spaces.has(id)))||
   d.actors.some(a=>!a.local&&!existingActors.has(a.id)))throw Error('삭제되었거나 찾을 수 없는 연결 대상이 있습니다. 사건·카테고리·주체·공간 연결을 확인해 주세요.');
 const requests=[];
 for(const [tab,rows] of Object.entries(desired)){
  const headers=tables[tab][0],sheetId=config.sheetIds[tab],fields=keys[tab];
  const identify=r=>JSON.stringify(fields.map(k=>r[k]));
  const existing=new Map(current[tab].map(r=>[identify(r),r]));
  const wanted=new Set(),append=[];
  function owns(r){
   if(tab==='주체')return false;
   if(tab==='패키지'||tab==='관계'||tab==='사건_패키지'||tab==='카테고리')return r.패키지ID===d.id;
   if(tab==='카테고리_공간'||tab==='사건_카테고리')return ownedCategories.has(r.카테고리ID);
   return ownedEvents.has(r.사건ID)&&!sharedEvents.has(r.사건ID)&&!externalReferences.has(r.사건ID);
  }
  for(const row of rows){
   const key=identify(row);
   if(wanted.has(key))throw Error(tab+'에 중복된 항목이 있습니다.');
   wanted.add(key);
   const old=existing.get(key);
   if(!old){
    if(['사건_주체','사건_공간'].includes(tab)&&sharedEvents.has(row.사건ID))throw Error('다른 패키지에서도 사용하는 사건의 연결을 확인해 주세요.');
    append.push(cellRow(headers.map(h=>row[h])));continue;
   }
   if(tab==='주체'&&!ownedActors.has(row.주체ID))continue;
   const changed=Object.keys(row).filter(h=>h!=='작성상태'&&String(row[h]??'')!==old[h]);
   if(!changed.length)continue;
   if(!owns(old)&&!(tab==='주체'&&ownedActors.has(row.주체ID)))throw Error(tab+'에 다른 패키지가 사용하는 항목이 있습니다. 원본을 확인해 주세요.');
   for(const h of changed)requests.push({updateCells:{start:{sheetId,rowIndex:old.index,columnIndex:headers.indexOf(h)},rows:[cellRow([row[h]])],fields:'userEnteredValue'}});
  }
  for(const old of current[tab]){
   if(wanted.has(identify(old)))continue;
   if(['사건_주체','사건_공간'].includes(tab)&&events.has(old.사건ID)&&!owns(old))throw Error('다른 패키지에서도 사용하는 사건의 연결을 확인해 주세요.');
   if(!owns(old))continue;
   if(tab==='카테고리'&&externalReferences.has(old.카테고리ID))throw Error('다른 패키지의 관계에서도 사용하는 카테고리입니다.');
   requests.push({updateCells:{range:{sheetId,startRowIndex:old.index,endRowIndex:old.index+1,endColumnIndex:headers.length},fields:'userEnteredValue'}});
  }
  if(append.length)requests.push({appendCells:{sheetId,rows:append,fields:'userEnteredValue'}});
 }
 requests.push(...geographyRequests(d,config,tables,previousExtra));
 return requests;
}

function geographyRequests(d,config,tables,previous){
 const requests=[],places=d.spaces||[],all=new Set([...readTable(tables.공간).map(r=>r.공간ID),...places.map(p=>p.id)]);
 function upsert(tab,values,match){
  const [headers]=tables[tab],sheetId=config.sheetIds[tab];
  const row=Object.entries(values).filter(([k,v])=>headers.includes(k)||v);
  if(row.some(([k])=>!headers.includes(k)))throw Error(tab+' 탭의 열 이름을 확인해 주세요.');
  if(!match){requests.push({appendCells:{sheetId,rows:[cellRow(headers.map(k=>values[k]))],fields:'userEnteredValue'}});return;}
  for(const [k,v] of row)if((match[k]||'')!==(v||''))requests.push({updateCells:{start:{sheetId,rowIndex:match.index,columnIndex:headers.indexOf(k)},rows:[cellRow([v])],fields:'userEnteredValue'}});
 }
 const existing=readTable(tables.공간),owned=new Set(previous.spaces.map(p=>p.id));
 for(const p of places){
  if(p.parent&&!all.has(p.parent))throw Error('상위 공간을 확인해 주세요.');
  const old=existing.find(r=>r.공간ID===p.id);
  if(old&&!owned.has(p.id))throw Error('다른 항목이 사용하는 공간 ID입니다.');
  upsert('공간',{공간ID:p.id,공간명:p.name,공간유형:p.kind,상위공간ID:p.parent,시대별칭:p.alias,설명:p.body},old);
 }
 const links=tables.주체_공간?readTable(tables.주체_공간):[];
 for(const a of d.actors||[]){
  if(!d.queue?.some(r=>r.kind==='actor'&&r.id===a.id))continue;
  const wanted=new Set(a.spaceIds||[]),prior=previous.actorPlaces.get(a.id)||[];
  for(const id of wanted){
   if(!all.has(id)||!tables.주체_공간)throw Error('주체와 공간 연결을 확인해 주세요.');
   if(!links.some(r=>r.주체ID===a.id&&r.공간ID===id))upsert('주체_공간',{주체ID:a.id,공간ID:id});
  }
  for(const r of links)if(r.주체ID===a.id&&prior.includes(r.공간ID)&&!wanted.has(r.공간ID))
   requests.push({updateCells:{range:{sheetId:config.sheetIds.주체_공간,startRowIndex:r.index,endRowIndex:r.index+1,endColumnIndex:tables.주체_공간[0].length},fields:'userEnteredValue'}});
 }
 return requests;
}

const draftPrefix=id=>'draft:'+id+':';
const isUuid=id=>/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id);
const status='작성상태',working='작성 중';
const fields=Object.keys(keys);
const identity=(tab,r)=>JSON.stringify(keys[tab].map(k=>r[k]));
function readTable(values){
 const [header,...rows]=values;
 return rows.map((cells,i)=>({...Object.fromEntries(header.map((k,j)=>[k,cells[j]||''])),index:i+1}));
}
async function sourceState(token,config,id){
 if(typeof id!=='string'||!id||id.includes(':')||id.length>200)throw Error('패키지 ID를 확인해 주세요.');
 const tabs=[...fields,'공간',...(config.sheetIds.주체_공간?['주체_공간']:[])];
 const query='?fields=namedRanges(name,namedRangeId),sheets(properties(sheetId,gridProperties(columnCount)),data(rowData(values(formattedValue))))';
 const result=await googleSheet(token,'/'+config.id+':getByDataFilter'+query,{dataFilters:tabs.map(t=>({gridRange:{sheetId:config.sheetIds[t]}})),includeGridData:true});
 const tables={},widths={};
 for(const tab of tabs){
  const grid=result.sheets.find(s=>s.properties.sheetId===config.sheetIds[tab]);
  widths[tab]=grid?.properties.gridProperties?.columnCount;
  tables[tab]=(grid?.data?.[0]?.rowData||[]).map(row=>(row.values||[]).map(cell=>cell.formattedValue||''));
  if(!tables[tab][0]?.includes(['공간','주체_공간'].includes(tab)?'공간ID':status))throw Error(tab+' 탭의 '+(tab==='공간'?'공간ID':'작성상태')+' 열을 확인해 주세요.');
 }
 const names=result.namedRanges||[],markName='ChronicleSource_'+markKey(id);
 const mark=names.find(r=>r.name===markName);
 const [,version,published]=mark?.namedRangeId.match(/_(\d+)_(\d+)$/)||[];
 const wasLive=readTable(tables.패키지).some(r=>r.패키지ID===id&&r[status]!==working);
 return {book:id,tables,widths,names,mark,markName,version:Number(version)||(wasLive?1:0),published:Number(published)||(wasLive?1:0)};
}
function draftProjection(content,tables){
 const prefix=draftPrefix(content.id),records=rowsFor(content,false,tables);
 const liveActors=new Set(readTable(tables.주체).filter(r=>r.작성상태!==working).map(r=>r.주체ID));
 const newActors=new Set(content.actors.filter(a=>!liveActors.has(a.id)||content.queue?.some(r=>r.kind==='actor'&&r.id===a.id)).map(a=>a.id));
 records.주체=records.주체.filter(r=>newActors.has(r.주체ID));
 for(const rows of Object.values(records))for(const row of rows){
  for(const k of Object.keys(row)){
   if(!k.endsWith('ID')||k==='공간ID')continue;
   const actor=k==='주체ID'||(k==='출발ID'&&liveActors.has(row[k]))||(k==='도착ID'&&liveActors.has(row[k]));
   if(!actor||newActors.has(row[k]))row[k]=prefix+row[k];
  }
  row[status]=working;
 }
 return records;
}
function ourDraft(tab,r,id){
 return r[status]===working&&keys[tab].some(k=>r[k]?.startsWith(draftPrefix(id)));
}
function readContent(state){
 const {book:id,tables,version,published}=state;
 if(!version)throw Error('원본 시트에 등록된 공동 초안을 찾지 못했습니다.');
 const staged=version!==published,prefix=draftPrefix(id);
 const short=value=>value?.startsWith(prefix)?value.slice(prefix.length):value;
 const rows=Object.fromEntries(fields.map(tab=>[tab,readTable(tables[tab]).filter(r=>staged?ourDraft(tab,r,id):r[status]!==working)]));
 const pkgId=staged?prefix+id:id,meta=rows.패키지.find(r=>r.패키지ID===pkgId);
 if(!meta)throw Error('패키지 행과 작성상태를 확인해 주세요.');
 const extra=extras(meta);
 const eventIds=ids(rows.사건_패키지.filter(r=>r.패키지ID===pkgId),'사건ID');
 const linked=(tab,field,value,target)=>rows[tab].filter(r=>r[field]===value).map(r=>short(r[target]));
 const categories=rows.카테고리.filter(r=>r.패키지ID===pkgId).map(r=>({id:short(r.카테고리ID),name:r.카테고리명,kind:r.카테고리유형,start:r.시작일,end:r.종료일,body:r.설명,
  members:linked('사건_카테고리','카테고리ID',r.카테고리ID,'사건ID'),spaceIds:linked('카테고리_공간','카테고리ID',r.카테고리ID,'공간ID')}));
 const eventRows=new Map(rows.사건.map(r=>[r.사건ID,r]));
 const events=[...eventIds].map(key=>{const row=eventRows.get(key);if(!row)throw Error('패키지에 연결된 사건을 찾을 수 없습니다.');return row;}).map(r=>({id:short(r.사건ID),date:r.날짜,end:r.종료일,title:r.사건명,type:r.사건유형,body:r.내용,media:r.이미지,importance:r.중요도,source:r.출처||extra.eventSources.get(short(r.사건ID)),
  spaceIds:linked('사건_공간','사건ID',r.사건ID,'공간ID'),participants:rows.사건_주체.filter(a=>a.사건ID===r.사건ID).map(a=>({id:short(a.주체ID),role:a.역할}))}));
 const relations=rows.관계.filter(r=>r.패키지ID===pkgId).map(r=>({id:short(r.관계ID),fromType:r.출발유형,toType:r.도착유형,fromId:short(r.출발ID),toId:short(r.도착ID),kind:r.관계유형,label:r.라벨,body:r.설명,source:r.출처}));
 const needed=new Set(events.flatMap(e=>e.participants.map(a=>a.id)));
 for(const r of relations){if(['actor','person','organization','army','state','institution','territory','alliance'].includes(r.fromType))needed.add(r.fromId);if(['actor','person','organization','army','state','institution','territory','alliance'].includes(r.toType))needed.add(r.toId);}
 for(const r of extra.queue)if(r.kind==='actor')needed.add(r.id);
 const directory=new Map(readTable(tables.주체).filter(r=>r.주체ID&&(r[status]!==working||(staged&&ourDraft('주체',r,id)))).sort((a,b)=>Number(a[status]===working)-Number(b[status]===working)).map(r=>[short(r.주체ID),r]));
 const livePlaces=new Map();
 for(const r of readTable(tables.주체_공간||[[]])){
  if(!livePlaces.has(r.주체ID))livePlaces.set(r.주체ID,[]);
  if(r.공간ID)livePlaces.get(r.주체ID).push(r.공간ID);
 }
 const actors=[...needed].map(key=>{
  const a=directory.get(key);if(!a)throw Error('원본 시트에서 연결된 주체를 찾을 수 없습니다.');
  return {id:key,title:a.주체명,kind:a.구분,body:a.소개,originalName:a.원어명,start:a['존속 시작일'],end:a['존속 종료일'],source:a.출처,spaceIds:extra.queue.some(r=>r.kind==='actor'&&r.id===key)?extra.actorPlaces.get(key)||[]:livePlaces.get(key)||[],local:a[status]===working||a[status]==='게시됨'};
 });
 return sharedContent({id,name:meta.패키지명,school:meta.학교급,subject:meta.과목,description:meta.설명,categories,events,relations,queue:extra.queue,spaces:extra.spaces},actors);
}
function stagedChanges(state,content,config,promote){
 const {tables,book:id}=state,requests=[];
 const next=promote?{}:draftProjection(content,tables);
 for(const tab of fields){
  const [headers]=tables[tab],sheetId=config.sheetIds[tab];
  const previous=new Map(readTable(tables[tab]).filter(r=>ourDraft(tab,r,id)).map(r=>[identity(tab,r),r]));
  const additions=[];
  for(const row of next[tab]||[]){
   if(Object.keys(row).some(k=>!headers.includes(k)))throw Error(tab+' 열을 확인해 주세요.');
   const key=identity(tab,row),old=previous.get(key);
   if(!old){additions.push(cellRow(headers.map(h=>row[h])));continue;}
   previous.delete(key);
   for(const [key,value] of Object.entries(row))if((old[key]||'')!==(value||'')){
    requests.push({updateCells:{start:{sheetId,rowIndex:old.index,columnIndex:headers.indexOf(key)},rows:[cellRow([value])],fields:'userEnteredValue'}});
   }
  }
  for(const r of previous.values())requests.push({updateCells:{range:{sheetId,startRowIndex:r.index,endRowIndex:r.index+1,endColumnIndex:headers.length},fields:'userEnteredValue'}});
  if(additions.length)requests.push({appendCells:{sheetId,rows:additions,fields:'userEnteredValue'}});
 }
 return requests;
}
function publishedContent(content,tables){
 const unassigned=existingRoleKeys(tables);
 const events=content.events.map(event=>({...event,participants:event.participants.map(actor=>({...actor,role:actor.role||(unassigned.has(JSON.stringify([event.id,actor.id]))?'':'related')}))}));
 return sharedContent({...content,events},content.actors);
}
async function commit(token,config,state,content,promote){
 const requests=[];
 // Add editor-only columns in the same version-checked batch as their first use.
 const optionalColumns={패키지:{[reviewColumn]:extraData(content,state.tables)},사건:{중요도:content.events.some(e=>e.importance)}};
 for(const [tab,columns] of Object.entries(optionalColumns)){
  const headers=state.tables[tab][0],missing=Object.keys(columns).filter(key=>columns[key]&&!headers.includes(key));
  if(!missing.length)continue;
  const columnIndex=headers.length,sheetId=config.sheetIds[tab],width=state.widths?.[tab];
  if(width&&width<columnIndex+missing.length)requests.push({appendDimension:{sheetId,dimension:'COLUMNS',length:columnIndex+missing.length-width}});
  requests.push({updateCells:{start:{sheetId,rowIndex:0,columnIndex},rows:[cellRow(missing)],fields:'userEnteredValue'}});
  state={...state,tables:{...state.tables,[tab]:[[...headers,...missing],...state.tables[tab].slice(1)]}};
 }
 requests.push(...stagedChanges(state,content,config,promote));
 if(promote){
  // Preserve physical row indexes while excluding working copies from publication.
  const live=Object.fromEntries(Object.entries(state.tables).map(([k,[h,...rows]])=>[k,[h,...rows.map(r=>r[h.indexOf(status)]===working?[]:r)]]));
  const prefix=draftPrefix(content.id),used=new Set();
  const bySheet=new Map(fields.map(tab=>{
   const staged=readTable(state.tables[tab]).filter(r=>ourDraft(tab,r,content.id));
   return [config.sheetIds[tab],{tab,headers:state.tables[tab][0],indices:new Map(staged.map(r=>[
    JSON.stringify(keys[tab].map(k=>r[k].startsWith(prefix)?r[k].slice(prefix.length):r[k])),r.index]))}];
  }));
  const changes=publicationRequests(content,config,live,!!state.published);
  for(const change of changes){
   const adding=change.appendCells;
   if(!adding||!bySheet.has(adding.sheetId)){requests.push(change);continue;}
   const {tab,headers,indices}=bySheet.get(adding.sheetId),rest=[];
   for(const row of adding.rows){
    const key=JSON.stringify(keys[tab].map(k=>row.values[headers.indexOf(k)].userEnteredValue.stringValue));
    const index=indices.get(key);
    if(index===undefined){rest.push(row);continue;}
    used.add(adding.sheetId+':'+index);
    requests.push({updateCells:{start:{sheetId:adding.sheetId,rowIndex:index,columnIndex:0},rows:[row],fields:'userEnteredValue'}});
   }
   if(rest.length)requests.push({appendCells:{...adding,rows:rest}});
  }
  // A first upload promotes its working rows in place.
  for(let i=requests.length-1;i>=0;i--){
   const cleared=requests[i].updateCells?.range;
   if(cleared&&used.has(cleared.sheetId+':'+cleared.startRowIndex))requests.splice(i,1);
  }
 }
 const version=state.version+1,published=promote?version:state.published;
 const range={sheetId:config.packageSheetId,startRowIndex:0,endRowIndex:1,startColumnIndex:0,endColumnIndex:1};
 const replace=(old,name,namedRangeId)=>{
  if(old)requests.unshift({deleteNamedRange:{namedRangeId:old.namedRangeId}});
  requests.push({addNamedRange:{namedRange:{name,namedRangeId,range}}});
 };
 replace(state.mark,state.markName,'src_'+markKey(content.id)+'_'+version+'_'+published);
 replace(state.names.find(r=>r.name==='ChronicleUpload'),'ChronicleUpload','upload_'+crypto.randomUUID());
 await googleSheet(token,'/'+config.id+':batchUpdate',{requests});
 const saved=promote?publishedContent(content,state.tables):content;
 return {book:content.id,version,published,content:saved};
}
export async function readDraft(token,config,id){
 const state=await sourceState(token,config,id);return {...state,content:readContent(state)};
}
const publishedError=()=>Object.assign(Error('이미 게시가 끝난 패키지입니다.'),{published:true});
export async function createDraft(token,config,content){
 const state=await sourceState(token,config,content.id);
 if(state.published)throw publishedError();
 if(state.mark)return {...state,content:readContent(state)};
 return commit(token,config,state,content,false);
}
export async function writeDraft(token,config,state,content){
 if(state.published)throw publishedError();
 return commit(token,config,state,content,false);
}
export async function publishDraft(token,config,{book,content,version}){
 const state=await readDraft(token,config,book);
 if(content.queue?.some(r=>!r.done))throw Error('입력 중 추가된 데이터를 먼저 검토해 주세요.');
 if(content.relations.some(r=>!r.kind))throw Error('관련 사건의 관계유형을 선택해 주세요.');
 if(state.published===state.version&&state.version>=version&&same(state.content,publishedContent(content,state.tables)))return state;
 if(state.published)throw publishedError();
 if(version!==state.version||!same(state.content,content))throw Error('공동 초안이 변경됐습니다. 동기화한 뒤 다시 업로드해 주세요.');
 return commit(token,config,state,content,true);
}

// The authenticated writer re-reads these records before saving edits made from a public edition.
export function publicEdition(tables,id){
 return readContent({book:id,tables,version:1,published:1});
}
