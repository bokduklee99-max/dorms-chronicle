import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';

const folder=new URL('../mockups/modal-catalog/',import.meta.url);
const scripts=['../../sheet-config.js','../../sheets.js','sheet-data.js','../../assets/record-place-map.js','../../assets/record-views.js','place-map.js','records.js','specimens.js'];
const code=scripts.map(f=>readFileSync(new URL(f,folder),'utf8')).join('\n');
const {data,catalog,model,shapeFile}=runInNewContext(code+';({data:catalogSnapshot,catalog:catalogue,model:records,shapeFile:catalogue.shape.파일경로})',{URL,atob});
const full=id=>catalog.byId.get(id).render({mini:false});
test('all mockups and their related records open without internal view switches',()=>{
  assert.equal(new Set(catalog.items.map(c=>c.id)).size,catalog.items.length);
  for(const item of catalog.items){
    const html=full(item.id);
    assert.equal((html.match(/id="modal-title"/g)||[]).length,1,item.id);
    assert.doesNotMatch(html,/href="[^"]*[&;]range=[A-Z]+\d+|▦<\/i>/,item.id);
    assert.doesNotMatch(html,/role="tab(?:list|panel)?"|class="tabs"|data-act="tab:/);
    assert.doesNotMatch(html,/<b>사진 원본<\/b>/);
    for(const [,ref] of html.matchAll(/data-act="go:([^"]+)"/g))assert.ok(catalog.byId.has(ref.split('/')[0]),item.id+' → '+ref);
  }
});
test('featured views preserve the sheet records, their joins and original media sources',()=>{
  const event=full('event'),quiz=full('person'),map=full('shape'),b=catalog.berlin;
  assert.ok(event.includes(model.esc(b.내용)));
  assert.ok(event.includes(model.esc(b.이미지)));
  assert.match(event,/<figure><a [^>]*aria-label="[^"]*사진 1 원본 열기"><img /);
  assert.ok(event.indexOf('class="photo-set"')<event.indexOf('id="modal-title"'));
  for(const {actor} of model.participants(b))assert.ok(event.includes(model.esc(model.name(actor))));
  for(const r of [...model.relations(b),...model.places(b),...model.categories(b)])assert.ok(event.includes(model.esc(model.name(r))));
  assert.ok(quiz.indexOf('id="modal-title"')<quiz.indexOf('class="choices answers"'));
  const actual=model.participants(catalog.battle).find(x=>x.role==='leader'&&x.actor.구분==='person');
  assert.equal(catalog.answer,model.name(actual.actor));
  assert.ok(quiz.includes(model.name(actual.actor)));
  assert.ok(map.startsWith('<figure class="places-atlas shape-atlas"')&&map.indexOf('</figure>')<map.indexOf('id="modal-title"'));
  const caption=map.match(/<header class="map-caption">([\s\S]*?)<\/header>/)[1];
  assert.ok(caption.startsWith('<h2')&&caption.replace(/<[^>]+>/g,'')===model.name(model.get('공간',catalog.shape.지도참조키))+catalog.shape.기준시점);
  const footer=map.indexOf('<footer class="map-sources">');
  assert.ok(footer>map.indexOf('class="map-dossier"'));
  assert.ok(!map.slice(0,footer).includes(catalog.shape.출처)&&map.slice(footer).includes(catalog.shape.출처));
  const geometry=JSON.parse(readFileSync(new URL('../../'+shapeFile,folder),'utf8')).geometry;
  assert.equal(JSON.stringify(data.wall),JSON.stringify(geometry.coordinates));
});
test('unrecorded classroom and comment data start empty',()=>{
  assert.doesNotMatch(full('comments'),/김 선생님|class="comment"/);
  assert.match(full('lesson'),/학교명<\/span><input type="text" value=""/);
  assert.match(full('score'),/풀이 전/);
  assert.match(full('maps'),/저장한 지도가 없습니다/);
});

test('shape previews fit registered geometry over the geographic basemap, including unlinked sheet records',()=>{
  const examples=full('map-examples');
  for(const id of ['geo_cuba','geo_japan'])assert.ok(examples.includes('data-space="'+id+'"'));
  const preview=id=>catalog.byId.get('map-source').render({record:id,mini:false});
  for(const id of ['geo_berlin_wall','geo_cuba','geo_japan','geo_prc_territory','geo_iron_curtain']){
    const html=preview(id),layer=data.mapLayers[id];
    assert.ok(layer.path.startsWith('M')&&!layer.path.includes('NaN'));
    assert.ok(html.includes('data-geometry="'+id+'"><path class="map-'+layer.kind+'" d="'+layer.path+'"'));
    assert.ok(html.indexOf('class="map-land"')>0&&html.indexOf('class="map-country-border"')>html.indexOf('class="map-land"'));
    assert.ok(html.indexOf('data-geometry="')>html.indexOf('class="map-country-border"'));
    assert.match(html,/data-map-action="fit"/);
  }
  assert.match(preview('geo_berlin'),/class="map-pin"/);
  assert.match(preview('geo_nato_1949'),/class="map-land"[\s\S]+시트에 도형 좌표가 없습니다/);
  assert.doesNotMatch(preview('geo_nato_1949'),/NaN|Infinity|data-geometry=/);
  const wall=preview('geo_berlin_wall');
  for(const name of ['베를린','서베를린','포츠담'])assert.ok(wall.includes('class="map-city-label">'+name+'</text>'));
  assert.match(wall,/class="map-city-boundary"/);
});

