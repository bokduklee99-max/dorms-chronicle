import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../sheets.js';
import {readStoryEvents} from '../assets/story-events.js';
import {eventMapExamples,loadShape,mapAsset,mapLinks,shapePaths} from '../event-map-links.js';

test('new shape metadata accepts verified coordinate columns and inline GeoJSON areas', async () => {
 const ready={데이터형식:'geojson',좌표상태:'ready'};
 const point={...ready,도형유형:'point',경도:'0',위도:'37.56'};
 assert.deepEqual((await loadShape(point)).coordinates,[0,37.56]);
 await assert.rejects(loadShape({...point,경도:'181'}),/좌표/);
 const geometry={type:'Polygon',coordinates:[[[8,50],[10,50],[10,52],[8,50]]]};
 const encoded=Buffer.from(JSON.stringify({type:'Feature',geometry})).toString('base64');
 const area={...ready,도형유형:'area',지도데이터URL:'data:application/geo+json;base64,'+encoded};
 assert.deepEqual(await loadShape(area),geometry);
 await assert.rejects(loadShape({...area,좌표상태:'needs_digitize'}),/준비되지/);
});

test('an event resolves its space and registered shape through separate IDs', () => {
  const resolve = mapLinks(
    [['사건ID','공간ID'],['E056','cuba'],['E056','missing']],
    [['공간ID','공간명','공간유형','지도참조키','위도','경도'],['cuba','쿠바','area','geo_cuba','','']],
    [['지도참조키','도형유형','파일경로','외부도형ID','원본SVG','출처','기준시점'],
     ['geo_cuba','area','assets/event-geometry/cuba.geojson','CUB','','','1962년 당시 쿠바 국가 경계']],
  );
  const [place] = resolve('E056');
  assert.equal(resolve('E056').length,1);
  assert.equal(place.외부도형ID,'CUB');
  assert.deepEqual(resolve('E000'),[]);
});

test('map examples use the current event row and omit IDs absent from the event sheet', () => {
  const headers = ['사건명','사건ID','내용','날짜','종료일'];
  const rows = [headers,['첫 행','E001','','1910',''],['바뀐 사건명','E096','첫 줄\n둘째 줄','1973-09','']];
  assert.deepEqual(eventMapExamples(rows,['missing','E096']),[
    {사건명:'바뀐 사건명',사건ID:'E096',내용:'첫 줄\n둘째 줄',날짜:'1973-09',종료일:'',sheetRow:3},
  ]);
});

