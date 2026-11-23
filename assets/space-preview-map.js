import {loadShape, shapePaths} from '../event-map-links.js';
import {svg, pathData} from './story-map.js';

function mapFrame(name, box, geographic) {
  const [x,y,width,height] = box;
  const pad = Math.max(width,height) * .14;
  const map = svg('svg',{viewBox:[x-pad,y-pad,width+2*pad,height+2*pad].join(' '),role:'img','aria-label':name+' 지도'});
  if (geographic) map.append(svg('use',{href:'/assets/swimlane-basemap.svg#land'}));
  return map;
}

const geometryDir = '/assets/event-geometry/';
const snapshots = [1914,1920,1930,1938,1945,1960,1994];

export function pointBackdrop(space, date = '') {
  const key = space.지도참조키;
  // Partial dates that straddle a boundary cannot identify the district edition.
  const first = date.length === 4 ? date+'-01-01' : date.length === 7 ? date+'-01' : date;
  const last = date.length === 4 ? date+'-12-31' : date.length === 7 ? date+'-31' : date;
  if (key === 'geo_seoul' && (!date || (first >= '1914-03-01' && last <= '1936-03-31'))) return 'gyeongseong';
  if (key === 'geo_incheon') return 'incheon-coast';
  if (['geo_korean_peninsula','geo_seoul','geo_incheon'].includes(space.상위공간ID) || key === 'geo_seoul') return 'peninsula';
  if (['geo_china_proper','geo_shanghai'].includes(space.상위공간ID) || key === 'geo_chongqing') {
    const year = date ? Number(date.slice(0,4)) : 1938;
    const edition = snapshots.findLast(value=>value <= year);
    return edition && year <= 1994 ? 'world-'+edition : 'china-land';
  }
  return '';
}

function layer(geometry, kind) {
  return svg('path',{d:pathData(shapePaths(geometry),kind !== 'line' && kind !== 'river'),class:'context-'+kind,'fill-rule':'evenodd','vector-effect':'non-scaling-stroke'});
}

async function asset(file) {
  const response = await fetch(geometryDir+file);
  if (!response.ok) throw Error('배경 지도를 읽지 못했습니다.');
  return file.endsWith('.svg') ? new DOMParser().parseFromString(await response.text(),'image/svg+xml') : response.json();
}

function cityLabel(map, name, lon, lat, size, selected) {
  map.append(svg('circle',{cx:lon,cy:-lat,r:size*(selected ? .46 : .28),class:selected ? 'space-map-point' : 'context-city'}));
  const label = svg('text',{x:lon+size*.65,y:-lat+size*.3,'font-size':size,class:'context-label'});
  label.textContent = name;
  map.append(label);
}

