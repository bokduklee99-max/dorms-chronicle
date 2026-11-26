import { coldWarLibrary, historyTables, loadCatalogLayers } from './cold-war.js?v=area-names-1';
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

const kindLabels = {
  point: '지점·도시', line: '경계·선', area: '권역·지역',
  sovereignty: '주권·국경', occupation: '점령·전선', sphere: '세력권·진영',
};

function territoryPeriod(start, end) {
  const label = (date) => {
    if (/^-\d+$/.test(date)) return '기원전 ' + Math.abs(Number(date)) + '년';
    if (/^\d+$/.test(date)) return Number(date) + '년';
    return date;
  };
  if (start && end) return start === end ? label(start) : label(start) + ' ~ ' + label(end);
  if (start) return label(start) + '부터';
  return end ? label(end) + '까지' : '';
}

export function shapeCatalog(tables) {
  const shapes = new Map(tables.지도도형.map((shape) => [shape.지도참조키, shape]));
  const actorNames = new Map((tables.주체 || []).map(row => [row.주체ID, row.주체명]));
  const catalog = new Map();
  const periods = new Map();
  function register(key, type, name, kind, keywords) {
    const entry = catalog.get(key) || { key, type, name, kind, keywords: '' };
    entry.keywords = [entry.keywords, keywords].filter(Boolean).join(' ');
    catalog.set(key, entry);
    return entry;
  }
  for (const row of tables.공간) {
    const type = row.공간유형, key = row.지도참조키;
    if (!key || !row.공간명 || !['line', 'area'].includes(type) || (shapes.has(key) && shapes.get(key).도형유형 !== type)) continue;
    const entry = register(key, type, row.공간명, kindLabels[type], [row.시대별칭, row.설명].join(' '));
    if (entry.name === row.공간명) {
      entry.description = row.설명;
      entry.spaceRow = row.sheetRow;
    }
  }
  for (const row of tables.영토변화 || []) {
    const key = row.지도참조키, shape = shapes.get(key);
    if (!['line', 'area'].includes(shape?.도형유형) || !row.영토유형) continue;
    const type = row.영토유형;
    const kind = Object.hasOwn(kindLabels, type) ? kindLabels[type] : type;
    const actorName = shape.도형유형 === 'area' ? actorNames.get(row.주체ID) : '';
    const name = shape.도형유형 === 'area' ? actorName || '이름 미등록' : shape.기준시점 || key;
    const entry = register(key, shape.도형유형, name, kind, [actorName, row.설명].filter(Boolean).join(' '));
    entry.kind = kind;
    if (entry.type !== 'area') continue;
    if (actorName) {
      entry.actorId ??= row.주체ID;
      if (entry.actorId !== row.주체ID) entry.actorId = '';
      entry.actorName = entry.actorId ? actorName : '';
    }
    const date = /^(-?\d+)(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(row.시작일 || '');
    if (date) {
      const [, year, month = 0, day = 0] = date;
      const order = Number(year) * 10000 + Number(month) * 100 + Number(day);
      entry.startOrder = Math.min(entry.startOrder ?? Infinity, order);
    }
    const period = territoryPeriod(row.시작일, row.종료일);
    if (!period) continue;
    if (!periods.has(key)) periods.set(key, new Set());
    periods.get(key).add(period);
  }
  for (const entry of catalog.values()) {
    if (entry.type !== 'area') continue;
    const basis = /^(\d+(?:\s*[~–—]\s*\d+)?년|현대|냉전기)(?=\s|$)/.exec(shapes.get(entry.key)?.기준시점 || '')?.[1];
    entry.period = periods.has(entry.key) ? [...periods.get(entry.key)].join(' · ')
      : basis?.endsWith('년') ? basis + ' 기준' : basis || '';
  }
  return [...catalog.values()];
}

export function groupAreaChoices(areas) {
  const groups = new Map();
  for (const area of areas) {
    const key = area.actorId ? 'actor:' + area.actorId : 'shape:' + area.key;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(area);
  }
  return [...groups.values()].map(group => group.sort((a, b) =>
    (a.startOrder ?? Number.MAX_SAFE_INTEGER) - (b.startOrder ?? Number.MAX_SAFE_INTEGER)));
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
        : kindLabels.point;
    byId.set(id, {
      id,
      shapeKey: row.지도참조키,
      description: description.includes(' (history-map-maker') ? '' : description,
      spaceRow: row.sheetRow,
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
  const shapeSources = new Map([...shapes].map(([key, row]) => [key, {
    source: row.출처, period: row.기준시점, method: row['도형 추출·사용 설명'], sheetRow: row.sheetRow,
  }]));
  return { shapeSources, shapes: catalog, packages, places: [...byId.values()], themes, eras: presets.eras };
}

export async function loadSheetLibrary(config, presets, readRecords) {
  const fields = { ...required, ...historyTables, 주체: ['주체ID', '주체명'] };
  const failedTabs = [];
  const entries = await Promise.all(Object.entries(fields).map(async ([name, columns]) => {
    try {
      return [name, await readRecords(config, name, columns, undefined, ['공간', '지도도형'].includes(name) && Boolean(config.sheetIds?.[name])) || []];
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
