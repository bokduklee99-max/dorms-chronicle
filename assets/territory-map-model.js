export const territoryAsset = {
  asset_id: 'asset_cliopatria_east_asia_land_clipped_v1',
  url: './event-geometry/cliopatria-east-asia-land-clipped.geojson',
  format: 'geojson',
  source_id: 'source_cliopatria',
  version: '0.04-degree subset, Natural Earth land clip v1',
};

export const worldTerritoryAsset = {
  asset_id: 'asset_cliopatria_world_v1',
  url: './event-geometry/cliopatria-world/',
  source_id: 'source_cliopatria',
};
export function territoryFileStart(year) {
  const step = year >= 1600 ? 50 : 200;
  return Math.floor(year / step) * step;
}

// The local sample uses signed years. Keep them in its adapter because Sheets dates only accept CE.
export const yearPosition = year => year < 0 ? year + 1 : year;
export const yearAtPosition = position => position <= 0 ? position - 1 : position;
export const yearLabel = year => (year < 0 ? '기원전 ' : '') + Math.abs(year) + '년';
const partialYear = year => (year < 0 ? '-' : '') + String(Math.abs(year)).padStart(4, '0');

export function readTerritoryBoundaries(collection, asset = territoryAsset) {
  if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features) || !collection.features.length) {
    throw new Error('영토 도형 목록이 비어 있습니다.');
  }
  const actors = new Map();
  const featureIds = new Set();
  const boundaries = collection.features.map(({id, properties = {}, geometry}) => {
    const {polity, name, fromYear, toYear} = properties;
    if (typeof id !== 'string' || !id || featureIds.has(id) || typeof polity !== 'string' || !polity ||
        typeof name !== 'string' || !name ||
        !Number.isInteger(fromYear) || !Number.isInteger(toYear) || !fromYear || !toYear || fromYear > toYear ||
        !['Polygon', 'MultiPolygon'].includes(geometry?.type)) {
      throw new Error('영토 도형의 ID, 적용 기간 또는 유형을 확인해 주세요.');
    }
    featureIds.add(id);
    const actorId = 'actor_clio_' + polity.toLowerCase().replaceAll(' ', '_');
    if (!actors.has(actorId)) {
      actors.set(actorId, {actor_id: actorId, name: name.replace(/ \(-?\d+\s*~\s*-?\d+\)$/, ''), polity});
    }
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    if (!Array.isArray(polygons) || !polygons.length) throw new Error('영토 도형의 좌표가 비어 있습니다.');
    const boxes = polygons.map(polygon => {
      const bounds = [Infinity, Infinity, -Infinity, -Infinity];
      if (!Array.isArray(polygon) || !polygon.length) throw new Error('영토 도형의 외곽선을 확인해 주세요.');
      for (const [index, ring] of polygon.entries()) {
        if (!Array.isArray(ring) || ring.length < 4) throw new Error('영토 도형의 둘레선을 확인해 주세요.');
        for (const [lon, lat] of ring) {
          if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) {
            throw new Error('영토 도형의 경위도를 확인해 주세요.');
          }
          if (index !== 0) continue;
          bounds[0] = Math.min(bounds[0], lon);
          bounds[1] = Math.min(bounds[1], lat);
          bounds[2] = Math.max(bounds[2], lon);
          bounds[3] = Math.max(bounds[3], lat);
        }
      }
      return bounds;
    });
    return {
      boundary_version_id: 'boundary_' + id,
      actor_id: actorId,
      start_date: partialYear(fromYear),
      end_date: partialYear(toYear),
      boundary_type: 'control',
      asset_id: asset.asset_id,
      feature_id: id,
      precision: 'approximate',
      review_status: 'draft',
      source_id: asset.source_id,
      start: fromYear,
      end: toYear,
      geometry,
      boxes,
    };
  });
  return {actors, boundaries};
}

export function boundariesAt(boundaries, year, [west, south, east, north]) {
  return boundaries.filter(({start, end, boxes}) => start <= year && year <= end &&
    boxes.some(([w, s, e, n]) => e >= west && n >= south && w <= east && s <= north));
}

export function territoryChanges(boundaries) {
  const start = Math.min(...boundaries.map(row => row.start));
  const end = Math.max(...boundaries.map(row => row.end));
  const changes = new Set([start, end]);
  for (const row of boundaries) {
    changes.add(row.start);
    if (row.end < end) changes.add(yearAtPosition(yearPosition(row.end) + 1));
  }
  return {start, end, frames: [...changes].sort((a, b) => a - b)};
}