async function regionalPointMap(backdrop, name, lon, lat) {
  if (backdrop === 'incheon-coast') {
    const [land, cities] = await Promise.all([asset('seoul-land-1919-1926.geojson'), asset('place-points.geojson')]);
    const map = svg('svg',{viewBox:'126.28 -37.77 .92 .53',class:'incheon-coast',role:'img','aria-label':'인천과 서울 위치 지도'});
    map.append(layer(land.geometry,'land'));
    const seoul = cities.features.find(city => city.id === 'geo_seoul');
    if (seoul) cityLabel(map,seoul.properties.name,...seoul.geometry.coordinates,.032,false);
    cityLabel(map,name,lon,lat,.035,true);
    return [map,mapCredit('인천·서울 일대 · 국사편찬위원회 1919·1926년 복원 자료',koreaSource)];
  }
  const district = backdrop === 'gyeongseong';
  const peninsula = backdrop === 'peninsula';
  const box = district ? [lon-.14,-lat-.084,.28,.168] : peninsula ? [123,-43,9,10] : [72,-54,62,37];
  const map = svg('svg',{viewBox:box.join(' '),role:'img','aria-label':name+' 위치 지도'});
  let credit, source;
  if (district) {
    const files = ['seoul-land-1919-1926','seoul-admin-1919-1926','gyeongseong-1919'];
    const [land,admin,area] = await Promise.all(files.map(file=>asset(file+'.geojson')));
    map.append(layer(land.geometry,'land'),layer(admin.geometry,'line'),layer(area.geometry,'district'));
    credit = '경성부 · 국사편찬위원회 1919년 복원도';
    source = 'https://hgis.history.go.kr/pro_g1/dataset.do#tab05';
  } else if (peninsula) {
    const coast = await asset('korea-guide-1920.svg');
    map.append(svg('path',{d:coast.querySelector('path').getAttribute('d'),class:'context-land','fill-rule':'evenodd'}));
    credit = '한반도 해안선 · GSHHG';
    source = 'https://www.soest.hawaii.edu/wessel/gshhg/';
  } else {
    const [terrain,cities,borders] = await Promise.all([asset('east-asia-1938.geojson'),asset('place-points.geojson'),
      backdrop === 'china-land' ? null : asset(backdrop+'.svg')]);
    if (borders) {
      for (const path of borders.querySelectorAll('path')) {
        const country = svg('path',{d:path.getAttribute('d'),class:'context-country','fill-rule':'evenodd','vector-effect':'non-scaling-stroke'});
        map.append(country);
      }
    } else map.append(layer(terrain.features.find(f=>f.id === 'land').geometry,'land'));
    for (const river of terrain.features.filter(f=>f.id !== 'land')) map.append(layer(river.geometry,'river'));
    for (const city of cities.features.filter(f=>['geo_beijing','geo_shanghai'].includes(f.id) && f.properties.name !== name)) {
      cityLabel(map,city.properties.name,...city.geometry.coordinates,2,false);
    }
    credit = borders ? '중국 일대 · '+backdrop.slice(6)+'년 판도' : '중국 일대 · 해안선과 주요 하천';
    source = 'https://github.com/aourednik/historical-basemaps';
  }
  cityLabel(map,district ? '경성부 · 서울' : name,lon,lat,district ? .009 : peninsula ? .5 : 2.15,true);
  return [map,mapCredit(credit,source)];
}

// Each extent is in longitude / negative latitude, as in the registered SVGs.
const historyViews = {
  geo_pyongyang: {box:[125.65,-39.115,.245,.145], year:1920, korea:true, rivers:true},
  geo_korean_peninsula: {box:[123.3,-43.2,8.5,10.5], year:1920, korea:true, cities:['geo_pyongyang','geo_seoul']},
  geo_gyeongseong_1919: {box:[126.84,-37.65,.28,.168], year:1919, seoul:true},
  geo_shanghai: {box:[119.95,-32.45,2.65,1.75], year:1919, landmarks:['쑤저우'], coast:'shanghai-land', rivers:true},
  geo_hongkou_park: {box:[121.415,-31.305,.16,.096], year:1932, coast:'shanghai-land', rivers:true},
  geo_nanjing: {box:[117.4,-33.5,5.9,3.6], year:1932, rivers:true, cities:['geo_shanghai']},
  geo_tokyo: {box:[138.3,-36.3,2.8,1.65], year:1919, landmarks:['요코하마'], coast:'honshu-coast', rivers:true},
  geo_japan: {box:[127,-46,21,16.5], year:1919, highlight:'740', landmarks:['나가사키'], cities:['geo_tokyo']},
  geo_china_proper: {box:[99,-43,27,22], year:1940, rivers:true, cities:['geo_chongqing','geo_nanjing','geo_beijing','geo_guangzhou']},
  geo_manchuria_primorsky: {box:[117,-54.5,23,16], year:1920, landmarks:['하얼빈','지린','블라디보스토크','하바롭스크'], rivers:true},
  geo_east_asia: {box:[82,-56,69,42], year:1938, cities:['geo_seoul','geo_tokyo','geo_beijing']},
  geo_europe: {box:[-14,-66,55,32], atlas:'europe', year:1914, cities:['geo_berlin','geo_moscow'], landmarks:['파리']},
  geo_americas: {box:[-171,-73,141,130], atlas:'americas', year:1914, cities:['geo_new_york'], landmarks:['호놀룰루','샌프란시스코','부에노스아이레스']},
  geo_ussr: {box:[113,-56,31,17], year:1921, landmarks:['지린','블라디보스토크','하바롭스크'], rivers:true},
};

