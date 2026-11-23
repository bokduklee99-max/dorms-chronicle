// All layers use the source basemap's Mercator projection, including at high zoom.
export const W = 900,
  H = 610;
const rad = Math.PI / 180;
const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * rad) / 2)) / rad;
export const presets = {
  korea: [127.9, ll({ lon: 127.9, lat: 43.2, span: 8.6 }, W / 2, H / 2 + (W * 907) / 1200)[1], 8.6],
  south: [128.1, 35.95, 11],
  north: [126.5, 41.5, 19],
  east: [125, 36.9, 48],
  world: [69, 50, 162],
  globe: [0, 20, 360],
};
export const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export function xy(view, lon, lat, height = H) {
  const k = W / view.span;
  return [W / 2 + (lon - view.lon) * k, height / 2 + (merc(view.lat) - merc(lat)) * k];
}
export function ll(view, x, y, height = H) {
  const k = W / view.span;
  return [
    view.lon + (x - W / 2) / k,
    (2 * Math.atan(Math.exp((merc(view.lat) - (y - height / 2) / k) * rad)) - Math.PI / 2) / rad,
  ];
}
export function camera(base) {
  const [lon, lat, span] = presets[base];
  return { base, lon, lat, span };
}
const text = (x, y, content, attrs = '') =>
  '<text x="' + x + '" y="' + y + '" ' + attrs + '>' + esc(content) + '</text>';
const elPath = (d, attrs) => (d ? '<path d="' + d + '" ' + attrs + '/>' : '');
const rect = (x, y, w, h, attrs) =>
  '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" ' + attrs + '/>';
