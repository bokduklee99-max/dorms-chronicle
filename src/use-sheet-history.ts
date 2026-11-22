import {localLesson} from '../assets/local-sheet-copy.js';
import {clearBrowserPackages} from '../assets/studio-library.js';
import {useEffect,useMemo,useState} from 'react';
import {koreanHistory} from './korean-history';
import {coldWarData,type HistoryData} from './metro-model';
import {fallbackPackages,fetchCategoryMetadata,fetchPackages,type CategoryMetadata,type HistoryPackage} from './package-catalog';
import {fetchEventTables,type SheetTables} from './package-content';

type SheetHistory = {
 packages:HistoryPackage[];
 tables:SheetTables;
 categoryMetadata:Map<string,CategoryMetadata>;
 pending:boolean;
 status:string;
};
const empty:HistoryData = {events:[],topics:[],actors:[],tenures:[]};

export function useSheetHistory(){
 const source = window.HistorySource;
 const [{packages,tables,categoryMetadata,pending,status},setHistory] = useState<SheetHistory>(()=>({
  packages:fallbackPackages,tables:source.tables,categoryMetadata:new Map(),pending:true,status:'저장된 시트 데이터'
 }));
 useEffect(()=>{
  try{clearBrowserPackages();}catch{}
  let cancelled = false;
  let reading=false;
  async function load(){
   if(reading)return;
   reading=true;
   try{
    const {config,SheetData} = source;
    const [catalog,events,categories] = await Promise.allSettled([
     fetchPackages(config,SheetData.parseCSV),fetchEventTables(config,SheetData),fetchCategoryMetadata(config,SheetData.parseCSV)
    ]);
    if(cancelled)return;
    setHistory(previous=>({
     packages:catalog.status==='fulfilled'?catalog.value:previous.packages,
     tables:events.status==='fulfilled'?events.value:previous.tables,
     categoryMetadata:categories.status==='fulfilled'?categories.value:previous.categoryMetadata,
     pending:false,
     status:events.status==='fulfilled'?'공개 시트 연결됨':'저장된 시트 데이터 · 연결 확인 필요'
    }));
   }finally{reading=false;}
  }
  void load();
  if(!localLesson)window.addEventListener('focus',load);
  return ()=>{cancelled=true;window.removeEventListener('focus',load);};
 },[source]);

 const samplePackageId=tables.categories.some(row=>Object.hasOwn(row,'package_id'))?null:'korean-history';
 const packageData = useMemo(()=>{
  const loaded = new Map<string,HistoryData>();
  if(samplePackageId)loaded.set(samplePackageId,koreanHistory(source.data.tenures));
  return (id:string)=>{
   let data = loaded.get(id);
   if(data)return data;
   const scoped = source.SheetData.scopePackage(id,tables);
   data = scoped.events.length?source.SheetData.build(scoped):empty;
   if(id==='cold-war')data=coldWarData(data);
   loaded.set(id,data);
   return data;
  };
 },[source,tables,samplePackageId]);

 return {packages,packageData,categoryMetadata,pending,status};
}
