import { geographicSvgLines, projectedPath } from '../geographic-paths.js';
import { loadShape, mapAsset, shapePaths } from '../../event-map-links.js';
import { registeredSvgFrame } from '../space-preview-map.js';
import { camera, ll, mapHeight, W, xy } from './cartography.js';

export const historyTables = {
  사건: ['사건ID', '사건명', '날짜'],
  사건_패키지: ['사건ID', '패키지ID'],
  사건_카테고리: ['사건ID', '카테고리ID'],
  사건_공간: ['사건ID', '공간ID'],
  영토변화: ['계기사건ID', '지도참조키', '시작일', '종료일'],
  지도뷰: ['뷰ID', '뷰명', '최소경도', '최대경도', '최소위도', '최대위도'],
};
const projectDegrees = (lon, lat) => [
  lon,
  (-Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * Math.PI) / 360)) * 180) / Math.PI,
];
const unique = (values) => [...new Set(values)];

function shapeDrawing(paths, line) {
  if (!paths.length) throw Error('빈 도형');
  let west = 180,
    east = -180,
    south = 90,
    north = -90;
  for (const path of paths)
    for (const [lon, lat] of path) {
      west = Math.min(lon, west);
      east = Math.max(lon, east);
      south = Math.min(lat, south);
      north = Math.max(lat, north);
    }
  return { d: projectedPath(paths, projectDegrees, !line), bounds: [west, south, east, north], line };
}

async function readLayer(shape, readOnce, svgPaths) {
  const key = shape.지도참조키;
  const line = shape.도형유형.includes('line');
  if (shape.데이터형식 === 'geojson') return shapeDrawing(shapePaths(await loadShape(shape, readOnce)), line);
  const source = shape.지도데이터URL || '';
  if (source.startsWith('data:image/svg+xml;base64,')) {
    const { root, geographic } = registeredSvgFrame(source);
    const index = /^g > path:nth-of-type\((\d+)\)$/.exec(shape.외부도형ID);
    if (index && /^assets\/event-geometry\/world-\d+\.svg$/.test(shape.파일경로)) {
      const paths = await svgPaths(shape.파일경로);
      return shapeDrawing(geographicSvgLines(paths[Number(index[1]) - 1]), line);
    }
    if (!geographic) return { original: source };
    return shapeDrawing(
      [...root.querySelectorAll('path')].flatMap((p) => geographicSvgLines(p.getAttribute('d'))),
      line,
    );
  }
  const region = {
    geo_afghanistan: 'afghanistan',
    geo_iran: 'iran',
    geo_israel: 'israel',
    geo_india_pakistan: 'india-pakistan',
    geo_middle_east: 'middle-east',
  }[key];
  if (region) {
    const data = await readOnce('assets/event-geometry/context/' + region + '.json');
    return {
      ...shapeDrawing((data.selected || data.countries).flatMap(geographicSvgLines), !data.selected),
      note: data.date + ' 기준 ' + (data.selected ? '국가 경계' : '권역 내 국가 경계') + ' · CShapes 2.1',
    };
  }
  if (key === 'geo_nato_1949' || key === 'geo_roc_taiwan') {
    const data = await readOnce('assets/event-geometry/cold-war-territories.geojson');
    return {
      ...shapeDrawing(
        data.features.filter((f) => f.properties.layer === key).flatMap((f) => shapePaths(f.geometry)),
        false,
      ),
      note: (key === 'geo_nato_1949' ? '1949-04-04 창립 12개국 본국' : '1949-12-08 대만') + ' · CShapes 2.1',
    };
  }
  throw Error('등록된 도형 파일 없음');
}

function svgPathReader() {
  const xml = new Map();
  function svgPaths(path) {
    if (!xml.has(path))
      xml.set(
        path,
        fetch('/' + path).then(async (r) => {
          if (!r.ok) throw Error(path);
          const svg = new DOMParser().parseFromString(await r.text(), 'image/svg+xml');
          return [...svg.querySelectorAll('path')].map((p) => p.getAttribute('d'));
        }),
      );
    return xml.get(path);
  }
  return svgPaths;
}

export async function loadCatalogLayers(catalog, shapes, layers, readOnce) {
  const svgPaths = svgPathReader();
  const byKey = new Map(shapes.map((shape) => [shape.지도참조키, shape]));
  await Promise.all(catalog.map(async (entry) => {
    const { key, name } = entry;
    if (layers[key]?.d || layers[key]?.original) return;
    const shape = byKey.get(key);
    if (!shape) return;
    try {
      layers[key] = { name, note: shape.기준시점 || '', ...(await readLayer(shape, readOnce, svgPaths)) };
    } catch {
      layers[key] = { name, missing: true };
    }
  }));
}

