import test from 'node:test';
import assert from 'node:assert/strict';
import '../sheets.js';
import {covers,dayMs,eventSpan,isoDate,mapTimeBounds,territorySpans} from '../src/timed-map-model.ts';

const {dateRange}=SheetData;
const day=date=>dateRange(date).start/dayMs;

test('territory changes land on exact boundaries without carrying expired borders forward',()=>{
 const row={주체ID:'de',영토유형:'sovereignty',설명:'',종료일:''};
 const territories=territorySpans([
  {...row,영토ID:'west',지도참조키:'west',시작일:'1949-05-23',종료일:'1990-10-02'},
  {...row,영토ID:'east',지도참조키:'east',시작일:'1949-10-07',종료일:'1990-10-02'},
  {...row,영토ID:'unified',지도참조키:'unified',시작일:'1990-10-03'},
  {...row,영토ID:'invalid',지도참조키:'invalid',시작일:'1990-02-31'}
 ],dateRange);
 assert.deepEqual(territories.filter(row=>covers(row,day('1990-10-02'))).map(row=>row.id),['west','east']);
 assert.deepEqual(territories.filter(row=>covers(row,day('1990-10-03'))).map(row=>row.id),['unified']);
 assert.deepEqual(mapTimeBounds([{start:day('1990-10-01'),end:day('1990-10-05')}],territories).frames.map(isoDate),
  ['1990-10-01','1990-10-03','1990-10-05']);
});

test('the map preserves month precision and includes the full recorded final day',()=>{
 const event=eventSpan({bounds:dateRange('1950-06'),endDate:'1953-07'},dateRange);
 assert.equal(isoDate(event.start),'1950-06-01');
 assert.equal(isoDate(event.end),'1953-07-31');
 assert.ok(covers(event,day('1953-07-27')));
 assert.ok(!covers(event,day('1953-08-01')));
 const dayEvent=eventSpan({bounds:dateRange('1953-07-27')},dateRange);
 assert.ok(covers(dayEvent,day('1953-07-27')));
 assert.ok(!covers(dayEvent,day('1953-07-28')));
});
