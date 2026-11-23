import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { camera, comparisonYears, draw, historicalDefinitions, presets, xy, ll, mapHeight } from '../assets/history-map/cartography.js';

const data = (name) => JSON.parse(readFileSync(new URL('../assets/history-map/' + name, import.meta.url)));
const bases = data('bases.json');
const packed = (file) =>
  JSON.parse(gunzipSync(readFileSync(new URL('../assets/history-map/' + file, import.meta.url))));
const places = [
  { lon: 126.978, lat: 37.5665 },
  { lon: -77.0369, lat: 38.9072 },
  { lon: 0, lat: 0 },
];
test('clicking a projected point gives the same coordinates for each extent', () => {
  for (const key of Object.keys(presets)) {
    const view = camera(key);
    for (const p of places) {
      const height = mapHeight(view);
      const [lon, lat] = ll(view, ...xy(view, p.lon, p.lat, height), height);
      assert.ok(Math.abs(lon - p.lon) < 1e-8 && Math.abs(lat - p.lat) < 1e-8);
    }
  }
});

test('user annotations are escaped in exported SVG', () => {
  const note = { name: '<script>&', lat: 37, lon: 127 };
  const svg = draw(
    { title: note.name, view: camera('korea'), points: [note], notes: [note], routes: [] },
    bases,
  );
  assert.ok(svg.includes('&lt;script&gt;&amp;'));
  assert.ok(!svg.includes('<script>'));
});

test('portrait editing and export share geography but only the editor marks the selected point', () => {
  const {
    bbox: [west, , , north],
  } = bases.korea;
  const doc = {
    view: camera('korea'),
    points: [{ lon: 127, lat: 37, name: '수도' }],
    routes: [
      [
        [127, 37],
        [128, 38],
      ],
    ],
    notes: [],
  };
  const [x, y] = xy(doc.view, west, north, mapHeight(doc.view));
  assert.ok(Math.abs(x) < 0.001 && Math.abs(y) < 0.001);
  assert.match(draw(doc, bases, 1, { kind: 'points', index: 0 }), /data-selection/);
  const image = draw(doc, bases);
  assert.doesNotMatch(image, /data-selection/);
  assert.match(image, /<polyline/);
});


test('packaged backgrounds contain every registered edition and both modern boundary levels', () => {
  const editions = packed('editions.json.gz');
  const boundaries = packed('boundaries.json.gz');
  assert.equal(Object.keys(editions).length, 55);
  for (const year of [-123000, 400, 1945, 1980, 2010]) {
    const key = 'world_' + (year < 0 ? 'bc' : '') + Math.abs(year);
    assert.equal(editions[key].year, year);
  }
  for (const edition of Object.values(editions)) {
    assert.ok(edition.paths.length > 0);
    assert.ok(edition.paths.every((d) => d.startsWith('M') && d.endsWith('Z')));
  }
  assert.deepEqual(Object.keys(boundaries).sort(), ['countries', 'provinces']);
  for (const path of Object.values(boundaries)) assert.match(path, /^M[-.,0-9LM]+$/);
});

test('historical borders and modern first-level boundaries can be selected independently', () => {
  const history = {
    editions: { old: { name: '시대별 배경', paths: ['M1,1L2,2Z'] } },
    boundaries: { countries: 'M1,1L2,2', provinces: 'M3,3L4,4' },
    layers: {},
  };
  const doc = { view: camera('korea'), points: [], notes: [], routes: [] };
  function svg(options) {
    return historicalDefinitions(history, options.edition, [], options) +
      draw({ ...doc, ...options }, bases, 1, null, history);
  }
  assert.match(svg({}), /href="#modern-borders"/);
  assert.doesNotMatch(svg({}), /href="#modern-provinces"/);
  for (const edition of ['old', undefined]) {
    for (const countryBorders of [true, false]) {
      for (const provinceBorders of [true, false]) {
        const image = svg({ edition, countryBorders, provinceBorders });
        assert.equal(image.includes('href="#historic-land"'), !!edition);
        assert.equal(image.includes('href="#modern-borders"'), !edition && countryBorders);
        assert.equal(image.includes('href="#modern-provinces"'), provinceBorders);
        if (edition) assert.equal(/id="historic-land"[^>]*stroke="none"/.test(image), !countryBorders);
      }
    }
  }
});

test('the packaged provincial lines cross the shared borders of neighboring East Asian regions', () => {
  // Midpoints sampled from the unsimplified shared edges in Natural Earth Admin 1.
  const samples = [
    ['Hebei–Shandong', 116.27883, 37.55013],
    ['Guangdong–Fujian', 116.75625, 24.59404],
    ['Tokyo–Saitama', 139.39163, 35.75415],
    ['Seoul–Gyeonggi', 127.17641, 37.55766],
  ];
  const lines = packed('boundaries.json.gz').provinces.split('M').slice(1)
    .map((line) => line.split('L').map((vertex) => vertex.split(',').map(Number)));
  for (const [name, lon, lat] of samples) {
    const y = -Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * 180 / Math.PI;
    const near = lines.some((line) => line.some(([x2, y2], i) => {
      if (!i) return false;
      const [x1, y1] = line[i - 1];
      const dx = x2 - x1, dy = y2 - y1;
      const t = Math.max(0, Math.min(1, ((lon - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(lon - x1 - t * dx, y - y1 - t * dy) < 0.015;
    }));
    assert.ok(near, name);
  }
});


test('switching to an outline retains comparison years and older saved maps recover their active year', () => {
  const editions = { world_1945: { paths: ['M1,1Z'] }, world_1980: { paths: ['M2,2Z'] } };
  assert.deepEqual(comparisonYears({}, editions), []);
  assert.deepEqual(comparisonYears({ background: 'world_1945' }, editions), ['world_1945']);
  const backgroundYears = ['world_1945', 'missing', 'world_1980', 'world_1945'];
  for (const background of ['outline', 'world_1945']) {
    assert.deepEqual(comparisonYears({ background, backgroundYears }, editions), ['world_1945', 'world_1980']);
  }
});
