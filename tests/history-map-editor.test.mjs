import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { camera, draw, presets, xy, ll, mapHeight } from '../assets/history-map/cartography.js';

const data = (name) => JSON.parse(readFileSync(new URL('../assets/history-map/' + name, import.meta.url)));
const bases = data('bases.json');
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
