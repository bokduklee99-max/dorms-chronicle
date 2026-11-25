import './record-place-map.js';
import './record-views.js';

const assetJsonCache = new Map();
async function loadLocalJson(relPath) {
  if (assetJsonCache.has(relPath)) return assetJsonCache.get(relPath);
  const pending = fetch(relPath).then(async res=>{
    if (!res.ok) throw new Error(`파일을 불러올 수 없습니다 (${res.status}): ${relPath}`);
    return res.json();
  }).catch(error=>{assetJsonCache.delete(relPath);throw error;});
  assetJsonCache.set(relPath,pending);
  return pending;
}

function geomBBox(geom) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  const walk = c => {
    if (typeof c[0] === 'number') {
      if (c[0] < w) w = c[0];
      if (c[0] > e) e = c[0];
      if (c[1] < s) s = c[1];
      if (c[1] > n) n = c[1];
    } else if (Array.isArray(c)) {
      c.forEach(walk);
    }
  };
  if (geom?.coordinates) walk(geom.coordinates);
  return [w, s, e, n];
}

function geoToSvgPath(geom, lonScale = 0.78) {
  const ringToD = (ring, close) => {
    if (!ring?.length) return '';
    const parts = ring.map(([lon, lat], i) => `${i === 0 ? 'M' : 'L'}${(lon * lonScale).toFixed(3)},${(-lat).toFixed(3)}`);
    return parts.join(' ') + (close ? ' Z' : '');
  };
  if (geom.type === 'Polygon') return geom.coordinates.map(r => ringToD(r, true)).join(' ');
  if (geom.type === 'MultiPolygon') return geom.coordinates.flatMap(poly => poly.map(r => ringToD(r, true))).join(' ');
  if (geom.type === 'LineString') return ringToD(geom.coordinates, false);
  if (geom.type === 'MultiLineString') return geom.coordinates.map(r => ringToD(r, false)).join(' ');
  return '';
}

const previewContextRegions = new Map([
  ['geo_middle_east', 'middle-east'], ['geo_south_asia', 'south-asia'],
  ['geo_israel', 'israel'], ['geo_afghanistan', 'afghanistan'],
  ['geo_iran', 'iran'], ['geo_india_pakistan', 'india-pakistan'],
]);
const previewTerritories = new Set([
  'geo_north_vietnam', 'geo_south_vietnam', 'geo_roc_taiwan', 'geo_nato_1949', 'geo_nato_1982',
]);
const localPreviewPath = /^(?:\.\/|\/)?assets\/event-geometry\//;


function mapPreviewSource(value) {
  if (!value) return null;
  if (/^data:image\/svg\+xml(?:;base64)?,/i.test(value)) return { url: value, image: true };
  if (/^data:application\/(?:geo\+json|json)(?:;base64)?,/i.test(value)) return { url: value, image: false };
  let url;
  try { url = new URL(value, location.origin + '/'); }
  catch { return null; }
  const local = url.origin === location.origin && localPreviewPath.test(value);
  if ((!local && url.protocol !== 'https:') || url.username || url.password) return null;
  if (url.pathname.endsWith('.svg')) return { url: url.href, image: true };
  if (url.pathname.endsWith('.geojson')) return { url: url.href, image: false };
  return null;
}

async function loadMapPreview(shape) {
  if(shape.도형유형==='point' && shape.경도 && shape.위도){
    const coordinates=[Number(shape.경도),Number(shape.위도)];
    if(coordinates.every(Number.isFinite)&&Math.abs(coordinates[0])<=180&&Math.abs(coordinates[1])<=90)
      return {feature:{geometry:{type:'Point',coordinates}}};
  }
  const file = shape['파일경로']?.trim() || '';
  const dataUrl = shape['지도데이터URL']?.trim() || '';
  const localFile = localPreviewPath.test(file);
  const sources = new Set([...(localFile ? [file, dataUrl] : [dataUrl, file]), shape['원본SVG']?.trim()]);
  const extId = shape['외부도형ID']?.trim();
  let failure;
  for (const value of sources) {
    const source = mapPreviewSource(value);
    if (!source) continue;
    try {
      if (source.image) {
        const text=await fetch(source.url).then(res=>res.ok?res.text():'').catch(()=>'');
        if(text.includes('x=경도, y=−위도') || (text && /world-\d{4}\.svg$/.test(source.url))){
          const svg=new DOMParser().parseFromString(text,'image/svg+xml');
          const path=svg.querySelector('[transform]')?'':[...svg.querySelectorAll('path[d]')].map(node=>node.getAttribute('d')).join(' ');
          const layer=layerFromPath(path,shape.도형유형);
          if(layer)return {layer};
        }
        if(value===file && dataUrl && dataUrl!==value && dataUrl.startsWith('data:image/svg+xml')){
          const registered=await loadMapPreview({...shape,파일경로:'',지도데이터URL:dataUrl});
          if(registered.layer)return registered;
        }
        const image = new Image();
        image.alt = shape['지도참조키'] + ' 지도';
        image.src = source.url;
        await image.decode();
        return { image };
      }
      const data = await loadLocalJson(source.url);
      const features = data.type === 'FeatureCollection' ? data.features : [data];
      const feature = source.url.startsWith('data:') && data.type !== 'FeatureCollection'
        ? (data.type === 'Feature' ? data : { geometry: data })
        : (extId ? features.find(f => String(f.id) === extId || String(f.properties?.id) === extId) : features[0]);
      if (!feature?.geometry) throw new Error('파일에 등록된 도형 ID를 찾을 수 없습니다.');
      return { feature };
    } catch (error) {
      failure = source.image ? new Error('등록된 SVG 이미지를 불러오지 못했습니다.') : error;
    }
  }

  const key = shape['지도참조키'];
  const region = previewContextRegions.get(key);
  if (region) {
    const context = await loadLocalJson('/assets/event-geometry/context/' + region + '.json');
    return { context };
  }
  if (previewTerritories.has(key)) {
    const { features } = await loadLocalJson('/assets/event-geometry/schema-preview-territories.geojson');
    const feature = features.find(item => item.id === key);
    if (feature) return { feature, date: feature.properties.date };
  }
  throw failure || new Error(file || dataUrl
    ? '등록된 주소에서 SVG 또는 GeoJSON 미리보기를 만들 수 없습니다.'
    : '이 지도참조키의 미리보기 자료가 등록되어 있지 않습니다.');
}


