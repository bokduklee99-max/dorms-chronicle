import {readStoryEvents} from './story-events.js';
import {stories} from './asia-story-scenes.js';
import {storyCamera, pathData, svg} from './story-map.js';
import {mountStory} from './story-player.js';
import {shapePaths} from '../event-map-links.js';

const $ = selector => document.querySelector(selector);
const requested = new URLSearchParams(location.search).get('story') || 'volunteers';
const story = stories[requested];
let pins = [];
let routes = [];

function ink(name) {
  return name === 'north' ? 'north-pin' : name;
}

function addPin(pin) {
  const node = svg('g',{class:ink(pin.ink || 'origin')});
  if (pin.region) {
    node.append(svg('ellipse',{class:'region',rx:32,ry:21}));
  } else if (!pin.context) {
    node.append(svg('circle',{class:'halo',r:9}),svg('circle',{class:'dot',r:4.5}));
  }
  const title = svg('text',{y:pin.context ? 0 : -14,class:pin.context ? 'context' : 'place'});
  title.textContent = pin.name;
  node.append(title);
  if (pin.detail) {
    const detail = svg('text',{class:'detail',y:23});
    detail.textContent = pin.detail;
    node.append(detail);
  }
  $('#story-pins').append(node);
  const texts = [...node.querySelectorAll('text')];
  return {node,point:pin.point,texts};
}

const {paint,move} = storyCamera($('#atlas'),(project,camera,width,height) => {
  for (const {node,point,texts} of pins) {
    const [x,y] = project(...point);
    node.setAttribute('transform','translate('+x+' '+y+')');
    for (const label of texts) {
      const half = label.getComputedTextLength()/2 + 6;
      label.setAttribute('x', Math.max(half,Math.min(width-half,x))-x);
    }
    node.style.visibility = x < 0 || y < 5 || x > width || y > height-6 ? 'hidden' : 'visible';
  }
  for (const {node,link} of routes) {
    const [x,y] = project(...link.from), [ex,ey] = project(...link.to);
    const dx = ex-x, dy = ey-y;
    const cx = (x+ex)/2 - dy*link.bend;
    const cy = (y+ey)/2 + dx*link.bend;
    node.setAttribute('d','M'+x+','+y+' Q'+cx+','+cy+' '+ex+','+ey);
  }
});

function render(scene,animate) {
  $('#routes').replaceChildren();
  routes = (scene.links || []).map(link => {
    const node = svg('path',{class:ink(link.ink)+(link.muted ? ' muted' : '')});
    if (!link.muted) node.setAttribute('pathLength',1);
    $('#routes').append(node);
    return {node,link};
  });
  $('#story-pins').replaceChildren();
  const context = requested === 'volunteers'
    ? [{name:'황허강',point:[109.7,37.6]},{name:'창장강',point:[111,29.3]}]
    : scene.id === 'E083' ? [{name:'황해',point:[123.4,34.5]}]
    : scene.view.width > 100 ? [{name:'태평양',point:[197,32]}] : [];
  pins = [...context.map(item=>({...item,context:true})),...scene.pins].map(addPin);
  $('#map-credit').textContent = requested === 'volunteers'
    ? '1938년 지형 · 선은 조직의 계보' : '1960년 지형 · '+(scene.id==='E083' ? '대표팀 교류' : scene.view.width>100 ? '두 수도의 외교 관계' : '회담과 성명의 장소');
  $('#atlas').setAttribute('aria-label',scene.title+'. '+scene.pins.map(p=>[p.name,p.detail].filter(Boolean).join(' · ')).join(', '));
  move(scene.view,animate);
}

async function read(path) {
  const response = await fetch('./assets/'+path);
  if (!response.ok) throw Error('지도 또는 사건 자료를 읽지 못했습니다.');
  return response.json();
}

async function init() {
  if (!Object.hasOwn(stories,requested)) throw Error('등록된 이야기가 없습니다.');
  document.body.dataset.story = requested;
  $('#history-source').href = story.source;
  $('#base-source').textContent = story.year+'년 배경지도 ↗';
  $('#base-source').href = 'https://github.com/aourednik/historical-basemaps/blob/master/geojson/world_'+story.year+'.geojson';
  const [data,geometry] = await Promise.all([readStoryEvents(),read('event-geometry/'+story.map+'.geojson')]);
  const land = geometry.features.find(f=>f.id === 'land');
  $('#land').setAttribute('d',pathData(shapePaths(land.geometry)));
  $('#pacific-copy').style.display = requested === 'diplomacy' ? '' : 'none';
  for (const river of geometry.features.filter(f=>f.id !== 'land')) {
    $('#rivers').append(svg('path',{d:pathData(shapePaths(river.geometry),false)}));
  }
  const visuals = new Map(story.scenes.map(scene=>[scene.id,scene]));
  const scenes = data.filter(event=>visuals.has(event.id)).map(event=>({...visuals.get(event.id),...event}));
  mountStory(requested,scenes,render,paint);
}

init().catch(error=>{
  $('#scene-title').textContent = '이 지도를 열 수 없습니다.';
  $('#story-text').textContent = error.message;
  console.error(error);
});