test('points resolve by key without coordinate columns and use registered GeoJSON', async (t) => {
  const file='assets/event-geometry/place-points.geojson';
  const snapshot=JSON.parse(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
  t.mock.method(globalThis,'fetch',async path=>{assert.equal(path,'/'+file);return Response.json(snapshot);});
  const resolve=mapLinks(
    [['사건ID','공간ID'],['E192','space1']],
    [['공간ID','공간명','공간유형','지도참조키'],['space1','서울','point','geo_seoul']],
    [['지도참조키','도형유형','파일경로','외부도형ID','원본SVG','출처','기준시점'],['geo_seoul','point',file,'geo_seoul']],
  );
  const [shape]=resolve('E192');
  assert.deepEqual((await loadShape(shape)).coordinates,[126.978,37.5665]);
  const inline=coordinates=>'data:application/geo+json,'+encodeURIComponent(JSON.stringify({type:'Point',coordinates}));
  assert.deepEqual((await loadShape({...shape,지도데이터URL:inline([12,34])})).coordinates,[12,34]);
  await assert.rejects(loadShape({...shape,지도데이터URL:inline([Infinity,91])}));
});

test('the packaged areas and lines contain usable paths and registered feature IDs', () => {
  const shapes = [
    ['cuba.geojson','CUB'],['japan.geojson','JPN'],
    ['berlin-wall-1989.geojson','berlinermauer:a_grenzmauer'],['korea-38th-parallel.geojson','KR-38N'],
  ];
  for (const [file,id] of shapes) {
    const path = mapAsset('assets/event-geometry/'+file,'geojson');
    const feature = JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
    assert.equal(feature.id,id);
    assert.ok(shapePaths(feature.geometry).every(line => line.length>=2));
    assert.ok(shapePaths(feature.geometry).length);
    if (id==='KR-38N') {
      const [line] = shapePaths(feature.geometry);
      assert.equal(feature.properties.source_feature_id,'boundary_38line.1');
      assert.equal(line.length,57);
      assert.ok(line.every(([,lat]) => lat===38));
      assert.deepEqual([line[0],line.at(-1)],[[124.2,38],[129.8,38]]);
    }
    if (id==='CUB') {
      assert.equal(feature.properties.gwcode,40);
      assert.equal(feature.properties.gwsyear,1902);
      assert.equal(feature.properties.gweyear,2023);
    }
  }
  assert.equal(mapAsset('https://another.example/cuba.geojson','geojson'),'');
});

test('playback reads linked categories and spaces and preserves the original event row', async (t) => {
  globalThis.SHEET_CONFIG = {id:'test',sheetIds:{사건:1,사건_카테고리:2,카테고리:3,공간:4,사건_공간:5}};
  t.after(() => {delete globalThis.SHEET_CONFIG;});
  const header = '사건ID,날짜,종료일,사건명,사건유형,내용,이미지';
  let title = '첫 제목';
  t.mock.method(globalThis,'fetch',async url => {
    const tables = {
      1:[header,'E9,1946,,마지막,event,,',',,,,,,','E1,1945,,'+title+',event,,'].join('\n'),
      2:'사건ID,카테고리ID\nE1,A\nE1,T',
      3:'카테고리ID,카테고리명,카테고리유형\nA,운동,arc\nT,주제,theme',
      4:'공간ID,공간명\nS,서울\nC,충칭',
      5:'사건ID,공간ID\nE1,C\nE1,S'
    };
    const table=tables[url.searchParams.get('gid')];
    assert.ok(table);
    return new Response(table);
  });
  for (const name of ['첫 제목','수정한 제목']) {
    title = name;
    const [event] = await readStoryEvents();
    assert.deepEqual([event.id,event.title,event.body,event.row],['E1',name,'',4]);
    assert.deepEqual([event.arcs,event.place],[['운동'],'충칭, 서울']);
  }
});

test('city backgrounds distinguish dated Seoul boundaries and Chinese map editions', async () => {
  const {pointBackdrop} = await import('../assets/space-preview-map.js');
  const seoul = {지도참조키:'geo_seoul',상위공간ID:'geo_korean_peninsula'};
  const chongqing = {지도참조키:'geo_chongqing',상위공간ID:'geo_china_proper'};
  for (const date of ['', '1919-03-01','1936-03-31']) assert.equal(pointBackdrop(seoul,date),'gyeongseong');
  for (const date of ['1914', '1936-04','1950-06-25']) assert.equal(pointBackdrop(seoul,date),'peninsula');
  for (const date of ['', '1950-09-15']) assert.equal(pointBackdrop({지도참조키:'geo_incheon',상위공간ID:'geo_korean_peninsula'},date),'incheon-coast');
  assert.equal(pointBackdrop(chongqing),'world-1938');
  assert.equal(pointBackdrop(chongqing,'1940-09'),'world-1938');
  assert.equal(pointBackdrop(chongqing,'1945-08-15'),'world-1945');
  assert.equal(pointBackdrop(chongqing,'1900'),'china-land');
  assert.equal(pointBackdrop({지도참조키:'geo_berlin'}),'');
});

test('Korean-history views resolve dated places, including regional areas and changes to Pyongyang', async () => {
  const {historicalView} = await import('../assets/space-preview-map.js');
  const keys = ['geo_pyongyang','geo_hongkou_park','geo_shanghai','geo_nanjing','geo_tokyo','geo_japan',
    'geo_gyeongseong_1919','geo_korean_peninsula','geo_china_proper','geo_manchuria_primorsky','geo_americas','geo_europe','geo_east_asia','geo_ussr'];
  for (const key of keys) {
    const view = historicalView({지도참조키:key},'1921',['geo_manchuria_primorsky']);
    assert.equal(view.day,'1921-01-01');
    if (!view.seoul) assert.ok(readFileSync(new URL('../assets/event-geometry/independence-'+(view.atlas || 'asia')+'.svg',import.meta.url)).length);
  }
  assert.equal(historicalView({지도참조키:'geo_ussr'},'1945'),null);
  assert.equal(historicalView({지도참조키:'geo_japan'},'1972'),null);
  assert.equal(historicalView({지도참조키:'geo_pyongyang'},'1931-05').day,'1931-05-01');
  const source = readFileSync(new URL('../assets/event-geometry/colonial-korea.svg',import.meta.url),'utf8');
  const districts = [...source.matchAll(/<path [^>]*start="([^"]+)" end="([^"]+)" name="평양부"/g)];
  const valid = day => districts.filter(([,start,end])=>start <= day && day <= end);
  assert.equal(valid('1920-01-01').length,1);
  assert.equal(valid('1931-01-01').length,1);
  assert.notEqual(valid('1920-01-01')[0][1],valid('1931-01-01')[0][1]);
});

test('regional reference maps contain local geography and identify the dates of country boundaries', () => {
  const region = name => JSON.parse(readFileSync(new URL('../assets/event-geometry/context/'+name+'.json',import.meta.url)));
  for (const [name,lon,lat] of [['cairo',31.2357,30.0444],['geneva',6.1432,46.2044],['moscow',37.6173,55.7558],['gyeongin',126.617,37.4769],['berlin',13.405,52.52]]) {
    const data = region(name);
    const [left,top,width,height] = data.box;
    assert.ok(left<lon && lon<left+width && top< -lat && -lat<top+height);
    assert.ok(data.cities.length && data.land.startsWith('M'));
  }
  assert.ok(region('geneva').lakes && region('cairo').rivers && region('gyeongin').rail);
  for (const name of ['middle-east','south-asia','iran','israel','afghanistan','india-pakistan']) {
    const data = region(name);
    assert.match(data.date,/^\d{4}-\d{2}-\d{2}$/);
    assert.ok(data.countries.length);
    if (!['middle-east','south-asia'].includes(name)) assert.ok(data.selected.length);
  }
});

test('map reader follows recorded event IDs separately for places and territorial changes', async () => {
  const {linkedMapEvents}=await import('../event-map-links.js');
  const events=linkedMapEvents({
    사건:[{사건ID:'E1',날짜:'1949',sheetRow:2},{사건ID:'E2',날짜:'1945',sheetRow:3},{사건ID:'unused',날짜:'1900'}],
    사건_공간:[{사건ID:'E1',공간ID:'p'},{사건ID:'E1',공간ID:'p'},{사건ID:'E1',공간ID:'missing'}],
    공간:[{공간ID:'p',공간명:'장소',공간유형:'point',지도참조키:'key'}],
    지도도형:[{지도참조키:'key',도형유형:'point'},{지도참조키:'area',도형유형:'area'}],
    영토변화:[{계기사건ID:'E2',지도참조키:'area',주체ID:'a',영토유형:'occupation',시작일:'1946'}],
    주체:[{주체ID:'a',주체명:'주체'}],사건_카테고리:[{사건ID:'E1',카테고리ID:'group'}]
  });
  assert.deepEqual(events.map(e=>e.사건ID),['E2','E1']);
  assert.deepEqual(events.map(e=>e.layers.map(l=>[l.label,l.shape.지도참조키])),[[['점령·전선 · 주체','area']],[['장소','key']]]);
  assert.ok(events[1].groups.has('group'));
  assert.equal(events[0].layers[0].start,'1946');
});
