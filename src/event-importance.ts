import {readLessonSheet} from '../assets/local-sheet-copy.js';
import type {SheetParser} from './package-content';

export type ImportanceRow={id:string;title:string;date:string;importance?:string};
export type SwimlaneSnapshotCategory={id:string;kind:string;name:string;start?:string;end?:string};

export async function swimlaneSnapshot<T extends ImportanceRow>(packageId:string):Promise<{events:T[];categories:SwimlaneSnapshotCategory[]}|null>{
 if(!['japan','cold-war'].includes(packageId))return null;
 const response=await fetch('/assets/swimlane-'+packageId+'.json');
 return response.ok?response.json():null;
}

export async function readEventImportance(config:{id:string},parser:SheetParser):Promise<ImportanceRow[]>{
 const rows=await parser.sheetRecords(config,'사건',['사건ID','날짜','사건명','중요도'],readLessonSheet);
 return rows.map(row=>({id:row.사건ID,date:row.날짜,title:row.사건명,importance:row.중요도}));
}
