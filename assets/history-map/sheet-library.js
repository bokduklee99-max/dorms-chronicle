import { coldWarLibrary, historyTables } from './cold-war.js';
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

export function sheetLibrary(tables, presets) {
  const shapes = new Map(tables.지도도형.filter((s) => s.지도참조키).map((s) => [s.지도참조키, s]));
  const byId = new Map();
  for (const row of tables.공간) {
    const id = row.공간ID,
      shape = shapes.get(row.지도참조키);
    if (!id || !row.공간명 || !shape) continue;
    const lon = coordinate(shape.경도, 180),
      lat = coordinate(shape.위도, 85.05112878);
    if (lon === null || lat === null) continue;
    // Imported rows store the original era and kind before their source note.
    const description = row.설명 || '';
    const classification = description.split(' (history-map-maker')[0].split(' · ');
    const eras = presets.eras.filter((era) => classification.length === 2 && classification[0].includes(era));
    const kind =
      classification.length === 2
        ? classification[1]
        : { point: '지점', area: '지역', line: '선' }[row.공간유형] || row.공간유형 || '지점';
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
  const links = new Map();
  for (const row of tables.카테고리_공간) {
    if (!byId.has(row.공간ID)) continue;
    if (!links.has(row.카테고리ID)) links.set(row.카테고리ID, new Set());
    links.get(row.카테고리ID).add(row.공간ID);
  }
  const themes = [];
  for (const row of tables.카테고리) {
    const ids = links.get(row.카테고리ID);
    if (row.카테고리ID && row.카테고리명)
      themes.push({
        id: row.카테고리ID,
        name: row.카테고리명,
        packageId: row.패키지ID,
        source: '시트 주제',
        era: [row.시작일, row.종료일].filter(Boolean).join(' — '),
        places: [...(ids || [])],
      });
  }
  for (const theme of presets.themes) {
    const ids = theme.places.filter((id) => byId.has(id));
    if (ids.length) themes.push({ ...theme, places: ids, source: '편집기 주제' });
  }
  const packages = tables.패키지
    .filter((row) => row.패키지ID && row.패키지명)
    .map((row) => ({ id: row.패키지ID, name: row.패키지명 }));
  return { packages, places: [...byId.values()], themes, eras: presets.eras };
}

export async function loadSheetLibrary(config, presets, readRecords, storage) {
  const cacheKey = 'chronicle.atlas.sheet.v1.' + config.id;
  let saved;
  try {
    const value = JSON.parse(storage?.getItem(cacheKey) || 'null');
    if (Array.isArray(value?.places) && Array.isArray(value?.themes) && Array.isArray(value?.eras))
      saved = value;
  } catch {
    /* Storage is optional. */
  }
  try {
    let historyError = false;
    const entries = await Promise.all(
      Object.entries({ ...required, ...historyTables }).map(async ([name, fields]) => {
        try {
          return [name, await readRecords(config, name, fields)];
        } catch (error) {
          if (!(name in historyTables) || saved?.history) throw error;
          historyError = true;
          return [name, []];
        }
      }),
    );
    const tables = Object.fromEntries(entries);
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
    if (!historyError && library.themes.some((t) => t.packageId === 'cold-war')) {
      library.history = await coldWarLibrary(tables, library, readOnce);
      const partial =
        Object.values(library.history.editions).some((e) => !e.paths) ||
        Object.values(library.history.layers).some((layer) => layer.missing);
      if (partial && saved?.history) {
        const previous = saved.history;
        for (const [key, layer] of Object.entries(library.history.layers)) {
          if (layer.missing && previous.layers[key]?.d && layer.note === previous.layers[key].note)
            library.history.layers[key] = previous.layers[key];
        }
        for (const [key, e] of Object.entries(library.history.editions)) {
          if (!e.paths && previous.editions[key]?.paths)
            library.history.editions[key] = previous.editions[key];
        }
      }
      if (partial) historyError = true;
    }
    if (unresolved && !library.places.length) throw Error('지점 도형을 불러오지 못했습니다.');
    if (!unresolved && !historyError) {
      try {
        storage?.setItem(cacheKey, JSON.stringify(library));
      } catch {
        /* Storage is optional. */
      }
    }
    return {
      ...library,
      source: 'live',
      unresolved,
      historyError,
      recoveredEmptyLibrary: saved?.places.length === 0 && library.places.length > 0,
    };
  } catch {
    if (saved?.places.length) return { ...saved, source: 'cached' };
    return { places: [], themes: [], eras: [], source: 'unavailable' };
  }
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
