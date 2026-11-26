import {shapePaths} from '../event-map-links.js';
import {pathData, svg} from './story-map.js';
import {readPackedMapData} from './packed-map-data.js';
import {
  boundariesAt, readTerritoryBoundaries, territoryFileStart, worldTerritoryAsset, yearAtPosition, yearLabel, yearPosition,
} from './territory-map-model.js?v=world';

const $ = id => document.getElementById(id);
const frame = window.frameElement;
const content = document.querySelector('main');
if (frame) {
  new ResizeObserver(() => {
    if (!content.classList.contains('atlas-expanded')) {
      frame.style.height = Math.ceil(content.getBoundingClientRect().height) + 'px';
    }
  }).observe(content);
}

function initFullscreen() {
  const button = $('fullscreen');
  let expandedInPage = false;
  function update() {
    const expanded = expandedInPage || document.fullscreenElement === content;
    content.classList.toggle('atlas-expanded', expanded);
    const label = expanded ? '전체 화면 닫기' : '전체 화면';
    button.dataset.expanded = String(expanded);
    button.setAttribute('aria-label', label);
    button.title = label;
  }
  function setInPage(expanded) {
    expandedInPage = expanded;
    frame?.classList.toggle('atlas-expanded', expanded);
    update();
    button.focus({preventScroll: true});
  }
  button.addEventListener('click', async () => {
    if (expandedInPage) setInPage(false);
    else if (document.fullscreenElement === content) await document.exitFullscreen();
    else if (document.fullscreenEnabled) {
      try {
        await content.requestFullscreen();
      } catch {
        setInPage(true);
      }
    } else setInPage(true);
  });
  document.addEventListener('fullscreenchange', update);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && expandedInPage) setInPage(false);
  });
  button.hidden = false;
}
const longitudeScale = .78;

const scopes = {
  world: {name: '세계', lon: 0, lat: 0, width: 360, height: 170.2},
  korea: {name: '한반도·만주', lon: 127.7, lat: 39.5, width: 20, height: 14},
  eastAsia: {name: '동아시아', lon: 122, lat: 38, width: 47, height: 25},
  china: {name: '중국', lon: 109, lat: 34.5, width: 48, height: 30},
  europe: {name: '유럽·지중해', lon: 14, lat: 46.5, width: 50, height: 30},
};
const eras = [
  {name: '춘추전국', year: -300, scope: 'china'},
  {name: '로마 제국', year: 117, scope: 'europe'},
  {name: '위진남북조', year: 475, scope: 'china'},
  {name: '삼국', year: 600, scope: 'korea'},
  {name: '남북국', year: 820, scope: 'korea'},
  {name: '후삼국', year: 925, scope: 'korea'},
  {name: '고려', year: 1100, scope: 'korea'},
  {name: '몽골 제국', year: 1270, scope: 'world'},
  {name: '조선', year: 1500, scope: 'korea'},
  {name: '냉전', year: 1960, scope: 'world'},
];