export function historicalView(space, date = '', nearbyKeys = []) {
  const view = historyViews[space.지도참조키];
  if (!view || (space.지도참조키 === 'geo_ussr' && !nearbyKeys.includes('geo_manchuria_primorsky'))) return null;
  const day = date || String(view.year);
  if (!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(day) || +day.slice(0,4)<1910 || +day.slice(0,4)>1945) return null;
  return {...view,day: day.length === 4 ? day+'-01-01' : day.length === 7 ? day+'-01' : day};
}

const cshapesSource = 'https://icr.ethz.ch/data/cshapes/';
const koreaSource = 'https://hgis.history.go.kr/pro_g1/dataset.do#tab05';
const geoSources = 'https://www.soest.hawaii.edu/wessel/gshhg/';

function mapCredit(label,source) {
  const link = document.createElement('a');
  link.className = 'point-basemap-credit';
  link.href = source;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = label+' ↗';
  return link;
}

function activePaths(doc,day) {
  return Array.from(doc.querySelectorAll('path')).filter(p=>p.getAttribute('start')<=day && day<=p.getAttribute('end'));
}

function contextPath(path,kind) {
  return svg('path',{d:path.getAttribute('d'),class:'context-'+kind,'fill-rule':'evenodd','vector-effect':'non-scaling-stroke'});
}

async function drawHistoricalPlace(space,shape,view) {
  const {day,box} = view;
  const key = space.지도참조키;
  const map = svg('svg',{viewBox:box.join(' '),role:'img','aria-label':space.공간명+' 위치 지도'});
  if (key === 'geo_americas') map.classList.add('hemisphere-map');
  let credit,source;
  const [atlas,provinces,land,rivers,cities,point,landmarks] = await Promise.all([
    !view.seoul && asset('independence-'+(view.atlas || 'asia')+'.svg'),
    view.korea && asset('colonial-korea.svg'),
    view.coast && asset(view.coast+'.geojson'),
    view.rivers && asset('east-asia-regional-rivers.geojson'),
    view.cities && asset('place-points.geojson'),
    shape.도형유형 === 'point' && loadShape(shape),
    view.landmarks && asset('historical-map-landmarks.geojson'),
  ]);
  if (atlas && !view.coast) {
    for (const path of activePaths(atlas,day)) {
      const country = contextPath(path,'country');
      if (path.getAttribute('code') === view.highlight) country.classList.add('context-selected-country');
      map.append(country);
    }
    credit = day+' 기준 국경 · CShapes';
    source = cshapesSource;
  }
  if (land) {
    map.append(layer(land.geometry,'land'));
    credit = (view.coast === 'honshu-coast' ? '도쿄만' : '창장강 하구')+' · GSHHG 해안선';
    source = geoSources;
  }
  if (provinces) {
    const active = activePaths(provinces,day);
    for (const p of active.filter(p=>!p.hasAttribute('kind') && p.getAttribute('name') !== '평양부')) map.append(contextPath(p,'province'));
    const district = active.find(p=>p.getAttribute('name') === '평양부');
    if (key === 'geo_pyongyang') {
      for (const p of active.filter(p=>p.getAttribute('kind') === 'county')) map.append(contextPath(p,'line'));
      if (district) map.append(contextPath(district,'district'));
    }
    if (active.length) {
      credit = day+' 기준 '+(district && key === 'geo_pyongyang' ? '평양부' : '도 경계')+' · 국사편찬위원회';
      source = koreaSource;
    }
  }
  if (view.seoul) {
    const [land,admin,district] = await Promise.all([asset('seoul-land-1919-1926.geojson'),asset('seoul-admin-1919-1926.geojson'),loadShape(shape)]);
    map.append(layer(land.geometry,'land'),layer(admin.geometry,'line'),layer(district,'district'));
    credit = '1919년 경성부 · 국사편찬위원회';
    source = koreaSource;
  }
  if (rivers) map.append(layer(rivers.geometry,'river'));
  if (cities) for (const f of cities.features.filter(f=>view.cities.includes(f.id))) {
    cityLabel(map,f.properties.name,...f.geometry.coordinates,Math.min(box[2]*.046,box[3]*.065),false);
  }
  if (landmarks) for (const f of landmarks.features.filter(f=>view.landmarks.includes(f.properties.name))) {
    cityLabel(map,f.properties.name,...f.geometry.coordinates,Math.min(box[2]*.039,box[3]*.055),false);
  }
  if (point) cityLabel(map,space.공간명,...point.coordinates,Math.min(box[2]*.045,box[3]*.065),true);
  if (view.coast && point) {
    const japan = key === 'geo_tokyo';
    const inset = svg('svg',{viewBox:japan ? '128 -46 19 17' : '94 -44 35 25',role:'img','aria-label':day+' 기준 '+space.공간명+'의 광역 위치'});
    const frame = document.createElement('div');
    frame.className = 'context-local-frame';
    const locator = document.createElement('a');
    locator.className = 'context-locator';
    locator.href = cshapesSource;
    locator.target = '_blank';
    locator.rel = 'noopener noreferrer';
    for (const path of activePaths(atlas,day)) inset.append(contextPath(path,'country'));
    inset.append(svg('circle',{cx:point.coordinates[0],cy:-point.coordinates[1],r:japan ? .85 : 1.3,class:'space-map-point'}));
    const legend = document.createElement('span');
    legend.textContent = day.slice(0,4)+'년 '+(japan ? '일본' : '중국')+' 일대';
    locator.append(inset,legend);
    frame.append(map,locator);
    return [frame,mapCredit(credit,source)];
  }
  return [map,mapCredit(credit,source)];
}

