// Refresh only the catalogue's read-only copy. Keep source row numbers for citations.
import {readFile, writeFile, rename, readdir} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {gunzipSync} from 'node:zlib';
import {geoIdentity,geoPath} from 'd3-geo';
import {countryFlag} from '../../assets/country-flag.js';
const configFile = new URL('../../sheet-config.js', import.meta.url);
const sheetsFile = new URL('../../sheets.js', import.meta.url);
const config = runInNewContext(await readFile(configFile, 'utf8') + '\nSHEET_CONFIG');
const context = {};
runInNewContext(await readFile(sheetsFile, 'utf8'), context);
const parseCSV = context.SheetData.parseCSV;
const tables = {};
const pending = Object.entries(config.sheetIds);
const names = pending.map(([name])=>name);
async function readTables() {
  while (pending.length) {
    const [name,gid] = pending.shift();
    const url = new URL('https://docs.google.com/spreadsheets/d/' + config.id + '/export');
    url.search = new URLSearchParams({format:'csv',gid});
    const response = await fetch(url, {signal:AbortSignal.timeout(45000)});
    if (!response.ok || !response.headers.get('content-type')?.includes('csv')) throw Error('시트 읽기 실패 · ' + name);
    const [header,...rows] = parseCSV(await response.text(), true);
    if (name==='공간' && header[0]==='ㅇ') header[0]='공간ID';
    const columns=header.map((h,i)=>[h.trim(),i]).filter(([h])=>h);
    const status=header.indexOf('작성상태');
    tables[name]={gid,fields:columns.map(([h])=>h),rows:rows.flatMap((row,i)=>
      row.some(Boolean) && row[status]!=='작성 중' ? [[i+2,...columns.map(([,j])=>row[j]??'')]] : [])};
    console.log(name,tables[name].rows.length);
  }
}
const target = new URL('./sheet-data.js',import.meta.url);
let readAt;
if(process.argv.includes('--use-snapshot')){
  const snapshot=runInNewContext(await readFile(target,'utf8')+'\ncatalogSnapshot');
  if(snapshot.id!==config.id)throw Error('시트 ID 불일치');
  Object.assign(tables,snapshot.tables);readAt=snapshot.readAt;
}else{
  await Promise.all(Array.from({length:4},readTables));
  readAt=new Date().toISOString();
}
// These map features come from the files registered in the shape rows. Include the
// coordinates here so the same interactive catalogue works when opened from Finder.
const shapeTable=tables.지도도형;
const column=name=>1+shapeTable.fields.indexOf(name);
const shapeFiles=Object.fromEntries(shapeTable.rows.map(row=>[row[column('지도참조키')],row[column('파일경로')]]));
async function geometry(key) {
  const file=shapeFiles[key];
  if (!file?.startsWith('assets/event-geometry/') || file.includes('..')) throw Error('등록 도형을 확인하세요: '+key);
  return JSON.parse(await readFile(new URL('../../'+file,import.meta.url),'utf8'));
}
const pointFeatures=(await geometry('geo_berlin')).features;
const points=Object.fromEntries(pointFeatures.filter(f=>f.geometry?.type==='Point'&&shapeFiles[f.id]===shapeFiles.geo_berlin).map(f=>[f.id,f.geometry.coordinates]));
const wall=(await geometry('geo_berlin_wall')).geometry;
if(wall.type!=='MultiLineString')throw Error('베를린 장벽의 선 도형을 확인하세요.');
function tableRows(name){
  const {fields,rows}=tables[name];
  return rows.map(([, ...cells])=>Object.fromEntries(fields.map((field,i)=>[field,cells[i]])));
}
const countryFlags={};
const dates=[...new Set(tableRows('사건').map(event=>event.날짜).filter(Boolean))].sort();
for(const actor of tableRows('주체').filter(a=>a.구분==='state'||a.구분==='territory')){
  const changes=[];
  for(const day of dates){
    const flag=countryFlag({actor_id:actor.주체ID,iso3:actor.국가코드},day)||null;
    if(JSON.stringify(flag)!==JSON.stringify(changes.at(-1)?.[1]??null))changes.push([day,flag]);
  }
  if(changes.length)countryFlags[actor.주체ID]=changes;
}
const spaceKeys=new Set(tableRows('공간').map(s=>s.지도참조키));
// Common map coordinates are longitude and negative latitude, also used by the registered SVGs.
const geographicPath=geoPath(geoIdentity().reflectY(true)).digits(5);
const mapShapes={geo_berlin_wall:geographicPath(wall)};
// Render the registered feature within each shared file, preserving polygon holes and islands.
const geometryFiles=new Map();
for(const row of shapeTable.rows){
  const value=f=>row[column(f)];
  if(!spaceKeys.has(value('지도참조키'))||value('데이터형식')!=='geojson'||value('도형유형')==='point'||value('지도참조키')==='geo_berlin_wall')continue;
  const file=value('파일경로'),url=value('지도데이터URL');
  let doc;
  if(file?.startsWith('assets/event-geometry/')&&file.endsWith('.geojson')&&!file.includes('..')){
    if(!geometryFiles.has(file))geometryFiles.set(file,await geometry(value('지도참조키')));
    doc=geometryFiles.get(file);
  }else if(url.startsWith('data:application/')&&url.includes(';base64,'))doc=JSON.parse(Buffer.from(url.split(',')[1],'base64').toString());
  if(!doc)continue;
  const feature=doc.type==='FeatureCollection'?doc.features.find(f=>String(f.id)===value('외부도형ID')):doc;
  if(!feature)continue;
  mapShapes[value('지도참조키')]=geographicPath(feature);
}
const contextDir=new URL('../../assets/event-geometry/context/',import.meta.url);
const backgrounds=[];
for(const file of (await readdir(contextDir)).filter(f=>f.endsWith('.json')).sort()){
  const data=JSON.parse(await readFile(new URL(file,contextDir),'utf8'));
  if(!data.box||!data.land||file==='gyeongin.json')continue;
  const region=file.slice(0,-5);
  backgrounds.push({region,box:data.box,land:data.land,lakes:data.lakes,rivers:data.rivers,cityBoundary:data.cityBoundary});
  const ref='geo_'+region.replaceAll('-','_');
  if(spaceKeys.has(ref)&&data.date&&!mapShapes[ref]){
    // Country records have selected polygons. The regional reference map shows its countries together.
    mapShapes[ref]=(data.selected||data.countries||[]).join('');
  }
}
const {globe}=JSON.parse(await readFile(new URL('../../assets/history-map/bases.json',import.meta.url),'utf8'));
const atlasBorders=JSON.parse(gunzipSync(await readFile(new URL('../../assets/history-map/boundaries.json.gz',import.meta.url))));
// The editor stores Natural Earth's admin-0 lines in Mercator degrees; the catalogue uses negative latitude.
const countryBorders=atlasBorders.countries.replace(/(-?[\d.]+),(-?[\d.]+)/g,(_,lon,y)=>
  lon+','+(Math.atan(Math.sinh(Number(y)*Math.PI/180))*180/Math.PI).toFixed(4));
