import { historyCamera } from './cold-war.js';
import { readPackedMapData } from '../packed-map-data.js';
import { loadSheetLibrary, sheetPoint, refreshDrawing, groupAreaChoices } from './sheet-library.js?v=area-groups-1';
import {
  W,
  mapHeight,
  canvasFrame,
  zoomView,
  camera,
  presets,
  xy as project,
  ll as invert,
  esc,
  definitions,
  comparisonYears,
  historicalDefinitions,
  draw,
} from './cartography.js?v=full-canvas-1';

const xy = (view, lon, lat) => project(view, lon, lat, mapHeight(view));
const ll = (view, x, y) => invert(view, x, y, mapHeight(view));
function coordinateLabel({lat, lon}) {
  return (lat < 0 ? '남위 ' : '북위 ') + Math.abs(lat).toFixed(4) + '° · ' +
    (lon < 0 ? '서경 ' : '동경 ') + Math.abs(lon).toFixed(4) + '°';
}
const $ = (id) => document.getElementById(id);
const paths = {
  trash: 'M3 7h18M9 7V4h6v3 M6 7l1 14h10l1-14 M10 10v8m4-8v8',
  layers: 'M2 9l10-6 10 6-10 6z M3 13l9 5 9-5 M3 17l9 5 9-5',
  sheet: 'M4 3h16v18H4z M4 9h16 M4 15h16 M10 9v12',
  external: 'M7 17 18 6 M8 6h10v10',
  atlas: 'M3 5l6-2 6 3 6-2v15l-6 2-6-3-6 2z M9 3v15m6-12v15',
  map: 'M2 5l7-2 6 3 7-2v15l-7 2-6-3-7 2z M9 3v15m6-12v15',
  folder: 'M3 5h7l2 3h9v12H3z',
  save: 'M4 3h13l3 3v15H4z M8 3v6h8V3 M8 20v-7h8v7',
  download: 'M12 3v12m-5-5 5 5 5-5 M4 16v5h16v-5',
  search: 'M16 16l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  pencil: 'M4 16 16 4l4 4L8 20l-5 1z M14 6l4 4',
  plus: 'M12 5v14M5 12h14',
  undo: 'M8 4 3 9l5 5 M3 9h10a7 7 0 0 1 7 7v2',
  redo: 'M16 4l5 5-5 5 M21 9H11a7 7 0 0 0-7 7v2',
  globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M3 12h18 M12 3c-5 4-5 14 0 18 5-4 5-14 0-18',
  move: 'M12 2v20m-3-17 3-3 3 3m-6 14 3 3 3-3 M2 12h20M5 9l-3 3 3 3m14-6 3 3-3 3',
  pin: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0z M14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
  route: 'M3 18l6-9 6 5 6-11m-5 0h5v5',
  note: 'M4 4h16v12l-5 5H4z M15 21v-5h5 M8 9h8m-8 4h5',
};
const icon = (k) =>
  '<svg class="ic" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="' +
  paths[k] +
  '"/></svg>';
document.querySelectorAll('[data-icon]').forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
const modes = {
  move: ['선택·이동', ''],
  pin: ['직접 찍기', '지도를 눌러 새 지점을 표시하세요.'],
  route: ['경로', '지도나 지명 목록에서 두 곳 이상을 차례로 선택하세요.'],
  note: ['메모', '메모를 놓을 위치를 선택하세요.'],
};
$('tools').innerHTML = ['pin', 'route', 'note']
  .map((key) => '<button data-mode="' + key + '">' + icon(key) + modes[key][0] + '</button>')
  .join('');

