import {readLessonSheet} from '../assets/local-sheet-copy.js';
import type {HistoryData} from './metro-model';
import {readMapViews} from './map-view.js';

export type SheetTables = Record<string,Record<string,string>[]>;
export type SheetParser = {
 parseCSV:(csv:string)=>string[][];
 dateRange:(value:string)=>{start:number;end:number};
 sheetRecords:(config:{id:string},name:string,fields:string[],request?:typeof fetch)=>Promise<Record<string,string>[]>;
 readPublishedTables:(rows:string[][],config:EventSheet,request:typeof fetch)=>Promise<SheetTables>;
 scopePackage:(id:string,tables:SheetTables)=>SheetTables;
 build:(tables:unknown)=>HistoryData;
 actorFilterOptions:(events:HistoryData['events'],actors:HistoryData['actors'])=>{groups:[string,HistoryData['actors']][];leans:string[]};
 filterActorEvents:(events:HistoryData['events'],actors:HistoryData['actors'],selection:string)=>HistoryData['events'];
};

type EventSheet = {id:string;eventSheetId:number;feedUrl:string};
export type GeographySheet = {id:string;spaceSheetId:number;eventSpaceSheetId:number;mapShapeSheetId:number;sheetIds?:Record<string,number>};
export type WorkspaceSpace = {id:string;name:string;parentId:string;type:string;alias:string;mapKey:string};

export function readWorkspaceGeography([spaceHeader,...spaceRows]:string[][],[linkHeader,...linkRows]:string[][]) {
 const spaceColumns = ['공간ID','공간명','상위공간ID','공간유형','시대별칭','지도참조키'].map(name=>spaceHeader?.indexOf(name)??-1);
 const linkColumns = ['사건ID','공간ID'].map(name=>linkHeader?.indexOf(name)??-1);
 if(spaceColumns.slice(0,4).some(index=>index<0)||linkColumns.some(index=>index<0))throw new Error('공간 시트의 열을 확인해 주세요.');

 const spaces = new Map<string,WorkspaceSpace>();
 for(const row of spaceRows){
  const [id,name,parentId,type,alias,mapKey] = spaceColumns.map(index=>row[index]?.trim()??'');
  if(!id||!name)continue;
  if(spaces.has(id))throw new Error('공간ID가 중복됐어요.');
  spaces.set(id,{id,name,parentId,type,alias,mapKey});
 }
 const directByEvent = new Map<string,Set<string>>();
 const byEvent = new Map<string,Set<string>>();
 const [eventColumn,spaceColumn] = linkColumns;
 for(const row of linkRows){
  const eventId = row[eventColumn]?.trim();
  const spaceId = row[spaceColumn]?.trim();
  if(!eventId||!spaceId||!spaces.has(spaceId))continue;
  const direct=directByEvent.get(eventId)??new Set<string>();
  direct.add(spaceId);
  directByEvent.set(eventId,direct);
  const ids = byEvent.get(eventId)??new Set<string>();
  let current = spaces.get(spaceId);
  while(current&&!ids.has(current.id)){
   ids.add(current.id);
   current = spaces.get(current.parentId);
  }
  byEvent.set(eventId,ids);
 }
 return {spaces:[...spaces.values()],byEvent,directByEvent};
}

export async function fetchWorkspaceGeography(config:GeographySheet,parseCSV:SheetParser['parseCSV']) {
 const rows = await Promise.all([config.spaceSheetId,config.eventSpaceSheetId].map(gid=>readMapSheet(config.id,gid,parseCSV)));
 return readWorkspaceGeography(rows[0],rows[1]);
}

async function readMapSheet(sheetId:string,gid:number,parseCSV:SheetParser['parseCSV']) {
  const url = new URL(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq`);
  url.search = new URLSearchParams({gid:String(gid),headers:'1',tqx:'out:csv'}).toString();
  const response = await readLessonSheet(url,{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('공개 공간 시트를 읽지 못했어요.');
  return parseCSV(await response.text());
}

export async function fetchMapShapes(config:GeographySheet,parseCSV:SheetParser['parseCSV']) {
 const [headers,...rows]=await readMapSheet(config.id,config.mapShapeSheetId,parseCSV);
 if(!headers?.includes('지도참조키')||!headers.includes('도형유형'))throw Error('지도도형 시트를 확인해 주세요.');
 return new Map(rows.map(row=>{
  const shape=Object.fromEntries(headers.map((name,index)=>[name,row[index]??'']));
  return [shape.지도참조키,shape] as const;
 }));
}

export async function fetchMapViews(config:GeographySheet,parseCSV:SheetParser['parseCSV']) {
 const gid=config.sheetIds?.지도뷰;
 return gid?readMapViews(await readMapSheet(config.id,gid,parseCSV)):readMapViews([]);
}

export async function fetchEventTables(config:EventSheet,parser:SheetParser): Promise<SheetTables> {
 const response = await readLessonSheet(config.feedUrl+'&v='+Math.floor(Date.now()/60000),{
  credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(10000)
 });
 if(!response.ok)throw new Error('공개 시트를 읽지 못했습니다.');
 const tables = await parser.readPublishedTables(parser.parseCSV(await response.text()),config,readLessonSheet);
 parser.build(tables);
 return tables;
}

