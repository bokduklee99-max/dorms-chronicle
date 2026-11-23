const required = {
  공간: ['공간ID', '공간명', '지도참조키'],
  지도도형: ['지도참조키', '경도', '위도'],
  카테고리: ['카테고리ID', '카테고리명'],
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
    if (row.카테고리명 && ids?.size)
      themes.push({ name: row.카테고리명, era: '', source: '시트 주제', places: [...ids] });
  }
  const sheetNames = new Set(themes.map((t) => t.name));
  for (const theme of presets.themes) {
    if (sheetNames.has(theme.name)) continue;
    const ids = theme.places.filter((id) => byId.has(id));
    if (ids.length) themes.push({ ...theme, places: ids, source: '편집기 주제' });
  }
  return { places: [...byId.values()], themes, eras: presets.eras };
}

export async function loadSheetLibrary(config, presets, readRecords, storage) {
  const cacheKey = 'chronicle.atlas.sheet.v1.' + config.id;
  try {
    const entries = await Promise.all(
      Object.entries(required).map(async ([name, fields]) => [name, await readRecords(config, name, fields)]),
    );
    const library = sheetLibrary(Object.fromEntries(entries), presets);
    try {
      storage?.setItem(cacheKey, JSON.stringify(library));
    } catch {
      /* Quota or storage access is optional. */
    }
    return { ...library, source: 'live' };
  } catch {
    try {
      const saved = JSON.parse(storage?.getItem(cacheKey) || 'null');
      if (Array.isArray(saved?.places) && Array.isArray(saved?.themes) && Array.isArray(saved?.eras))
        return { ...saved, source: 'cached' };
    } catch {
      /* The editor can still open a saved drawing. */
    }
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
