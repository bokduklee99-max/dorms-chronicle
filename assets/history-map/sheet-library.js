import { coldWarLibrary, historyTables, loadCatalogLayers } from './cold-war.js?v=live-sheets-1';
import { loadShape, readGeometryFile } from '../../event-map-links.js?v=point-files-1';

const required = {
  패키지: ['패키지ID', '패키지명'],
  공간: ['공간ID', '공간명', '지도참조키'],
  지도도형: ['지도참조키'],
  카테고리: ['카테고리ID', '패키지ID', '카테고리명'],
  카테고리_공간: ['카테고리ID', '공간ID'],
};

function coordinate(value, limit) {
  if (value == null || String(value).trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

const defaultKindLabels = {
  point: '지점·도시', line: '경계·선', area: '권역·지역',
  sovereignty: '주권·국경', occupation: '점령·전선', sphere: '세력권·진영',
};

function kindLabel(tables, tab, column, value) {
  return tables.유형설명?.find((row) => row.시트명 === tab && row.컬럼명 === column && row.유형값 === value)?.한글명 ||
    defaultKindLabels[value] || value;
}

export function shapeCatalog(tables) {
  const shapes = new Map(tables.지도도형.map((shape) => [shape.지도참조키, shape]));
  const catalog = new Map();
  function register(key, type, name, kind, keywords) {
    const entry = catalog.get(key) || { key, type, name, kind, keywords: '' };
    entry.keywords = [entry.keywords, keywords].filter(Boolean).join(' ');
    catalog.set(key, entry);
    return entry;
  }
  for (const row of tables.공간) {
    const type = row.공간유형, key = row.지도참조키;
    if (!key || !['line', 'area'].includes(type) || (shapes.has(key) && shapes.get(key).도형유형 !== type)) continue;
    register(key, type, row.공간명, kindLabel(tables, '공간', '공간유형', type), [row.시대별칭, row.설명].join(' '));
  }
  for (const row of tables.영토변화 || []) {
    const key = row.지도참조키, shape = shapes.get(key);
    if (!['line', 'area'].includes(shape?.도형유형) || !row.영토유형) continue;
    const kind = kindLabel(tables, '영토변화', '영토유형', row.영토유형);
    const entry = register(key, shape.도형유형, shape.기준시점 || key, kind, row.설명);
    entry.kind = kind;
  }
  return [...catalog.values()];
}

export function sheetLibrary(tables, presets) {
  const shapes = new Map(tables.지도도형.filter((s) => s.지도참조키).map((s) => [s.지도참조키, s]));
  const byId = new Map();
  for (const row of tables.공간) {
    const id = row.공간ID,
      shape = shapes.get(row.지도참조키);
    if (!id || !row.공간명 || !shape || (row.공간유형 && row.공간유형 !== 'point') ||
        (shape.도형유형 && shape.도형유형 !== 'point')) continue;
    const lon = coordinate(shape.경도, 180),
      lat = coordinate(shape.위도, 85.05112878);
    if (lon === null || lat === null) continue;
    // Imported rows store the original era and kind before their source note.
    const description = row.설명 || '';
    const classification = description.split(' (history-map-maker')[0].split(' · ');
    const eras = presets.eras.filter((era) => classification.length === 2 && classification[0].includes(era));
    const kind =
      description.includes(' (history-map-maker') && classification.length === 2
        ? classification[1]
        : kindLabel(tables, '공간', '공간유형', 'point');
    byId.set(id, {
      id,
      name: row.공간명,
      lon,
      lat,
      keywords: [row.시대별칭, description].filter(Boolean).join(' '),
      kind,
      eras,
    });
  }
  const catalog = shapeCatalog(tables);
  const shapeKeys = new Set(catalog.map(entry => entry.key));
  const keysBySpace = new Map(tables.공간.map(row => [row.공간ID, row.지도참조키]));
  const links = new Map();
  for (const row of tables.카테고리_공간) {
    const id = row.공간ID, category = row.카테고리ID;
    if (!links.has(category)) links.set(category, { places: new Set(), layers: new Set() });
    const members = links.get(category);
    if (byId.has(id)) members.places.add(id);
    else if (shapeKeys.has(keysBySpace.get(id))) members.layers.add(keysBySpace.get(id));
  }
  const themes = [];
  for (const row of tables.카테고리) {
    const members = links.get(row.카테고리ID);
    if (row.카테고리ID && row.카테고리명)
      themes.push({
        id: row.카테고리ID,
        name: row.카테고리명,
        packageId: row.패키지ID,
        source: '시트 주제',
        era: [row.시작일, row.종료일].filter(Boolean).join(' — '),
        places: [...(members?.places || [])],
        layers: [...(members?.layers || [])],
      });
  }
  for (const theme of presets.themes) {
    const ids = theme.places.filter((id) => byId.has(id));
    if (ids.length) themes.push({ ...theme, places: ids, source: '편집기 주제' });
  }
  const packages = tables.패키지
    .filter((row) => row.패키지ID && row.패키지명)
    .map((row) => ({ id: row.패키지ID, name: row.패키지명 }));
  return { shapes: catalog, packages, places: [...byId.values()], themes, eras: presets.eras };
}

export async function loadSheetLibrary(config, presets, readRecords) {
  const fields = { ...required, ...historyTables, 유형설명: ['시트명', '컬럼명', '유형값', '한글명'] };
  const failedTabs = [];
  const entries = await Promise.all(Object.entries(fields).map(async ([name, columns]) => {
    try {
      return [name, await readRecords(config, name, columns) || []];
    } catch {
      // Retry the live tab by name through Google's visualization endpoint.
      try {
        return [name, await readRecords({ id: config.id }, name, columns)];
      } catch {
        failedTabs.push(name);
        return [name, []];
      }
    }
  }));
  const tables = Object.fromEntries(entries);
  if (Object.keys(required).every(name => failedTabs.includes(name)))
    return { places: [], themes: [], eras: presets.eras, source: 'unavailable', failedTabs };
  const files = new Map();
  function readOnce(path) {
    if (!files.has(path)) files.set(path, readGeometryFile(path));
    return files.get(path);
  }
  const spaceKeys = new Set(tables.공간.map((r) => r.지도참조키));
  let unresolved = 0;
  tables.지도도형 = await Promise.all(
    tables.지도도형.map(async (row) => {
      if (
        !spaceKeys.has(row.지도참조키) ||
        row.도형유형 !== 'point' ||
        (!row.파일경로 && !row.지도데이터URL)
      )
        return row;
      if (String(row.경도 ?? '').trim() && String(row.위도 ?? '').trim()) return row;
      try {
        const {
          coordinates: [경도, 위도],
        } = await loadShape(row, readOnce);
        return { ...row, 경도, 위도 };
      } catch {
        unresolved++;
        return row;
      }
    }),
  );
  const library = sheetLibrary(tables, presets);
  if (library.themes.some(t => t.packageId === 'cold-war'))
    library.history = await coldWarLibrary(tables, library, readOnce);
  if (library.shapes.length) {
    library.history ??= { events: {}, editions: {}, layers: {} };
    await loadCatalogLayers(library.shapes, tables.지도도형, library.history.layers, readOnce);
  }
  const failedShapes = Object.values(library.history?.layers || {}).filter(layer => layer.loadFailed).length;
  const failedEditions = Object.values(library.history?.editions || {}).filter(edition => !edition.paths).length;
  return { ...library, source: 'live', failedTabs, unresolved, failedShapes, failedEditions };
}

export const sheetPoint = (p) => ({
  spaceId: p.id,
  sourceName: p.name,
  name: p.name,
  lon: p.lon,
  lat: p.lat,
});

export function refreshDrawing(doc, byId) {
  for (const mark of doc.points) {
    const p = byId.get(mark.spaceId);
    if (!p) continue;
    if (mark.name === mark.sourceName) mark.name = p.name;
    Object.assign(mark, { sourceName: p.name, lon: p.lon, lat: p.lat });
  }
  return doc;
}
