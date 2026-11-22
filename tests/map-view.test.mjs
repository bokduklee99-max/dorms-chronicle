import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {geographicSvgLines,mapCamera,projectedPath,readMapViews} from '../src/map-view.js';

test('map views read their sheet columns and keep the center and bounds in the requested projection', () => {
 const headers=['뷰ID','뷰명','투영법','중심경도','중심위도','최소경도','최소위도','최대경도','최대위도'];
 const korea=['view_korean_peninsula','한반도','geoMercator','127.5','38.0','123.5','33.0','132.0','43.5'];
 const views=readMapViews([headers,korea,['blank',...korea.slice(1,-1),''],['unknown',korea[1],'toString',...korea.slice(3)]]);
 assert.equal(views.size,1);
 const {box,project}=mapCamera(views.get(korea[0]));
 assert.deepEqual(project(127.5,38),[0,0]);
 const left=project(123.5,38)[0], right=project(132,38)[0], north=project(127.5,43.5)[1];
 assert.ok(box[0]<left&&left<0&&right>0&&right<box[0]+box[2]&&box[1]<north&&north<0);
 assert.notEqual(project(127.5,43)[1]-project(127.5,42)[1],project(127.5,34)[1]-project(127.5,33)[1]);
});

test('all seven registered local historical maps yield projectable rings', () => {
 for(const year of [1914,1920,1930,1938,1945,1960,1994]){
  const svg=readFileSync(new URL(`../assets/event-geometry/world-${year}.svg`,import.meta.url),'utf8');
  const paths=[...svg.matchAll(/<path d="([^"]+)"/g)];
  assert.ok(paths.length>100);
  for(const [,path] of paths) assert.ok(geographicSvgLines(path).length,`Invalid geographic path in ${year}`);
 }
 assert.equal(projectedPath(geographicSvgLines('M126,-38 127,-38'),(x,y)=>[x,-y],false),'M126,-38L127,-38');
 assert.deepEqual(geographicSvgLines('M500,400L540,480Z'),[]);
});
