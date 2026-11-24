import {shapePaths} from '../event-map-links.js';
import {pathData, svg} from './story-map.js';
import {boundariesAt, readTerritoryBoundaries, territoryAsset, territoryChanges, yearAtPosition, yearLabel, yearPosition} from './territory-map-model.js';

const $ = id => document.getElementById(id);
const frame = window.frameElement;
if (frame) {
  const content = document.querySelector('main');
  new ResizeObserver(() => {
    frame.style.height = Math.ceil(content.getBoundingClientRect().height) + 'px';
  }).observe(content);
}
const longitudeScale = .78;

const regions = {
  eastAsia: {
    territoryUrl: territoryAsset.url,
    terrainUrl: './event-geometry/context/east-asia.json',
    eras: [
      {name: '삼국', start: -91, example: 600},
      {name: '남북국', start: 682, example: 820},
      {name: '후삼국', start: 892, example: 925},
      {name: '고려', start: 936, example: 1100},
      {name: '조선', start: 1395, example: 1500},
    ],
    seaLabels: [
      {text: '황해', x: 122.7, y: -35.75},
      {text: '동해', x: 133.9, y: -39.2},
      {text: '동중국해', x: 126.4, y: -27.6},
    ],
  },
  china: {
    territoryUrl: './event-geometry/cliopatria-china.geojson',
    terrainUrl: './event-geometry/context/east-asia.json',
    eras: [
      {name: '상·주·춘추전국', start: -1600, example: -300},
      {name: '진·한', start: -218, example: -100},
      {name: '삼국·남북조', start: 207, example: 240},
      {name: '수·당·송·요·금', start: 587, example: 750},
      {name: '원·명·청', start: 1206, example: 1500},
      {name: '근현대', start: 1912, example: 1960},
    ],
    seaLabels: [
      {text: '황해', x: 122.7, y: -35.75},
      {text: '동중국해', x: 125.5, y: -28.0},
      {text: '남중국해', x: 114.5, y: -18.5},
    ],
  },
  europe: {
    territoryUrl: './event-geometry/cliopatria-europe.geojson',
    terrainUrl: './event-geometry/context/europe.json',
    eras: [
      {name: '고대 지중해', start: -630, example: -230},
      {name: '로마 제국', start: -27, example: 117},
      {name: '중세 유럽', start: 510, example: 1147},
      {name: '근세 제국', start: 1487, example: 1687},
      {name: '근대·대전', start: 1805, example: 1918},
    ],
    seaLabels: [
      {text: '지중해', x: 16.5, y: -35.5},
      {text: '북해', x: 3.5, y: -56.5},
      {text: '흑해', x: 34.5, y: -43.2},
    ],
  },
};

const scopes = {
  china: {region: 'china', name: '중국사', lon: 109, lat: 34.5, width: 48, height: 30},
  korea: {region: 'eastAsia', name: '한반도·만주', lon: 127.7, lat: 39.5, width: 20, height: 14},
  eastAsia: {region: 'eastAsia', name: '동아시아', lon: 122, lat: 38, width: 47, height: 25},
  europe: {region: 'europe', name: '유럽·지중해', lon: 14, lat: 46.5, width: 50, height: 30},
};

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

function polityColor(polity) {
  if (colors[polity]) return colors[polity];
  let hash = 0;
  for (const char of polity) hash = (Math.imul(hash, 31) + char.codePointAt(0)) >>> 0;
  return 'hsl(' + (hash % 360) + ' 45% 48%)';
}

const regionCache = new Map();

async function readAsset(file) {
  const response = await fetch(new URL(file, import.meta.url));
  if (!response.ok) throw new Error('지도 파일을 읽지 못했습니다.');
  return response.json();
}

async function loadRegion(regionKey) {
  if (regionCache.has(regionKey)) return regionCache.get(regionKey);
  const spec = regions[regionKey];
  const [collection, terrain] = await Promise.all([readAsset(spec.territoryUrl), readAsset(spec.terrainUrl)]);
  const loaded = {regionKey, spec, data: readTerritoryBoundaries(collection), terrain};
  regionCache.set(regionKey, loaded);
  return loaded;
}

function makeButton(label, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function labelPosition(row, path, [west, south, east, north], halfWidth, halfHeight, occupied) {
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
        if (occupied.some(([l, t, r, b]) => l < box[2] && t < box[3] && r > box[0] && b > box[1])) continue;
        if (path.isPointInFill(new DOMPoint(lon, y))) {
          occupied.push(box);
          return [x, y];
        }
      }
    }
  }
}

