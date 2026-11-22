import {readStoryEvents} from './story-events.js';
import {storyCamera, pathData, svg} from './story-map.js';
import {mountStory} from './story-player.js';
import {loadShape, shapePaths} from '../event-map-links.js';
import background from './event-geometry/berlin-background.js';

const $ = selector => document.querySelector(selector);
const atlas = $('#atlas');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const westBerlin = [13.28, 52.50], eastBerlin = [13.48, 52.535];
const regionalView = {lon:10.6, lat:51.35, width:13.5, height:9.2};
const countryView = {lon:10.6, lat:51.3, width:13, height:9.5};
const cityView = {lon:13.34, lat:52.505, width:.93, height:.44};
const cityLabels = [
  ['서베를린',westBerlin,'area'], ['동베를린',eastBerlin,'area'],
];
const episodes = {
  E018: {
    view:regionalView, note:'1945년 4국 점령구역 · 점선은 공수 연결',
    labels:[['영국',[8.5,52.55],'area'],['미국',[11.1,48.75],'area'],['프랑스',[7.99,49.08],'area'],['소련',[12.45,51.15],'area'],['서베를린 · 템펠호프',[13.403,52.473],'point'],['비스바덴',[8.326,50.049],'point'],['북해',[7.9,54.6],'sea']],
  },
  E027: {
    view:cityView, note:'베를린 시가지 · 현대 시 경계와 수역',
    labels:[...cityLabels,['템펠호프 공항',[13.403,52.473],'point']],
  },
  E054: {
    view:cityView, note:'베를린 시가지 · 현대 시 경계와 수역',
    labels:[...cityLabels,['브란덴부르크문',[13.3777,52.5163],'point']],
  },
  E096: {
    view:countryView, note:'1973년 영토 · CShapes 2.1',
    labels:[['서독',[9.2,50.5],'area'],['동독',[12.15,51.4],'area'],['서베를린',westBerlin,'point'],['폴란드',[16.6,52.5],'minor'],['북해',[6.8,54.6],'sea']],
  },
  E148: {
    view:cityView, note:'장벽 위치 · 1989년 4월 항공사진 기준',
    labels:[...cityLabels,['보른홀머 거리 검문소',[13.398,52.555],'point']],
  },
};

let labels = [];
let statesInView = false;
let leavingStates = false;
const {move,paint} = storyCamera(atlas,(project,camera,width,height) => {
  $('#states').setAttribute('opacity', statesInView ? 1 : leavingStates ? Math.max(0, Math.min(1,(camera.width-1.5)/6)) : 0);
  for (const {node, point} of labels) {
    const [px,py] = project(...point);
    node.setAttribute('transform', 'translate('+px+' '+py+')');
    node.style.visibility = (px<8 || px>width-8 || py<12 || py>height-12) ? 'hidden' : 'visible';
  }
});

function render(scene, animate) {
  const city = scene.view === cityView;
  leavingStates = statesInView && scene.id === 'E148' && animate;
  statesInView = scene.id === 'E096';
  $('#zones').style.display = scene.id === 'E018' ? '' : 'none';
  $('#airlift').style.display = scene.id === 'E018' ? '' : 'none';
  if (scene.id === 'E018' && !reduceMotion.matches) $('#airlift animateMotion').beginElement();
  $('#city-detail').setAttribute('opacity', city ? 1 : 0);
  const wall = $('#wall');
  wall.getAnimations().forEach(animation => animation.cancel());
  wall.style.visibility = scene.id === 'E148' ? 'visible' : 'hidden';
  if (scene.id === 'E148' && !reduceMotion.matches) {
    wall.animate([{clipPath:'inset(0 100% 0 0) fill-box'},{clipPath:'inset(0 0% 0 0) fill-box'}],
      {duration:1700,delay:animate ? 850 : 0,fill:'both',easing:'ease-out'});
  }
  $('.archive').hidden = !['E018','E027'].includes(scene.id);
  $('#scale-note').textContent = scene.note;
  $('#labels').replaceChildren();
  labels = scene.labels.map(([name,point,style]) => {
    const node = svg('g',{});
    if (style === 'point') node.append(svg('circle',{r:8,class:'ring'}),svg('circle',{r:4,class:'point'}));
    const title = svg('text',{'text-anchor':'middle',y:style==='point' ? -12 : 4,class:style === 'point' ? '' : style});
    title.textContent = name;
    node.append(title);
    $('#labels').append(node);
    return {node,point};
  });
  atlas.setAttribute('aria-label', scene.title + '. ' + scene.labels.map(label=>label[0]).join(', '));
  move(scene.view, animate);
}

async function init() {
  const shape = (file,id,kind='area') => loadShape({도형유형:kind,파일경로:'assets/event-geometry/'+file+'.geojson',외부도형ID:id});
  const [data, terrain, west, east, wall, zones] = await Promise.all([
    readStoryEvents(),
    shape('europe-land-1973','europe-land-1973'),shape('germany-1973','260'),shape('germany-1973','265'),
    shape('berlin-wall-1989','berlinermauer:a_grenzmauer','line'),
    fetch('./assets/event-geometry/germany-zones-1945.geojson').then(r => {
      if (!r.ok) throw Error('1945년 점령구역을 읽지 못했습니다.');
      return r.json();
    }),
  ]);
  for (const [id,geometry] of [['terrain',terrain],['west-state',west],['east-state',east],['east-ink',east]]) {
    $('#'+id).setAttribute('d',pathData(shapePaths(geometry)));
  }
  const zoneColors = {uk:'#84aaa0',usa:'#b9a55f',france:'#9c91b0',ussr:'#cc866e'};
  if (new Set(zones.features.map(f=>f.id)).size !== 4 || zones.features.some(f=>!zoneColors[f.id])) throw Error('점령구역 도형을 확인해 주세요.');
  for (const zone of zones.features) {
    $('#zones').append(svg('path',{d:pathData(shapePaths(zone.geometry)),fill:zoneColors[zone.id]}));
  }
  $('#city').setAttribute('d',pathData(background.city.flat()));
  $('#water').setAttribute('d',pathData(background.water.flat()));
  $('#wall').append(svg('path',{d:pathData(shapePaths(wall),false)}));
  const scenes = data.filter(event => Object.hasOwn(episodes,event.id)).map(event => ({...episodes[event.id],...event}));
  mountStory('berlin-story',scenes,render,paint);
}

init().catch(error => {
  $('#scene-title').textContent = '지도를 불러올 수 없습니다.';
  $('#story-text').textContent = '페이지를 새로고침해 주세요.';
  console.error(error);
});
