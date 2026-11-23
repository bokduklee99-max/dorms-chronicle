import test from 'node:test';
import assert from 'node:assert/strict';
import { coldWarLibrary, historyCamera } from '../assets/history-map/cold-war.js';
import { sheetLibrary } from '../assets/history-map/sheet-library.js';
import { xy, W, mapHeight } from '../assets/history-map/cartography.js';

test('cold-war maps resolve category, event, space, edition, view and dated territory IDs', async () => {
  const point = { 공간ID: 'space-p', 공간명: '지점', 지도참조키: 'point' };
  const area = { 공간ID: 'space-a', 공간명: '지역', 지도참조키: 'area' };
  const data = {
    패키지: [{ 패키지ID: 'cold-war', 패키지명: '냉전' }],
    공간: [point, area],
    지도도형: [
      { 지도참조키: 'point', 도형유형: 'point', 경도: '2', 위도: '3' },
      {
        지도참조키: 'area',
        도형유형: 'area',
        지도데이터URL:
          'data:application/geo+json,' +
          encodeURIComponent(
            JSON.stringify({
              type: 'Polygon',
              coordinates: [
                [
                  [1, 2],
                  [2, 2],
                  [2, 3],
                  [1, 2],
                ],
              ],
            }),
          ),
        데이터형식: 'geojson',
        좌표상태: 'ready',
      },
      {
        지도참조키: 'backdrop',
        도형유형: 'basemap',
        파일경로: 'assets/event-geometry/test.geojson',
        기준시점: '시트 판본',
      },
    ],
    카테고리: [
      {
        카테고리ID: 'category',
        카테고리명: '수업',
        패키지ID: 'cold-war',
        지도참조키: 'backdrop',
        기본뷰ID: 'frame',
      },
    ],
    카테고리_공간: [],
    사건: [
      { 사건ID: 'event', 사건명: '연결된 사건', 날짜: '1962' },
      { 사건ID: 'other', 날짜: '1961' },
    ],
    사건_카테고리: [
      { 사건ID: 'event', 카테고리ID: 'category' },
      { 사건ID: 'other', 카테고리ID: 'category' },
    ],
    사건_패키지: [{ 사건ID: 'event', 패키지ID: 'cold-war' }],
    사건_공간: [point, area, point].map((s) => ({ 사건ID: 'event', 공간ID: s.공간ID })),
    영토변화: [{ 계기사건ID: 'event', 지도참조키: 'area', 시작일: '1962', 종료일: '1963', 설명: '경계' }],
    지도뷰: [{ 뷰ID: 'frame', 뷰명: '권역', 최소경도: '1', 최대경도: '5', 최소위도: '2', 최대위도: '6' }],
  };
  const library = sheetLibrary(data, { eras: [], themes: [] });
  const h = await coldWarLibrary(data, library, async (path) => {
    assert.equal(path, 'assets/event-geometry/test.geojson');
    return {
      features: [
        {
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [1, 2],
                [2, 2],
                [2, 3],
                [1, 2],
              ],
            ],
          },
        },
      ],
    };
  });
  assert.deepEqual(library.themes[0].events, ['event']);
  assert.deepEqual(library.themes[0].places, ['space-p']);
  assert.deepEqual(library.themes[0].layers, ['area']);
  assert.deepEqual(h.events.event.territories, [{ key: 'area', from: '1962', to: '1963', note: '경계' }]);
  assert.deepEqual(h.layers.area.bounds, [1, 2, 2, 3]);
  assert.ok(h.editions.backdrop.paths.length);
  const { bounds } = library.themes[0].frame,
    camera = historyCamera(bounds),
    height = mapHeight(camera);
  for (const [lon, lat] of [
    [1, 2],
    [5, 6],
  ]) {
    const [x, y] = xy(camera, lon, lat, height);
    assert.ok(x >= 0 && x <= W && y >= 0 && y <= height);
  }
});
