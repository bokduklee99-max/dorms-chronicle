// Excel (.xlsx) template and import for the package studio.
// No external library: a small zip writer/reader plus a minimal sheet parser.

const encoder=new TextEncoder(),decoder=new TextDecoder();
const maxRows=2000;

/* ---------- zip ---------- */
const crcTable=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
export function zipStore(files){
 const parts=[],central=[];let offset=0;
 for(const [name,text] of Object.entries(files)){
  const nameBytes=encoder.encode(name),data=typeof text==='string'?encoder.encode(text):text,crc=crc32(data);
  const local=new DataView(new ArrayBuffer(30));
  local.setUint32(0,0x04034b50,true);local.setUint16(4,20,true);local.setUint16(6,0x0800,true);local.setUint16(8,0,true);
  local.setUint16(10,0,true);local.setUint16(12,0x21,true);local.setUint32(14,crc,true);local.setUint32(18,data.length,true);local.setUint32(22,data.length,true);
  local.setUint16(26,nameBytes.length,true);local.setUint16(28,0,true);
  parts.push(new Uint8Array(local.buffer),nameBytes,data);
  const head=new DataView(new ArrayBuffer(46));
  head.setUint32(0,0x02014b50,true);head.setUint16(4,20,true);head.setUint16(6,20,true);head.setUint16(8,0x0800,true);head.setUint16(10,0,true);
  head.setUint16(12,0,true);head.setUint16(14,0x21,true);head.setUint32(16,crc,true);head.setUint32(20,data.length,true);head.setUint32(24,data.length,true);
  head.setUint16(28,nameBytes.length,true);head.setUint32(42,offset,true);
  central.push(new Uint8Array(head.buffer),nameBytes);
  offset+=30+nameBytes.length+data.length;
 }
 const size=central.reduce((n,p)=>n+p.length,0),end=new DataView(new ArrayBuffer(22));
 end.setUint32(0,0x06054b50,true);end.setUint16(8,Object.keys(files).length,true);end.setUint16(10,Object.keys(files).length,true);
 end.setUint32(12,size,true);end.setUint32(16,offset,true);
 return new Blob([...parts,...central,new Uint8Array(end.buffer)]);
}
async function inflate(bytes){
 const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
 return new Uint8Array(await new Response(stream).arrayBuffer());
}
export async function unzip(buffer){
 const bytes=new Uint8Array(buffer),view=new DataView(buffer);
 let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0)throw Error('엑셀(.xlsx) 파일이 아닙니다. 템플릿을 내려받아 사용해 주세요.');
 const count=view.getUint16(end+10,true);let at=view.getUint32(end+16,true);const files={};
 for(let i=0;i<count;i++){
  if(view.getUint32(at,true)!==0x02014b50)throw Error('엑셀 파일을 읽지 못했습니다.');
  const method=view.getUint16(at+10,true),size=view.getUint32(at+20,true),nameLength=view.getUint16(at+28,true),extra=view.getUint16(at+30,true),comment=view.getUint16(at+32,true),local=view.getUint32(at+42,true);
  const name=decoder.decode(bytes.subarray(at+46,at+46+nameLength));
  const start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true),data=bytes.subarray(start,start+size);
  files[name]=method===0?data:method===8?await inflate(data):null;
  if(files[name]===null)throw Error('지원하지 않는 압축 방식의 파일입니다.');
  at+=46+nameLength+extra+comment;
 }
 return files;
}

