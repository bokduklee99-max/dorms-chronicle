import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stories} from '../assets/asia-story-scenes.js';

const read = file => JSON.parse(readFileSync(new URL('../assets/'+file,import.meta.url),'utf8'));

test('both map stories follow dated sheet events and end with both branches or capitals in view', () => {
  for (const story of Object.values(stories)) {
    const dates = new Map(read('swimlane-'+story.dataset+'.json').events.map(e=>[e.id,e.date]));
    const sequence = story.scenes.map(scene=>dates.get(scene.id));
    assert.ok(sequence.every(Boolean));
    assert.deepEqual(sequence,sequence.toSorted());
    const end = story.scenes.at(-1);
    for (const {point:[lon,lat]} of end.pins) {
      assert.ok(Math.abs(lon-end.view.lon) < end.view.width/2);
      assert.ok(Math.abs(lat-end.view.lat) < end.view.height/2);
    }
  }
  assert.equal(stories.volunteers.scenes.at(-1).links.length,2);
  assert.equal(stories.diplomacy.scenes.at(-1).pins.length,2);
});

test('1945 source has all four distinct occupation-zone geometries', () => {
  const {features} = read('event-geometry/germany-zones-1945.geojson');
  assert.deepEqual(features.map(f=>f.id).sort(),['france','uk','usa','ussr']);
  assert.ok(features.every(f=>f.geometry.coordinates.length));
});
