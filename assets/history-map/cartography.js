// All layers use the source basemap's Mercator projection, including at high zoom.
export const W = 900,
  H = 610;
const rad = Math.PI / 180;
const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * rad) / 2)) / rad;
export const presets = {
  korea: [127.6, 38.25, 19],
  south: [128.1, 35.95, 11],
  north: [126.5, 41.5, 19],
  east: [125, 36.9, 48],
  world: [69, 50, 162],
};
export const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export function xy(view, lon, lat) {
  const k = W / view.span;
  return [W / 2 + (lon - view.lon) * k, H / 2 + (merc(view.lat) - merc(lat)) * k];
}
export function ll(view, x, y) {
  const k = W / view.span;
  return [
    view.lon + (x - W / 2) / k,
    (2 * Math.atan(Math.exp((merc(view.lat) - (y - H / 2) / k) * rad)) - Math.PI / 2) / rad,
  ];
}
export function camera(base) {
  const [lon, lat, span] = presets[base];
  return { base, lon, lat, span };
}
const sea = '#d6e8e6',
  land = '#f1edda',
  peninsula = '#e6e7c9',
  ink = '#294c42',
  accent = '#bc553e';
const path = (d, attrs) => (d ? '<path d="' + d + '" ' + attrs + '/>' : '');
export function definitions(bases) {
  return (
    '<defs><clipPath id="frame"><rect width="900" height="610"/></clipPath><marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="' +
    accent +
    '"/></marker>' +
    Object.entries(bases)
      .map(([key, b]) => {
        const bounded = '<rect width="' + b.w + '" height="' + b.h + '" fill="' + sea + '"/>';
        const coast = path(
          b.coast,
          'fill="none" stroke="#afcfcb" stroke-width="4" opacity=".6" vector-effect="non-scaling-stroke"',
        );
        const shore = path(
          b.coast,
          'fill="none" stroke="#728f80" stroke-width=".9" vector-effect="non-scaling-stroke"',
        );
        const rivers = (b.rivers || [])
          .map((r) =>
            path(r.d, 'fill="none" stroke="#8dbbb9" stroke-width="1" vector-effect="non-scaling-stroke"'),
          )
          .join('');
        return (
          '<svg id="base-' +
          key +
          '" width="' +
          b.w +
          '" height="' +
          b.h +
          '" overflow="hidden">' +
          bounded +
          coast +
          path(b.land, 'fill="' + land + '"') +
          path(b.krLand, 'fill="' + peninsula + '"') +
          shore +
          rivers +
          '</svg>'
        );
      })
      .join('') +
    '</defs>'
  );
}
function caption(x, y, t, size, attrs = '') {
  return '<text x="' + x + '" y="' + y + '" font-size="' + size + '" ' + attrs + '>' + esc(t) + '</text>';
}
export function draw(doc, bases, labelScale = 1) {
  const view = doc.view,
    k = W / view.span;
  const layers = ['world', 'east', ...(['korea', 'south', 'north'].includes(view.base) ? [view.base] : [])]
    .map((key) => {
      const b = bases[key],
        [lo, hi, , top] = b.bbox,
        [x, y] = xy(view, lo, top);
      return (
        '<use href="#base-' +
        key +
        '" transform="translate(' +
        x +
        ' ' +
        y +
        ') scale(' +
        ((hi - lo) * k) / b.w +
        ')"/>'
      );
    })
    .join('');
  const [west, north] = ll(view, 0, 0),
    [east, south] = ll(view, W, H);
  const step = [0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 30, 60].find((n) => n >= view.span / 7) || 60;
  let grid = '',
    ticks = '';
  for (let lon = Math.ceil(west / step) * step; lon < east; lon += step) {
    const [x] = xy(view, lon, view.lat);
    grid += 'M' + x + ' 0V610';
    if (x > 38 && x < W - 38)
      ticks += caption(x, H - 12, Math.abs(lon) + '°' + (lon < 0 ? 'W' : 'E'), 10, 'text-anchor="middle"');
  }
  for (let lat = Math.ceil(south / step) * step; lat < north; lat += step) {
    const [, y] = xy(view, view.lon, lat);
    grid += 'M0 ' + y + 'H900';
    if (y > 28 && y < H - 30) ticks += caption(14, y - 4, Math.abs(lat) + '°' + (lat < 0 ? 'S' : 'N'), 10);
  }
  const routes = doc.routes
    .map(
      (points) =>
        '<polyline points="' +
        points.map((p) => xy(view, ...p).join(',')).join(' ') +
        '" fill="none" stroke="' +
        accent +
        '" stroke-width="2.4" stroke-dasharray="7 4" marker-end="url(#arrow)"/>',
    )
    .join('');
  const labels = [];
  const points = doc.points
    .map((p, i) => {
      const [x, y] = xy(view, p.lon, p.lat);
      if (x < 0 || x > W || y < 0 || y > H) return '';
      const width = Math.max(35, Array.from(p.name).length * 15 + 12) * labelScale;
      const ly = p.labelOffset
        ? y + p.labelOffset[1]
        : ([0, -21, 21, -42, 42, -63, 63]
            .map((d) => y + d * labelScale)
            .find(
              (v) =>
                v > 14 &&
                v < H - 20 &&
                !labels.some(
                  (q) =>
                    Math.abs(q.y - v) < 19 * labelScale && Math.abs(q.x - x) < Math.max(q.width, width) + 10,
                ),
            ) ?? y);
      labels.push({ x, y: ly, width });
      const left = x + width + 15 > W;
      const tx = x + (p.labelOffset ? p.labelOffset[0] : (left ? -12 : 12) * labelScale);
      return (
        '<g data-point="' +
        i +
        '">' +
        (ly === y && !p.labelOffset
          ? ''
          : '<path d="M' + x + ' ' + y + ' L' + tx + ' ' + ly + '" stroke="' + ink + '" fill="none"/>') +
        '<circle cx="' +
        x +
        '" cy="' +
        y +
        '" r="6" fill="' +
        accent +
        '" stroke="#fffdf4" stroke-width="2"/>' +
        caption(
          tx,
          ly + 5,
          p.name,
          15 * labelScale,
          'font-weight="700" text-anchor="' +
            (left ? 'end' : 'start') +
            '" stroke="#f7f4e6" stroke-width="4" paint-order="stroke" stroke-linejoin="round"',
        ) +
        '</g>'
      );
    })
    .join('');
  const notes = doc.notes
    .map((n, i) => {
      const [x, y] = xy(view, n.lon, n.lat);
      return (
        '<g data-note="' +
        i +
        '">' +
        caption(
          x,
          y,
          n.name,
          16 * labelScale,
          'font-weight="700" fill="#70452e" stroke="#fffaf0" stroke-width="5" paint-order="stroke"',
        ) +
        '</g>'
      );
    })
    .join('');
  const waters = [
    ['황해', 123.7, 35.9],
    ['동해', 132.1, 38.7],
    ['남해', 128.5, 33.6],
  ];
  const waterLabels =
    view.span <= 26
      ? waters
          .map(([name, lon, lat]) => {
            const [x, y] = xy(view, lon, lat);
            return caption(
              x,
              y,
              name,
              17,
              'fill="#638986" letter-spacing="5" font-family="serif" text-anchor="middle"',
            );
          })
          .join('')
      : '';
  const scaleKm =
    [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000]
      .filter((n) => (n / (111.32 * Math.cos(view.lat * rad))) * k < 112)
      .at(-1) || 1;
  const scaleWidth = (scaleKm / (111.32 * Math.cos(view.lat * rad))) * k;
  const compass =
    '<g transform="translate(851 52)" stroke="' +
    ink +
    '"><circle r="17" fill="#f6f4df" fill-opacity=".72" stroke-width=".65"/><path d="M0 -23L5 3L0 0L-5 3Z" fill="' +
    ink +
    '"/><path d="M0 20L-4 0L0 3L4 0Z" fill="#fffcee"/><path d="M-13 0H13" stroke-width=".7"/></g>' +
    caption(851, 22, 'N', 12, 'text-anchor="middle" font-family="Georgia,serif"');
  const titleWidth = Math.min(410, Math.max(112, Array.from(doc.title).length * 22 + 34));
  return (
    '<g clip-path="url(#frame)" fill="' +
    ink +
    '" font-family="Apple SD Gothic Neo,Malgun Gothic,sans-serif"><rect width="900" height="610" fill="' +
    sea +
    '"/>' +
    layers +
    path(grid, 'stroke="#4f7670" opacity=".23" stroke-dasharray="2 5" fill="none"') +
    waterLabels +
    routes +
    points +
    notes +
    '<g font-family="monospace" fill="#53746b">' +
    ticks +
    '</g><g transform="translate(27 26)"><rect width="' +
    titleWidth +
    '" height="48" fill="#fbfaeb" fill-opacity=".95"/><rect width="4" height="48" fill="' +
    ink +
    '"/>' +
    caption(
      15,
      32,
      doc.title,
      23,
      'textLength="' +
        (titleWidth === 410
          ? 376
          : Math.min(titleWidth - 25, Math.max(22, Array.from(doc.title).length * 21))) +
        '" lengthAdjust="spacingAndGlyphs" font-weight="700" font-family="Georgia,AppleMyungjo,serif"',
    ) +
    '</g>' +
    compass +
    '<g transform="translate(33 566)"><rect x="-8" y="-17" width="' +
    (scaleWidth + 17) +
    '" height="29" rx="2" fill="#f6f5e6" fill-opacity=".85"/>' +
    caption(0, -3, scaleKm + ' km', 11, 'font-family="monospace"') +
    '<path d="M0 2v5h' +
    scaleWidth +
    'v-5" fill="none" stroke="' +
    ink +
    '" stroke-width="1.5"/></g></g>'
  );
}
