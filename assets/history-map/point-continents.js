export const unclassifiedContinent = '대륙 미분류';

function ringContains(ring, lon, lat) {
  let inside = false;
  for (let index = 1; index < ring.length; index++) {
    const [ax, ay] = ring[index - 1];
    const [bx, by] = ring[index];
    if ((ay > lat) !== (by > lat) && lon < ax + (bx - ax) * (lat - ay) / (by - ay)) inside = !inside;
  }
  return inside;
}

function coastDistance(ring, lon, lat, longitudeScale) {
  let nearest = Infinity;
  for (let index = 1; index < ring.length; index++) {
    const [ax, ay] = ring[index - 1];
    const [bx, by] = ring[index];
    const x = (ax - lon) * longitudeScale, y = ay - lat;
    const dx = (bx - ax) * longitudeScale, dy = by - ay;
    const length = dx * dx + dy * dy;
    const fraction = length ? Math.max(0, Math.min(1, -(x * dx + y * dy) / length)) : 0;
    nearest = Math.min(nearest, (x + fraction * dx) ** 2 + (y + fraction * dy) ** 2);
  }
  return nearest;
}

export function pointContinent({ lon, lat }, continents) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return unclassifiedContinent;
  const longitudeScale = Math.cos(lat * Math.PI / 180);
  let closest = unclassifiedContinent;
  // Match coastal sites up to roughly 110 km offshore to the nearest coast.
  let nearest = 1;
  for (const { name, polygons } of continents) {
    for (const { bounds: [west, south, east, north], rings: [outer, ...holes] } of polygons) {
      if (lat < south - 1 || lat > north + 1) continue;
      const x = [lon, lon - 360, lon + 360].find(value =>
        value >= west - 1 / longitudeScale && value <= east + 1 / longitudeScale);
      if (x === undefined) continue;
      if (ringContains(outer, x, lat) && !holes.some(hole => ringContains(hole, x, lat))) return name;
      const distance = coastDistance(outer, x, lat, longitudeScale);
      if (distance < nearest) {
        nearest = distance;
        closest = name;
      }
    }
  }
  return closest;
}
