import {readStoryEvents} from './story-events.js';
import {mountStory} from './story-player.js';
import {loadShape, shapePaths} from '../event-map-links.js';

const $ = selector => document.querySelector(selector);
const atlas = $('#atlas');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const source = './assets/';
// The Cuba label anchors the island as a whole.
const locations = {'쿠바': [-77.7812, 21.5218]};
const initialCamera = [-80.1, 22.3, 15.8];
const atlanticCamera = [-21, 40, 157];
let camera = initialCamera;
let cameraFrame = 0;
let labelNodes = [];
let hotline;
let frameNodes = [];
const svg = (name, attrs = {}) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
};

async function read(path, format) {
  const response = await fetch(source + path);
  if (!response.ok) throw Error('지도 자료를 읽지 못했습니다.');
  return response[format]();
}

function landPath(shape) {
  return shapePaths(shape).map(ring =>
    'M' + ring.map(([lon, lat]) => lon.toFixed(4) + ',' + (-lat).toFixed(4)).join('L') + 'Z'
  ).join('');
}

function paint() {
  const [cx, cy, span] = camera;
  const {width, height} = atlas.getBoundingClientRect();
  const k = width / span;
  const ky = k / Math.cos(cy * Math.PI / 180);
  const x = width / 2 - cx*k, y = height / 2 + cy*ky;
  const project = (lon, lat) => [x + lon*k, y - lat*ky];
  $('#geography').setAttribute('transform', 'translate(' + x + ' ' + y + ') scale(' + k + ' ' + ky + ')');
  const globalOpacity = Math.min(1, Math.max(0,(span-20)/30));
  $('#world').setAttribute('opacity', globalOpacity);
  $('#regional').setAttribute('opacity', 1-globalOpacity);
  for (const {node, point} of labelNodes) {
    const [px, py] = project(...point);
    node.style.visibility = (py < 13 || py > height-12 || px < 14 || px > width-14) ? 'hidden' : 'visible';
    node.setAttribute('transform', 'translate(' + px + ' ' + py + ')');
  }
  for (const {node, axis, value} of frameNodes) {
    const pos = project(axis === 'x' ? value : 0, axis === 'y' ? value : 0)[axis === 'x' ? 0 : 1];
    node.setAttribute(axis + '1', pos);
    node.setAttribute(axis + '2', pos);
  }
  if (hotline) {
    const [ax, ay] = project(...locations['워싱턴 D.C.']), [bx, by] = project(...locations['모스크바']);
    const arch = Math.max(12, Math.min(ay, by) * .55);
    hotline.setAttribute('d', 'M' + ax + ',' + ay + ' Q' + (ax+bx)/2 + ',' + (Math.min(ay,by)-arch) + ' ' + bx + ',' + by);
  }
}

function moveCamera(to, animate) {
  cancelAnimationFrame(cameraFrame);
  const from = camera;
  if (!animate || reduceMotion.matches || from.every((n, i) => n === to[i])) {
    camera = to;
    paint();
    return;
  }
  const start = performance.now();
  function step(now) {
    const t = Math.min(1, (now-start)/1800);
    const ease = t*t*(3-2*t);
    camera = from.map((n,i) => n + (to[i]-n)*ease);
    paint();
    if (t < 1) cameraFrame = requestAnimationFrame(step);
  }
  cameraFrame = requestAnimationFrame(step);
}

function addLabel(text, point, style = '') {
  const node = svg('g');
  if (style === 'point') {
    node.append(svg('circle', {r:8, class:'ring'}), svg('circle', {r:4.5, class:'point'}));
  }
  const label = svg('text', {class: style === 'point' ? '' : style, 'text-anchor':'middle', y: style === 'point' ? -12 : 4});
  label.textContent = text;
  node.append(label);
  $('#labels').append(node);
  labelNodes.push({node, point});
}

function setMap(scene, animate) {
  const dispatch = $('#dispatch');
  const quotation = {
    E056: ['쿠바로 수송 중인 모든 공격용 군사 장비에 대해 엄격한 해상 격리를 시작합니다.', '케네디의 대국민 방송', 'oct22/doc5'],
    E057: ['세계 평화를 지키는 일은 우리 공동의 관심사여야 합니다.', '흐루쇼프가 케네디에게 보낸 서한', 'oct26/doc4'],
  }[scene.id];
  dispatch.hidden = !quotation;
  if (quotation) {
    dispatch.querySelector('q').textContent = quotation[0];
    const link = dispatch.querySelector('a');
    link.textContent = quotation[1] + ' · 번역 ↗';
    link.href = 'https://microsites.jfklibrary.org/cmc/' + quotation[2] + '.html';
  }
  const broad = scene.places.includes('모스크바');
  $('.player').dataset.phase = broad ? 'diplomacy' : scene.id === 'E056' || scene.id === 'E057' ? 'crisis' : 'local';
  $('#labels').replaceChildren();
  $('#hotline').replaceChildren();
  labelNodes = [];
  hotline = undefined;
  if (broad) {
    addLabel('대서양', [-34, 29], 'water');
  } else {
    addLabel('카리브해', [-80.1, 19.8], 'water');
    addLabel('플로리다', [-81.5, 25.7], 'secondary');
    addLabel('자메이카', [-77.3, 18.15], 'secondary');
  }
  for (const place of scene.places) {
    if (locations[place]) addLabel(place === '워싱턴 D.C.' ? '워싱턴' : place, locations[place], place === '쿠바' ? '' : 'point');
  }
  if (scene.id === 'E059') {
    hotline = svg('path', {pathLength:1});
    $('#hotline').append(hotline);
  }
  atlas.setAttribute('aria-label', scene.title + ' 지도. ' + scene.places.join(', '));
  $('#grid').replaceChildren();
  frameNodes = [];
  const increment = broad ? 15 : 2;
  for (const [axis, extent] of [['x', 180], ['y', 90]]) {
    for (let value = -extent; value <= extent; value += increment) {
      const other = axis === 'x' ? 'y' : 'x';
      const node = svg('line', {[other+'1']:0, [other+'2']:'100%'});
      $('#grid').append(node);
      frameNodes.push({node, axis, value});
    }
  }
  moveCamera(broad ? atlanticCamera : initialCamera, animate);
}

async function init() {
  const shape = (name, id) => loadShape({도형유형:'area', 파일경로:'assets/event-geometry/' + name + '.geojson', 외부도형ID:id});
  const [data, world, region, island, points] = await Promise.all([
    readStoryEvents(), read('swimlane-basemap.svg', 'text'),
    shape('caribbean-land','caribbean-land'), shape('cuba','CUB'), read('event-geometry/place-points.geojson','json'),
  ]);
  for (const {properties,geometry} of points.features) locations[properties.name] = geometry.coordinates;
  const land = new DOMParser().parseFromString(world,'image/svg+xml').querySelector('#land');
  for (const path of land.querySelectorAll('path')) $('#world').append(svg('path', {d:path.getAttribute('d')}));
  $('#regional').append(svg('path', {d:landPath(region)}));
  const outline = landPath(island);
  $('#island').append(svg('path', {d:outline}), svg('path', {d:outline, class:'texture'}));
  const scenes = data.filter(event => event.arcs.includes('쿠바위기')).map(event => ({
    ...event, places:event.place.split(',').map(p => p.trim()).filter(Boolean),
  }));
  mountStory('cuba-story',scenes,setMap,paint);
}

init().catch(error => {
  $('#scene-title').textContent = '지도를 불러올 수 없습니다.';
  $('#story-text').textContent = '페이지를 새로고침해 주세요.';
  console.error(error);
});
