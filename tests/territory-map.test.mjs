import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {boundariesAt, readTerritoryBoundaries, territoryAsset, territoryChanges, yearAtPosition, yearLabel, yearPosition} from '../assets/territory-map-model.js';

const assets = new URL('../assets/', import.meta.url);
const collection = JSON.parse(readFileSync(new URL(territoryAsset.url, assets)));
const {actors, boundaries} = readTerritoryBoundaries(collection);
const eastAsia = [93, 21, 150, 55];

test('the shipped edition uses the current basemap land and preserves source IDs and dates', () => {
  const source = readFileSync(new URL('event-geometry/cliopatria-east-asia.geojson', assets));
  const {land} = JSON.parse(readFileSync(new URL('event-geometry/context/east-asia.json', assets)));
  const hash = value => createHash('sha256').update(value).digest('hex');
  assert.equal(collection.clip.source_sha256, hash(source));
  assert.equal(collection.clip.land_sha256, hash(land));
  const sourceFeatures = JSON.parse(source).features;
  const metadata = features => features.map(({id, properties}) => ({id, properties}));
  assert.deepEqual(metadata(collection.features), metadata(sourceFeatures));
});

test('joins every supplied boundary to a stable polity and the registered map asset', () => {
  assert.equal(boundaries.length, collection.features.length);
  assert.equal(actors.size, 29);
  for (const row of boundaries) {
    assert.ok(actors.has(row.actor_id));
    assert.equal(row.asset_id, territoryAsset.asset_id);
    assert.equal(row.precision, 'approximate');
    assert.equal(row.review_status, 'draft');
  }
  assert.throws(() => readTerritoryBoundaries({...collection, features: [collection.features[0], collection.features[0]]}));
});

test('switches at the end of the inclusive source period and preserves coverage gaps', () => {
  const goryeo = boundaries.filter(row => actors.get(row.actor_id).polity === 'Goryeo');
  const at = (year, rows = goryeo, viewport = eastAsia) => boundariesAt(rows, year, viewport).map(row => row.feature_id);
  assert.deepEqual(at(935), ['clio_goryeo_922']);
  assert.deepEqual(at(936), ['clio_goryeo_936']);
  assert.deepEqual(at(1259), ['clio_goryeo_936']);
  assert.deepEqual(at(1260), []);
  assert.deepEqual(at(1362), []);
  assert.deepEqual(at(1363), ['clio_goryeo_1363']);
  assert.deepEqual(at(1100, goryeo, [140, 20, 145, 25]), []);
});

test('navigates both beginnings and disappearances without inventing a calendar year zero', () => {
  const {start, end, frames} = territoryChanges(boundaries);
  assert.equal(start, -91);
  assert.equal(end, 1897);
  assert.ok(frames.includes(1260));
  assert.ok(frames.includes(1363));
  assert.equal(yearLabel(-91), '기원전 91년');
  assert.equal(yearAtPosition(yearPosition(-1) + 1), 1);
  assert.deepEqual(territoryChanges([{start: -3, end: -1}, {start: 2, end: 3}]).frames, [-3, 1, 2, 3]);
});