export async function renderSpaceMap(container, space, shape, {pointWidth = 6, date = '', nearbyKeys = [], registered = false} = {}) {
  if (!shape) {
    container.textContent = space.지도참조키 ? '이 참조키에 등록된 도형이 없습니다.' : '등록된 지도참조키가 없습니다.';
    return;
  }
  if (registered && shape.도형유형 !== 'point') return drawRegisteredMap(container,space,shape,pointWidth,date,true);
  const view = historicalView(space,date,nearbyKeys);
  if (view) {
    try {
      const parts = await drawHistoricalPlace(space,shape,view);
      if (shape.도형유형 !== 'point' && !view.seoul) {
        const details = document.createElement('details');
        details.className = 'context-registered';
        const summary = document.createElement('summary');
        summary.textContent = '시트에 등록된 도형 보기';
        const original = document.createElement('div');
        details.append(summary,original);
        const registeredCaption = container.parentElement?.querySelector(':scope > figcaption');
        if (registeredCaption && container.closest('.space-figure')) {
          const caption = document.createElement('p');
          caption.className = 'registered-shape-caption';
          caption.append(...registeredCaption.childNodes);
          registeredCaption.remove();
          details.append(caption);
        }
        details.addEventListener('toggle',()=>{if (details.open && !original.hasChildNodes()) void drawRegisteredMap(original,space,shape,pointWidth,date);});
        parts.push(details);
      }
      container.replaceChildren(...parts);
    } catch {
      container.textContent = '이 장소의 지도를 불러오지 못했습니다.';
    }
    return;
  }
  return drawRegisteredMap(container,space,shape,pointWidth,date);
}

export function registeredSvgFrame(url) {
  const prefix = 'data:image/svg+xml;base64,';
  if (!url.startsWith(prefix)) throw Error();
  const source = new DOMParser().parseFromString(new TextDecoder().decode(Uint8Array.from(atob(url.slice(prefix.length)), c=>c.charCodeAt(0))), 'image/svg+xml');
  const root = source.documentElement;
  const box = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  if (root.localName !== 'svg' || box.length !== 4 || !box.every(Number.isFinite) || box[2]<=0 || box[3]<=0) throw Error();
  const geographic = root.querySelector('desc')?.textContent.includes('x=경도, y=−위도');
  return {box,geographic,root};
}