test('every sheet category retains its members and links in its own kind of spread',()=>{
  for(const row of model.rows.카테고리){
    const kind=row.카테고리유형, options={record:model.key(row)};
    const render=mini=>catalog.byId.get(kind).render({...options,mini});
    const view=render(false), thumbnail=render(true), header=({period:'era-cover',arc:'flow-cover',theme:'theme-network'})[kind];
    assert.ok(view.startsWith('<header class="'+header+'"')&&thumbnail.startsWith('<header class="'+header+'"'));
    assert.doesNotMatch(view,/▦<\/i>|[&;]range=A\d+/);
    for(const markup of [view,thumbnail])assert.ok(markup.includes('<small class="category-schema">'+row.tab+' › '+model.label(kind)+' ('+kind+')</small><h2'),model.key(row));
    if(kind==='period')for(const markup of [view,thumbnail])assert.match(markup,/<h2[^>]*>[^<]+<\/h2><figure class="era-scale"><div class="scale-track"[^>]*><b[^>]*><\/b><div class="era-tick"/);
    for(const member of model.events(row))assert.ok(view.includes('data-act="go:'+model.route(member)+'"'),model.key(row)+' / '+model.key(member));
    for(const r of [...model.places(row),...model.relations(row)])assert.ok(view.includes('data-act="go:'+model.route(r)+'"'));
    assert.doesNotMatch(view,/role="tab(?:list|panel)?"|data-act="tab:/);
    if(kind==='theme'){
      const periods=new Set(model.events(row).flatMap(e=>model.categories(e).filter(c=>c.카테고리유형==='period')));
      for(const p of periods)assert.ok(thumbnail.includes('data-act="go:'+model.route(p)+'"'));
      if(!periods.size&&model.events(row).length)assert.match(thumbnail,/시기 미기재/);
    }
  }
});

test('the featured flow follows two actual directed relations and the period uses sheet bounds',()=>{
  const view=full('arc').split('</header>')[0];
  const nodes=[...view.matchAll(/data-act="go:event\/([^"]+)"/g)].map(match=>match[1]);
  const links=[...view.matchAll(/data-act="go:relation\/([^"]+)"/g)].map(match=>model.get('관계',match[1]));
  assert.equal(links.length,2);
  assert.deepEqual(nodes,links.flatMap(edge=>[edge.출발ID,edge.도착ID]));
  assert.equal(links[0].도착ID,links[1].출발ID);
  const period=model.get('카테고리','japan_cultural_rule'),upper=full('period').split('</header>')[0];
  for(const [label,value] of [['시작',period.시작일],['종료',period.종료일]])assert.ok(upper.includes('<time aria-label="'+label+' '+value+'">'+value+'</time>'));
  assert.match(upper,/class="scale-track"/);
});

test('relation diagrams show the type above the arrow, followed by the sheet label and explanation',()=>{
  for(const row of model.rows.관계){
    const html=model.relationList([row]);
    const type=model.label(row.관계유형),typeMarkup=row.라벨?model.esc(type):model.jump(row,type);
    const caption=html.indexOf('<span class="relation-type">'+typeMarkup+'</span>');
    const arrow=html.indexOf('class="relation-arrow"');
    assert.ok(caption>=0&&arrow>caption,model.key(row));
    const heading=row.라벨?html.indexOf('<h4 class="relation-title">'+model.jump(row,row.라벨)+'</h4>'):arrow;
    if(row.라벨)assert.ok(heading>arrow);
    if(row.설명)assert.ok(html.indexOf(model.prose(row.설명))>heading);
    const detail=catalog.byId.get('relation').render({record:model.key(row)});
    assert.ok(detail.includes(model.title(row.라벨||type||'관계'))&&detail.indexOf('id="modal-title"')>detail.indexOf('class="relation-arrow"'));
    assert.doesNotMatch(detail,/관계 근거 자료|검토 상태/);
  }
});

test('participant groups lead with the flag and actor and keep matching officeholders underneath',()=>{
  const render=id=>catalog.byId.get('event').render({record:id,mini:false});
  const groups=id=>render(id).match(/<ul class="participant-list">([\s\S]*?)<\/section>/)?.[1].split('<li class="participant-group">').slice(1)||[];
  const berlin=groups(model.key(catalog.berlin));
  const participants=model.participants(catalog.berlin);
  assert.equal(berlin.length,participants.length);
  participants.forEach(({actor},i)=>assert.ok(berlin[i].startsWith('<h4>')&&berlin[i].split('</h4>')[0].includes(model.jump(actor))));
  const us=berlin[participants.findIndex(({actor})=>model.key(actor)==='actor_usa')];
  assert.match(us,/<h4><img src="..\/..\/assets\/flags\/us.svg" alt="">.*미국<\/button><\/h4>/);
  assert.match(us,/class="participant-terms".*해리 트루먼.*1945-04-12.*1953-01-20.*미국 대통령/);
  assert.doesNotMatch(berlin[1],/participant-terms|<img/);
  assert.doesNotMatch(render(model.key(catalog.berlin)),/event-participants|재임 근거/);
  const battle=groups(model.key(catalog.battle));
  for(const person of ['홍범도','대한독립군'])assert.ok(battle.some(g=>g.split('</h4>')[0].includes(person)));
  for(const event of model.rows.사건){
    const html=groups(model.key(event)).join('');
    for(const {actor} of model.participants(event))assert.ok(html.includes(model.jump(actor)),event.사건ID+' '+actor.주체명);
  }
});

test('place introductions keep authored text alongside imported gazetteer metadata',()=>{
  const gando=model.get('공간','geo_gando'),manchuria=model.get('공간','geo_manchuria_primorsky');
  assert.equal(model.placeIntroduction(gando),'');
  assert.equal(model.placeIntroduction(manchuria),manchuria.설명);
  for(const description of [gando.설명+'\n'+manchuria.설명,manchuria.설명+'\n'+gando.설명])
    assert.equal(model.placeIntroduction({설명:description}),manchuria.설명);
  const detail=catalog.byId.get('map-source').render({record:gando.공간ID});
  assert.ok(!detail.includes(gando.설명)&&detail.includes(gando.시대별칭));
});

test('each related-place section projects all linked spaces on one basemap and uses their sheet descriptions',()=>{
  const checked=new Set();
  for(const record of [...model.rows.사건,...model.rows.카테고리,...model.rows.주체]){
    const spaces=[...new Set(model.places(record))],ids=spaces.map(s=>s.공간ID).join(',');
    if(!spaces.length||checked.has(ids))continue;
    checked.add(ids);
    const section=model.geoSection(record);
    assert.equal((section.match(/<svg /g)||[]).length,1,ids);
    assert.equal((section.match(/data-place="/g)||[]).length,spaces.length,ids);
    assert.doesNotMatch(section,/NaN|Infinity|history-map-maker 지명 사전, 좌표 검수 전/);
    for(const space of spaces){
      assert.ok(section.includes('data-place="'+space.지도참조키+'"'),space.공간ID);
      assert.ok(section.includes(model.jump(space)),space.공간ID);
      if(!space.설명.includes('history-map-maker 지명 사전'))assert.ok(section.includes(model.esc(space.설명)),space.공간ID);
    }
  }
  const berlin=model.geoSection(catalog.berlin);
  assert.match(berlin,/class="map-land"/);
  assert.ok(berlin.indexOf('class="map-country-border"')>berlin.indexOf('class="map-land"'));
  for(const action of ['in','out','fit','world'])assert.ok(berlin.includes('data-map-action="'+action+'"'));
  assert.doesNotMatch(berlin,/data-map-action="cluster"/);
  assert.match(berlin,/베를린시 수역/);
});

test('the showroom shelves the 64 remaining designs and resolves adopted designs to the real project',()=>{
  const applied=['event','period','arc','theme','actor','relations','shape'];
  assert.equal(catalog.items.length,64);
  assert.deepEqual([...catalog.byId.keys()].filter(id=>!catalog.items.some(item=>item.id===id)).sort(),applied.sort());
  assert.equal(catalog.projectPath('event',model.key(catalog.berlin)),'../../swimlane.html?package=cold-war&record=E018');
  assert.equal(catalog.projectPath('event',model.key(catalog.battle)),'../../swimlane.html?package=japan&record=E278');
  assert.equal(catalog.projectPath('shape',''),'../../sheet-schema-dashboard.html?shape=geo_berlin_wall');
  assert.equal(catalog.projectPath('relations',''),'../../swimlane.html?package=japan&record=all');
  for(const item of catalog.items)assert.equal(catalog.projectPath(item.id,''),'');
});

test('lesson records use the active lesson’s category IDs when two periods have the same name',async()=>{
  const {lessonRecordViews}=await import('../assets/lesson-record-views.js');
  const lesson=lessonRecordViews({events:[{id:'e',title:'수업에서 고친 사건명',date:'1921',categoryIds:['b','t']}],
    categories:[{id:'a',kind:'period',name:'같은 이름'},{id:'b',kind:'period',name:'같은 이름'},{id:'t',kind:'theme',name:'주제'}],
    detailActors:[],relations:[],packageId:'local',name:'편집한 수업'});
  const theme=lesson.categoryView(lesson.find('t'));
  assert.match(theme,/go:period\/b/);
  assert.doesNotMatch(theme,/go:period\/a/);
  assert.match(theme,/수업에서 고친 사건명/);
  assert.equal(lesson.events(lesson.find('a')).length,0);
});
