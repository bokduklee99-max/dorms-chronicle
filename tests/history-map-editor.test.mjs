import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { camera, draw, presets, xy, ll } from '../assets/history-map/cartography.js';

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
      const [lon, lat] = ll(view, ...xy(view, p.lon, p.lat));
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