export const mapHeight = (view) => (view.base === 'korea' ? (W * 907) / 600 : H);
export function definitions(bases) {
  // Match the reference's default Korean base: white land, gray water and dashed borders.
  const defs = Object.entries(bases)
    .map(
      ([key, b]) =>
        '<svg id="geo-' +
        key +
        '" width="' +
        b.w +
        '" height="' +
        b.h +
        '" overflow="hidden">' +
        rect(0, 0, b.w, b.h, 'fill="#d9d9d9"') +
        elPath(b.land, 'fill="#fff" fill-rule="evenodd"') +
        (key === 'korea' || key === 'north'
          ? elPath(
              b.border,
              'fill="none" stroke="#444" stroke-width=".8" stroke-dasharray="3 2" vector-effect="non-scaling-stroke"',
            )
          : '') +
        elPath(
          b.coast,
          'fill="none" stroke="#111" stroke-width=".8" stroke-linejoin="round" vector-effect="non-scaling-stroke"',
        ) +
        '</svg>',
    )
    .join('');
  return (
    '<defs><marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#333"/></marker>' +
    defs +
    '</defs>'
  );
}
export function draw(doc, bases, unit = 1, selected = null) {
  const camera = doc.view,
    H = mapHeight(camera),
    labels = doc.labels !== false;
  const project = (lon, lat) => xy(camera, lon, lat, H),
    invert = (x, y) => ll(camera, x, y, H);
  function placeMarks(unit) {
    const size = 13 * unit,
      gap = 7 * unit;
    const pins = doc.points.map((p) => ({ p, at: project(p.lon, p.lat) }));
    const used = pins.map(({ at: [x, y] }) => ({
      x: x - 4 * unit,
      y: y - 4 * unit,
      w: 8 * unit,
      h: 8 * unit,
    }));
    return pins
      .map(({ p, at: [x, y] }, index) => {
        if (x < 0 || x > W || y < 0 || y > H) return '';
        const width = Array.from(p.name).length * size;
        let chosen;
        positions: for (const row of [0, -1, 1, -2, 2, -3, 3]) {
          for (const right of [true, false]) {
            const bx = right ? x + gap : x - gap - width,
              by = y + row * (size + 4 * unit) - size * 0.55;
            const box = { x: bx, y: by, w: width, h: size + 2 * unit };
            if (!chosen) chosen = box;
            if (bx < 2 || bx + width > W - 2 || by < 2 || by + size > H - 2) continue;
            if (
              used.some(
                (b) => bx < b.x + b.w + unit && bx + width > b.x - unit && by < b.y + b.h && by + box.h > b.y,
              )
            )
              continue;
            chosen = box;
            break positions;
          }
        }
        if (p.labelOffset)
          chosen = { ...chosen, x: x + p.labelOffset[0], y: y + p.labelOffset[1] - size * 0.55 };
        used.push(chosen);
        const cy = chosen.y + size * 0.55;
        const leader =
          labels && Math.abs(cy - y) > unit
            ? elPath(
                'M' + x + ' ' + y + 'L' + Math.max(chosen.x, Math.min(x, chosen.x + width)) + ' ' + cy,
                'stroke="#444" stroke-width="' + 0.65 * unit + '" fill="none"',
              )
            : '';
        const dot = (r, attrs) =>
          '<circle cx="' + x + '" cy="' + y + '" r="' + r * unit + '" ' + attrs + '/>';
        return (
          '<g data-point="' +
          index +
          '" role="button" aria-label="' +
          esc(p.name) +
          ' 선택" tabindex="0">' +
          dot(9, 'fill="transparent"') +
          leader +
          dot(3.1, 'fill="#111"') +
          (selected?.kind === 'points' && selected.index === index
            ? dot(
                6.3,
                'data-selection="" fill="none" stroke="#555" stroke-dasharray="' +
                  2 * unit +
                  ' ' +
                  2 * unit +
                  '" stroke-width="' +
                  unit +
                  '"',
              )
            : '') +
          (labels
            ? text(
                chosen.x,
                chosen.y + size * 0.93,
                p.name,
                'font-size="' +
                  size +
                  '" fill="#111" stroke="#fff" stroke-width="' +
                  1.6 * unit +
                  '" paint-order="stroke" stroke-linejoin="round"',
              )
            : '') +
          '</g>'
        );
      })
      .join('');
  }
  const [west, north] = invert(0, 0),
    [east, south] = invert(W, H);
  const isKorea = camera.span < 35 && east > 123 && west < 133 && south < 44 && north > 32;
  let map = '';
  for (const key of [
    'globe',
    'world',
    'east',
    ...(['north', 'south'].includes(camera.base) ? [camera.base] : isKorea ? ['korea'] : []),
  ]) {
    const b = bases[key],
      [lo, hi, , top] = b.bbox,
      [x, y] = project(lo, top);
    map +=
      '<use href="#geo-' +
      key +
      '" transform="translate(' +
      x +
      ' ' +
      y +
      ') scale(' +
      ((hi - lo) * W) / camera.span / b.w +
      ')"/>';
  }
  const seaNames = isKorea
    ? [
        ['동해', 130.4, 38.7],
        ['황해', 124.9, 36.9],
      ]
    : [
        ['동해', 134.5, 40],
        ['황해', 123.6, 35.6],
      ];
  const seas =
    camera.span <= 55
      ? seaNames
          .map(([name, lon, lat]) => {
            const [x, y] = project(lon, lat);
            return x > 26 * unit && x < W - 26 * unit && y > 16 * unit && y < H - 8 * unit
              ? text(
                  x,
                  y,
                  name,
                  'text-anchor="middle" font-size="' +
                    13 * unit +
                    '" font-style="italic" font-family="Batang,AppleMyungjo,serif" fill="#444"',
                )
              : '';
          })
          .join('')
      : '';
  const [isletX, isletY] = project(131.87, 37.24);
  const dokdo = isKorea
    ? '<ellipse cx="' +
      isletX +
      '" cy="' +
      isletY +
      '" rx="' +
      1.3 * unit +
      '" ry="' +
      1.3 * unit +
      '" fill="white" stroke="#111" stroke-width="' +
      0.8 * unit +
      '"/>'
    : '';
  const routes = doc.routes
    .map(
      (route) =>
        '<polyline points="' +
        route.map((p) => project(...p).join(',')).join(' ') +
        '" fill="none" stroke="#333" stroke-width="' +
        1.6 * unit +
        '" stroke-dasharray="' +
        5 * unit +
        ' ' +
        3 * unit +
        '" marker-end="url(#arrow)"/>',
    )
    .join('');
  const notes = doc.notes
    .map((p, i) => {
      const [x, y] = project(p.lon, p.lat);
      return (
        '<g data-note="' +
        i +
        '" role="button" tabindex="0" aria-label="' +
        esc(p.name) +
        '">' +
        text(
          x,
          y,
          p.name,
          'font-size="' +
            14 * unit +
            '" fill="#111" stroke="white" stroke-width="' +
            3 * unit +
            '" paint-order="stroke"',
        ) +
        '</g>'
      );
    })
    .join('');
  return (
    rect(0, 0, W, H, 'fill="#d9d9d9"') +
    map +
    dokdo +
    seas +
    routes +
    placeMarks(unit) +
    notes +
    rect(
      unit / 2,
      unit / 2,
      W - unit,
      H - unit,
      'fill="none" stroke="#222" stroke-width="' + unit + '" pointer-events="none"',
    )
  );
}