function layerFromPath(path,kind){
  if(!path || /[^MLZ\d.,\s+\-]/i.test(path))return null;
  const bounds=[Infinity,Infinity,-Infinity,-Infinity];
  for(const pair of path.matchAll(/(-?[\d.]+)[,\s]+(-?[\d.]+)/g)){
    const x=Number(pair[1]),y=Number(pair[2]);
    bounds[0]=Math.min(bounds[0],x);bounds[2]=Math.max(bounds[2],x);
    bounds[1]=Math.min(bounds[1],y);bounds[3]=Math.max(bounds[3],y);
  }
  return bounds.every(Number.isFinite)?{path,kind,bounds}:null;
}

// The background is cartography only. Read each overlay from its current sheet record.
export async function lessonAtlas(spaces,tables,{shape=false}={}){
  const background=await loadLocalJson('/assets/event-geometry/context/reader-basemap.json');
  const atlas={...background,points:{},mapLayers:{}},shapes=new Map(tables.지도도형.map(r=>[r.지도참조키,r]));
  const allSpaces=tables.공간.map(s=>({...s,tab:'공간'}));
  const rows={공간:allSpaces,지도도형:[...shapes.values()].map(s=>({...s,tab:'지도도형'}))};
  const key=r=>r?.공간ID||r?.지도참조키||'';
  const model=globalThis.createChronicleRecordViews(rows,{key,points:atlas.points,mapRenderer:()=>maps});
  const maps=globalThis.createChroniclePlaceMap(atlas,()=>model);
  const images=[],meta=[];
  const selected=new Set(spaces.map(s=>s.지도참조키));
  const register=async ref=>{
    const row=shapes.get(ref);if(!row)return;
    try{
      const result=await loadMapPreview(row),g=result.feature?.geometry;
      if(g?.type==='Point' && g.coordinates.slice(0,2).every(Number.isFinite)){
        atlas.points[ref]=g.coordinates;
        if(selected.has(ref))meta.push(['좌표',g.coordinates.map(x=>x.toFixed(4)+'°').join(', ')]);
      }else{
        let layer=result.layer;
        if(g){
          const [west,south,east,north]=geomBBox(g);
          if([west,south,east,north].every(Number.isFinite)){
            layer={bounds:[west,-north,east,-south],path:geoToSvgPath(g,1),kind:row.도형유형};
            if(shape)meta.push(['실제 지오메트리',g.type+(g.type==='MultiLineString'?' · '+g.coordinates.length+'개 선 구간':'')]);
          }
        }else if(result.context){
          layer=layerFromPath((result.context.selected?.length?result.context.selected:result.context.countries||[]).join(' '),row.도형유형);
          if(layer)layer.fromContext=true;
        }
        if(layer)atlas.mapLayers[ref]=layer;
        else if(result.image&&selected.has(ref))images.push(result.image);
        if(result.date||result.context?.date)meta.push(['국경 기준일',result.date||result.context.date]);
      }
    }catch{/* The record and its registered sources remain available for shapes without coordinates. */}
  };
  const refs=new Set(selected);
  if(shape && shapes.get(spaces[0]?.지도참조키)?.도형유형==='line'){
    const pointFile='assets/event-geometry/place-points.geojson';
    for(const row of shapes.values())if(row.도형유형==='point'&&row.파일경로===pointFile)refs.add(row.지도참조키);
  }
  await Promise.all(Array.from(refs,register));
  return {model,maps,images,meta,html:shape?'':maps.render(spaces,model.esc)};
}

export async function renderShapePreview(host,mapKey,tables){
  const sh=tables.지도도형.find(r=>r.지도참조키===mapKey);
  if(!sh)throw Error('지도도형 시트에서 해당 기록을 찾지 못했습니다.');
  const space=tables.공간.find(s=>s.지도참조키===mapKey)||
    {공간ID:mapKey,지도참조키:mapKey,공간명:mapKey,공간유형:sh.도형유형};
  if(!tables.공간.includes(space))tables={...tables,공간:[...tables.공간,space]};
  const {model,maps,images,meta}=await lessonAtlas([space],tables,{shape:true});
  if(!host.isConnected)return;
  const restoreFocus=host.contains(document.activeElement);
  host.innerHTML=model.mapView(space);
  if(restoreFocus)host.querySelector('.record-title').focus({preventScroll:true});
  maps.bind(host.querySelector('.places-atlas'));
  const facts=host.querySelector('.map-key');
  if(facts&&meta.length)facts.insertAdjacentHTML('beforeend',model.facts(meta));
  for(const image of images){image.className='registered-image';host.querySelector('.places-atlas').after(image);}
}