const contextRegions = {
  geo_incheon_station_1899:'gyeongin', geo_noryangjin_temporary_1899:'gyeongin', geo_gyeongin_1899:'gyeongin',
  geo_panmunjom:'kaesong', geo_seoul:'gyeongin', geo_gyeongseong_1919:'gyeongin', geo_pyongyang:'pyongyang',
  geo_38th_parallel:'parallel', geo_demilitarized_zone:'dmz', geo_korean_peninsula:'korea',
  geo_beijing:'beijing', geo_yanan:'yanan', geo_guangzhou:'guangzhou', geo_chongqing:'chongqing',
  geo_shanghai:'yangtze', geo_hongkou_park:'yangtze', geo_nanjing:'yangtze', geo_tokyo:'tokyo',
  geo_berlin:'berlin', geo_west_berlin:'berlin', geo_potsdam:'berlin', geo_berlin_wall:'berlin',
  geo_moscow:'moscow', geo_brussels:'brussels', geo_geneva:'geneva', geo_yalta:'yalta',
  geo_new_york:'new-york', geo_washington_dc:'washington', geo_bay_of_pigs:'pigs', geo_cairo:'cairo',
  geo_frg_territory:'germany', geo_gdr_territory:'germany', geo_germany:'germany',
  geo_europe:'europe', geo_west_europe:'europe', geo_east_europe:'europe', geo_ussr:'ussr',
  geo_manchuria_primorsky:'manchuria', geo_china_proper:'east-asia', geo_iron_curtain:'europe', geo_americas:'americas', geo_east_asia:'east-asia',
  geo_vietnam:'vietnam', geo_japan:'japan', geo_cuba:'cuba',
  geo_middle_east:'middle-east', geo_south_asia:'south-asia', geo_israel:'israel',
  geo_afghanistan:'afghanistan', geo_iran:'iran', geo_india_pakistan:'india-pakistan'
};

const physicalSource = 'https://www.naturalearthdata.com/downloads/10m-physical-vectors/';

async function drawRegion(container,space,shape,region,date) {
  const data = await asset('context/'+region+'.json').catch(() => null);
  if (!data) return false;
  const [x,y,width,height] = data.box;
  const map = svg('svg',{viewBox:data.box.join(' '),role:'img','aria-label':space.공간명+' 위치 지도',class:'place-context'});
  map.style.setProperty('--map-ratio',String(width/height));
  const path = (d,kind) => {
    if (d) map.append(svg('path',{d,class:kind,'fill-rule':'evenodd','vector-effect':'non-scaling-stroke'}));
  };
  path(data.land,'context-land');
  path(data.cityBoundary,'context-city-boundary');
  const edition = shape.도형유형 === 'point' && pointBackdrop(space,date).match(/^world-(\d{4})$/)?.[1];
  if (edition) {
    const borders = await asset('world-'+edition+'.svg');
    for (const outline of borders.querySelectorAll('path')) path(outline.getAttribute('d'),'context-border');
  }
  for (const d of data.countries || []) path(d,'context-country');
  path(data.lakes,'context-lake');
  path(data.rivers,'context-river');
  const railView = region === 'gyeongin' && ['geo_incheon_station_1899','geo_noryangjin_temporary_1899','geo_gyeongin_1899'].includes(space.지도참조키);
  if (railView) path(data.rail,'context-line');

  let point;
  if (shape.도형유형 === 'point') {
    point = (await loadShape(shape)).coordinates;
    if (point[0]<x || point[0]>x+width || -point[1]<y || -point[1]>y+height) return false;
  } else if (shape.데이터형식 === 'svg_legacy' && shape.지도데이터URL) {
    const {box,geographic,root} = registeredSvgFrame(shape.지도데이터URL);
    if (!geographic) return false;
    const simpleLine = shape.도형유형 === 'line' && root.querySelector(':scope > path:only-of-type');
    if (simpleLine && !simpleLine.hasAttribute('transform') && !root.hasAttribute('transform')) {
      path(simpleLine.getAttribute('d'),'space-map-line');
    } else {
      map.append(svg('image',{href:shape.지도데이터URL,x:box[0],y:box[1],width:box[2],height:box[3],
        class:shape.도형유형 === 'line' ? 'context-registered-line' : 'context-registered-area'}));
    }
  } else if (shape.데이터형식 === 'geojson' || !shape.데이터형식) {
    const geometry = await loadShape(shape);
    path(pathData(shapePaths(geometry),shape.도형유형 === 'area'),shape.도형유형 === 'area' ? 'space-map-area' : 'space-map-line');
  } else if (data.date) {
    for (const d of data.selected || []) path(d,'space-map-area');
  } else return false;

  const size = Math.min(width*.042,height*.063);
  const occupied = [];
  function label(name,lon,lat,selected) {
    const font = selected ? size : size*.84;
    const length = font*[...name].length;
    const options = lon+length+font >= x+width ? [-1,1] : [1,-1];
    for (const direction of options) {
      const labelX = lon+direction*font*.74;
      const a = Math.min(lon,direction<0 ? labelX-length : labelX)-font*.35;
      const b = Math.max(lon,direction<0 ? labelX : labelX+length)+font*.35;
      if (!selected && (a<x || b>x+width || occupied.some(([l,r,h])=>a<r && b>l && Math.abs(lat-h)<size*1.22))) continue;
      occupied.push([a,b,lat]);
      cityLabel(map,name,lon,lat,font,selected);
      map.lastChild.setAttribute('x',labelX);
      if (direction<0) map.lastChild.setAttribute('text-anchor','end');
      break;
    }
  }
  if (point) label(space.공간명,...point,true);
  for (const [name,lon,lat] of data.cities) {
    if (region === 'gyeongin' && !railView) continue;
    if (point && Math.hypot(lon-point[0],lat-point[1])<size*.8) continue;
    label(name,lon,lat,false);
  }
  let credit = mapCredit('해안선·수계 · Natural Earth 지형 참고도',physicalSource);
  if (edition) credit = mapCredit(edition+'년 국경 · Historical Basemaps / 지형 · Natural Earth','https://github.com/aourednik/historical-basemaps');
  if (region === 'gyeongin') credit = mapCredit((railView ? '1899년 경인선 · ' : '')+'1910년 경인 지역 복원 · 국사편찬위원회',koreaSource);
  if (region === 'berlin') credit = mapCredit('베를린·포츠담 · 현대 시 경계와 수역', 'https://daten.berlin.de/datensaetze/gewasserverzeichnis-wfs-353f1716');
  if (data.date) credit = mapCredit(data.date+' 기준 국가 경계 · CShapes 2.1',cshapesSource);
  container.replaceChildren(map,credit);
  return true;
}