export function historyCamera(bounds) {
  const [west, south, east, north] = bounds;
  const base = west >= 122 && east <= 134 && south >= 30 && north <= 45 ? 'korea' : 'globe';
  const view = camera(base),
    height = mapHeight(view);
  const y1 = xy(view, west, south, height)[1],
    y2 = xy(view, east, north, height)[1];
  return {
    base,
    lon: (west + east) / 2,
    lat: ll(view, W / 2, (y1 + y2) / 2, height)[1],
    span: Math.max(0.06, east - west, (Math.abs(y1 - y2) * view.span) / height) * 1.04,
  };
}

export async function coldWarLibrary(tables, library, readOnce) {
  const events = {},
    layers = {},
    editions = {};
  const spaces = new Map(tables.공간.map((r) => [r.공간ID, r]));
  const shapes = new Map(tables.지도도형.map((r) => [r.지도참조키, r]));
  const categories = new Map(tables.카테고리.map((r) => [r.카테고리ID, r]));
  const views = new Map(tables.지도뷰.map((r) => [r.뷰ID, r]));
  const catalog = new Set(library.places.map((p) => p.id));
  const pkgEvents = new Set(tables.사건_패키지.filter((r) => r.패키지ID === 'cold-war').map((r) => r.사건ID));
  for (const row of tables.사건)
    if (pkgEvents.has(row.사건ID))
      events[row.사건ID] = { name: row.사건명, date: row.날짜, places: [], layers: [], territories: [] };
  const needed = new Set(),
    names = new Map();
  function addSpace(item, id) {
    const space = spaces.get(id);
    if (catalog.has(id)) item.places.push(id);
    else if (space?.지도참조키) {
      item.layers.push(space.지도참조키);
      needed.add(space.지도참조키);
      names.set(space.지도참조키, space.공간명);
    }
  }
  for (const r of tables.사건_공간) if (events[r.사건ID]) addSpace(events[r.사건ID], r.공간ID);
  for (const r of tables.영토변화)
    if (events[r.계기사건ID] && r.지도참조키) {
      const key = r.지도참조키;
      events[r.계기사건ID].territories.push({ key, from: r.시작일, to: r.종료일, note: r.설명 });
      needed.add(key);
    }
  for (const e of Object.values(events)) {
    e.places = unique(e.places);
    e.layers = unique(e.layers);
  }
  const svgPaths = svgPathReader();
  const backgrounds = new Set();
  for (const t of library.themes.filter((t) => t.packageId === 'cold-war')) {
    const category = categories.get(t.id),
      v = views.get(category.기본뷰ID);
    if (v) {
      const bounds = [v.최소경도, v.최소위도, v.최대경도, v.최대위도].map(Number);
      if (bounds.every(Number.isFinite) && bounds[0] < bounds[2] && bounds[1] < bounds[3])
        t.frame = { bounds, name: v.뷰명 };
    }
    t.edition = category.지도참조키;
    if (t.edition) backgrounds.add(t.edition);
    t.events = unique(
      tables.사건_카테고리.filter((r) => r.카테고리ID === t.id && events[r.사건ID]).map((r) => r.사건ID),
    ).sort((a, b) => events[a].date.localeCompare(events[b].date));
    const direct = { places: [], layers: [] };
    for (const r of tables.카테고리_공간) if (r.카테고리ID === t.id) addSpace(direct, r.공간ID);
    t.places = unique(direct.places.length ? direct.places : t.events.flatMap((id) => events[id].places));
    t.layers = unique(direct.layers.length ? direct.layers : t.events.flatMap((id) => events[id].layers));
  }
  await Promise.all(
    [...needed].map(async (key) => {
      const s = shapes.get(key);
      const info = {
        name: names.get(key) || s?.기준시점 || key,
        note: s?.기준시점 || '',
      };
      try {
        layers[key] = { ...info, ...(await readLayer(s, readOnce, svgPaths)) };
      } catch {
        layers[key] = { ...info, missing: true };
      }
    }),
  );
  await Promise.all(
    [...backgrounds].map(async (key) => {
      const s = shapes.get(key);
      try {
        const svg = mapAsset(s.파일경로, 'svg'),
          geo = mapAsset(s.파일경로, 'geojson');
        const groups = svg
          ? (await svgPaths(svg)).map(geographicSvgLines)
          : (await readOnce(geo)).features.map((f) => shapePaths(f.geometry));
        const paths = groups
          .filter((group) => group.length)
          .map((group) => projectedPath(group, projectDegrees, true));
        if (!paths.length) throw Error();
        editions[key] = {
          paths,
          name:
            key === 'world_1980' ? '1980년 세계 국경 · CShapes 2.1' : s.기준시점 + ' · Historical Basemaps',
        };
      } catch {
        editions[key] = { name: (s?.기준시점 || key) + ' · 배경지도 로드 실패' };
      }
    }),
  );
  return { events, layers, editions };
}