const colors = {
  // East Asia
  'Goguryeo': '#7764ab', 'Baekje': '#d19d47', 'Silla': '#4f9a79', 'Byeonhan': '#ca778a',
  'Tamna': '#69be3c', 'Unified Silla': '#319b33', 'Balhae': '#4f87b3', 'Hubaekje': '#d3cb73',
  'Taebong': '#be3c3c', 'Goryeo': '#b95741', 'Joseon': '#3f8e91',
  'Sui Dynasty': '#a3825c', 'Tang Dynasty': '#c3734e', 'Liao Dynasty': '#8b83b4',
  'Northern Song': '#6b9b8b', 'Great Jin': '#c68e51', 'Southern Song': '#73d3bb',
  'Mongol Empire': '#948ab0', 'Yuan Dynasty': '#8c81af', 'Ming Dynasty': '#703cbe',
  'Later Jin Dynasty': '#b19b52', 'Qing Dynasty': '#c7a458',
  'Asuka Japan': '#be3cad', 'Nara Japan': '#be3c95', 'Heian Japan': '#883cbe',
  'Kamakura Shogunate': '#a03cbe', 'Ashikaga Shogunate': '#7793ac',
  'Warring States Japan': '#7d9264', 'Tokugawa Shogunate': '#be3c65',
  // Europe & Mediterranean
  'Macedonian Empire': '#8b72b5', 'Carthage': '#c98845', 'Roman Republic': '#b85042',
  'Roman Empire': '#a94438', 'Western Roman Empire': '#c2654c', 'Eastern Roman Empire': '#8e5a9e',
  'Byzantine Empire': '#7d5494', 'Kingdom of the Franks': '#4d7ea8', 'Holy Roman Empire': '#c5a246',
  'Kingdom of France': '#4876a3', 'Kingdom of England': '#b85d63', 'Republic of Venice': '#3f8f85',
  'Papal States': '#3cbe3e', "Kievan Rus'": '#34319b', 'Ottoman Empire': '#b73cbe',
  'Spanish Empire': '#3cbe86', 'Portuguese Empire': '#a6d373', 'Habsburg Monarchy': '#c083c3',
  'Polish-Lithuanian Commonwealth': '#758a42', 'Dutch Republic': '#cf7f41', 'Swedish Empire': '#7773d3',
  'Tsardom of Russia': '#8a6a42', 'Kingdom of Prussia': '#9b3179', 'British Empire': '#c2575e',
  'First French Empire': '#3f6899', 'Austrian Empire': '#c2a44c', 'Austria-Hungary': '#b89448',
  'Russian Empire': '#8a5c42', 'German Empire': '#667185', 'Nazi Germany': '#6e6565',
  // Chinese polities
  'Cao Wei': '#beb33c', 'Chen Dynasty': '#5c58ca',
  'Chu': '#3cafbe', 'Eastern Wu': '#ab73d3',
  'Former Qin': '#6f319b', 'Han': '#583cbe',
  'Han Dynasty': '#d373a3', 'Liang Dynasty': '#45428a',
  'Liu Song Dynasty': '#d373c6', 'Northern Qi': '#c3b283',
  'Northern Wei': '#83c390', 'Northern Zhou': '#9b3153',
  "People's Republic of China": '#b54f42', 'Qi': '#8a4266',
  'Qin': '#587eca', 'Qin Dynasty': '#8a424c',
  'Republic of China': '#39769f', 'Shang Dynasty': '#7451a9',
  'Shu Han': '#58bdca', 'Southern Qi': '#a451a9',
  'Wei': '#d39673', 'Western Jin': '#9b4431',
  'Western Xia': '#81be3c', 'Wu': '#ca8258',
  'Xiongnu': '#3cbeb5', 'Yan': '#909b31',
  'Zhao': '#3cbe6e', 'Zhou Dynasty': '#3cbe9d',
  // European and Mediterranean polities
  'Abbasid Caliphate': '#c558ca', 'Ayyubid Sultanate': '#73b6d3',
  'Crown of Aragon': '#be3c7d', 'Crown of Castile': '#428a43',
  'Fatimid Caliphate': '#319b5a', 'Golden Horde': '#be6c3c',
  'Grand Duchy of Lithuania': '#73d387', 'Grand Principality of Moscow': '#73d3cd',
  'Great Seljuk Empire': '#be543c', 'Hunnic Empire': '#73c8d3',
  'Kalmar Union': '#3c67be', 'Kingdom of Poland': '#b1c383',
  'Kingdom of Portugal': '#403cbe', 'Mamluk Sultanate': '#c39b83',
  'Novgorod Republic': '#99be3c', 'Rashidun Caliphate': '#a97151',
  'Umayyad Caliphate': '#9b5831', 'Visigothic Kingdom': '#60a951',
};

const koLabels = new Map();
function displayPolityName(actor) {
  if (!actor) return '';
  const raw = actor.polity || '';
  const clean = raw.replace(/^\(|\)$/g, '');
  return koLabels.get(raw) || koLabels.get(clean) || actor.name;
}

