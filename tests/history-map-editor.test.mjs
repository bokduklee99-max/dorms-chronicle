import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { camera, draw, presets, xy, ll } from '../assets/history-map/cartography.js';

const data = (name) => JSON.parse(readFileSync(new URL('../assets/history-map/' + name, import.meta.url)));
const bases = data('bases.json');
const { places, themes } = data('places.json');

test('theme places resolve to unique entries with valid coordinates', () => {
  const lookup = new Set(places.map((p) => p.name));
  assert.equal(lookup.size, places.length);
  for (const p of places) assert.ok(Math.abs(p.lat) < 85 && Math.abs(p.lon) <= 180);
  for (const theme of themes) for (const name of theme.places) assert.ok(lookup.has(name), name);
});

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
