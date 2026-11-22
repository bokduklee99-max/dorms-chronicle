import {actorRecord,eventRecord,spaceRecord} from './studio-grid-model.js';
import {publicEdition} from './studio-publish.js';

const tabs=['패키지','카테고리','사건','관계','주체','공간','사건_패키지','사건_카테고리','사건_주체','사건_공간','카테고리_공간','주체_공간'];
const rows=([headers,...values])=>values.filter(r=>r[0]).map(r=>Object.fromEntries(headers.map((k,i)=>[k,r[i]||''])));
export function catalogTables(tables){
 const actors=rows(tables.주체).map(r=>actorRecord({id:r.주체ID,title:r.주체명,kind:r.구분,body:r.소개,originalName:r.원어명,start:r['존속 시작일'],end:r['존속 종료일'],source:r.출처,local:r.작성상태==='게시됨'}));
 const index=list=>Object.fromEntries(list.map(r=>[r.id,r]));
 const catalog={event:index(rows(tables.사건).map(eventRecord)),place:index(rows(tables.공간).map(spaceRecord)),actor:index(actors)};
 for(const r of rows(tables.사건_공간))catalog.event[r.사건ID]?.place.push(r.공간ID);
 for(const r of rows(tables.사건_주체))catalog.event[r.사건ID]?.actor.push({id:r.주체ID,role:r.역할});
 for(const r of rows(tables.주체_공간))catalog.actor[r.주체ID]?.place.push(r.공간ID);
 return catalog;
}
export async function fetchStudioCatalog(){
 const tables=Object.fromEntries(await Promise.all(tabs.map(async tab=>{
  const csv=await SheetData.sheetCSV(SHEET_CONFIG,tab),table=SheetData.parseCSV(csv,true);
  if(!table[0]?.some(c=>c.endsWith('ID')))throw Error(tab+' 탭을 읽지 못했습니다.');
  return [tab,table];
 })));
 return studioCatalog(tables);
}
export function studioCatalog(source){
 const tables=Object.fromEntries(tabs.map(tab=>{
  const [head,...data]=source[tab],status=head.indexOf('작성상태');
  return [tab,[head,...data.filter(row=>row[0]&&row[status]!=='작성 중')]];
 }));
 return {catalog:catalogTables(tables),editions:rows(tables.패키지).map(r=>({id:r.패키지ID,name:r.패키지명,course:r.과목})),open:id=>publicEdition(tables,id)};
}