// Representative polities for teaching Korean and world history under the 2022 curriculum.
const teachingOrder = new Map([
  'Gojoseon', 'Goguryeo', 'Baekje', 'Silla', 'Gaya', 'Byeonhan',
  'Unified Silla', 'Balhae', 'Hubaekje', 'Taebong', 'Goryeo', 'Joseon',
  'Korean Empire', 'Republic of Korea', 'South Korea', "Democratic People's Republic of Korea",
  'Buyeo', 'Dong-okjeo', 'Dongye', 'Korean Jin', 'Mahan', 'Jinhan', 'Tamna',
  'Han Dynasty', 'Sui Dynasty', 'Tang Dynasty', 'Liao Dynasty', 'Great Jin',
  'Northern Song', 'Southern Song', 'Mongol Empire', 'Yuan Dynasty', 'Ming Dynasty',
  'Later Jin Dynasty', 'Qing Dynasty', 'Republic of China', "People's Republic of China",
  'Yamato', 'Asuka Japan', 'Nara Japan', 'Heian Japan', 'Kamakura Shogunate',
  'Ashikaga Shogunate', 'Warring States Japan', 'Tokugawa Shogunate', 'Empire of Japan', 'Japan',
  'United States of America', 'Russian Empire', 'Soviet Union', 'Union of Soviet Socialist Republics',
  'USSR', 'Russian Federation', 'Northern Wei', 'Eastern Göktürks', 'Western Göktürks',
  'Shang Dynasty', 'Zhou Dynasty', 'Qin Dynasty', 'Cao Wei', 'Shu Han', 'Eastern Wu', 'Western Jin',
  'Liu Song Dynasty', 'Northern Qi', 'Northern Zhou', 'Western Xia', 'Republics of the Soviet Union',
  'Sumerian City-States', 'Akkadian Empire', 'Babylonia', 'Neo-Assyrian Empire', 'Neo-Babylonian Empire',
  'Old Kingdom of Egypt', 'Middle Kingdom of Egypt', 'New Kingdom of Egypt', 'Achaemenid Empire',
  'Indus Valley Civilization', 'Maurya Empire', 'Gupta Empire', 'Mughal Empire', 'British Raj',
  'Macedonian Empire', 'Carthage', 'Roman Republic', 'Roman Empire', 'Western Roman Empire',
  'Eastern Roman Empire', 'Byzantine Empire', 'Kingdom of the Franks', 'Holy Roman Empire',
  'Rashidun Caliphate', 'Umayyad Caliphate', 'Abbasid Caliphate', 'Emirate of Córdoba', 'Caliphate of Córdoba',
  'Ottoman Empire', 'Mayan City-States', 'Later Mayan City-States', 'Aztec Triple Alliance', 'Inca Empire',
  'Kingdom of England', 'Kingdom of France', 'First French Empire', 'Kingdom of Prussia',
  'Spanish Empire', 'Portuguese Empire', 'British Colonial Empire', 'German Empire',
  'Weimar Republic', 'Nazi Germany', 'Democratic Republic of Vietnam', 'Republic of Vietnam',
  'Socialist Republic of Vietnam', 'Republic of Cuba', 'Communist Cuba',
].map((polity, index) => [polity, index]));
const byKoreanName = new Intl.Collator('ko');

function polityColor(polity) {
  if (colors[polity]) return colors[polity];
  let hash = 0;
  for (const char of polity) hash = (Math.imul(hash, 31) + char.codePointAt(0)) >>> 0;
  return 'hsl(' + (hash % 360) + ' 45% 48%)';
}

const chunks = new Map();

async function readAsset(file) {
  const response = await fetch(new URL(file, import.meta.url));
  if (!response.ok) throw new Error('지도 파일을 읽지 못했습니다.');
  if (!file.endsWith('.gz')) return response.json();
  return readPackedMapData(response);
}

function loadYear(year) {
  const file = territoryFileStart(year);
  let request = chunks.get(file);
  if (request) {
    chunks.delete(file);
  } else {
    request = readAsset(worldTerritoryAsset.url + file + '.json.gz')
      .then(collection => readTerritoryBoundaries(collection, worldTerritoryAsset))
      .catch(error => {
        if (chunks.get(file) === request) chunks.delete(file);
        throw error;
      });
  }
  chunks.set(file, request);
  if (chunks.size > 3) chunks.delete(chunks.keys().next().value);
  return request;
}

