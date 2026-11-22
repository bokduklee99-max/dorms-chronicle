const geometryTypes = {
  point:['Point'],
  line:['LineString','MultiLineString'],
  area:['Polygon','MultiPolygon'],
};

function records([header,...rows], required) {
  if (!required.every(key => header?.includes(key))) throw new Error('지도 시트의 열 제목을 확인해 주세요.');
  return rows.map(row => Object.fromEntries(header.map((key,index) => [key,row[index]?.trim() ?? ''])));
}

export function mapLinks(eventRows,spaceRows,shapeRows) {
  const links = records(eventRows,['사건ID','공간ID']);
  const spaces = new Map(records(spaceRows,['공간ID','공간명','공간유형','지도참조키']).map(row => [row.공간ID,row]));
  const shapes = new Map(records(shapeRows,['지도참조키','도형유형','파일경로','외부도형ID','원본SVG','출처','기준시점']).map(row => [row.지도참조키,row]));
  return eventId => [
    ...new Set(links.filter(link => link.사건ID === eventId).map(link => link.공간ID)),
  ].flatMap(spaceId => {
    const space = spaces.get(spaceId);
    const shape = shapes.get(space?.지도참조키);
    if (!shape || space.공간유형 !== shape.도형유형 || !Object.hasOwn(geometryTypes,shape.도형유형)) return [];
    return [{name:space.공간명,key:space.지도참조키,...shape}];
  });
}

export function eventMapExamples(eventRows, ids) {
  const events = records(eventRows,['사건ID','사건명','날짜','내용']);
  const byId = new Map(events.map((event,index) => [event.사건ID,{...event,sheetRow:index+2}]));
  return (ids ? ids.map(id => byId.get(id)) : [...byId.values()]).filter(event => event?.사건ID && event.사건명);
}

export function linkedMapEvents(tables) {
  const events = new Map(tables.사건.map(row=>[row.사건ID,{...row,groups:new Set(),layers:[]}]));
  const spaces = new Map(tables.공간.map(row=>[row.공간ID,row]));
  const shapes = new Map(tables.지도도형.map(row=>[row.지도참조키,row]));
  const actors = new Map(tables.주체.map(row=>[row.주체ID,row.주체명]));
  for (const row of tables.사건_카테고리) events.get(row.사건ID)?.groups.add(row.카테고리ID);
  for (const row of tables.사건_공간) {
    const event = events.get(row.사건ID);
    const space = spaces.get(row.공간ID);
    if (!event || !space || event.layers.some(layer=>layer.space===space)) continue;
    const shape = shapes.get(space.지도참조키);
    event.layers.push({space,shape:shape?.도형유형===space.공간유형 ? shape : undefined,label:space.공간명});
  }
  const kinds = {sovereignty:'주권·국경',occupation:'점령·전선',sphere:'세력권'};
  for (const row of tables.영토변화) {
    const event = events.get(row.계기사건ID);
    if (!event || !row.지도참조키) continue;
    const name = actors.get(row.주체ID) || row.주체ID || row.지도참조키;
    const label = (kinds[row.영토유형] || '영토 변화')+' · '+name;
    event.layers.push({
      space:{공간명:name,지도참조키:row.지도참조키},shape:shapes.get(row.지도참조키),label,
      start:row.시작일,period:row.시작일 ? row.시작일+(row.종료일 ? ' ~ '+row.종료일 : '부터') : row.종료일,
      note:row.설명
    });
  }
  return [...events.values()].filter(event=>event.layers.length)
    .sort((a,b)=>a.날짜.localeCompare(b.날짜) || a.sheetRow-b.sheetRow);
}

export function mapAsset(path,extension) {
  return /^assets\/event-geometry\/[a-z0-9-]+\.(svg|geojson)$/.test(path) && path.endsWith('.'+extension) ? path : '';
}

function pointGeometry(geometry) {
  const coords = geometry?.coordinates;
  if (geometry?.type !== 'Point' || !Array.isArray(coords) || coords.length < 2 ||
      !Number.isFinite(coords[0]) || !Number.isFinite(coords[1]) ||
      Math.abs(coords[0]) > 180 || Math.abs(coords[1]) > 90) throw Error('점 도형의 좌표를 확인해 주세요.');
  return geometry;
}

export async function loadShape(place) {
  const type = place.도형유형;
  if (place.데이터형식 && (place.데이터형식 !== 'geojson' || place.좌표상태 !== 'ready')) {
    throw new Error('경위도 도형이 준비되지 않았습니다.');
  }
  if (type === 'point' && place.경도?.trim() && place.위도?.trim()) {
    return pointGeometry({type:'Point',coordinates:[Number(place.경도),Number(place.위도)]});
  }
  const url = place.지도데이터URL ?? '';
  const inline = /^(data:application\/geo\+json)(;base64)?,/.exec(url);
  let geometry;
  if (inline) {
    const value = url.slice(inline[0].length);
    const json = inline[2] ? new TextDecoder().decode(Uint8Array.from(atob(value),c=>c.charCodeAt(0))) : decodeURIComponent(value);
    const data = JSON.parse(json);
    geometry = data.type === 'Feature' ? data.geometry : data;
  } else {
    const path = mapAsset(place.파일경로,'geojson');
    if (!path) throw new Error('지도도형 탭의 파일경로를 확인해 주세요.');
    const response = await fetch('/'+path);
    if (!response.ok) throw new Error('등록된 지도 파일을 읽지 못했어요.');
    const data = await response.json();
    const features = data.type === 'FeatureCollection' ? data.features : [data];
    geometry = features.find(item => String(item.id) === place.외부도형ID)?.geometry;
  }
  if (!geometryTypes[type]?.includes(geometry?.type)) throw new Error('등록된 도형 ID와 유형을 확인해 주세요.');
  if (type === 'point') return pointGeometry(geometry);
  const paths = shapePaths(geometry);
  if (!paths.length || paths.some(path => path.length < 2 || path.some(([lon,lat]) =>
    !Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon)>180 || Math.abs(lat)>90))) {
    throw new Error('지도 파일의 위도·경도를 확인해 주세요.');
  }
  return geometry;
}

export function shapePaths({type,coordinates}) {
  if (type === 'Point') return [];
  if (type === 'LineString') return [coordinates];
  if (type === 'MultiPolygon') return coordinates.flat();
  return coordinates;
}
