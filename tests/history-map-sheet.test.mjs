import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sheetLibrary,
  loadSheetLibrary,
  sheetPoint,
  refreshDrawing,
} from '../assets/history-map/sheet-library.js';

const presets = {
  eras: ['근현대'],
  themes: [{ name: '원본 묶음', era: '근현대', places: ['a', 'b', 'removed'] }],
};
const tables = {
  공간: [
    { 공간ID: 'a', 공간명: '중앙', 지도참조키: 'point_a', 시대별칭: '옛 이름' },
    { 공간ID: 'b', 공간명: '중앙', 지도참조키: 'point_b' },
    { 공간ID: 'c', 공간명: '빈 좌표', 지도참조키: 'point_c' },
  ],
  지도도형: [
    { 지도참조키: 'point_a', 경도: '0', 위도: '0' },
    { 지도참조키: 'point_b', 경도: '-77.1', 위도: '38.2' },
    { 지도참조키: 'point_c', 경도: '', 위도: '0' },
  ],
  카테고리: [{ 카테고리ID: 'c1', 카테고리명: '시트에 추가한 주제' }],
  카테고리_공간: [
    { 카테고리ID: 'c1', 공간ID: 'b' },
    { 카테고리ID: 'c1', 공간ID: 'b' },
    { 카테고리ID: 'c1', 공간ID: 'c' },
  ],
};

test('sheet IDs distinguish namesakes and themes resolve only current, mappable spaces', () => {
  const { places, themes } = sheetLibrary(tables, presets);
  assert.deepEqual(
    places.map((p) => [p.id, p.lon, p.lat]),
    [
      ['a', 0, 0],
      ['b', -77.1, 38.2],
    ],
  );
  assert.match(places[0].keywords, /옛 이름/);
  assert.deepEqual(
    themes.map((t) => t.places),
    [['b'], ['a', 'b']],
  );
});

test('a timeline category keeps its ID even when empty or named like an example map', () => {
  const { themes } = sheetLibrary(
    {
      ...tables,
      카테고리: [
        { 카테고리ID: 'c1', 카테고리명: '원본 묶음', 시작일: '1950' },
        { 카테고리ID: 'c2', 카테고리명: '원본 묶음' },
      ],
    },
    presets,
  );
  assert.deepEqual(
    themes.map((t) => [t.source, t.id, t.places]),
    [
      ['시트 주제', 'c1', ['b']],
      ['시트 주제', 'c2', []],
      ['편집기 주제', undefined, ['a', 'b']],
    ],
  );
  assert.equal(themes[0].era, '1950');
});

test('reopening a drawing updates sheet positions and preserves authored labels and custom marks', () => {
  const { places } = sheetLibrary(tables, presets);
  const a = sheetPoint(places[0]),
    b = { ...sheetPoint(places[1]), name: '내 이름', labelOffset: [1, 2] };
  const doc = { points: [a, b, { name: '직접 추가', lon: 3, lat: 4 }] };
  refreshDrawing(doc, new Map(places.map((p) => [p.id, { ...p, name: '변경됨', lon: 55 }])));
  assert.deepEqual(
    doc.points.map((p) => [p.name, p.lon]),
    [
      ['변경됨', 55],
      ['내 이름', 55],
      ['직접 추가', 3],
    ],
  );
  assert.deepEqual(b.labelOffset, [1, 2]);
});

test('each visit reads fresh rows and distinguishes offline copies from a successfully emptied sheet', async () => {
  const config = { id: 'test' },
    values = new Map(),
    storage = { getItem: (k) => values.get(k), setItem: (k, v) => values.set(k, v) };
  const load = (read) => loadSheetLibrary(config, presets, read, storage);
  const offline = () => {
    throw Error('offline');
  };
  assert.equal((await load(offline)).source, 'unavailable');
  assert.equal((await load((_, name) => tables[name])).places.length, 2);
  assert.equal((await load(offline)).source, 'cached');
  const empty = await load(() => []);
  assert.equal(empty.source, 'live');
  assert.deepEqual(empty.places, []);
  assert.deepEqual((await load(offline)).places, []);
});

test('resolves point coordinates by the sheet’s external IDs with one request per referenced file', async (t) => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async (path) => {
    requests++;
    assert.equal(path, '/assets/event-geometry/place-points.geojson');
    return Response.json({
      type: 'FeatureCollection',
      features: [
        { id: 'external-b', geometry: { type: 'Point', coordinates: [127, 37] } },
        { id: 'external-a', geometry: { type: 'Point', coordinates: [0, 0] } },
      ],
    });
  });
  const data = {
    ...tables,
    지도도형: ['a', 'b'].map((id) => ({
      지도참조키: 'point_' + id,
      도형유형: 'point',
      외부도형ID: 'external-' + id,
      파일경로: 'assets/event-geometry/place-points.geojson',
      경도: '',
      위도: '',
    })),
  };
  const library = await loadSheetLibrary({ id: 'test' }, presets, (_, name) => data[name], null);
  assert.equal(library.source, 'live');
  assert.equal(requests, 1);
  assert.deepEqual(
    library.places.map((p) => [p.id, p.lon, p.lat]),
    [
      ['a', 0, 0],
      ['b', 127, 37],
    ],
  );
});

test('a missing point file cannot overwrite a good cached library with zero places', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('Not found', { status: 404 }));
  const good = sheetLibrary(tables, presets);
  const storage = { getItem: () => JSON.stringify(good), setItem: () => assert.fail('bad read cached') };
  const data = {
    ...tables,
    지도도형: [
      {
        지도참조키: 'point_a',
        외부도형ID: 'a',
        도형유형: 'point',
        파일경로: 'assets/event-geometry/missing.geojson',
      },
    ],
  };
  const library = await loadSheetLibrary({ id: 'test' }, presets, (_, name) => data[name], storage);
  assert.equal(library.source, 'cached');
  assert.deepEqual(library.places, good.places);
});