// The atlas uses longitude/latitude. The shared globe land path is in local Mercator units.
function globePath({land, bbox: [west, , , north]}) {
  const rad = Math.PI / 180;
  const top = Math.log(Math.tan(Math.PI / 4 + north * rad / 2));
  return land.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => {
    const lat = (2 * Math.atan(Math.exp(top - Number(y) * rad)) - Math.PI / 2) / rad;
    return (west + Number(x)).toFixed(4) + ',' + (-lat).toFixed(4);
  });
}

function makeButton(label, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function syncChildren(parent, children) {
  const keep = new Set(children);
  for (const child of [...parent.children]) {
    if (!keep.has(child)) child.remove();
  }
  for (const [index, child] of children.entries()) {
    const current = parent.children[index];
    if (current !== child) parent.insertBefore(child, current ?? null);
  }
}

function overlapsLabel(occupied, [left, top, right, bottom]) {
  return occupied.some(([l, t, r, b]) => l < right && t < bottom && r > left && b > top);
}

function labelPosition(row, path, land, [west, south, east, north], halfWidth, halfHeight, occupied) {
  const parts = row.boxes.map(([w, s, e, n]) => [
    Math.max(w, west + halfWidth / longitudeScale), Math.max(s, south + halfHeight),
    Math.min(e, east - halfWidth / longitudeScale), Math.min(n, north - halfHeight),
  ]).filter(([w, s, e, n]) => w < e && s < n)
    .map(([w, s, e, n]) => ({w, s, width: e - w, height: n - s}));
  parts.sort((a, b) => b.width * b.height - a.width * a.height);
  const offsets = [.5, .33, .67, .17, .83, .06, .94];
  for (const part of parts) {
    for (const vertical of offsets) {
      const y = -(part.s + vertical * part.height);
      for (const horizontal of offsets) {
        const lon = part.w + horizontal * part.width;
        const x = lon * longitudeScale;
        const box = [x - halfWidth, y - halfHeight, x + halfWidth, y + halfHeight];
        if (overlapsLabel(occupied, box)) continue;
        const point = new DOMPoint(lon, y);
        if (path.isPointInFill(point) && land.isPointInFill(point)) {
          occupied.push(box);
          return [x, y];
        }
      }
    }
  }
}

function initAtlas({start, end, frames}, landPath, mountains, waterways) {
  const map = $('atlas-map');
  const land = $('land');
  const range = $('year-range');
  const yearOutput = $('year');
  const period = $('period');
  const empty = $('empty');
  const resetSelection = $('reset-territories');
  const mapStatus = $('map-status');
  const play = $('play');
  const playLabel = play.innerHTML;
  const previous = $('previous');
  const next = $('next');
  const labelLayer = $('territory-labels');
  const terrainLayer = $('terrain-labels');
  const terrainNames = [...mountains, ...waterways.labels].sort((a, b) => a[3] - b[3]);
  const terrainLabels = terrainNames.map(([name, lon, lat, rank, type = 'mountain']) => {
    const node = svg('text', {class: 'terrain-label terrain-label--' + type, x: lon * longitudeScale, y: -lat});
    node.textContent = name;
    return {node, lon, lat, rank};
  });
  terrainLayer.replaceChildren(...terrainLabels.map(({node}) => node));
  const territoryGroup = $('territories');
  const scopeButtons = [...$('scope').querySelectorAll('button')];
  const world = scopes.world;
  const legendRows = [...document.querySelectorAll('.legend-row')].map(row => ({
    inCurriculum: row.dataset.curriculum === 'true',
    list: row.querySelector('ul'),
    empty: row.querySelector('p'),
  }));

  const initial = new URLSearchParams(location.search);
  const initialScope = initial.get('scope');
  const initialYear = Number(initial.get('year'));
  let scope = Object.hasOwn(scopes, initialScope) ? initialScope : 'world';
  let camera = scopes[scope];
  let year = Number.isInteger(initialYear) && initialYear !== 0 && initialYear >= start && initialYear <= end ? initialYear : 600;
  let readyYear;
  let renderedYear;
  let data;
  let viewport;
  let labelSize;
  let redraw;
  let timer;
  const selectionOverrides = new Map();
  let paths = new Map();
  let legend = new Map();
  let labels = new Map();

  resetSelection.addEventListener('click', () => {
    selectionOverrides.clear();
    map.focus({preventScroll: true});
    scheduleRender();
  });

  land.setAttribute('d', landPath);
  $('rivers').setAttribute('d', waterways.rivers[0] || '');
  $('rivers-detail').setAttribute('d', waterways.rivers[1] || '');
  $('lakes').setAttribute('d', waterways.lakes);
  range.min = yearPosition(start);
  range.max = yearPosition(end);
  $('first-year').textContent = yearLabel(start);
  $('last-year').textContent = yearLabel(end);

  const eraButtons = eras.map(era => {
    const button = makeButton(era.name, () => {
      setScope(era.scope);
      seek(era.year);
    });
    button.title = yearLabel(era.year);
    return button;
  });
  $('eras').replaceChildren(...eraButtons);
  $('era-ticks').replaceChildren(...eras.map(era => new Option('', String(yearPosition(era.year)))));

  function stop() {
    if (timer === undefined) return;
    clearInterval(timer);
    timer = undefined;
    play.innerHTML = playLabel;
    yearOutput.setAttribute('aria-live', 'polite');
  }

  function updateControls() {
    const label = yearLabel(year);
    if (yearOutput.textContent !== label) yearOutput.textContent = label;
    range.value = yearPosition(year);
    range.setAttribute('aria-valuetext', label);
    previous.disabled = year <= start;
    next.disabled = year >= end;
    scopeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scope === scope)));
    eraButtons.forEach((button, index) => button.setAttribute('aria-pressed',
      String(eras[index].year === year && eras[index].scope === scope)));
  }

  async function showYear(target) {
    year = target;
    updateControls();
    const file = territoryFileStart(target);
    if (data?.file !== file) {
      mapStatus.textContent = '선택한 연도의 영토를 불러오는 중입니다.';
      mapStatus.hidden = false;
      scheduleRender();
      try {
        const loaded = await loadYear(target);
        if (year !== target) return;
        data = {...loaded, file};
      } catch (error) {
        if (year !== target) return;
        stop();
        mapStatus.textContent = readyYear === undefined
          ? '이 연도의 영토를 불러오지 못했습니다. 연도를 다시 선택해 주세요.'
          : '이 연도의 영토를 불러오지 못해 ' + yearLabel(readyYear) + ' 판도를 표시합니다.';
        console.error(error);
        return;
      }
    }
    readyYear = target;
    mapStatus.hidden = true;
    scheduleRender();
  }

  function seek(target) {
    stop();
    void showYear(target);
  }

  function mountYear() {
    renderedYear = readyYear;
    const rows = boundariesAt(data.boundaries, readyYear, [-180, -90, 180, 90]);
    const byArea = rows.map(row => [row, row.boxes.reduce((sum, [w, s, e, n]) => sum + (e - w) * (n - s), 0)]);
    byArea.sort((a, b) => b[1] - a[1]);
    const featureIds = new Set(rows.map(row => row.feature_id));
    const previousPaths = new Map();
    const replacedPaths = new Map();
    for (const [row, path] of paths) {
      previousPaths.set(row.feature_id, path);
      if (featureIds.has(row.feature_id)) continue;
      if (!replacedPaths.has(row.actor_id)) replacedPaths.set(row.actor_id, []);
      replacedPaths.get(row.actor_id).push(path);
    }
    const nextPaths = new Map();
    for (const [row] of byArea) {
      let path = previousPaths.get(row.feature_id);
      const actor = data.actors.get(row.actor_id);
      if (!path) {
        const d = pathData(shapePaths(row.geometry));
        const candidates = replacedPaths.get(row.actor_id) || [];
        const match = candidates.findIndex(node => node.getAttribute('d') === d);
        if (match >= 0) {
          [path] = candidates.splice(match, 1);
          path.dataset.feature = row.feature_id;
        } else {
          path = svg('path', {
            d, class: 'atlas-territory', 'data-feature': row.feature_id,
            'fill-rule': 'evenodd', 'vector-effect': 'non-scaling-stroke',
          });
          path.style.color = polityColor(actor.polity);
        }
      }
      nextPaths.set(row, path);
    }
    paths = nextPaths;
    syncChildren(territoryGroup, [...paths.values()]);

    const nextLegend = new Map();
    const nextLabels = new Map();
    const actors = new Map();
    for (const {actor, selected} of selectionOverrides.values()) {
      if (selected) actors.set(actor.actor_id, actor);
    }
    for (const row of rows) actors.set(row.actor_id, data.actors.get(row.actor_id));
    const ordered = [...actors.values()].sort((a, b) =>
      (teachingOrder.get(a.polity) ?? teachingOrder.size) - (teachingOrder.get(b.polity) ?? teachingOrder.size) ||
      byKoreanName.compare(displayPolityName(a), displayPolityName(b)));
    for (const actor of ordered) {
      const id = actor.actor_id;
      const inCurriculum = teachingOrder.has(actor.polity);
      const koName = displayPolityName(actor);
      let entry = legend.get(id);
      if (!entry) {
        const item = document.createElement('li');
        const button = makeButton(koName, () => {
          if (selectionOverrides.has(id)) selectionOverrides.delete(id);
          else selectionOverrides.set(id, {actor, selected: !inCurriculum});
          scheduleRender();
        });
        const swatch = document.createElement('i');
        swatch.setAttribute('aria-hidden', 'true');
        button.style.setProperty('--swatch', polityColor(actor.polity));
        button.prepend(swatch);
        item.append(button);
        entry = {item, button, actor, inCurriculum};
      }
      if (entry.button.textContent !== koName) entry.button.lastChild.textContent = koName;
      nextLegend.set(id, entry);
      const label = labels.get(id) || svg('text', {class: 'territory-label', 'data-actor': id});
      const labelText = koName.replace(/^일본\((.+)\)$/, '$1');
      if (label.textContent !== labelText) label.textContent = labelText;
      nextLabels.set(id, label);
    }
    legend = nextLegend;
    labels = nextLabels;
    for (const row of legendRows) {
      syncChildren(row.list, [...legend.values()].filter(entry => entry.inCurriculum === row.inCurriculum)
        .map(({item}) => item));
    }
    syncChildren(labelLayer, [...labels.values()]);
  }

  function renderLabels(active) {
    const occupied = [];
    const placed = new Set();
    const worldView = viewport[3] - viewport[1] > 85;
    if (worldView) renderTerrainLabels(occupied);
    for (const row of active) {
      if (placed.has(row.actor_id)) continue;
      const label = labels.get(row.actor_id);
      const halfWidth = (label.getComputedTextLength() + labelSize * .5) / 2;
      const position = labelPosition(row, paths.get(row), land, viewport, halfWidth, labelSize * .62, occupied);
      if (!position) continue;
      const [x, y] = position;
      label.setAttribute('x', x);
      label.setAttribute('y', y);
      placed.add(row.actor_id);
    }
    for (const [id, label] of labels) {
      label.classList.toggle('is-current', placed.has(id));
    }
    if (!worldView) renderTerrainLabels(occupied);
  }

  function renderTerrainLabels(occupied) {
    const [west, south, east, north] = viewport;
    const span = north - south;
    const maxRank = span > 85 ? 1 : span > 42 ? 2 : span > 24 ? 3 : span > 12 ? 4 : 6;
    const halfHeight = labelSize * .5;
    const offsets = [[0, 0], [0, -1], [0, 1], [-.9, 0], [.9, 0], [-.9, 1], [.9, -1]];
    for (const {node, lon, lat, rank} of terrainLabels) {
      let visible = false;
      if (rank <= maxRank && lon > west && lon < east && lat > south && lat < north) {
        const halfWidth = (node.getComputedTextLength() + labelSize * .6) / 2;
        for (const [dx, dy] of offsets) {
          const x = lon * longitudeScale + dx * labelSize, y = -lat + dy * labelSize;
          const box = [x - halfWidth, y - halfHeight, x + halfWidth, y + halfHeight];
          if (box[0] < west * longitudeScale || box[2] > east * longitudeScale ||
              box[1] < -north || box[3] > -south || overlapsLabel(occupied, box)) continue;
          node.setAttribute('x', x);
          node.setAttribute('y', y);
          occupied.push(box);
          visible = true;
          break;
        }
      }
      node.classList.toggle('is-current', visible);
    }
  }

  function render() {
    redraw = undefined;
    if (!viewport) return;
    if (renderedYear !== readyYear) mountYear();
    const areaName = scopes[scope]?.name;
    const mapTitle = [areaName, readyYear === undefined ? '' : yearLabel(readyYear), '영토 지도'].filter(Boolean).join(' ');
    if ($('map-title').textContent !== mapTitle) $('map-title').textContent = mapTitle;
    const active = new Set(boundariesAt([...paths.keys()], readyYear, viewport));
    const activeActors = new Set([...active].map(row => row.actor_id));
    const selected = id => selectionOverrides.get(id)?.selected ?? legend.get(id).inCurriculum;
    const visible = new Set([...active].filter(row => selected(row.actor_id)));
    for (const [row, path] of paths) path.classList.toggle('is-current', visible.has(row));
    renderLabels(visible);
    for (const [id, {item, button}] of legend) {
      item.hidden = !activeActors.has(id) && selectionOverrides.get(id)?.selected !== true;
      button.setAttribute('aria-pressed', String(selected(id)));
    }
    for (const row of legendRows) {
      const hasEntries = !!row.list.querySelector('li:not([hidden])');
      row.list.hidden = !hasEntries;
      row.empty.hidden = hasEntries;
    }
    resetSelection.hidden = selectionOverrides.size === 0;
    empty.hidden = readyYear === undefined || visible.size > 0;
    empty.textContent = active.size ? '이 범위에서 표시할 영토를 선택하세요.' : '이 연도와 범위에 영토 자료가 없습니다.';
    const visibleActors = new Set([...visible].map(row => row.actor_id));
    const periodRows = [...visible].filter(row => selectionOverrides.get(row.actor_id)?.selected ||
      (selectionOverrides.size > 0 && visibleActors.size === 1));
    const selectedPeriods = new Set(periodRows.map(row => {
      const dates = row.start === row.end ? yearLabel(row.start) : yearLabel(row.start) + '–' + yearLabel(row.end);
      return visibleActors.size === 1 ? dates : displayPolityName(legend.get(row.actor_id).actor) + ' ' + dates;
    }));
    period.hidden = selectedPeriods.size === 0;
    period.textContent = selectedPeriods.size ? '도형 적용 기간 ' + [...selectedPeriods].join(' · ') : '';
  }

  function scheduleRender() {
    if (redraw === undefined) redraw = requestAnimationFrame(render);
  }

  const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));

  function resize() {
    const {width, height} = map.getBoundingClientRect();
    if (!width || !height) return;
    const aspect = width / height;
    const mapHeight = Math.max(camera.height, camera.width * longitudeScale / aspect);
    const mapWidth = mapHeight * aspect;
    const lon = clamp(camera.lon, Math.max(0, (world.width - mapWidth / longitudeScale) / 2));
    const lat = clamp(camera.lat, Math.max(0, (world.height - mapHeight) / 2));
    const left = lon * longitudeScale - mapWidth / 2;
    const top = -lat - mapHeight / 2;
    viewport = [left / longitudeScale, -top - mapHeight, (left + mapWidth) / longitudeScale, -top];
    map.setAttribute('viewBox', [left, top, mapWidth, mapHeight].join(' '));
    $('rivers-detail').style.display = mapHeight > 45 ? 'none' : '';
    labelSize = (width < 500 ? 13 : 15) * mapWidth / width;
    labelLayer.setAttribute('font-size', labelSize);
    labelLayer.setAttribute('stroke-width', labelSize * .22);
    terrainLayer.setAttribute('font-size', labelSize * .8);
    terrainLayer.setAttribute('stroke-width', labelSize * .16);
    scheduleRender();
  }

  function setScope(nextScope) {
    scope = nextScope;
    camera = scopes[scope];
    updateControls();
    resize();
  }

  function moveCamera(factor, from, to = from) {
    const rect = map.getBoundingClientRect();
    const {x, y, height: oldHeight} = map.viewBox.baseVal;
    if (!oldHeight || !rect.width || !rect.height) return;
    const worldHeight = Math.max(world.height, world.width * longitudeScale * rect.height / rect.width);
    const height = Math.max(2.5, Math.min(worldHeight, oldHeight * factor));
    const oldUnits = oldHeight / rect.height;
    const units = height / rect.height;
    const center = [rect.left + rect.width / 2, rect.top + rect.height / 2];
    from ??= center;
    to ??= from;
    camera = {
      width: 0,
      height,
      lon: (x + (from[0] - rect.left) * oldUnits + (center[0] - to[0]) * units) / longitudeScale,
      lat: -(y + (from[1] - rect.top) * oldUnits + (center[1] - to[1]) * units),
    };
    scope = undefined;
    updateControls();
    resize();
  }

  for (const button of scopeButtons) button.addEventListener('click', () => setScope(button.dataset.scope));
  $('zoom-in').addEventListener('click', () => moveCamera(.72));
  $('zoom-out').addEventListener('click', () => moveCamera(1 / .72));
  map.addEventListener('wheel', event => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    moveCamera(Math.exp(clamp(event.deltaY, 100) * .007), [event.clientX, event.clientY]);
  }, {passive: false});

  const pointers = new Map();
  function gesture() {
    const [a, b = a] = pointers.values();
    return {
      center: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      distance: Math.hypot(a[0] - b[0], a[1] - b[1]),
    };
  }
  map.addEventListener('pointerdown', event => {
    if (event.button !== 0 || pointers.size === 2) return;
    pointers.set(event.pointerId, [event.clientX, event.clientY]);
    map.setPointerCapture(event.pointerId);
    map.classList.add('is-dragging');
  });
  map.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    const before = gesture();
    pointers.set(event.pointerId, [event.clientX, event.clientY]);
    const after = gesture();
    moveCamera(before.distance && after.distance ? before.distance / after.distance : 1, before.center, after.center);
  });
  map.addEventListener('lostpointercapture', event => {
    pointers.delete(event.pointerId);
    map.classList.toggle('is-dragging', pointers.size > 0);
  });
  map.addEventListener('keydown', event => {
    const arrows = {ArrowLeft: [45, 0], ArrowRight: [-45, 0], ArrowUp: [0, 45], ArrowDown: [0, -45]};
    const delta = arrows[event.key];
    if (delta) {
      const rect = map.getBoundingClientRect();
      const point = [rect.left + rect.width / 2, rect.top + rect.height / 2];
      moveCamera(1, point, [point[0] + delta[0], point[1] + delta[1]]);
    } else if (event.key === '+' || event.key === '=') moveCamera(.72);
    else if (event.key === '-') moveCamera(1 / .72);
    else return;
    event.preventDefault();
  });

  previous.addEventListener('click', () => seek(frames.findLast(value => value < year) ?? start));
  next.addEventListener('click', () => seek(frames.find(value => value > year) ?? end));
  range.addEventListener('input', () => seek(yearAtPosition(range.valueAsNumber)));
  play.addEventListener('click', () => {
    if (timer !== undefined) {
      stop();
      return;
    }
    yearOutput.setAttribute('aria-live', 'off');
    if (year === end) void showYear(start);
    else if (year !== readyYear) void showYear(year);
    play.textContent = '일시정지';
    timer = setInterval(() => {
      if (readyYear !== year) return;
      const target = frames.find(value => value > year) ?? end;
      void showYear(target);
      if (target === end) stop();
    }, 850);
  });

  $('status').hidden = true;
  $('scope').hidden = false;
  $('atlas').hidden = false;
  initFullscreen();
  resize();
  new ResizeObserver(resize).observe(map);
  document.fonts.ready.then(scheduleRender);
  void showYear(year);
}

Promise.all([
  readAsset(worldTerritoryAsset.url + 'index.json'),
  readAsset('./history-map/bases.json'),
  readAsset('./event-geometry/cliopatria-labels-ko.json?v=ko2').catch(() => ({})),
  readAsset('./event-geometry/context/mountain-ranges.json').catch(() => []),
  readAsset('./event-geometry/context/waterways.json').catch(() => ({rivers: [], lakes: '', labels: []})),
]).then(([timeline, bases, dict, mountains, waterways]) => {
  for (const [k, v] of Object.entries(dict || {})) koLabels.set(k, v);
  initAtlas(timeline, globePath(bases.globe), mountains, waterways);
})
  .catch(error => {
    $('status').textContent = '영토 지도를 불러오지 못했습니다. 페이지를 새로고침해 주세요.';
    console.error(error);
  });