function initAtlas(initialLoaded) {
  const map = $('atlas-map');
  const range = $('year-range');
  const yearOutput = $('year');
  const period = $('period');
  const gap = $('gap');
  const play = $('play');
  const playLabel = play.innerHTML;
  const previous = $('previous');
  const next = $('next');
  const labelLayer = $('territory-labels');
  const scopeButtons = [...$('scope').querySelectorAll('button')];

  let activeRegionKey;
  let eras = [];
  let actors = new Map();
  let boundaries = [];
  let goryeo = [];
  let start = 0;
  let end = 0;
  let frames = [];
  let eraButtons = [];
  let paths = new Map();
  let legend = new Map();
  let labels = new Map();

  let scope = scopes.korea;
  let year = 600;
  let viewport;
  let focused;
  let timer;
  let labelFrame;
  let labelSize;

  function stop() {
    if (timer === undefined) return;
    clearInterval(timer);
    timer = undefined;
    play.innerHTML = playLabel;
    yearOutput.setAttribute('aria-live', 'polite');
  }

  function seek(target) {
    stop();
    year = target;
    render();
  }

  function mountRegion(loaded) {
    stop();
    activeRegionKey = loaded.regionKey;
    const {spec, data, terrain} = loaded;
    eras = spec.eras;
    actors = data.actors;
    boundaries = data.boundaries;
    focused = undefined;
    labelFrame = undefined;


    for (const layer of ['land', 'rivers', 'lakes']) $(layer).setAttribute('d', terrain[layer] || '');
    const seaGroup = $('sea-labels');
    seaGroup.replaceChildren(...spec.seaLabels.map(({text, x, y}) => {
      const node = svg('text', {x, y});
      node.textContent = text;
      return node;
    }));

    const boundsInfo = territoryChanges(boundaries);
    start = boundsInfo.start;
    end = boundsInfo.end;
    frames = boundsInfo.frames;
    goryeo = boundaries.filter(row => actors.get(row.actor_id).polity === 'Goryeo')
      .sort((a, b) => a.start - b.start);
    year = eras[0].example;

    range.min = yearPosition(start);
    range.max = yearPosition(end);
    $('first-year').textContent = yearLabel(start);
    $('last-year').textContent = yearLabel(end);

    eraButtons = eras.map(era => makeButton(era.name, () => seek(era.example)));
    $('eras').replaceChildren(...eraButtons);
    $('era-ticks').replaceChildren(...eras.map(era => new Option('', String(yearPosition(era.start)))));

    paths = new Map();
    const territoryGroup = $('territories');
    territoryGroup.replaceChildren();
    const byArea = boundaries.map(row => [row, row.boxes.reduce((sum, [w, s, e, n]) => sum + (e - w) * (n - s), 0)]);
    byArea.sort((a, b) => b[1] - a[1]);
    for (const [row] of byArea) {
      const path = svg('path', {
        d: pathData(shapePaths(row.geometry)), class: 'atlas-territory',
        'data-feature': row.feature_id, 'fill-rule': 'evenodd', 'vector-effect': 'non-scaling-stroke',
      });
      path.style.color = polityColor(actors.get(row.actor_id).polity);
      territoryGroup.append(path);
      paths.set(row, path);
    }

    legend = new Map();
    labels = new Map();
    $('legend').replaceChildren();
    labelLayer.replaceChildren();
    for (const actor of actors.values()) {
      const item = document.createElement('li');
      const button = makeButton(actor.name, () => {
        focused = focused === actor.actor_id ? undefined : actor.actor_id;
        render();
      });
      const swatch = document.createElement('i');
      swatch.setAttribute('aria-hidden', 'true');
      button.style.setProperty('--swatch', polityColor(actor.polity));
      button.prepend(swatch);
      item.append(button);
      $('legend').append(item);
      legend.set(actor.actor_id, {item, button});
      const label = svg('text', {class: 'territory-label', 'data-actor': actor.actor_id});
      label.textContent = actor.name.replace(/^일본\((.+)\)$/, '$1').replace(/\(.+\)$/, '');
      labelLayer.append(label);
      labels.set(actor.actor_id, label);
    }
  }

  function renderLabels(active, selection) {
    const frameKey = [activeRegionKey, viewport.join(), labelSize, selection, ...Array.from(active, row => row.feature_id)].join('|');
    if (labelFrame === frameKey) return;
    labelFrame = frameKey;
    const rows = [...active].sort((a, b) => Number(b.actor_id === selection) - Number(a.actor_id === selection));
    const occupied = [];
    const placed = new Set();
    for (const row of rows) {
      if (placed.has(row.actor_id)) continue;
      const label = labels.get(row.actor_id);
      const halfWidth = (label.getComputedTextLength() + labelSize * .5) / 2;
      const position = labelPosition(row, paths.get(row), viewport, halfWidth, labelSize * .62, occupied);
      if (!position) continue;
      const [x, y] = position;
      label.setAttribute('x', x);
      label.setAttribute('y', y);
      placed.add(row.actor_id);
    }
    for (const [id, label] of labels) {
      label.classList.toggle('is-current', placed.has(id));
      label.classList.toggle('is-dim', !!selection && id !== selection);
    }
  }

  function render() {
    if (!viewport) return;
    const active = new Set(boundariesAt(boundaries, year, viewport));
    const activeActors = new Set([...active].map(row => row.actor_id));
    const selection = activeActors.has(focused) ? focused : undefined;
    for (const [row, path] of paths) {
      const current = active.has(row);
      path.classList.toggle('is-current', current);
      path.classList.toggle('is-focused', current && row.actor_id === selection);
      path.classList.toggle('is-dim', current && !!selection && row.actor_id !== selection);
    }
    renderLabels(active, selection);
    for (const [id, {item, button}] of legend) {
      item.hidden = !activeActors.has(id);
      button.setAttribute('aria-pressed', String(id === selection));
    }
    $('empty').hidden = activeActors.size > 0;
    const selectedPeriods = new Set([...active].filter(row => row.actor_id === selection)
      .map(row => row.start === row.end ? yearLabel(row.start) : yearLabel(row.start) + '–' + yearLabel(row.end)));
    period.hidden = !selection;
    period.textContent = selection ? '도형 적용 기간 ' + [...selectedPeriods].join(', ') : '';
    const beforeGap = goryeo.findLast(row => row.end < year);
    const afterGap = goryeo.find(row => row.start > year);
    gap.hidden = !beforeGap || !afterGap || goryeo.some(row => row.start <= year && year <= row.end);
    gap.textContent = gap.hidden ? '' : '고려 영역 자료 없음 · ' + (beforeGap.end + 1) + '–' + yearLabel(afterGap.start - 1);

    const label = yearLabel(year);
    yearOutput.textContent = label;
    range.value = yearPosition(year);
    range.setAttribute('aria-valuetext', label);
    $('map-title').textContent = scope.name + ' ' + label + ' 영토 지도';
    previous.disabled = year <= start;
    next.disabled = year >= end;
    const era = eras.findLastIndex(item => item.start <= year);
    eraButtons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === era)));
  }

  function resize() {
    const {width, height} = map.getBoundingClientRect();
    if (!width || !height) return;
    const aspect = width / height;
    const mapHeight = Math.max(scope.height, scope.width * longitudeScale / aspect);
    const mapWidth = mapHeight * aspect;
    const left = scope.lon * longitudeScale - mapWidth / 2;
    const top = -scope.lat - mapHeight / 2;
    viewport = [left / longitudeScale, -top - mapHeight, (left + mapWidth) / longitudeScale, -top];
    map.setAttribute('viewBox', [left, top, mapWidth, mapHeight].join(' '));
    $('sea-labels').setAttribute('font-size', mapWidth / 55);
    labelSize = (width < 500 ? 13 : 15) * mapWidth / width;
    labelLayer.setAttribute('font-size', labelSize);
    labelLayer.setAttribute('stroke-width', labelSize * .22);
    render();
  }

  for (const button of scopeButtons) {
    button.addEventListener('click', async () => {
      const nextScope = scopes[button.dataset.scope];
      if (!nextScope) return;
      for (const choice of scopeButtons) choice.setAttribute('aria-pressed', String(choice === button));
      scope = nextScope;
      $('status').hidden = true;
      if (nextScope.region !== activeRegionKey) {
        $('status').hidden = false;
        $('status').textContent = nextScope.name + ' 영토 지도를 불러오는 중입니다.';
        try {
          const loaded = await loadRegion(nextScope.region);
          if (scope !== nextScope) return;
          mountRegion(loaded);
          $('status').hidden = true;
        } catch (error) {
          if (scope !== nextScope) return;
          $('status').hidden = false;
          $('status').textContent = '선택한 권역의 영토 지도를 불러오지 못했습니다.';
          console.error(error);
          return;
        }
      }
      resize();
    });
  }

  previous.addEventListener('click', () => seek(frames.findLast(value => value < year) ?? start));
  next.addEventListener('click', () => seek(frames.find(value => value > year) ?? end));
  range.addEventListener('input', () => seek(yearAtPosition(range.valueAsNumber)));
  play.addEventListener('click', () => {
    if (timer !== undefined) {
      stop();
      return;
    }
    yearOutput.setAttribute('aria-live', 'off');
    if (year === end) {
      year = start;
      render();
    }
    play.textContent = '일시정지';
    timer = setInterval(() => {
      year = frames.find(value => value > year) ?? end;
      render();
      if (year === end) stop();
    }, 850);
  });

  mountRegion(initialLoaded);
  $('status').hidden = true;
  $('scope').hidden = false;
  $('atlas').hidden = false;
  resize();
  new ResizeObserver(resize).observe(map);
  document.fonts.ready.then(() => {
    labelFrame = undefined;
    resize();
  });
}

loadRegion('eastAsia')
  .then(initAtlas)
  .catch(error => {
    $('scope').hidden = true;
    $('atlas').hidden = true;
    $('status').hidden = false;
    $('status').textContent = '영토 지도를 불러오지 못했습니다. 페이지를 새로고침해 주세요.';
    console.error(error);
  });