/* ---------- xlsx write ---------- */
const xmlEscape=v=>String(v??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const columnName=i=>{let n=i+1,s='';while(n){s=String.fromCharCode(65+(n-1)%26)+s;n=Math.floor((n-1)/26);}return s;};
// sheet: {name, columns:[{title,width,text,list}], rows:[[...]], notes:true}
function sheetXml(sheet){
 const columns=sheet.columns||[],last=Math.max(columns.length,...sheet.rows.map(r=>r.length),1);
 const cols=columns.map((c,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+(c.width||18)+'" customWidth="1"'+(c.text?' style="2"':'')+'/>').join('');
 const cell=(r,c,value,style)=>'<c r="'+columnName(c)+(r+1)+'" t="inlineStr"'+(style?' s="'+style+'"':'')+'><is><t xml:space="preserve">'+xmlEscape(value)+'</t></is></c>';
 const lines=[];
 if(columns.length)lines.push('<row r="1">'+columns.map((c,i)=>cell(0,i,c.title,1)).join('')+'</row>');
 const offset=columns.length?1:0;
 sheet.rows.forEach((row,r)=>{lines.push('<row r="'+(r+1+offset)+'">'+row.map((v,c)=>v===''||v==null?'':cell(r+offset,c,v,sheet.wrap?3:columns[c]?.text?2:0)).join('')+'</row>');});
 const validations=columns.map((c,i)=>c.list?'<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="'+columnName(i)+'2:'+columnName(i)+'500"><formula1>"'+xmlEscape(c.list.join(','))+'"</formula1></dataValidation>':'').join('');
 return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
  (columns.length?'<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>':'')+
  (cols?'<cols>'+cols+'</cols>':'')+'<sheetData>'+lines.join('')+'</sheetData>'+
  (validations?'<dataValidations count="'+columns.filter(c=>c.list).length+'">'+validations+'</dataValidations>':'')+'</worksheet>';
}
export function buildWorkbook(sheets){
 const files={
  '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+
   sheets.map((_,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>',
  '_rels/.rels':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+
   sheets.map((s,i)=>'<sheet name="'+xmlEscape(s.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>',
  'xl/_rels/workbook.xml.rels':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+
   sheets.map((_,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+
   '<Relationship Id="rId'+(sheets.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  'xl/styles.xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Malgun Gothic"/></font><font><b/><sz val="11"/><name val="Malgun Gothic"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF5"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'
 };
 sheets.forEach((s,i)=>{files['xl/worksheets/sheet'+(i+1)+'.xml']=sheetXml(s);});
 return zipStore(files);
}

/* ---------- xlsx read ---------- */
const xmlUnescape=v=>v.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,e)=>{
 if(e[0]==='#')return String.fromCodePoint(e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):Number(e.slice(1)));
 return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[e.toLowerCase()];
});
const attrs=tag=>Object.fromEntries([...tag.matchAll(/([\w:]+)="([^"]*)"/g)].map(m=>[m[1],xmlUnescape(m[2])]));
const textOf=xml=>[...xml.replace(/<rPh[\s\S]*?<\/rPh>/g,'').matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m=>xmlUnescape(m[1])).join('');
const columnIndex=ref=>{let n=0;for(const ch of /^[A-Z]+/i.exec(ref)?.[0]||'A')n=n*26+ch.toUpperCase().charCodeAt(0)-64;return n-1;};
function sheetRows(xml,strings){
 const rows=[];
 for(const rowMatch of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)){
  const row=[],body=rowMatch[1]||'';let seq=0;
  for(const c of body.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
   const a=attrs(c[1]),at=a.r?columnIndex(a.r):seq;seq=at+1;
   const inner=c[2]||'',v=/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
   let value='';
   if(a.t==='s')value=strings[Number(v)]??'';
   else if(a.t==='inlineStr')value=textOf(inner);
   else if(v!==undefined)value=xmlUnescape(v);
   row[at]=value;
  }
  const number=Number(attrs(/<row\b([^>]*)/.exec(rowMatch[0])[1]).r);
  rows[(Number.isInteger(number)?number:rows.length+1)-1]=row;
 }
 return Array.from(rows,r=>r?Array.from(r,v=>v??''):[]);
}
export async function readWorkbook(buffer){
 const files=await unzip(buffer),text=name=>files[name]?decoder.decode(files[name]):'';
 const workbook=text('xl/workbook.xml');
 if(!workbook)throw Error('엑셀(.xlsx) 파일이 아닙니다. 템플릿을 내려받아 사용해 주세요.');
 const rels=Object.fromEntries([...text('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)].map(m=>{const a=attrs(m[0]);return [a.Id,a.Target];}));
 const strings=[...text('xl/sharedStrings.xml').matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g)].map(m=>textOf(m[1]||''));
 const result={};
 for(const m of workbook.matchAll(/<sheet\b[^>]*>/g)){
  const a=attrs(m[0]),target=rels[a['r:id']];if(!target)continue;
  const path=target.startsWith('/')?target.slice(1):'xl/'+target;
  result[a.name]=sheetRows(text(path),strings);
 }
 return result;
}

/* ---------- template ---------- */
export const templateColumns={
 events:['사건명','날짜','종료일','내용','중요도','유형','카테고리','행위주체','공간','이미지 주소','출처'],
 categories:['카테고리명','종류','시작일','종료일','설명'],
 relations:['출발 사건명','도착 사건명','관계유형','설명','출처']
};
export function buildTemplate(labels,catalog={}){
 const list=o=>Object.values(o),exampleMark='(예시)';
 const guide=[
  ['패키지 제작실 엑셀 템플릿 사용법'],
  [''],
  ['1. 사건·카테고리·관계 시트에 한 줄에 하나씩 입력합니다. 첫 줄(제목 줄)은 바꾸지 마세요.'],
  ['2. 이름으로 연결합니다. 사건의 "카테고리" 칸에는 카테고리 시트에 적은 이름을, 관계 시트에는 사건 시트의 사건명을 그대로 적습니다.'],
  ['3. 여러 개는 쉼표(,)로 구분합니다. 예) 카테고리: 냉전의 군사화, 1950년대'],
  ['4. 행위주체는 "이름(역할)" 형식입니다. 예) 미국(주도자), 소련(대립 상대방). 이름은 "주체목록" 시트에 있는 이름과 같아야 연결됩니다.'],
  ['5. 공간은 "공간목록" 시트의 이름을 씁니다. 목록에 없는 주체·공간은 연결되지 않고 올리기 전 안내에 표시됩니다.'],
  ['6. 날짜는 1950, 1950-06, 1950-06-25 중 하나로 씁니다. 날짜 칸은 글자 형식이라 하이픈이 날짜로 바뀌지 않습니다.'],
  ['7. 첫 칸이 "'+exampleMark+'"로 시작하는 줄은 예시라서 올려도 무시됩니다. 지우지 않아도 됩니다.'],
  ['8. 엑셀 올리기는 현재 초안에 더하기만 합니다. 기존 사건·카테고리를 지우거나 덮어쓰지 않으며, 같은 사건명·날짜가 이미 있으면 건너뜁니다.'],
  [''],
  ['선택할 수 있는 값'],
  ['중요도: '+list(labels.importance).join(' / ')],
  ['유형: '+list(labels.types).join(' / ')],
  ['카테고리 종류: '+list(labels.cats).join(' / ')],
  ['행위주체 역할: '+list(labels.roles).join(' / ')],
  ['관계유형: '+list(labels.rels).join(' / ')]
 ];
 const sheets=[
  {name:'안내',columns:[{title:guide[0][0],width:130}],rows:guide.slice(1),wrap:true},
  {name:'사건',columns:templateColumns.events.map((title,i)=>({title,width:[26,12,12,40,14,14,28,30,20,30,20][i],text:i===1||i===2,list:i===4?list(labels.importance):i===5?list(labels.types):null})),
   rows:[[exampleMark+' 6·25 전쟁 발발','1950-06-25','1953-07-27','북한의 남침으로 시작된 전쟁','핵심·전환점','사건','냉전의 군사화','미국(주도자), 소련(대립 상대방)','한반도','','']]},
  {name:'카테고리',columns:templateColumns.categories.map((title,i)=>({title,width:[24,12,12,12,40][i],text:i===2||i===3,list:i===1?list(labels.cats):null})),
   rows:[[exampleMark+' 냉전의 군사화','사건군','1947','1953','군사 동맹과 전쟁으로 대립이 커진 흐름']]},
  {name:'관계',columns:templateColumns.relations.map((title,i)=>({title,width:[26,26,16,40,20][i],list:i===2?list(labels.rels):null})),
   rows:[[exampleMark+' 6·25 전쟁 발발','정전 협정','원인·계기','','']]}
 ];
 const actorNames=Object.values(catalog.actor||{}).map(a=>[a.name,labels.actors?.[a.kind]||a.kind,a.original||'']);
 const placeNames=Object.values(catalog.place||{}).map(p=>[p.name,labels.places?.[p.kind]||p.kind,p.alias||'']);
 if(actorNames.length)sheets.push({name:'주체목록',columns:[{title:'이름',width:28},{title:'구분',width:16},{title:'원어명',width:28}],rows:actorNames});
 if(placeNames.length)sheets.push({name:'공간목록',columns:[{title:'이름',width:28},{title:'유형',width:16},{title:'시대별 명칭',width:28}],rows:placeNames});
 return buildWorkbook(sheets);
}

/* ---------- import ---------- */
const norm=s=>String(s??'').normalize('NFKC').replace(/\s+/g,'').toLocaleLowerCase();
const split=value=>String(value??'').split(/[,，;；\n]/).map(s=>s.trim()).filter(Boolean);
export function excelDate(value){
 const raw=String(value??'').trim();
 if(/^\d{5}(\.\d+)?$/.test(raw)){
  const serial=Math.floor(Number(raw));
  if(serial>=10000&&serial<=100000)return new Date(Date.UTC(1899,11,30)+serial*86400000).toISOString().slice(0,10);
 }
 const compact=/^(\d{4})(\d{2})(\d{2})?$/.exec(raw);
 return compact?compact.slice(1).filter(Boolean).join('-'):raw;
}
function pick(options,value){
 const v=String(value??'').trim();if(!v)return {code:''};
 const code=Object.keys(options).find(k=>k===v||norm(options[k])===norm(v));
 return code?{code}:{code:'',bad:v};
}
function table(rows,required){
 const [head=[],...body]=rows||[];
 const index=Object.fromEntries(head.map((h,i)=>[norm(h),i]));
 if(!rows||!(norm(required) in index))return null;
 const col=name=>index[norm(name)];
 return body.map((r,i)=>({row:i+2,get:name=>String(r[col(name)]??'').trim()})).filter(r=>[...head].some((_,i)=>String(rows[r.row-1]?.[i]??'').trim()));
}
// ctx: {labels:{importance,types,cats,roles,rels}, categories:[{id,name,kind}], events:[{id,title,date}], relations:[...], actors:name=>[ids], places:name=>[ids], uid, validDate}
export function parseImport(workbook,ctx){
 const warnings=[],plan={events:[],categories:[],relations:[],warnings,links:0,newCategoryLinks:0};
 const marked=t=>t.startsWith('(예시)');
 const events=table(workbook['사건'],'사건명','사건');
 if(!events&&workbook['사건'])throw Error("'사건' 시트의 제목 줄에 '사건명' 칸이 있어야 합니다. 템플릿의 제목 줄을 바꾸지 마세요.");
 if(!events&&!workbook['카테고리']&&!workbook['관계'])throw Error('사건·카테고리·관계 시트를 찾지 못했습니다. 템플릿을 내려받아 사용해 주세요.');
 for(const [name,list] of [['사건',events],['카테고리',table(workbook['카테고리'],'카테고리명','카테고리')],['관계',table(workbook['관계'],'출발 사건명','관계')]])
  if(list&&list.length>maxRows)throw Error(name+' 시트가 '+maxRows+'줄을 넘습니다. 나누어 올려 주세요.');
 const existingCategory=new Map(ctx.categories.map(c=>[norm(c.name),c]));
 const categoryByName=new Map(existingCategory);
 for(const r of table(workbook['카테고리'],'카테고리명','카테고리')||[]){
  const name=r.get('카테고리명');if(!name||marked(name))continue;
  const where='카테고리 '+r.row+'행 ‘'+name+'’';
  if(categoryByName.has(norm(name))){warnings.push(where+': 이미 있는 카테고리라 건너뜁니다.');continue;}
  const kind=pick(ctx.labels.cats,r.get('종류'));
  if(!kind.code){warnings.push(where+': 종류('+Object.values(ctx.labels.cats).join('·')+')를 확인해 건너뜁니다.');continue;}
  const item={id:ctx.uid(),name,kind:kind.code,start:excelDate(r.get('시작일')),end:excelDate(r.get('종료일')),body:r.get('설명'),place:[]};
  for(const key of ['start','end'])if(item[key]&&!ctx.validDate(item[key]))warnings.push(where+': '+(key==='start'?'시작일':'종료일')+' 형식을 확인해 주세요('+item[key]+').');
  plan.categories.push(item);categoryByName.set(norm(name),item);
 }
 const titles=new Map(ctx.events.map(e=>[norm(e.title),e.id]));
 const seen=new Set(ctx.events.map(e=>norm(e.title)+'|'+e.date));
 for(const r of events||[]){
  const title=r.get('사건명');if(!title||marked(title))continue;
  const where='사건 '+r.row+'행 ‘'+title+'’';
  const date=excelDate(r.get('날짜')),end=excelDate(r.get('종료일'));
  if(seen.has(norm(title)+'|'+date)){warnings.push(where+': 같은 사건명·날짜가 이미 있어 건너뜁니다.');continue;}
  seen.add(norm(title)+'|'+date);
  const event={id:ctx.uid(),title,date,end,body:r.get('내용'),image:r.get('이미지 주소').split(/[\s,]+/).filter(Boolean).join('\n'),source:r.get('출처'),importance:'',type:'',actor:[],place:[],categoryIds:[]};
  if(!date)warnings.push(where+': 날짜가 없습니다. 올린 뒤 입력해야 업로드할 수 있습니다.');
  for(const [key,text] of [['date','날짜'],['end','종료일']])if(event[key]&&!ctx.validDate(event[key]))warnings.push(where+': '+text+' 형식을 확인해 주세요('+event[key]+').');
  for(const [key,options,text] of [['importance',ctx.labels.importance,'중요도'],['type',ctx.labels.types,'유형']]){
   const got=pick(options,r.get(text));event[key]=got.code;
   if(got.bad)warnings.push(where+': '+text+' ‘'+got.bad+'’을 비워 둡니다. 선택값을 확인해 주세요.');
  }
  for(const name of split(r.get('카테고리'))){
   const found=categoryByName.get(norm(name));
   if(found)event.categoryIds.push(found.id);else warnings.push(where+': 카테고리 ‘'+name+'’가 없어 연결하지 않았습니다.');
  }
  for(const item of split(r.get('행위주체'))){
   const m=/^(.*?)\s*\(([^()]*)\)$/.exec(item);let name=item,role='';
   let ids=ctx.actors(item);
   if(!ids.length&&m){const got=pick(ctx.labels.roles,m[2]);if(!got.bad){name=m[1];role=got.code;ids=ctx.actors(name);}}
   if(!ids.length){warnings.push(where+': 주체 ‘'+name+'’를 목록에서 찾지 못해 연결하지 않았습니다.');continue;}
   if(ids.length>1)warnings.push(where+': 주체 ‘'+name+'’와 같은 이름이 '+ids.length+'개라 첫 번째에 연결했습니다.');
   if(!event.actor.some(a=>a.id===ids[0]))event.actor.push({id:ids[0],role});
  }
  for(const name of split(r.get('공간'))){
   const ids=ctx.places(name);
   if(!ids.length){warnings.push(where+': 공간 ‘'+name+'’를 목록에서 찾지 못해 연결하지 않았습니다.');continue;}
   if(ids.length>1)warnings.push(where+': 공간 ‘'+name+'’와 같은 이름이 '+ids.length+'개라 첫 번째에 연결했습니다.');
   if(!event.place.includes(ids[0]))event.place.push(ids[0]);
  }
  plan.events.push(event);titles.set(norm(title),event.id);
 }
 const known=new Set(ctx.relations.map(x=>[x.fromId,x.toId,x.kind].join('|')));
 for(const r of table(workbook['관계'],'출발 사건명','관계')||[]){
  const from=r.get('출발 사건명'),to=r.get('도착 사건명');if(!from||marked(from))continue;
  const where='관계 '+r.row+'행 ‘'+from+' → '+to+'’';
  const fromId=titles.get(norm(from)),toId=titles.get(norm(to));
  if(!fromId||!toId){warnings.push(where+': 사건 시트에 없는 사건명이 있어 건너뜁니다.');continue;}
  if(fromId===toId){warnings.push(where+': 같은 사건끼리는 연결할 수 없어 건너뜁니다.');continue;}
  const kind=pick(ctx.labels.rels,r.get('관계유형'));
  if(!kind.code){warnings.push(where+': 관계유형('+Object.values(ctx.labels.rels).join('·')+')을 확인해 건너뜁니다.');continue;}
  const key=[fromId,toId,kind.code].join('|');
  if(known.has(key)){warnings.push(where+': 같은 관계가 이미 있어 건너뜁니다.');continue;}
  known.add(key);
  plan.relations.push({id:ctx.uid(),fromType:'event',fromId,toType:'event',toId,kind:kind.code,label:r.get('설명'),source:r.get('출처')});
 }
 return plan;
}