const top=Math.log(Math.tan(Math.PI/4+globe.bbox[3]*Math.PI/360))*180/Math.PI;
const worldLand=globe.land.replace(/(-?[\d.]+),(-?[\d.]+)/g,(_,x,y)=>{
  const lat=Math.atan(Math.sinh((top-Number(y))*Math.PI/180))*180/Math.PI;
  return (globe.bbox[0]+Number(x)).toFixed(3)+','+(-lat).toFixed(3);
});
backgrounds.sort((a,b)=>a.box[2]*a.box[3]-b.box[2]*b.box[3]);
backgrounds.push({region:'world',box:[-180,-90,360,180],land:worldLand});
const mapLayers={};
for(const shape of tableRows('지도도형').filter(s=>spaceKeys.has(s.지도참조키)&&s.도형유형!=='point')){
  const ref=shape.지도참조키;
  let path=mapShapes[ref],fromContext=!shape.파일경로&&!shape.지도데이터URL;
  if(!path&&shape.지도데이터URL.startsWith('data:image/svg+xml;base64,')){
    const svg=Buffer.from(shape.지도데이터URL.split(',')[1],'base64').toString();
    const geographic=svg.includes('x=경도, y=−위도')||/^assets\/event-geometry\/world-\d{4}\.svg$/.test(shape.파일경로);
    if(geographic&&!svg.includes('transform='))path=[...svg.matchAll(/<path\b[^>]*?\sd="([^"]+)"/g)].map(m=>m[1]).join('');
  }
  if(!path)continue;
  // These registered paths use absolute move/line pairs and closed rings.
  if(/[^MLZ\d.,\s+\-]/i.test(path))throw Error('경위도 경로 형식 확인: '+ref);
  const coords=[...path.matchAll(/(-?[\d.]+)[,\s]+(-?[\d.]+)/g)].map(m=>[Number(m[1]),Number(m[2])]);
  const xs=coords.map(p=>p[0]),ys=coords.map(p=>p[1]);
  const bounds=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
  mapLayers[ref]={path,bounds,kind:shape.도형유형,fromContext};
}
if(process.argv.includes('--basemap')){
  await writeFile(new URL('reader-basemap.json',contextDir),JSON.stringify({backgrounds,countryBorders}));
}
const result={points,wall:wall.coordinates,countryFlags,countryBorders,mapLayers,backgrounds,id:config.id,readAt,tables:Object.fromEntries(names.map(k=>[k,tables[k]]))};
const temp = new URL('./sheet-data.tmp',import.meta.url);
await writeFile(temp,'const catalogSnapshot = '+JSON.stringify(result)+';\n');
await rename(temp,target);
