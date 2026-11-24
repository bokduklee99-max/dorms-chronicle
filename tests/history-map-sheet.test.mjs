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
  패키지: [{ 패키지ID: 'pkg', 패키지명: '수업 패키지' }],
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
  카테고리: [{ 카테고리ID: 'c1', 패키지ID: 'pkg', 카테고리명: '시트에 추가한 주제' }],
  카테고리_공간: [
    { 카테고리ID: 'c1', 공간ID: 'b' },
    { 카테고리ID: 'c1', 공간ID: 'b' },
    { 카테고리ID: 'c1', 공간ID: 'c' },
  ],
};

test('sheet IDs distinguish namesakes and themes resolve only current, mappable spaces', () => {
  const { packages, places, themes } = sheetLibrary(tables, presets);
  assert.deepEqual(packages, [{ id: 'pkg', name: '수업 패키지' }]);
  assert.equal(themes[0].packageId, 'pkg');
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
        { 카테고리ID: 'c1', 패키지ID: 'pkg', 카테고리명: '원본 묶음', 시작일: '1950' },
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

test('visits use current sheet rows, including edits and deletions, and never serve an offline copy', async () => {
  const config = { id: 'test' };
  const load = read => loadSheetLibrary(config, presets, read);
  assert.equal((await load((_, name) => tables[name])).places.length, 2);
  const updated = await load((_, name) => name === '공간' ? [{ ...tables.공간[0], 공간명: '수정됨' }] : tables[name]);
  assert.deepEqual(updated.places.map(p => p.name), ['수정됨']);
  const empty = await load(() => []);
  assert.equal(empty.source, 'live');
  assert.deepEqual(empty.places, []);
  const offline = await load(() => { throw Error('offline'); });
  assert.equal(offline.source, 'unavailable');
  assert.deepEqual(offline.places, []);
});

test('a failed tab retries by name and an optional tab failure preserves fresh places', async () => {
  const config = { id: 'test', sheetIds: { 공간: 1 } };
  let retried = false;
  const library = await loadSheetLibrary(config, presets, (source, name) => {
    if (name === '공간' && source.sheetIds) throw Error('export failed');
    if (name === '공간') retried = true;
    if (name === '지도뷰') throw Error('unavailable');
    return tables[name] || [];
  });
  assert.ok(retried);
  assert.deepEqual(library.failedTabs, ['지도뷰']);
  assert.equal(library.places.length, 2);
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

test('a missing sheet-referenced point file reports the failure and keeps the current categories', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('Not found', { status: 404 }));
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
  const library = await loadSheetLibrary({ id: 'test' }, presets, (_, name) => data[name]);
  assert.equal(library.source, 'live');
  assert.equal(library.unresolved, 1);
  assert.deepEqual(library.places, []);
  assert.equal(library.themes[0].id, 'c1');
});

test('catalog uses sheet geometry and subtype labels even when a line has a reference coordinate', () => {
  const data = {
    ...tables,
    공간: [...tables.공간,
      { 공간ID: 'border', 공간명: '경계', 공간유형: 'line', 지도참조키: 'line-key' },
      { 공간ID: 'region', 공간명: '지역', 공간유형: 'area', 지도참조키: 'area-key' }],
    지도도형: [...tables.지도도형,
      { 지도참조키: 'line-key', 도형유형: 'line', 경도: '0', 위도: '0' },
      { 지도참조키: 'area-key', 도형유형: 'area' },
      { 지도참조키: 'front-key', 도형유형: 'line', 기준시점: '전선' }],
    영토변화: [
      { 지도참조키: 'area-key', 영토유형: 'sovereignty' },
      { 지도참조키: 'front-key', 영토유형: 'occupation' }],
    유형설명: [{ 시트명: '영토변화', 컬럼명: '영토유형', 유형값: 'occupation', 한글명: '전선 유형' }],
  };
  const { places, shapes } = sheetLibrary(data, presets);
  assert.deepEqual(places.map(p => p.id), ['a', 'b']);
  assert.deepEqual(shapes.map(s => [s.name, s.type, s.kind]), [
    ['경계', 'line', '경계·선'], ['지역', 'area', '주권·국경'], ['전선', 'line', '전선 유형'],
  ]);
});

test('area choices keep the space name and show sheet periods separately', () => {
  const { shapes } = sheetLibrary({
    ...tables,
    공간: [
      { 공간ID: 'dated', 공간명: '고구려', 공간유형: 'area', 지도참조키: 'dated' },
      { 공간ID: 'open', 공간명: '대한민국', 공간유형: 'area', 지도참조키: 'open' },
      { 공간ID: 'snapshot', 공간명: '중국 관내', 공간유형: 'area', 지도참조키: 'snapshot' },
      { 공간ID: 'line', 공간명: '경계', 공간유형: 'line', 지도참조키: 'line' },
    ],
    지도도형: [
      { 지도참조키: 'dated', 도형유형: 'area', 기준시점: '원자료 · 출처' },
      { 지도참조키: 'open', 도형유형: 'area', 기준시점: '1960년 판본' },
      { 지도참조키: 'snapshot', 도형유형: 'area', 기준시점: '1921–1945년 중화민국 영역 · 출처' },
      { 지도참조키: 'line', 도형유형: 'line' },
    ],
    영토변화: [
      { 지도참조키: 'dated', 영토유형: 'sovereignty', 시작일: '-36', 종료일: '22' },
      { 지도참조키: 'dated', 영토유형: 'sovereignty', 시작일: '-36', 종료일: '22' },
      { 지도참조키: 'open', 영토유형: 'sovereignty', 시작일: '1953-07-27', 종료일: '' },
      { 지도참조키: 'line', 영토유형: 'occupation', 시작일: '1945', 종료일: '1950' },
    ],
  }, presets);
  assert.deepEqual(shapes.map(({ name, period }) => [name, period]), [
    ['고구려', '기원전 36년 ~ 22년'],
    ['대한민국', '1953-07-27부터'],
    ['중국 관내', '1921–1945년 기준'],
    ['경계', undefined],
  ]);
});