async function json(file) {
  const r = await fetch(new URL(file, import.meta.url));
  if (!r.ok) throw Error(file);
  return r.json();
}
async function packedMapData(name) {
  const response = await fetch(new URL(name, import.meta.url));
  if (!response.ok) throw Error(name);
  return readPackedMapData(response);
}
async function start() {
  const [library, bases, editions, boundaries] = await Promise.all([
    json('presets.json').then((presets) =>
      loadSheetLibrary(SHEET_CONFIG, presets, SheetData.sheetRecords),
    ),
    json('bases.json?v=global-coasts-1'),
    packedMapData('editions.json.gz').catch(() => null),
    packedMapData('boundaries.json.gz?v=2').catch(() => null),
  ]);
  const { places, themes, eras } = library;
  const historical = {
    ...(library.history || { events: {}, layers: {} }),
    boundaries,
    editions: { ...editions },
  };
  for (const [id, entry] of Object.entries(library.history?.editions || {})) {
    if (entry.paths || !historical.editions[id]) {
      historical.editions[id] = { ...historical.editions[id], ...entry };
    }
  }
  const byId = new Map(places.map((p) => [p.id, p]));
  const requested = [...new Set(new URLSearchParams(location.search).getAll('topic').filter(Boolean))];
  const linked =
    requested.length === 1 ? themes.find((t) => t.source === '시트 주제' && t.id === requested[0]) : null;
  const lessons = themes.filter((t) => t.source === '시트 주제');
  const packages = [...(library.packages || [])];
  for (const t of lessons) {
    if (!packages.some((p) => p.id === t.packageId))
      packages.push({ id: t.packageId, name: t.packageId || '패키지 미지정' });
  }
  const reloading = performance.getEntriesByType('navigation')[0]?.type === 'reload';
  const source = $('source');
  const sheetUrl = new URL(SHEET_CONFIG.url);
  sheetUrl.hash = 'gid=' + SHEET_CONFIG.spaceSheetId;
  source.href = sheetUrl;
  const issues = [];
  if (library.failedTabs.length) issues.push('탭 읽기 실패: ' + library.failedTabs.join(', '));
  if (library.unresolved) issues.push('좌표 읽기 실패 ' + library.unresolved + '곳');
  if (library.failedShapes) issues.push('도형 파일 읽기 실패 ' + library.failedShapes + '개');
  if (library.failedEditions) issues.push('배경 파일 읽기 실패 ' + library.failedEditions + '개');
  source.querySelector('span').textContent = library.source === 'live'
    ? ['구글 시트', '지명 ' + places.length + '곳', ...issues].join(' · ')
    : '구글 시트 연결 실패 · 원본 열기';
  source.title = issues.join(' · ') || '구글 시트 열기';
  const fresh = () => ({
    id: crypto.randomUUID(),
    title: '제목 없는 지도',
    view: camera('korea'),
    points: [],
    notes: [],
    routes: [],
  });
  const draftKey = 'chronicle.atlas.draft.v1' + (requested.length ? '.' + JSON.stringify(requested) : ''),
    libraryKey = 'chronicle.atlas.library.v1';
  const valid = (d) =>
    d &&
    typeof d.id === 'string' &&
    typeof d.title === 'string' &&
    presets[d.view?.base] &&
    [d.view.lon, d.view.lat, d.view.span].every(Number.isFinite) &&
    d.view.span > 0 &&
    [d.points, d.notes, d.routes].every(Array.isArray);
  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  }
  function openDrawing(drawing) {
    const { base, lon, lat, span } = drawing.view;
    // Migrate the old default framing; keep custom pans and zooms.
    if (base === 'korea' && lon === 127.6 && lat === 38.25 && span === 19) drawing.view = camera('korea');
    const t = themes.find((t) => t.id && t.id === drawing.topic?.id);
    if (t?.edition && !drawing.edition) {
      drawing.edition = t.edition;
      drawing.layerKeys = t.layers;
      drawing.topic = { id: t.id };
      if (!drawing.itemsCleared && !drawing.points.length && !drawing.notes.length && !drawing.routes.length) {
        drawing.points = t.places.map((id) => sheetPoint(byId.get(id)));
        if (t.frame) drawing.view = historyCamera(t.frame.bounds);
      }
    }
    return refreshDrawing(drawing, byId);
  }
  let doc = read(draftKey, null);
  const resume = valid(doc) && (!requested.length || reloading || (linked && doc.topic?.id === linked.id));
  const resumedId = resume ? doc.id : null;
  if (resume) {
    openDrawing(doc);
  } else {
    doc = fresh();
    if (linked) setTheme(linked);
  }
  function setTheme(theme) {
    delete doc.itemsCleared;
    doc.title = theme.name;
    doc.topic = theme.source === '편집기 주제' ? { example: theme.name } : { id: theme.id };
    doc.view = camera('korea');
    doc.points = theme.places.map((id) => sheetPoint(byId.get(id)));
    doc.notes = [];
    doc.routes = [];
    delete doc.hiddenRoutes;
    doc.edition = theme.edition;
    doc.layerKeys = theme.layers || [];
    doc.hiddenLayers =
      doc.layerKeys.length > 1 ? doc.layerKeys.filter((k) => historical?.layers[k]?.original) : [];
    if (theme.frame) doc.view = historyCamera(theme.frame.bounds);
    else fit(doc.points);
  }
  function currentTheme() {
    if (doc.topic?.id) return themes.find((t) => t.id === doc.topic.id);
    if (doc.topic?.example)
      return themes.find((t) => t.source === '편집기 주제' && t.name === doc.topic.example);
  }
  const samePlace = (mark, p) =>
    mark.spaceId ? mark.spaceId === p.id : mark.name === p.name && mark.lon === p.lon && mark.lat === p.lat;
  let selected = null;
  const compact = matchMedia('(max-width: 680px)');
  const itemsDialog = $('items-dialog');
  const items = $('items');
  function positionItems() {
    const pins = items.querySelector('.pins');
    if (compact.matches) {
      pins.before($('inspect'));
      itemsDialog.append(items);
    } else {
      pins.after($('inspect'));
      if (itemsDialog.open) itemsDialog.close();
      document.querySelector('main').prepend(items);
    }
  }
  function openItems() {
    if (compact.matches && !itemsDialog.open) itemsDialog.showModal();
  }
  positionItems();
  compact.addEventListener('change', positionItems);
  $('show-items').onclick = openItems;
  $('close-items').onclick = () => itemsDialog.close();
  let pickerMode = 'places',
    restrictToLaunch = requested.length > 1 && (!doc.topic?.id || requested.includes(doc.topic.id)),
    mode = 'move',
    activeRoute = null,
    routeStart = null,
    routePicker = $('picker');
  const availableLessons = () =>
    restrictToLaunch ? lessons.filter((t) => requested.includes(t.id)) : lessons;
  let activePackage =
    currentTheme()?.packageId ??
    availableLessons().find((t) => t.places.length)?.packageId ??
    availableLessons()[0]?.packageId ??
    packages[0]?.id;
  let showEmpty = false;
  let lastTheme = currentTheme();
  function showSelectors() {
    const focused = document.activeElement;
    const zone = focused?.closest('#packages,#categories');
    const available = availableLessons();
    const theme = currentTheme();
    const inPackage = available.filter((t) => t.packageId === activePackage);
    const empty = inPackage.filter((t) => !t.places.length && !t.edition);
    $('packages').innerHTML =
      packages
        .map((p, i) =>
          restrictToLaunch && !available.some((t) => t.packageId === p.id)
            ? ''
            : '<button data-package="' +
              i +
              '" aria-pressed="' +
              (activePackage === p.id) +
              '">' +
              esc(p.name) +
              '</button>',
        )
        .join('') || '<span>표시할 패키지가 없습니다.</span>';
    if (restrictToLaunch)
      $('packages').insertAdjacentHTML(
        'beforeend',
        '<button class="extra-choice" id="all-packages">모든 수업 보기</button>',
      );
    const visible = inPackage.filter((t) => t.places.length || t.edition || showEmpty || t === theme);
    $('categories').innerHTML =
      visible
        .map(
          (t) =>
            '<button data-category="' +
            themes.indexOf(t) +
            '" aria-pressed="' +
            (theme === t) +
            '"><span>' +
            esc(t.name) +
            '</span><small>' +
            (t.events ? '사건 ' + t.events.length + '개' : t.places.length + '곳') +
            '</small></button>',
        )
        .join('') ||
      '<span>' +
        (library.source === 'unavailable'
          ? '시트를 읽지 못했습니다. 새로고침해 주세요.'
          : empty.length
            ? '연결된 지점이 없습니다.'
            : '이 패키지에 표시할 카테고리가 없습니다.') +
        '</span>';
    if (empty.some((t) => t !== theme))
      $('categories').insertAdjacentHTML(
        'beforeend',
        '<button class="extra-choice" id="empty-categories" aria-expanded="' +
          showEmpty +
          '">' +
          (showEmpty ? '접기' : '지점 없는 카테고리 ' + empty.length + '개') +
          '</button>',
      );
    if (zone && !focused.isConnected) {
      const match = [...zone.querySelectorAll('button')].find(
        (b) =>
          (b.id && b.id === focused.id) ||
          (b.dataset.category !== undefined && b.dataset.category === focused.dataset.category) ||
          (b.dataset.package !== undefined && b.dataset.package === focused.dataset.package),
      );
      (match || zone.querySelector('button[aria-pressed="true"]') || zone.querySelector('button'))?.focus({
        preventScroll: true,
      });
    }
  }
  const lessonPicker = $('lesson-picker');
  $('choose-lesson').onclick = () => lessonPicker.showModal();
  lessonPicker
    .querySelectorAll('[data-close-lesson]')
    .forEach((b) => (b.onclick = () => lessonPicker.close()));
  $('packages').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'all-packages') restrictToLaunch = false;
    else {
      activePackage = packages[Number(b.dataset.package)].id;
    }
    showEmpty = false;
    showSelectors();
  };
  $('categories').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'empty-categories') {
      showEmpty = !showEmpty;
      showSelectors();
      return;
    }
    const t = themes[Number(b.dataset.category)];
    if (t !== currentTheme() || doc.eventId) applyTheme(t);
  };
  function displayDrawing() {
    const edition = historical.editions[doc.background]?.paths ? doc.background : undefined;
    return { ...doc, edition };
  }
  const yearSelect = $('background-year');
  const byEra = new Map();
  for (const [id, item] of Object.entries(historical.editions)
    .filter(([, entry]) => entry.paths)
    .sort(([, a], [, b]) => (a.year ?? 0) - (b.year ?? 0))) {
    const year = item.year ?? Number(id.replace('world_', ''));
    const label =
      year < 0
        ? '기원전'
        : year < 1000
          ? '1–999년'
          : year < 1800
            ? '1000–1799년'
            : year < 1900
              ? '1800–1899년'
              : '1900년 이후';
    if (!byEra.has(label)) {
      const group = document.createElement('optgroup');
      group.label = label;
      yearSelect.add(group);
      byEra.set(label, group);
    }
    byEra
      .get(label)
      .append(
        new Option(
          Number.isFinite(year) ? (year < 0 ? '기원전 ' : '') + Math.abs(year) + '년' : item.name,
          id,
        ),
      );
  }
  yearSelect.options[0].disabled = true;
  yearSelect.disabled = !byEra.size;
  const yearList = $('year-list');
  const yearLabels = new Map(Array.from(yearSelect.options, (o) => [o.value, o.text]));
  function setBackground(value) {
    if ((doc.background || 'outline') === value) return;
    change(() => {
      doc.backgroundYears = comparisonYears(doc, historical.editions);
      if (doc.backgroundYears.includes(doc.background)) doc.previousBackground = doc.background;
      doc.background = value;
      if (value !== 'outline' && !doc.backgroundYears.includes(value)) doc.backgroundYears.push(value);
    });
  }
  $('compare-year').onclick = (e) => setBackground(e.currentTarget.dataset.target);
  $('background-outline').onclick = () => setBackground('outline');
  yearSelect.onchange = () => {
    setBackground(yearSelect.value);
    yearSelect.value = '';
  };
  yearList.onclick = (e) => {
    const button = e.target.closest('[data-year]');
    if (!button) return;
    const id = button.dataset.year;
    const years = comparisonYears(doc, historical.editions);
    const index = years.indexOf(id);
    const removing = button.hasAttribute('data-remove-year');
    if (removing) {
      change(() => {
        doc.backgroundYears = years.filter((key) => key !== id);
        if (doc.background === id) doc.background = 'outline';
      });
    } else {
      setBackground(doc.background === id ? 'outline' : id);
    }
    const target = yearList.querySelectorAll(removing ? '[data-remove-year]' : '[data-show-year]');
    (target[Math.min(index, target.length - 1)] || yearSelect).focus({ preventScroll: true });
  };
  $('country-borders').onclick = () =>
    change(() => {
      doc.countryBorders = doc.countryBorders === false;
    });
  $('province-borders').onclick = () =>
    change(() => {
      doc.provinceBorders = !doc.provinceBorders;
    });
  $('province-borders').disabled = !boundaries?.provinces;
  function backgroundControls() {
    const { edition } = displayDrawing();
    $('base-summary').textContent = yearLabels.get(edition) || '백지도';
    $('background-outline').setAttribute('aria-pressed', String(!edition));
    const years = comparisonYears(doc, historical.editions);
    const compare = $('compare-year');
    const remembered = years.includes(doc.previousBackground) ? doc.previousBackground : years.at(-1);
    compare.hidden = !years.length;
    compare.dataset.target = edition ? 'outline' : remembered || '';
    compare.textContent = (edition ? '백지도' : yearLabels.get(remembered) || '') + ' 보기';
    const signature = JSON.stringify([edition, years]);
    if (yearList.dataset.signature !== signature) {
      yearList.dataset.signature = signature;
      yearList.innerHTML = years
        .map((id) => {
          const name = esc(yearLabels.get(id));
          const key = esc(id);
          return (
            '<span class="year-chip"><button type="button" data-show-year data-year="' +
            key +
            '" aria-pressed="' +
            (id === edition) +
            '" aria-label="' +
            name +
            ' 지도 표시">' +
            name +
            '</button><button type="button" data-remove-year data-year="' +
            key +
            '" aria-label="' +
            name +
            ' 지도 목록에서 빼기" title="목록에서 빼기">×</button></span>'
          );
        })
        .join('');
    }
    $('country-borders').setAttribute('aria-pressed', String(doc.countryBorders !== false));
    $('country-borders').disabled = !boundaries?.countries && !edition;
    $('province-borders').setAttribute('aria-pressed', String(!!doc.provinceBorders));
  }
  const past = [],
    future = [];
  function message(s) {
    $('status').textContent = s;
  }
  function persist() {
    try {
      localStorage.setItem(draftKey, JSON.stringify(doc));
    } catch {
      message('브라우저에 변경 내용을 저장할 수 없습니다. 지도를 내보내세요.');
    }
  }
  let lastZoomGesture;
  function checkpoint(previous) {
    lastZoomGesture = null;
    past.push(previous);
    if (past.length > 60) past.shift();
    future.length = 0;
  }
  function change(edit) {
    checkpoint(structuredClone(doc));
    edit();
    render();
    persist();
  }
  function history(from, to) {
    if (!from.length) return;
    lastZoomGesture = null;
    to.push(doc);
    doc = from.pop();
    selected = null;
    activeRoute = null;
    routeStart = null;
    render();
    persist();
  }
  function setMode(m) {
    mode = m;
    activeRoute = null;
    routeStart = null;
    render();
  }
  $('era').insertAdjacentHTML('beforeend', eras.map((e) => '<option>' + esc(e) + '</option>').join(''));
  $('base').innerHTML = Object.keys(presets)
    .map((key) => '<option value="' + key + '">' + esc(bases[key].name) + '</option>')
    .join('');
  const svg = $('atlas');
  svg.innerHTML = definitions(bases) + '<g id="scene"></g>';
  const scene = $('scene');
  let definitionKey;
  const kindNames = { points: '지점', notes: '메모', routes: '경로' },
    kindIcons = { points: 'pin', notes: 'note', routes: 'route' };
  const itemLabels = { point: '점', line: '선', area: '면', other: '기타' };
  let itemType, sidebarMapId;
  function sidebarItems() {
    const rows = [];
    for (const kind of Object.keys(kindNames)) {
      for (const [index, item] of doc[kind].entries()) {
        const route = kind === 'routes';
        rows.push({ kind, index, type: route ? 'line' : 'point', name: route ? '경로 ' + (index + 1) : item.name,
          hidden: route ? doc.hiddenRoutes?.includes(index) : item.hidden });
      }
    }
    for (const [index, key] of (doc.layerKeys || []).entries()) {
      const entry = shapesByKey.get(key), layer = historical.layers[key];
      const type = entry?.type || (typeof layer?.line === 'boolean' ? (layer.line ? 'line' : 'area') : 'other');
      const territory = historical.events[doc.eventId]?.territories.find(t => t.key === key);
      const period = territory?.from && (territory.from + (territory.to ? ' ~ ' + territory.to : '부터'));
      rows.push({ kind: 'layerKeys', index, type, name: entry?.name || layer?.name || key, period: entry?.period,
        original: layer?.original, detail: [period, layer?.note, territory?.note].filter(Boolean).join(' · '),
        hidden: doc.hiddenLayers?.includes(key), missing: !layer?.d && !layer?.original, loadFailed: layer?.loadFailed });
    }
    return rows;
  }
  function removeRow(kind, index) {
    if (kind === 'layerKeys') {
      const key = doc.layerKeys[index];
      doc.layerKeys = doc.layerKeys.filter(k => k !== key);
      doc.hiddenLayers = (doc.hiddenLayers || []).filter(k => k !== key);
      return;
    }
    doc[kind].splice(index, 1);
    if (selected?.kind === kind) {
      if (selected.index === index) selected = null;
      else if (selected.index > index) selected.index--;
    }
    if (kind === 'routes') {
      doc.hiddenRoutes = (doc.hiddenRoutes || []).filter(i => i !== index).map(i => i > index ? i - 1 : i);
      activeRoute = routeStart = null;
    }
  }
  function removeItem(kind, index) {
    change(() => removeRow(kind, index));
  }
  function setItemHidden(kind, index, hidden) {
    if (kind === 'layerKeys' || kind === 'routes') {
      const field = kind === 'routes' ? 'hiddenRoutes' : 'hiddenLayers';
      const value = kind === 'routes' ? index : doc.layerKeys[index];
      doc[field] = (doc[field] || []).filter(v => v !== value);
      if (hidden) doc[field].push(value);
      if (hidden && kind === 'routes' && activeRoute === index) activeRoute = routeStart = null;
    } else {
      doc[kind][index].hidden = hidden;
    }
    if (hidden && selected?.kind === kind && selected.index === index) selected = null;
  }
  function shapeLabel(name, period) {
    return '<span class="shape-label"><span>' + name + '</span>' +
      (period ? '<span class="shape-period">' + esc(period) + '</span>' : '') + '</span>';
  }
  function sidebarRow({kind, index, name, period, hidden, missing, loadFailed, original, detail}) {
    const text = esc(name), id = 'visible-' + kind + '-' + index;
    const spokenName = period ? text + ' · ' + esc(period) : text;
    const toggle = '<label class="pin-toggle" title="지도에 표시"><input type="checkbox" id="' + id +
      '" data-visible-kind="' + kind + '" data-index="' + index + '"' +
      (kind === 'points' ? ' data-visible-point="' + index + '"' : '') +
      ' aria-label="' + spokenName + ' 지도에 표시"' + (missing ? ' disabled' : hidden ? '' : ' checked') + '></label>';
    const label = kind === 'layerKeys'
      ? '<button type="button" class="place layer-name" data-layer-source="' + index + '" aria-haspopup="dialog" aria-label="' + spokenName +
        ' 출처와 표시 근거" title="' + esc(detail ? '출처와 표시 근거 · ' + detail : '출처와 표시 근거') + '">' + shapeLabel(
          text + (loadFailed ? ' · 도형 읽기 실패' : missing ? ' · 도형 미등록' : ''), period) + '</button>'
      : '<button class="place" data-kind="' + kind + '" data-index="' + index + '" aria-pressed="' +
        (selected?.kind === kind && selected.index === index) + '">' +
        (kind === 'points' ? '' : '<i>' + icon(kindIcons[kind]) + '</i>') + '<span>' + text + '</span></button>';
    return '<div class="pin-row' + (kind === 'notes' ? ' wide-item' : '') + '">' + toggle + label +
      (original ? '<button type="button" data-original="' + index + '" aria-label="' + spokenName + ' 원도 크게 보기">원도 보기</button>' : '') +
      '<button type="button" class="remove-item" data-remove-kind="' + kind + '" data-index="' + index +
      '" aria-label="' + spokenName + ' 지도에서 빼기" title="지도에서 빼기">−</button></div>';
  }
  function list() {
    const all = sidebarItems();
    if (sidebarMapId !== doc.id || !itemType || (itemType === 'other' && !all.some(row => row.type === 'other'))) itemType = all[0]?.type || 'point';
    sidebarMapId = doc.id;
    const rows = all.filter(row => row.type === itemType);
    $('count').textContent = $('mobile-count').textContent = all.length;
    for (const button of $('item-types').children) {
      const type = button.dataset.itemType;
      const count = all.filter(row => row.type === type).length;
      button.querySelector('span').textContent = count;
      button.hidden = type === 'other' && !count;
      button.setAttribute('aria-pressed', String(type === itemType));
    }
    const checked = rows.some(row => !row.hidden && !row.missing);
    $('delete-checked').disabled = !checked;
    $('toggle-points').disabled = !rows.some(row => !row.missing);
    $('toggle-points').textContent = checked ? '전체 해제' : '전체 선택';
    $('toggle-points').title = itemLabels[itemType] + ' 항목 ' + $('toggle-points').textContent;
    $('delete-checked').title = '체크한 ' + itemLabels[itemType] + ' 항목 삭제';
    const theme = currentTheme();
    $('pins').innerHTML =
      rows.map(sidebarRow).join('') ||
      (itemType !== 'point' ? '<p class="empty">추가한 ' + itemLabels[itemType] + ' 항목이 없습니다.</p>' :
       theme?.places.length && !doc.eventId
        ? '<button class="place" id="fill-theme">' +
          esc(theme.name) +
          ' 지점 ' +
          theme.places.length +
          '곳 불러오기</button>'
        : '<p class="empty">' +
          (library.source === 'unavailable'
            ? '시트의 지점 좌표를 불러오지 못했습니다. 페이지를 새로고침해 주세요.'
            : doc.edition
              ? doc.layerKeys?.length
                ? '이 지도는 지역·경계로 표시됩니다.'
                : '이 사건에 연결된 지점이 없습니다.'
              : theme?.id
                ? '이 주제에 좌표가 연결된 지점이 없습니다.'
                : '지명을 추가하세요.') +
          '</p>');
    const fill = $('fill-theme');
    if (fill)
      fill.onclick = () =>
        change(() => {
          doc.points = theme.places.map((id) => sheetPoint(byId.get(id)));
          selected = null;
          fit(doc.points);
        });
  }
  function inspector() {
    const item = selected && doc[selected.kind]?.[selected.index];
    $('inspect').hidden = !item;
    if (!item) {
      $('inspect').replaceChildren();
      return;
    }
    const { kind, index } = selected;
    const isRoute = kind === 'routes';
    const field = kind === 'notes' ? '메모 내용' : '지도에 표시할 이름';
    const title = isRoute
      ? '<strong class="inspect-route">경로 ' + (index + 1) + '</strong>'
      : '<label class="inspect-name" title="' + field + ' 수정"><input id="label" maxlength="48" aria-label="' +
        field + '">' + icon('pencil') + '</label>';
    $('inspect').innerHTML =
      '<div class="inspect-head"><h3>' + icon(kindIcons[kind]) + '선택한 ' + kindNames[kind] +
      '</h3><button type="button" id="remove" title="지도에서 빼기" aria-label="지도에서 빼기">' +
      icon('trash') + '</button></div>' + title +
      (item.sourceName ? '<p id="original-name" hidden>원래 지명 · ' + esc(item.sourceName) + '</p>' : '') +
      '<p class="inspect-location">' + (isRoute ? '연결한 지점 ' + item.length + '곳' : coordinateLabel(item)) + '</p>' +
      (kind === 'notes' ? '' : '<button id="item-source" type="button" aria-haspopup="dialog">출처와 표시 근거<span aria-hidden="true">›</span></button>');
    if (kind !== 'notes') {
      $('item-source').onclick = () => showItemSource(kind, index);
    }
    $('remove').onclick = () => {
      removeItem(kind, index);
      const next = $('pins').querySelector('button.place, input:enabled') || (itemsDialog.open ? $('close-items') : $('query'));
      next.focus({ preventScroll: true });
    };
    if (isRoute) return;
    const input = $('label');
    input.value = item.name;
    const originalName = $('original-name');
    if (originalName) originalName.hidden = item.name === item.sourceName;
    let original = item.name,
      edited = false;
    input.onfocus = () => {
      edited = false;
      original = item.name;
    };
    input.oninput = () => {
      if (!edited) {
        checkpoint(structuredClone(doc));
        edited = true;
      }
      item.name = input.value.trim() || original;
      if (originalName) originalName.hidden = item.name === item.sourceName;
      list();
      paint();
      persist();
      $('undo').disabled = false;
      $('redo').disabled = true;
    };
    input.onblur = () => {
      input.value = item.name;
    };
    input.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.isComposing) input.blur();
    };
  }
  function pick(kind, index, center = false) {
    const item = doc[kind][index];
    if (!item) return;
    if (mode === 'route' && kind === 'points') {
      if (itemsDialog.open) itemsDialog.close();
      routeTo(item.lon, item.lat);
      return;
    }
    itemType = kind === 'routes' ? 'line' : 'point';
    selected = { kind, index };
    if (center) {
      const coords = kind === 'routes' ? item.map(([lon, lat]) => ({ lon, lat })) : [item];
      fit(coords);
    }
    render();
    openItems();
    $('inspect').focus({ preventScroll: true });
  }
  $('item-types').onclick = (e) => {
    const button = e.target.closest('[data-item-type]');
    if (!button) return;
    itemType = button.dataset.itemType;
    selected = null;
    render();
    $('pins').scrollTop = 0;
  };
  $('toggle-points').onclick = () => {
    const rows = sidebarItems().filter(row => row.type === itemType && !row.missing);
    const hide = rows.some(row => !row.hidden);
    change(() => rows.forEach(row => setItemHidden(row.kind, row.index, hide)));
  };
  $('delete-checked').onclick = () => {
    const rows = sidebarItems().filter(row => row.type === itemType && !row.hidden && !row.missing);
    change(() => {
      for (const row of rows.reverse()) removeRow(row.kind, row.index);
      if (itemType === 'point' && !doc.points.length) doc.itemsCleared = true;
    });
    (itemsDialog.open ? $('close-items') : $('undo')).focus({ preventScroll: true });
  };
  $('pins').onchange = (event) => {
    const input = event.target.closest('[data-visible-kind]');
    if (!input) return;
    change(() => setItemHidden(input.dataset.visibleKind, Number(input.dataset.index), !input.checked));
    $(input.id)?.focus({ preventScroll: true });
  };
  $('pins').onclick = (e) => {
    const sourceButton = e.target.closest('[data-layer-source]');
    if (sourceButton) {
      showItemSource('layerKeys', Number(sourceButton.dataset.layerSource));
      return;
    }
    const preview = e.target.closest('[data-original]');
    if (preview) {
      const layer = historical.layers[doc.layerKeys[preview.dataset.original]];
      modal(layer.name, '<img class="original-shape" alt="' + esc(layer.name) + ' 등록 도형"><p>' + esc(layer.note) + '</p>');
      body.querySelector('img').src = layer.original;
      return;
    }
    const minus = e.target.closest('[data-remove-kind]');
    if (minus) {
      const index = Number(minus.dataset.index);
      removeItem(minus.dataset.removeKind, index);
      const remaining = $('pins').querySelectorAll('[data-remove-kind="' + minus.dataset.removeKind + '"]');
      const next = remaining[Math.min(index, remaining.length - 1)] || (itemsDialog.open ? $('close-items') : $('query'));
      next.focus({ preventScroll: true });
      return;
    }
    const row = e.target.closest('[data-kind]');
    if (row) pick(row.dataset.kind, Number(row.dataset.index), true);
  };
  function paint() {
    const frame = canvasFrame(doc.view, svg.clientWidth, svg.clientHeight);
    const unit = frame.width / (svg.clientWidth || W);
    svg.setAttribute('viewBox', [frame.x, frame.y, frame.width, frame.height].join(' '));
    const drawing = displayDrawing();
    const signature = JSON.stringify([
      drawing.edition,
      doc.layerKeys,
      doc.countryBorders,
      doc.provinceBorders,
    ]);
    if (signature !== definitionKey) {
      definitionKey = signature;
      svg.querySelector('#historic-defs')?.remove();
      scene.insertAdjacentHTML(
        'beforebegin',
        '<g id="historic-defs">' +
          historicalDefinitions(historical, drawing.edition, doc.layerKeys || [], doc) +
          '</g>',
      );
    }
    scene.innerHTML = draw(drawing, bases, unit, selected, historical, frame);
    if (mode === 'route' && routeStart) {
      const [x, y] = xy(doc.view, ...routeStart);
      scene.insertAdjacentHTML(
        'beforeend',
        '<circle cx="' + x + '" cy="' + y + '" r="' + 4 * unit + '" fill="#444" stroke="white"/>',
      );
    }
    svg.setAttribute('aria-label', doc.title + ' 지도');
    const lessonFrame = currentTheme()?.frame;
    $('reset').textContent =
      Math.round(
        (100 * (lessonFrame ? historyCamera(lessonFrame.bounds).span : presets[doc.view.base][2])) / doc.view.span,
      ) + '%';
  }
  function render() {
    paint();
    list();
    inspector();
    pickerList();
    $('map-name').textContent = doc.title;
    const theme = currentTheme();
    backgroundControls();
    if (theme !== lastTheme) {
      if (theme?.source === '시트 주제') {
        activePackage = theme.packageId;
        if (!requested.includes(theme.id)) restrictToLaunch = false;
      }
      $('launch-notice').hidden = true;
      lastTheme = theme;
      showSelectors();
    }
    const event = historical.events?.[doc.eventId];
    const context = event ? [theme?.name, event.date] : [theme?.era];
    if (doc.id === resumedId) context.unshift('이전 작업');
    document.querySelector('.category').textContent = context.filter(Boolean).join(' · ');
    $('base').querySelector('[value="category"]')?.remove();
    if (theme?.frame) $('base').add(new Option(theme.frame.name + ' (수업 범위)', 'category'), 0);
    $('base').value =
      theme?.frame &&
      !doc.eventId &&
      JSON.stringify(doc.view) === JSON.stringify(historyCamera(theme.frame.bounds))
        ? 'category'
        : doc.view.base;
    svg.dataset.mode = mode;
    document
      .querySelectorAll('[data-mode]')
      .forEach((b) => b.setAttribute('aria-pressed', String(mode === b.dataset.mode)));
    $('draw-label').textContent = mode === 'move' ? '그리기' : modes[mode][0];
    $('draw-trigger').classList.toggle('active-tool', mode !== 'move');
    $('finish').hidden = mode === 'move';
    $('finish').textContent = activeRoute === null ? '취소' : '경로 완료';
    $('undo').disabled = !past.length;
    $('redo').disabled = !future.length;
    $('labels').setAttribute('aria-pressed', String(doc.labels !== false));
    message(mode === 'route' && (routeStart || activeRoute !== null)
      ? '다음 지점을 선택하세요.' : modes[mode][1]);
  }
  $('labels').onclick = () =>
    change(() => {
      doc.labels = doc.labels === false;
    });
  function placeChoice(place) {
    const mark = doc.points.find((point) => samePlace(point, place));
    const visible = !!mark && !mark.hidden;
    const routing = mode === 'route';
    const caption = routing ? '경로에 추가' : visible ? '✓ 표시 중' : mark?.hidden ? '다시 표시' : '＋ 추가';
    const id = esc(place.id);
    return '<button class="choice" id="choice-place-' + id + '" data-place="' + id + '"' +
      (routing ? '' : ' aria-pressed="' + visible + '" aria-label="' + esc(place.name + ' 지도에 표시') + '"') +
      '><span>' + esc(place.name) + '</span><small>' + caption + '</small></button>';
  }
  function catalogColumn(type, label, groups) {
    const sections = [...groups].map(([kind, buttons]) =>
      '<section class="place-kind"><h5>' + esc(kind) + '</h5>' + buttons.join('') + '</section>');
    return '<section class="geometry-column" aria-label="' + label + '"><h4>' + label + '</h4>' +
      '<div class="kind-places" data-scroll-key="' + type + '">' +
      (sections.join('') || '<p class="empty">결과 없음</p>') + '</div></section>';
  }
  function shapeChoice(entry, groupTitle) {
    const layer = historical.layers[entry.key];
    const available = layer?.d || layer?.original;
    const visible = doc.layerKeys?.includes(entry.key) && !doc.hiddenLayers?.includes(entry.key);
    const key = esc(entry.key);
    const caption = !available ? (layer?.loadFailed ? '도형 읽기 실패' : '도형 미등록') : visible ? '✓ 표시 중' : layer.original ? '원도 표시' : '＋ 추가';
    const periodOnly = entry.name === groupTitle;
    const label = periodOnly ? shapeLabel(esc(entry.period || '시기 미등록')) : shapeLabel(esc(entry.name), entry.period);
    return '<button class="choice" id="choice-shape-' + key + '" data-shape="' + key +
      '" aria-pressed="' + !!visible + '"' + (available ? '' : ' disabled') +
      (periodOnly ? ' aria-label="' + esc([entry.name, entry.period, caption].filter(Boolean).join(' · ')) + '"' : '') +
      '>' + label + '<small>' + caption + '</small></button>';
  }
  function areaChoice(group, scope) {
    const [entry] = group;
    if (group.length === 1) return shapeChoice(entry);
    const id = 'area-group-' + scope + '-' + esc(entry.actorId);
    const title = entry.actorName;
    return '<details class="area-group" id="' + id + '"><summary class="choice" id="' + id + '-summary">' +
      '<span>' + esc(title) + '</span><span class="area-group-meta"><small>' + group.length +
      '개</small><span class="caret" aria-hidden="true"></span></span></summary>' +
      '<div class="area-versions">' + group.map(version => shapeChoice(version, title)).join('') + '</div></details>';
  }
  const shapesByKey = new Map((library.shapes || []).map(entry => [entry.key, entry]));
  const packageLessons = packages.map(pkg => ({
    ...pkg,
    categories: lessons.filter(theme => theme.packageId === pkg.id).map(theme => ({
      theme,
      index: themes.indexOf(theme),
      points: theme.places.map(id => byId.get(id)).filter(Boolean),
      shapes: (theme.layers || []).map(key => shapesByKey.get(key)).filter(Boolean),
    })),
  })).filter(pkg => pkg.categories.length);
  let catalogPackage = Math.max(0, packageLessons.findIndex(pkg => pkg.id === currentTheme()?.packageId));

  function packageChoices(query) {
    const buttons = packageLessons.map((pkg, i) => '<button type="button" id="catalog-package-' + i +
      '" data-catalog-package="' + i + '" aria-pressed="' + (i === catalogPackage) + '">' + esc(pkg.name) + '</button>');
    const packages = '<div class="catalog-packages" role="group" aria-label="패키지"><h4>패키지</h4>' +
      buttons.join('') + '</div>';
    const matches = packageLessons[catalogPackage].categories.map(category => {
      const matching = entry => category.theme.name.includes(query) || entry.name.includes(query) || entry.keywords?.includes(query) || entry.period?.includes(query);
      return { category, points: category.points.filter(matching), shapes: category.shapes.filter(matching) };
    }).filter(row => row.category.theme.name.includes(query) || row.points.length || row.shapes.length);
    if (!matches.length) return packages + '<p class="empty">이 패키지에 검색 결과가 없습니다.</p>';

    const active = matches.find(row => row.category.index === selectedLesson) || matches[0];
    const headings = matches.map(row => {
      const { index, theme } = row.category;
      const title = esc(theme.name);
      const select = '<button class="choice lesson-toggle" id="choice-lesson-' + index + '" data-lesson="' + index +
        '" aria-pressed="' + (row === active) + '" aria-controls="lesson-regions"><span>' + title +
        '</span><small>' + (row.points.length + row.shapes.length) + '곳</small></button>';
      return '<div class="lesson-heading">' + select + '</div>';
    });
    const { index, theme, points } = active.category;
    const title = esc(theme.name);
    const add = points.length && active.points.length === points.length
      ? '<button class="lesson-add" id="choice-add-' + index + '" data-add-lesson="' + index +
        '" aria-label="' + title + ' 지점 전체 추가">지점 전체 추가</button>' : '';
    const regionRows = ['point', 'line', 'area'].map(type => {
      const shapes = active.shapes.filter(shape => shape.type === type);
      const buttons = type === 'point' ? active.points.map(placeChoice)
        : type === 'area' ? groupAreaChoices(shapes).map(group => areaChoice(group, 'lesson-' + index))
          : shapes.map(shape => shapeChoice(shape));
      const content = buttons.length ? buttons.join('') : '<span class="lesson-region-empty">없음</span>';
      const labelId = 'lesson-region-' + type;
      return '<div class="lesson-region-row" role="group" aria-labelledby="' + labelId + '"><h5 id="' +
        labelId + '">' + itemLabels[type] + '</h5><div class="lesson-region-items">' + content + '</div></div>';
    });
    return packages + '<div class="lesson-columns"><section><h4>카테고리</h4>' +
      '<div class="lesson-list" data-scroll-key="categories-' + catalogPackage + '">' + headings.join('') +
      '</div></section><section id="lesson-regions"><div class="lesson-region-head"><h4>' + title +
      ' · 지역</h4>' + add + '</div><div class="lesson-places" data-scroll-key="regions-' + active.category.index + '">' +
      regionRows.join('') + '</div></section></div>';
  }
  function pickerList() {
    const topic = pickerMode !== 'places',
      rows = pickerMode === 'lessons' ? [] : topic ? themes : places;
    const query = $('query').value.trim(),
      era = $('era').value;
    const groups = { point: new Map(), line: new Map(), area: new Map() };
    function addResult(type, kind, button) {
      if (!groups[type].has(kind)) groups[type].set(kind, []);
      groups[type].get(kind).push(button);
    }
    const results = [];
    for (const [i, r] of rows.entries()) {
      if (topic && (r.source === '시트 주제' || !r.places.length)) continue;
      if (era && (topic ? r.era !== era : r.eras.length && !r.eras.includes(era))) continue;
      if (![r.name, r.keywords || '', r.kind || ''].some((s) => s.includes(query))) continue;
      if (!topic) {
        const kind = !r.kind || r.kind === '지점' ? '지점·도시' : r.kind;
        addResult('point', kind, placeChoice(r));
        continue;
      }
      const button = '<button class="choice" data-index="' + i + '"><span>' + esc(r.name) +
        '</span><small>' + r.places.length + '곳</small></button>';
      results.push((doc.points.length || doc.notes.length || doc.routes.length)
        ? '<div class="topic-choice">' +
            button +
            '<button data-index="' +
            i +
            '" data-append aria-label="' +
            esc(r.name) +
            ' 지점만 추가">지점만 추가</button></div>'
        : button);
    }
    if (pickerMode === 'lessons' && packageLessons.length) results.push(packageChoices(query));
    const empty =
      library.source === 'unavailable'
        ? '시트 데이터를 불러오지 못했습니다. 새로고침해 주세요.'
        : !query && pickerMode === 'lessons'
          ? '지점이 연결된 수업 주제가 없습니다.'
          : '검색 결과가 없습니다.';
    const choices = $('choices');
    if (!topic && library.source !== 'unavailable') {
      const shapes = (library.shapes || []).filter(entry =>
        [entry.name, entry.keywords, entry.kind, entry.period].some(value => value?.includes(query)));
      for (const entry of shapes.filter(entry => entry.type === 'line')) {
        addResult('line', entry.kind, shapeChoice(entry));
      }
      for (const group of groupAreaChoices(shapes.filter(entry => entry.type === 'area'))) {
        const kind = group.every(entry => entry.kind === group[0].kind) ? group[0].kind : '영토';
        addResult('area', kind, areaChoice(group, 'places'));
      }
      results.push(catalogColumn('point', '점', groups.point), catalogColumn('line', '선', groups.line),
        catalogColumn('area', '면', groups.area));
    }
    const html = results.join('') || '<p class="empty">' + empty + '</p>';
    if (html === lastChoices) return;
    lastChoices = html;
    const focused = document.activeElement;
    const focusId = choices.contains(focused) ? focused.id : null;
    const filter = JSON.stringify([pickerMode, query, era]);
    const scroll = new Map();
    if (filter === lastFilter) {
      for (const list of choices.querySelectorAll('[data-scroll-key]')) scroll.set(list.dataset.scrollKey, list.scrollTop);
    } else {
      choices.scrollTop = 0;
    }
    lastFilter = filter;
    choices.classList.toggle('by-kind', !topic && library.source !== 'unavailable');
    const expandedAreas = [...choices.querySelectorAll('.area-group[open]')].map(group => group.id);
    choices.innerHTML = html;
    for (const id of expandedAreas) {
      const group = $(id);
      if (group) group.open = true;
    }
    for (const list of choices.querySelectorAll('[data-scroll-key]')) list.scrollTop = scroll.get(list.dataset.scrollKey) || 0;
    if (focusId) $(focusId)?.focus({ preventScroll: true });
  }
  function setPickerMode(which, query = '', era = '') {
    selectedLesson = null;
    pickerMode = which;
    $('add-sources').hidden = which === 'examples';
    $('era').closest('label').hidden = which === 'lessons';
    $('add-sources').querySelectorAll('button').forEach((button) =>
      button.setAttribute('aria-pressed', String(button.dataset.source === which)),
    );
    $('query').placeholder = which === 'places' ? '지명 또는 옛 이름 검색' :
      which === 'lessons' ? '선택한 패키지에서 카테고리·지역 검색' : '이름 검색';
    $('query').value = query;
    $('era').value = era;
    pickerList();
    $('choices').scrollTop = 0;
  }
  let lastChoices, lastFilter, previousCatalog, selectedLesson = null;
  const catalog = $('place-catalog');
  function openCatalog() {
    catalog.classList.add('show-results');
  }
  function closeCatalog() {
    catalog.classList.remove('show-results');
  }
  catalog.addEventListener('focusin', openCatalog);
  catalog.addEventListener('click', openCatalog);
  catalog.addEventListener('focusout', (event) => {
    if (event.relatedTarget && !catalog.contains(event.relatedTarget)) closeCatalog();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!catalog.contains(event.target)) closeCatalog();
  });
  const catalogChoice = 'summary, button:not(:disabled):not(details:not([open]) button)';
  catalog.addEventListener('keydown', (event) => {
    if (event.isComposing) return;
    if (event.key === 'ArrowRight' && event.target.matches('[data-lesson]')) {
      event.preventDefault();
      selectedLesson = Number(event.target.dataset.lesson);
      pickerList();
      $('lesson-regions')?.querySelector('.lesson-places')?.querySelector(catalogChoice)?.focus();
    } else if (event.key === 'ArrowLeft' && event.target.closest('#lesson-regions')) {
      event.preventDefault();
      $('choices').querySelector('[data-lesson][aria-pressed="true"]')?.focus();
    } else if (event.key === 'Escape' && catalog.classList.contains('show-results')) {
      event.preventDefault();
      event.stopPropagation();
      $('query').focus();
      closeCatalog();
    } else if (event.key === 'ArrowDown' && event.target === $('query')) {
      event.preventDefault();
      openCatalog();
      $('choices').querySelector(catalogChoice)?.focus();
    }
  });
  $('themes').onclick = () => {
    dialog.close();
    previousCatalog = { mode: pickerMode, query: $('query').value, era: $('era').value, scroll: $('choices').scrollTop };
    $('example-search').append($('catalog-controls'));
    $('picker-title').textContent = '예시 지도';
    setPickerMode('examples');
    routePicker.showModal();
    $('query').focus();
  };
  routePicker.addEventListener('close', () => {
    $('place-catalog').append($('catalog-controls'));
    setPickerMode(previousCatalog.mode, previousCatalog.query, previousCatalog.era);
    $('choices').scrollTop = previousCatalog.scroll;
  });
  $('add-sources').onclick = (e) => {
    const button = e.target.closest('[data-source]');
    if (button) setPickerMode(button.dataset.source);
  };
  $('query').oninput = () => {
    if (catalog.contains($('query'))) openCatalog();
    pickerList();
  };
  $('era').onchange = pickerList;
  $('close').onclick = () => routePicker.close();
  $('choices').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-shape')) {
      const key = b.dataset.shape;
      const layer = historical.layers[key];
      if (!layer?.d && !layer?.original) return;
      change(() => {
        const visible = doc.layerKeys?.includes(key) && !doc.hiddenLayers?.includes(key);
        doc.layerKeys = (doc.layerKeys || []).filter((k) => k !== key);
        doc.hiddenLayers = (doc.hiddenLayers || []).filter((k) => k !== key);
        if (!visible) {
          itemType = shapesByKey.get(key).type;
          doc.layerKeys.push(key);
          if (layer.bounds) doc.view = historyCamera(layer.bounds);
        }
      });
      return;
    }
    if (b.hasAttribute('data-catalog-package')) {
      catalogPackage = Number(b.dataset.catalogPackage);
      selectedLesson = null;
      pickerList();
      $('choices').scrollTop = 0;
      return;
    }
    if (b.hasAttribute('data-lesson')) {
      const index = Number(b.dataset.lesson);
      selectedLesson = index;
      pickerList();
      $(b.id)?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (b.hasAttribute('data-add-lesson')) {
      applyTheme(themes[Number(b.dataset.addLesson)], true);
      return;
    }
    if (pickerMode === 'examples') {
      routePicker.close();
      applyTheme(themes[Number(b.dataset.index)], b.hasAttribute('data-append'));
      return;
    }
    const p = byId.get(b.dataset.place);
    if (!p) return;
    if (mode === 'route') {
      if (itemsDialog.open) itemsDialog.close();
      routeTo(p.lon, p.lat);
      return;
    }
    const index = doc.points.findIndex((m) => samePlace(m, p));
    const wasVisible = index >= 0 && !doc.points[index].hidden;
    if (wasVisible) removeItem('points', index);
    else
      change(() => {
        itemType = 'point';
        if (index >= 0) doc.points[index].hidden = false;
        else doc.points.push(sheetPoint(p));
        mode = 'move';
        fit([p]);
      });
  };
  function applyTheme(theme, append = false) {
    change(() => {
      if (append) {
        itemType = 'point';
        const locations = theme.places.map((id) => byId.get(id)).filter(Boolean);
        for (const place of locations) {
          const mark = doc.points.find((p) => samePlace(p, place));
          if (mark) mark.hidden = false;
          else doc.points.push(sheetPoint(place));
        }
        fit(doc.points.filter((p) => !p.hidden));
      } else {
        doc = fresh();
        setTheme(theme);
      }
      selected = null;
      mode = 'move';
      activeRoute = routeStart = null;
    });
  }
  function fit(points) {
    if (!points.length) return;
    const H = mapHeight(doc.view);
    if (
      points.every((p) => {
        const [x, y] = xy(doc.view, p.lon, p.lat);
        return x >= 60 && x <= W - 60 && y >= 78 && y <= H - 48;
      })
    )
      return;
    const xs = points.map((p) => p.lon),
      ys = points.map((p) => p.lat);
    const lon = (Math.min(...xs) + Math.max(...xs)) / 2,
      lat = (Math.min(...ys) + Math.max(...ys)) / 2;
    const base =
      ['korea', 'east', 'world', 'globe'].find((key) => {
        const [w, e, s, n] = bases[key].bbox;
        return points.every((p) => p.lon >= w && p.lon <= e && p.lat >= s && p.lat <= n);
      }) || 'globe';
    const probe = { lon, lat, span: 1, base },
      height = mapHeight(probe);
    const span = Math.max(
      points.length === 1 ? doc.view.span : 5,
      ...points.map((p) => {
        const [x, y] = xy(probe, p.lon, p.lat);
        return Math.max(Math.abs(x - W / 2) / (W / 2 - 70), Math.abs(y - height / 2) / (height / 2 - 85));
      }),
    );
    doc.view = { lon, lat, span, base };
  }
  function routeTo(lon, lat) {
    if (activeRoute === null && !routeStart) {
      routeStart = [lon, lat];
      paint();
      message('시작점을 찍었습니다. 다음 지점을 선택하세요.');
      return;
    }
    change(() => {
      if (activeRoute === null) {
        activeRoute = doc.routes.length;
        doc.routes.push([routeStart]);
        routeStart = null;
      }
      itemType = 'line';
      doc.routes[activeRoute].push([lon, lat]);
    });
  }
  function showTools(open) {
    $('tools').hidden = !open;
    $('draw-trigger').setAttribute('aria-expanded', String(open));
    if (open) $('tools').querySelector('button').focus();
  }
  $('draw-trigger').onclick = () => showTools($('tools').hidden);
  document.addEventListener('click', (e) => {
    if (!$('tools').hidden && !e.target.closest('.draw-tools')) showTools(false);
  });
  document.addEventListener('focusin', (e) => {
    if (!$('tools').hidden && !e.target.closest('.draw-tools')) showTools(false);
  });
  $('tools').onclick = (e) => {
    const button = e.target.closest('[data-mode]');
    if (!button) return;
    showTools(false);
    if (mode !== button.dataset.mode) setMode(button.dataset.mode);
    svg.focus({ preventScroll: true });
  };
  $('finish').onclick = () => {
    setMode('move');
    $('draw-trigger').focus();
  };
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || document.querySelector('dialog[open], :popover-open')) return;
    if (!$('tools').hidden) {
      showTools(false);
      $('draw-trigger').focus();
    } else if (mode !== 'move') {
      $('finish').click();
    } else if (selected && !e.isComposing && !e.target.matches('input,select,textarea')) {
      selected = null;
      render();
      svg.focus({ preventScroll: true });
    }
  });
  $('base').onchange = (e) =>
    change(
      () =>
        (doc.view =
          e.target.value === 'category'
            ? historyCamera(currentTheme().frame.bounds)
            : camera(e.target.value)),
    );
  function zoom(factor, anchor = [W / 2, mapHeight(doc.view) / 2]) {
    const view = zoomView(doc.view, factor, anchor);
    if (view !== doc.view) change(() => (doc.view = view));
  }
  $('plus').onclick = () => zoom(0.75);
  $('minus').onclick = () => zoom(1 / 0.75);
  $('reset').onclick = () =>
    change(() => {
      const coordinates = [
        ...doc.points.filter((p) => !p.hidden),
        ...doc.notes.filter(note => !note.hidden),
        ...doc.routes.filter((_, i) => !doc.hiddenRoutes?.includes(i)).flat().map(([lon, lat]) => ({ lon, lat })),
      ];
      if (currentTheme()?.frame && !doc.eventId) {
        doc.view = historyCamera(currentTheme().frame.bounds);
        return;
      }
      for (const key of doc.layerKeys || []) {
        const b = historical?.layers[key]?.bounds;
        if (b && !doc.hiddenLayers?.includes(key))
          coordinates.push({ lon: b[0], lat: b[1] }, { lon: b[2], lat: b[3] });
      }
      doc.view = camera(coordinates.length ? 'korea' : doc.view.base);
      fit(coordinates);
    });
  $('undo').onclick = () => history(past, future);
  $('redo').onclick = () => history(future, past);

  const dialog = $('dialog'),
    body = $('dialog-body');
  $('close-dialog').onclick = () => dialog.close('cancel');
  function modal(title, html) {
    dialog.classList.remove('map-library', 'source-dialog');
    $('new').hidden = true;
    $('gallery-tools').hidden = true;
    $('themes').hidden = true;
    $('dialog-title').textContent = title;
    body.innerHTML = html;
    dialog.returnValue = '';
    if (!dialog.open) dialog.showModal();
  }
  function showItemSource(kind, index) {
    const row = sidebarItems().find(item => item.kind === kind && item.index === index);
    if (!row) return;
    const mark = kind === 'points' ? doc.points[index] : null;
    const place = mark && byId.get(mark.spaceId);
    const key = kind === 'layerKeys' ? doc.layerKeys[index] : place?.shapeKey;
    const space = place || shapesByKey.get(key);
    const record = library.shapeSources?.get(key);
    const manual = kind === 'routes' || (mark && !mark.spaceId);
    const original = key && historical.layers[key]?.original;
    const representative = mark && record?.period?.trim() === place?.name + ' 대표점';
    const type = representative ? '대표점' : itemLabels[row.type];
    function link(url, label) {
      return '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' +
        esc(label) + '<span aria-hidden="true"> ↗</span></a>';
    }
    function sheetLink(gid, number, label) {
      const url = new URL(SHEET_CONFIG.url);
      url.hash = 'gid=' + gid + (number ? '&range=A' + number : '');
      return link(url.href, label);
    }

    const context = space?.description || (manual
      ? (mark ? '지도에서 직접 찍은 지점입니다.' : '지도에서 선택한 지점을 순서대로 이은 경로입니다.')
      : '');
    const facts = [];
    if (record?.period && !representative && record.period !== row.name) facts.push(['표시 기준', record.period]);
    if (mark) facts.push(['위치', coordinateLabel(mark)]);
    if (original) facts.push(['표시 방식', '원도의 그림 좌표에 맞춰 별도로 표시합니다.']);
    const method = record?.method;
    const methodHtml = method && method !== context
      ? (context || facts.length ? '<details><summary>도형을 만든 방법</summary><p>' + esc(method) + '</p></details>'
        : '<p class="source-context">' + esc(method) + '</p>') : '';

    const citation = record?.source?.trim();
    const spaceReference = citation?.match(/^공간 시트\s*\(([^)]+)\)$/);
    let credit;
    if (spaceReference) {
      const number = place?.id === spaceReference[1] ? place.spaceRow : null;
      credit = sheetLink(SHEET_CONFIG.spaceSheetId, number, '공간 시트');
    } else if (citation) {
      credit = citation.split(/(https?:\/\/[^\s<>"]+)/i).map(part => {
        if (!/^https?:\/\//i.test(part)) return esc(part);
        try { return link(part, new URL(part).hostname); }
        catch { return esc(part); }
      }).join('');
    } else {
      credit = manual ? '직접 작성' : record ? '시트에 출처 미기록' : '현재 시트에서 출처를 확인할 수 없습니다.';
    }
    const sourceLabel = mark ? '좌표 출처' : '도형 출처';
    const contextLink = context && space?.spaceRow && !spaceReference
      ? sheetLink(SHEET_CONFIG.spaceSheetId, space.spaceRow, '장소 설명') : '';
    const recordLink = record ? sheetLink(SHEET_CONFIG.mapShapeSheetId, record.sheetRow, '도형 기록') : '';
    modal(row.name, '<div class="source-body">' +
      (context ? '<p class="source-context">' + esc(context) + '</p>' : '') +
      (facts.length ? '<dl>' + facts.map(([label, value]) => '<div><dt>' + label + '</dt><dd>' + esc(value) + '</dd></div>').join('') + '</dl>' : '') +
      methodHtml + '</div><footer class="source-credit"><div><strong>' + sourceLabel + '</strong><span>' + credit +
      '</span></div><div class="source-links">' + contextLink + recordLink + '</div></footer>');
    dialog.classList.add('source-dialog');
    $('dialog-title').insertAdjacentHTML('afterbegin', '<span class="source-type" data-geometry="' +
      row.type + '">' + esc(type) + '</span>');
  }
  function ask(title, initial, submit, onAccept) {
    modal(
      title,
      '<label>이름<input id="entry" maxlength="48" required></label><div class="actions"><button id="cancel-entry" type="button">취소</button><button value="ok" class="primary">' +
        esc(submit) +
        '</button></div>',
    );
    $('cancel-entry').onclick = () => dialog.close('cancel');
    const input = $('entry');
    input.value = initial;
    input.focus();
    input.select();
    dialog.addEventListener(
      'close',
      () => {
        const name = input.value.trim();
        if (dialog.returnValue === 'ok' && name) onAccept(name);
      },
      { once: true },
    );
  }
  $('rename').onclick = () =>
    ask('지도 제목 수정', doc.title, '적용', (name) => change(() => (doc.title = name)));
  $('new').onclick = () => {
    ask('새 지도', '제목 없는 지도', '만들기', (name) => {
      setMode('move');
      change(() => {
        doc = fresh();
        doc.title = name;
      });
      selected = null;
      render();
    });
    $('themes').hidden = false;
  };
  const saveDate = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  function save() {
    try {
      const lib = read(libraryKey, {});
      lib[doc.id] = { ...doc, savedAt: Date.now() };
      delete lib[doc.id].removedFromGallery;
      localStorage.setItem(libraryKey, JSON.stringify(lib));
      message('이 브라우저의 내 지도에 저장했습니다.');
    } catch {
      message('저장 공간을 사용할 수 없습니다. 지도를 내보내세요.');
    }
  }
  $('save').onclick = save;
  function showGallery(removed = false) {
    const maps = Object.values(read(libraryKey, {})).filter(valid);
    const removedCount = maps.filter((m) => m.removedFromGallery).length;
    const activeSaved = maps.some((m) => m.id === doc.id && !m.removedFromGallery);
    const rows = maps.flatMap((map, index) => {
      if (!!map.removedFromGallery !== removed) return [];
      const name = esc(map.title);
      const id = esc(map.id);
      const height = mapHeight(map.view);
      // Share the editor's coastline definitions while keeping the thumbnail noninteractive.
      const outline = draw({ ...map, points: [], notes: [] }, bases);
      const visiblePoints = map.points.filter((p) => !p.hidden);
      const dots = visiblePoints.map((point) => {
        const [x, y] = xy(map.view, point.lon, point.lat);
        return '<circle cx="' + x + '" cy="' + y + '" r="12" fill="currentColor"/>';
      }).join('');
      const preview = '<svg class="map-thumb" aria-hidden="true" focusable="false" viewBox="0 0 ' +
        W + ' ' + height + '" preserveAspectRatio="xMidYMid slice">' + outline + dots + '</svg>';
      const details = [bases[map.view.base].name, '지점 ' + visiblePoints.length + '곳'];
      if (map.routes.length) details.push('경로 ' + map.routes.length + '개');
      if (map.notes.length) details.push('메모 ' + map.notes.length + '개');
      const content = preview + '<span class="map-caption"><strong>' + name + '</strong><small>' +
        esc(details.join(' · ')) + '</small></span>';
      const entry = removed ? '<div class="saved">' + content + '</div>' :
        '<button type="button" class="saved" data-open="' + id + '" aria-label="' + name + ' 열기">' + content + '</button>';
      const action = removed ? '복원' : '빼기';
      const savedTime = Number.isFinite(map.savedAt)
        ? '<time datetime="' + new Date(map.savedAt).toISOString() + '">' + saveDate.format(map.savedAt) + ' 저장</time>'
        : '저장 시각 미기록';
      const rename = removed ? '' : '<button type="button" data-rename="' + id +
        '" aria-label="' + name + ' 이름 수정">' + icon('pencil') + '이름 수정</button>';
      return '<li class="saved-row"><div class="map-record"><strong>지도 ' + (index + 1) + '번</strong><span>' +
        savedTime + '</span></div>' + entry + '<div class="card-actions">' + rename +
        '<button type="button" data-shelve="' + id + '" aria-label="' + name +
        (removed ? ' 내 지도에 복원' : ' 내 지도에서 빼기') + '">' + action + '</button></div></li>';
    });
    const empty = removed ? '뺀 지도가 없습니다.' : '아직 저장한 지도가 없습니다.';
    const add = !activeSaved && !removed ? '<button type="button" id="add-current">' +
      icon('plus') + '현재 지도 추가</button>' : '';
    const html = (rows.length ? '<ul class="map-list">' + rows.join('') + '</ul>' :
      '<p class="library-empty">' + icon('atlas') + empty + '</p>') + add;
    modal(removed ? '뺀 지도' : '내 지도', html);
    dialog.classList.add('map-library');
    $('gallery-tools').hidden = !removed && !removedCount;
    $('new').hidden = removed;
    const switchButton = $('gallery-switch'), addButton = $('add-current');
    switchButton.hidden = !removed && !removedCount;
    switchButton.textContent = removed ? '내 지도로 돌아가기' : '뺀 지도 (' + removedCount + ')';
    switchButton.onclick = () => {
      showGallery(!removed);
      (switchButton.hidden ? $('close-dialog') : switchButton).focus();
    };
    if (addButton)
      addButton.onclick = () => {
        save();
        showGallery();
        (body.querySelector('[data-open]') || $('add-current'))?.focus();
      };
    body.querySelectorAll('[data-rename]').forEach((button) => {
      button.onclick = () => {
        const id = button.dataset.rename;
        const map = maps.find((m) => m.id === id);
        const row = button.closest('.saved-row');
        const actions = button.parentElement;
        const dismiss = () => {
          editor.remove();
          actions.hidden = false;
          button.focus();
        };
        body.querySelector('[data-cancel-name]')?.click();
        const editor = document.createElement('div');
        editor.className = 'saved-name-editor';
        editor.innerHTML = '<label>지도 이름<input maxlength="48" required></label><div class="card-actions">' +
          '<button type="button" data-cancel-name>취소</button><button class="primary" type="button">저장</button></div>';
        actions.hidden = true;
        row.append(editor);
        const input = editor.querySelector('input');
        input.value = map.title;
        input.select();
        editor.querySelector('[data-cancel-name]').onclick = dismiss;
        const commit = () => {
          const title = input.value.trim();
          if (!title) {
            input.setCustomValidity('지도 이름을 입력하세요.');
            input.reportValidity();
            return;
          }
          if (title === map.title) return dismiss();
          const lib = read(libraryKey, {});
          if (!lib[id]) return showGallery();
          try {
            lib[id].title = title;
            lib[id].savedAt = Date.now();
            localStorage.setItem(libraryKey, JSON.stringify(lib));
          } catch {
            input.setCustomValidity('이름을 저장하지 못했습니다. 다시 시도하세요.');
            input.reportValidity();
            return;
          }
          if (doc.id === id) change(() => (doc.title = title));
          showGallery();
          body.querySelector('[data-rename="' + CSS.escape(id) + '"]').focus();
        };
        input.oninput = () => input.setCustomValidity('');
        editor.querySelector('.primary').onclick = commit;
        editor.onkeydown = (event) => {
          if (event.isComposing) return;
          if (event.key === 'Escape') {
            event.preventDefault();
            dismiss();
          } else if (event.key === 'Enter' && event.target === input) {
            event.preventDefault();
            commit();
          }
        };
      };
    });
    body.querySelectorAll('[data-shelve]').forEach((button, index) => {
      button.onclick = () => {
        try {
          const lib = read(libraryKey, {});
          if (lib[button.dataset.shelve]) {
            if (removed) delete lib[button.dataset.shelve].removedFromGallery;
            else lib[button.dataset.shelve].removedFromGallery = true;
            localStorage.setItem(libraryKey, JSON.stringify(lib));
          }
        } catch {
          button.textContent = '저장 실패 · 다시 시도';
          return;
        }
        showGallery(removed);
        const rows = body.querySelectorAll('[data-shelve]');
        (rows[Math.min(index, rows.length - 1)] || (switchButton.hidden ? $('close-dialog') : switchButton)).focus();
      };
    });
    body.querySelectorAll('[data-open]').forEach((button) => {
      button.onclick = () => {
        dialog.close();
        mode = 'move';
        activeRoute = routeStart = selected = null;
        const map = maps.find((m) => m.id === button.dataset.open);
        change(() => (doc = openDrawing(structuredClone(map))));
      };
    });
  }
  $('gallery').onclick = () => showGallery();
  let drag = null;
  function locationOf(e) {
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
    return [pt.x, pt.y];
  }
  function shift(view, dx, dy) {
    const [lon, lat] = ll(view, W / 2 - dx, mapHeight(view) / 2 - dy);
    return { ...view, lon: Math.max(-180, Math.min(180, lon)), lat: Math.min(78, Math.max(-70, lat)) };
  }
  const desk = svg.closest('.paper-desk');
  let frame = 0,
    saveTimer = 0;
  function finishZoom() {
    clearTimeout(saveTimer);
    saveTimer = 0;
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
      paint();
    }
    persist();
  }
  function gestureView(view, gesture) {
    if (view.span === doc.view.span && view.lon === doc.view.lon && view.lat === doc.view.lat) return;
    if (lastZoomGesture !== gesture) {
      checkpoint(structuredClone(doc));
      lastZoomGesture = gesture;
      $('undo').disabled = false;
      $('redo').disabled = true;
    }
    doc.view = view;
    $('base').value = view.base;
    if (!frame)
      frame = requestAnimationFrame(() => {
        frame = 0;
        paint();
      });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(finishZoom, 180);
  }
  window.addEventListener('pagehide', () => {
    if (saveTimer) finishZoom();
  });
  function anchorAt(e) {
    if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return [W / 2, mapHeight(doc.view) / 2];
    return locationOf(e);
  }
  let wheelGesture,
    wheelTime = -Infinity,
    pinch,
    nativePinch;
  desk.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      if (drag || pinch || nativePinch || !e.deltaY) return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? desk.clientHeight : 1;
      const delta = Math.max(-300, Math.min(300, e.deltaY * unit));
      if (e.timeStamp - wheelTime > 200) wheelGesture = {};
      wheelTime = e.timeStamp;
      gestureView(
        zoomView(doc.view, Math.exp(delta * (e.ctrlKey ? 0.009 : 0.002)), anchorAt(e)),
        wheelGesture,
      );
    },
    { passive: false },
  );
  desk.addEventListener('dblclick', (e) => {
    if (mode !== 'move' || e.target.closest('[data-point],[data-note]')) return;
    e.preventDefault();
    zoom(e.shiftKey ? 2 : 0.5, anchorAt(e));
  });

  function cancelDrag() {
    if (!drag) return;
    if (drag.before) doc = drag.before;
    else doc.view = drag.view;
    drag = null;
    paint();
  }
  const contacts = new Map();
  function touchPair() {
    const [a, b] = contacts.values();
    return {
      center: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      distance: Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])),
    };
  }
  function beginPinch() {
    cancelDrag();
    pinch = { ...touchPair(), view: doc.view, gesture: pinch?.gesture || {} };
  }
  // Capture on a stable element: the SVG features are redrawn during the gesture.
  desk.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType !== 'touch') return;
      contacts.set(e.pointerId, locationOf(e));
      desk.setPointerCapture(e.pointerId);
      if (contacts.size === 2) beginPinch();
    },
    true,
  );
  desk.addEventListener(
    'pointermove',
    (e) => {
      if (!contacts.has(e.pointerId)) return;
      contacts.set(e.pointerId, locationOf(e));
      if (!pinch || contacts.size < 2) return;
      const { center, distance } = touchPair();
      gestureView(zoomView(pinch.view, pinch.distance / distance, pinch.center, center), pinch.gesture);
    },
    true,
  );
  function endContact(e) {
    if (!contacts.delete(e.pointerId) || !pinch) return;
    if (!contacts.size) pinch = null;
    else if (contacts.size >= 2) beginPinch();
    // A remaining finger must lift before it can place a point or start a drag.
  }
  desk.addEventListener('pointerup', endContact, true);
  desk.addEventListener('pointercancel', endContact, true);
  desk.addEventListener('lostpointercapture', endContact);

  // Safari trackpads can send gesture events in place of Ctrl+wheel.
  desk.addEventListener('gesturestart', (e) => {
    e.preventDefault();
    if (!contacts.size && !drag) nativePinch = { view: doc.view, center: anchorAt(e) };
  });
  desk.addEventListener('gesturechange', (e) => {
    e.preventDefault();
    if (nativePinch && !contacts.size && e.scale > 0)
      gestureView(zoomView(nativePinch.view, 1 / e.scale, nativePinch.center, anchorAt(e)), nativePinch);
  });
  desk.addEventListener('gestureend', (e) => {
    e.preventDefault();
    nativePinch = null;
  });
  svg.onpointerdown = (e) => {
    if (e.button !== 0 || drag || pinch || nativePinch) return;
    if (saveTimer) finishZoom();
    const [x, y] = locationOf(e);
    const label = e.target.closest('[data-point],[data-note]');
    const kind = label?.hasAttribute('data-point') ? 'points' : 'notes';
    const item =
      mode === 'move' && label ? doc[kind][Number(label.dataset.point ?? label.dataset.note)] : null;
    drag = {
      x,
      y,
      kind,
      item,
      index: label ? Number(label.dataset.point ?? label.dataset.note) : -1,
      before: item ? structuredClone(doc) : null,
      view: { ...doc.view },
      id: e.pointerId,
    };
    svg.setPointerCapture(e.pointerId);
  };
  svg.onpointermove = (e) => {
    if (drag?.id !== e.pointerId || mode !== 'move') return;
    const [x, y] = locationOf(e);
    if (!drag.moved && Math.hypot(x - drag.x, y - drag.y) <= 2) return;
    drag.moved = true;
    if (drag.item) {
      const [lon, lat] = ll(drag.view, x, y);
      if (drag.kind === 'notes') Object.assign(drag.item, { lon, lat });
      else {
        const [px, py] = xy(drag.view, drag.item.lon, drag.item.lat);
        drag.item.labelOffset = [x - px, y - py];
      }
    } else doc.view = shift(drag.view, x - drag.x, y - drag.y);
    paint();
  };
  svg.onpointercancel = (e) => {
    if (drag?.id === e.pointerId) cancelDrag();
  };
  svg.onpointerup = (e) => {
    if (drag?.id !== e.pointerId) return;
    const d = drag;
    drag = null;
    const [x, y] = locationOf(e);
    if (mode === 'move') {
      if (Math.hypot(x - d.x, y - d.y) > 2) {
        checkpoint(d.before ?? { ...structuredClone(doc), view: d.view });
        render();
        persist();
      } else if (d.item) {
        doc = d.before;
        pick(d.kind, d.index);
      } else if (d.moved) {
        doc.view = d.view;
        paint();
      } else if (selected) {
        selected = null;
        render();
      }
      return;
    }
    if (Math.hypot(x - d.x, y - d.y) > 8) return;
    const [lon, lat] = ll(doc.view, x, y);
    if (mode === 'route') {
      const pin = d.kind === 'points' ? doc.points[d.index] : null;
      routeTo(pin?.lon ?? lon, pin?.lat ?? lat);
      return;
    }
    addAt(lon, lat);
  };
  function addAt(lon, lat) {
    const kind = mode === 'note' ? 'notes' : 'points';
    change(() => {
      itemType = 'point';
      const index = doc[kind].push({ lon, lat, name: kind === 'notes' ? '새 메모' : '새 지점' }) - 1;
      selected = { kind, index };
      mode = 'move';
    });
    openItems();
    $('label').focus();
    $('label').select();
  }
  svg.onkeydown = (e) => {
    const item = e.target.closest('[data-point],[data-note]');
    const canPick = mode === 'move' || (mode === 'route' && item?.hasAttribute('data-point'));
    if (canPick && item && ['Enter', ' '].includes(e.key)) {
      e.preventDefault();
      pick(
        item.hasAttribute('data-point') ? 'points' : 'notes',
        Number(item.dataset.point ?? item.dataset.note),
      );
      return;
    }
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoom(0.75);
    } else if (e.key === '-') {
      e.preventDefault();
      zoom(1 / 0.75);
    } else if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      const [dx, dy] = { ArrowLeft: [45, 0], ArrowRight: [-45, 0], ArrowUp: [0, 45], ArrowDown: [0, -45] }[
        e.key
      ];
      change(() => (doc.view = shift(doc.view, dx, dy)));
    } else if (e.key === 'Enter' && mode !== 'move') {
      const { lon, lat } = doc.view;
      if (mode === 'route') routeTo(lon, lat);
      else addAt(lon, lat);
    }
  };
  document.addEventListener('keydown', (e) => {
    if (
      itemsDialog.open ||
      dialog.open ||
      routePicker.open ||
      lessonPicker.open ||
      e.target.matches('input,select,textarea') ||
      !(e.ctrlKey || e.metaKey)
    )
      return;
    if (e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
    }
    if (e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) history(future, past);
      else history(past, future);
    }
  });
  function download(blob, ext) {
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = doc.title.replace(/[\\/:*?"<>|]/g, '_') + '.' + ext;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  async function exportMap(format) {
    const drawing = displayDrawing();
    const copy = svg.cloneNode(false);
    const frame = canvasFrame(doc.view, svg.clientWidth, svg.clientHeight);
    const outputWidth = W * 2, outputHeight = Math.round(outputWidth * frame.height / frame.width);
    copy.setAttribute('viewBox', [frame.x, frame.y, frame.width, frame.height].join(' '));
    copy.innerHTML =
      definitions(bases) +
      historicalDefinitions(historical, drawing.edition, doc.layerKeys || [], doc) +
      draw(drawing, bases, frame.width / (svg.clientWidth || W), null, historical, frame);
    const title = document.createElementNS(svg.namespaceURI, 'title');
    title.textContent = doc.title;
    copy.prepend(title);
    if (drawing.edition || doc.layerKeys?.length || doc.provinceBorders || doc.countryBorders !== false) {
      const desc = document.createElementNS(svg.namespaceURI, 'desc');
      desc.textContent = [
        historical.editions[drawing.edition]?.name,
        doc.provinceBorders || (!drawing.edition && doc.countryBorders !== false)
          ? 'Natural Earth 1:10m · 현대 경계'
          : '',
        ...(doc.layerKeys || [])
          .filter((k) => !doc.hiddenLayers?.includes(k))
          .map((k) => historical?.layers[k]?.note),
        drawing.edition === 'world_1980' || doc.layerKeys?.length
          ? 'CShapes · Schvitz et al. CC BY-NC-SA 4.0 · https://icr.ethz.ch/data/cshapes/'
          : '',
      ]
        .filter(Boolean)
        .join(' / ');
      copy.prepend(desc);
    }
    copy.setAttribute('font-family', 'Apple SD Gothic Neo,Malgun Gothic,sans-serif');
    copy.setAttribute('width', outputWidth);
    copy.setAttribute('height', outputHeight);
    const blob = new Blob([new XMLSerializer().serializeToString(copy)], {
      type: 'image/svg+xml;charset=utf-8',
    });
    if (format === 'svg') {
      download(blob, 'svg');
      return;
    }
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!png) throw Error();
      download(png, 'png');
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  $('export').onclick = () => {
    modal(
      '지도 내보내기',
      '<div class="actions"><button type="button" data-format="svg">SVG 저장</button><button type="button" class="primary" data-format="png">PNG 저장</button></div>',
    );
    body.querySelectorAll('[data-format]').forEach(
      (b) =>
        (b.onclick = async () => {
          dialog.close();
          try {
            await exportMap(b.dataset.format);
            message('지도 파일을 내보냈습니다.');
          } catch {
            message('파일 생성에 실패했습니다. 다른 형식으로 다시 시도하세요.');
          }
        }),
    );
  };
  showSelectors();
  setPickerMode('places');
  if (catalog.contains(document.activeElement)) openCatalog();
  render();
  if (!editions || !boundaries) {
    const missing = [!editions && '시대별 배경', !boundaries && '현대 경계'].filter(Boolean).join('·');
    message(missing + ' 자료를 모두 불러오지 못했습니다. 새로 고쳐 주세요.');
  }
  if (issues.length)
    $('show-items').setAttribute('aria-label', '작업대 열기 및 시트 연결 상태 보기');
  if (requested.length === 1 && !linked) {
    $('launch-notice').textContent = '연표에서 선택한 카테고리를 시트에서 찾을 수 없습니다.';
    $('launch-notice').hidden = false;
  }
  new ResizeObserver(paint).observe(svg);
}
start().catch(() => {
  $('categories').textContent = '지도 자료를 불러오지 못했습니다.';
  $('status').textContent = '지도 자료를 불러오지 못했습니다. 페이지를 새로 고쳐 주세요.';
});
