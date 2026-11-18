import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {dashboardTables,historyDataTables} from '../src/data-explorer-model.ts';
import {koreanHistory} from '../src/korean-history.ts';
import {packages} from '../src/workspace-model.ts';

const context = vm.createContext({URL});
vm.runInContext(readFileSync(new URL('../sheet-snapshot.js',import.meta.url),'utf8'),context);
const sheet = context.SHEET_SNAPSHOT.tables;
const korea = koreanHistory([]);
const datasets = {'cold-war':sheet,'korean-history':historyDataTables(korea,sheet.tenure_periods)};
const sources = packages.map(pkg=>({...pkg,tables:datasets[pkg.id]}));

test('dashboard aggregates the registered packages and scopes rows and relations together',()=>{
 const all = dashboardTables(sources);
 assert.deepEqual(all.packages.map(row=>row.package_id),packages.map(pkg=>pkg.id));
 assert.equal(all.events.length,sheet.events.length+korea.events.length);
 assert.equal(all.categories.length,sheet.categories.length+korea.topics.length);
 assert.equal(all.countries.find(row=>row.actor_id==='actor_kor').iso3,'KOR');
 assert.ok(all.event_categories.every(link=>all.categories.some(row=>row.package_id===link.package_id&&row.topic_id===link.topic_id)));
 const scoped = dashboardTables(sources,'korean-history');
 assert.equal(scoped.events[0].title,'강화도 조약 체결');
 assert.ok(scoped.events.every(row=>row.package_id==='korean-history'&&row.review_status==='summary'));
 for (const {event_id,topic_id} of scoped.event_categories) {
  assert.ok(scoped.events.some(row=>row.event_id===event_id));
  assert.ok(scoped.categories.some(row=>row.topic_id===topic_id));
 }
 for (const {event_id,actor_id} of scoped.event_countries) {
  assert.ok(scoped.events.some(row=>row.event_id===event_id));
  assert.ok(scoped.countries.some(row=>row.actor_id===actor_id));
 }
 const empty = dashboardTables([...sources,{id:'new-package',name:'새 패키지'}],'new-package');
 assert.deepEqual(empty.packages,[{package_id:'new-package',name:'새 패키지'}]);
 assert.equal(empty.events.length,0);
 assert.equal(empty.categories.length,0);
});
