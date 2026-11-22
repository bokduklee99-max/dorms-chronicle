import {readLessonSheet} from '../assets/local-sheet-copy.js';
export type HistoryPackage = {id:string;name:string;schoolLevel?:string;subject?:string;description?:string};
export type PackageSheet = {id:string;packageSheetId:number;categorySheetId:number;sheetIds?:Record<string,number>};
export type CategoryMetadata = {packageId:string;type:string;startDate:string;endDate:string;mapKey?:string;viewId?:string;places?:string;spaceIds?:string[]};

export const fallbackPackages: HistoryPackage[] = [
 {id:'cold-war',name:'냉전',schoolLevel:'교양'},
 {id:'korean-history',name:'한국 근현대사',schoolLevel:'고등',subject:'한국사'},
];

export function parsePackages([header,...rows]:string[][]): HistoryPackage[] {
 const idColumn = header?.indexOf('패키지ID') ?? -1;
 const nameColumn = header?.indexOf('패키지명') ?? -1;
 if(idColumn<0||nameColumn<0)throw new Error('패키지 탭의 열을 확인하세요.');
 const ids = new Set<string>();
 return rows.filter(row=>row.some(cell=>cell.trim())&&row[header.indexOf('작성상태')]!=='작성 중').map(row=>{
  const id = row[idColumn]?.trim(),name = row[nameColumn]?.trim();
  if(!id||!name||ids.has(id))throw new Error('패키지ID와 이름을 확인하세요.');
  ids.add(id);
  const pkg: HistoryPackage = {id,name};
  for (const [key,label] of [['schoolLevel','학교급'],['subject','과목'],['description','설명']] as const) {
   const value = row[header.indexOf(label)]?.trim();
   if (value) pkg[key] = value;
  }
  return pkg;
 });
}

export async function fetchPackages(sheet:PackageSheet,parseCSV:(csv:string)=>string[][]): Promise<HistoryPackage[]> {
 const url = new URL(`https://docs.google.com/spreadsheets/d/${sheet.id}/gviz/tq`);
 url.search = new URLSearchParams({gid:String(sheet.packageSheetId),headers:'1',tqx:'out:csv'}).toString();
 const response = await readLessonSheet(url,{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error('패키지 시트를 읽지 못했습니다.');
 return parsePackages(parseCSV(await response.text()));
}

export function parseCategoryMetadata([header,...rows]:string[][], links?:string[][]):Map<string,CategoryMetadata> {
 const columns = ['카테고리ID','패키지ID','카테고리유형','시작일','종료일'].map(label=>header?.indexOf(label)??-1);
 if(columns.slice(0,2).includes(-1))throw new Error('카테고리 탭의 열을 확인하세요.');
 const metadata = new Map<string,CategoryMetadata>();
 for(const row of rows){
  if(row[header.indexOf('작성상태')]==='작성 중')continue;
  const [id,packageId,type,startDate,endDate] = columns.map(column=>row[column]?.trim()??'');
  if(!id||!packageId)continue;
  if(metadata.has(id))throw new Error('카테고리ID가 중복돼요.');
  const mapKey=row[header.indexOf('지도참조키')]?.trim();
  const viewId=row[header.indexOf('기본뷰ID')]?.trim();
  const places=row[header.indexOf('주공간')]?.trim();
  metadata.set(id,{packageId,type,startDate,endDate,...(mapKey?{mapKey}:{}),...(viewId?{viewId}:{}),...(places?{places}:{})});
 }
 if(links){
  const [head=[],...rows]=links;
  const category=head.indexOf('카테고리ID'),space=head.indexOf('공간ID');
  if(category<0||space<0)throw new Error('카테고리_공간 탭의 열을 확인하세요.');
  for(const row of rows){
   if(row[head.indexOf('작성상태')]==='작성 중')continue;
   const item=metadata.get(row[category]?.trim()),id=row[space]?.trim();
   if(!item||!id)continue;
   const ids=item.spaceIds??=[];
   if(!ids.includes(id))ids.push(id);
  }
 }
 return metadata;
}

export async function fetchCategoryMetadata(sheet:PackageSheet,parseCSV:(csv:string)=>string[][]) {
 const read=async(gid:number)=>{
  const url=new URL(`https://docs.google.com/spreadsheets/d/${sheet.id}/export`);
  url.search=new URLSearchParams({gid:String(gid),format:'csv'}).toString();
  const response=await readLessonSheet(url,{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('카테고리 시트를 읽지 못했습니다.');
  return parseCSV(await response.text());
 };
 const gid=sheet.sheetIds?.카테고리_공간;
 const [categories,links]=await Promise.all([read(sheet.categorySheetId),gid?read(gid):undefined]);
 return parseCategoryMetadata(categories,links);
}