async function drawRegisteredMap(container,space,shape,pointWidth,date,registered = false) {
  try {
    const type = shape.도형유형;
    const url = shape.지도데이터URL || '';
    const key = space.지도참조키;
    const region = contextRegions[key];
    if (region && !(key === 'geo_seoul' && pointBackdrop(space,date) === 'gyeongseong')) {
      if (await drawRegion(container,space,shape,region,date)) return;
    }
    let map;
    if (type === 'svg-area' || type === 'svg-line' || shape.데이터형식 === 'svg_legacy') {
      const {box,geographic} = registeredSvgFrame(url);
      map = mapFrame(space.공간명,box,geographic);
      const image = svg('image',{href:url,x:box[0],y:box[1],width:box[2],height:box[3],class:'space-shape-image'});
      image.addEventListener('error',()=>{container.textContent='등록된 지도 도형을 불러오지 못했습니다.';});
      map.append(image);
    } else if (type === 'point') {
      const {coordinates:[lon,lat]} = await loadShape(shape);
      const backdrop = pointBackdrop(space,date);
      if (backdrop) {
        try {
          const [region,credit] = await regionalPointMap(backdrop,space.공간명,lon,lat);
          container.replaceChildren(region,credit);
          const point = new DOMPoint(lon,-lat);
          for (const country of region.querySelectorAll('.context-country')) {
            if (country.isPointInFill(point)) country.classList.add('context-selected-country');
          }
        } catch {
          container.textContent = '이 장소의 배경 지도를 불러오지 못했습니다.';
        }
        return;
      }
      map = mapFrame(space.공간명,[lon-pointWidth/2,-lat-pointWidth/4,pointWidth,pointWidth/2],true);
      map.append(svg('circle',{cx:lon,cy:-lat,r:pointWidth*.015,class:'space-map-point'}));
    } else {
      const geometry = await loadShape(shape);
      const paths = shapePaths(geometry);
      let west=Infinity, east=-Infinity, south=Infinity, north=-Infinity;
      for (const path of paths) for (const [lon,lat] of path) {
        west=Math.min(west,lon); east=Math.max(east,lon); south=Math.min(south,lat); north=Math.max(north,lat);
      }
      map = mapFrame(space.공간명,[west,-north,east-west,north-south],true);
      map.append(svg('path',{d:pathData(paths,type==='area'),class:type==='area'?'space-map-area':'space-map-line','fill-rule':'evenodd'}));
    }
    container.replaceChildren(map);
  } catch {
    container.textContent = '등록된 지도 도형을 불러오지 못했습니다.';
  }
}
