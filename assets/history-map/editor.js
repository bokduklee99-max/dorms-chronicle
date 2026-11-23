import { loadSheetLibrary, sheetPoint, refreshDrawing } from './sheet-library.js';
import {
  W,
  mapHeight,
  camera,
  presets,
  xy as project,
  ll as invert,
  esc,
  definitions,
  draw,
} from './cartography.js';

const xy = (view, lon, lat) => project(view, lon, lat, mapHeight(view));
const ll = (view, x, y) => invert(view, x, y, mapHeight(view));
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
  move: ['선택·이동', '지도를 끌어 이동하고, 이름이나 메모를 끌어 배치하세요.'],
  pin: ['직접 찍기', '지도를 눌러 새 지점을 표시하세요.'],
  route: ['경로', '지도나 지명 목록에서 두 곳 이상을 차례로 선택하세요.'],
  note: ['메모', '메모를 놓을 위치를 선택하세요.'],
};
$('tools').innerHTML =
  Object.entries(modes)
    .map(([key, [name]]) => '<button data-mode="' + key + '">' + icon(key) + name + '</button>')
    .join('') + '<button id="finish" hidden>경로 완료</button>';

async function json(file) {
  const r = await fetch(new URL(file, import.meta.url));
  if (!r.ok) throw Error(file);
  return r.json();
}
async function start() {
  let storage;
  try {
    storage = window.localStorage;
  } catch {
    /* Storage may be disabled. */
  }
  const periods = new Map();
  const readRecords = async (...args) => {
    const rows = await SheetData.sheetRecords(...args);
    if (args[1] === '카테고리')
      for (const r of rows) periods.set(r.카테고리명, [r.시작일, r.종료일].filter(Boolean).join(' — '));
    return rows;
  };
  const [library, bases] = await Promise.all([
    json('presets.json').then((presets) => loadSheetLibrary(SHEET_CONFIG, presets, readRecords, storage)),
    json('bases.json'),
  ]);
  const { places, themes, eras } = library;
  const byId = new Map(places.map((p) => [p.id, p]));
  const example = themes.find((t) => t.source === '시트 주제' && t.name === '한국전쟁') ?? themes[0];
  const source = $('source');
  const sheetUrl = new URL(SHEET_CONFIG.url);
  sheetUrl.hash = 'gid=' + SHEET_CONFIG.spaceSheetId;
  source.href = sheetUrl;
  source.querySelector('span').textContent =
    library.source === 'live'
      ? '구글 시트 · 지명 ' + places.length + '곳'
      : library.source === 'cached'
        ? '시트 연결 실패 · 저장된 지명 ' + places.length + '곳'
        : '시트 연결 실패 · 원본 확인 ↗';
  const fresh = () => ({
    id: crypto.randomUUID(),
    title: '제목 없는 지도',
    view: camera('korea'),
    points: [],
    notes: [],
    routes: [],
  });
  const draftKey = 'chronicle.atlas.draft.v1',
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
    return refreshDrawing(drawing, byId);
  }
  let doc = read(draftKey, null);
  if (valid(doc)) openDrawing(doc);
  else {
    doc = fresh();
    if (example) {
      doc.title = example.name;
      doc.points = example.places.map((id) => sheetPoint(byId.get(id)));
      fit(doc.points);
    }
  }
  const samePlace = (mark, p) =>
    mark.spaceId ? mark.spaceId === p.id : mark.name === p.name && mark.lon === p.lon && mark.lat === p.lat;
  let selected = doc.points.length
    ? {
        kind: 'points',
        index: Math.max(
          0,
          doc.points.findIndex((p) => p.name === '인천'),
        ),
      }
    : null;
  let pickerMode = 'places',
    mode = 'move',
    activeRoute = null,
    routeStart = null,
    routePicker = $('picker');
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
  function checkpoint(previous) {
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
  $('base').innerHTML = Object.entries(bases)
    .map(([key, b]) => '<option value="' + key + '">' + esc(b.name) + '</option>')
    .join('');
  const svg = $('atlas');
  svg.innerHTML = definitions(bases) + '<g id="scene"></g>';
  const scene = $('scene');
  const kindNames = { points: '지점', notes: '메모', routes: '경로' },
    kindIcons = { points: 'pin', notes: 'note', routes: 'route' };
  function list() {
    $('count').textContent = doc.points.length;
    const rows = Object.keys(kindNames).flatMap((kind) =>
      doc[kind].map((item, index) => {
        const active = selected?.kind === kind && selected.index === index;
        return (
          '<button class="place" data-kind="' +
          kind +
          '" data-index="' +
          index +
          '" aria-pressed="' +
          active +
          '"><i>' +
          icon(kindIcons[kind]) +
          '</i>' +
          esc(kind === 'routes' ? '경로 ' + (index + 1) : item.name) +
          (active ? '<span class="current">선택됨</span>' : '') +
          '</button>'
        );
      }),
    );
    $('pins').innerHTML = rows.join('') || '<p class="empty">지명을 추가하세요.</p>';
  }
  function inspector() {
    const item = selected && doc[selected.kind]?.[selected.index];
    if (!item) {
      $('inspect').innerHTML = '<h3>지점 편집</h3><p class="empty">지도나 목록에서 지점을 선택하세요.</p>';
      return;
    }
    const { kind, index } = selected;
    const isRoute = kind === 'routes',
      name = isRoute ? '경로 ' + (index + 1) : item.sourceName || item.name;
    const coord = isRoute
      ? item.length + '곳'
      : Math.abs(item.lat).toFixed(4) +
        '° ' +
        (item.lat < 0 ? 'S' : 'N') +
        '  ' +
        Math.abs(item.lon).toFixed(4) +
        '° ' +
        (item.lon < 0 ? 'W' : 'E');
    $('inspect').innerHTML =
      '<h3>선택한 ' +
      kindNames[kind] +
      '</h3><div class="edit-head"><i>' +
      icon(kindIcons[kind]) +
      '</i><strong>' +
      esc(name) +
      '</strong><button id="remove" title="지도에서 빼기" aria-label="지도에서 빼기">' +
      icon('trash') +
      '</button></div><p class="coord">' +
      coord +
      '</p>' +
      (isRoute
        ? ''
        : '<label>' +
          (kind === 'notes' ? '메모 내용' : '지도에 표시할 이름') +
          '<input class="name-input" id="label" maxlength="48"></label>');
    $('remove').onclick = () =>
      change(() => {
        doc[kind].splice(index, 1);
        selected = null;
        activeRoute = routeStart = null;
      });
    if (isRoute) return;
    const input = $('label');
    input.value = item.name;
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
      routeTo(item.lon, item.lat);
      return;
    }
    selected = { kind, index };
    if (center) {
      const coords = kind === 'routes' ? item.map(([lon, lat]) => ({ lon, lat })) : [item];
      fit(coords);
    }
    render();
  }
  $('pins').onclick = (e) => {
    const row = e.target.closest('[data-kind]');
    if (row) pick(row.dataset.kind, Number(row.dataset.index), true);
  };
  function paint() {
    const height = mapHeight(doc.view);
    svg.dataset.layout = doc.view.base === 'korea' ? 'portrait' : 'wide';
    const unit = W / (svg.clientWidth || W);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + height);
    scene.innerHTML = draw(doc, bases, unit, selected);
    if (mode === 'route' && routeStart) {
      const [x, y] = xy(doc.view, ...routeStart);
      scene.insertAdjacentHTML(
        'beforeend',
        '<circle cx="' + x + '" cy="' + y + '" r="' + 4 * unit + '" fill="#444" stroke="white"/>',
      );
    }
    svg.setAttribute('aria-label', doc.title + ' 지도');
    $('reset').textContent = Math.round((100 * presets[doc.view.base][2]) / doc.view.span) + '%';
  }
  function render() {
    paint();
    list();
    inspector();
    $('map-name').textContent = doc.title;
    document.querySelector('.category').textContent =
      periods.get(doc.title) || themes.find((t) => t.name === doc.title)?.era || '';
    $('base').value = doc.view.base;
    svg.dataset.mode = mode;
    document
      .querySelectorAll('[data-mode]')
      .forEach((b) => b.setAttribute('aria-pressed', String(mode === b.dataset.mode)));
    $('finish').hidden = mode !== 'route' || activeRoute === null;
    $('undo').disabled = !past.length;
    $('redo').disabled = !future.length;
    $('labels').setAttribute('aria-pressed', String(doc.labels !== false));
    message(modes[mode][1]);
  }
  $('labels').onclick = () =>
    change(() => {
      doc.labels = doc.labels === false;
    });
  function pickerList() {
    const topic = pickerMode === 'themes',
      rows = topic ? themes : places;
    const query = $('query').value.trim(),
      era = $('era').value;
    const results = rows.flatMap((r, i) => {
      if (era && (topic ? r.era !== era : r.eras.length && !r.eras.includes(era))) return [];
      if (![r.name, r.keywords || ''].some((s) => s.includes(query))) return [];
      const caption = topic
        ? r.source + ' · ' + r.places.length + '곳'
        : mode === 'route'
          ? '경로에 추가'
          : doc.points.some((p) => samePlace(p, r))
            ? '지도에서 선택'
            : '추가 ＋';
      const button =
        '<button class="choice" data-index="' +
        i +
        '"><span>' +
        esc(r.name) +
        '</span><small>' +
        esc(caption) +
        '</small></button>';
      return topic
        ? '<div class="topic-choice">' +
            button +
            '<button data-index="' +
            i +
            '" data-append aria-label="' +
            esc(r.name) +
            ' 지점만 추가">지점만 추가</button></div>'
        : button;
    });
    $('choices').innerHTML = results.join('') || '<p class="empty">검색 결과가 없습니다.</p>';
  }
  function openPicker(which) {
    pickerMode = which;
    const topic = which === 'themes';
    $('picker-title').textContent = topic ? '지도 주제 변경' : '시트에서 지명 추가';
    $('query').placeholder = topic ? '주제 검색' : '지명 또는 옛 이름 검색';
    $('query').value = '';
    $('era').value = '';
    pickerList();
    routePicker.showModal();
    $('query').focus();
  }
  $('browse').onclick = () => openPicker('places');
  $('themes').onclick = () => openPicker('themes');
  $('query').oninput = pickerList;
  $('era').onchange = pickerList;
  $('close').onclick = () => routePicker.close();
  $('choices').onclick = (e) => {
    const b = e.target.closest('[data-index]');
    if (!b) return;
    const i = Number(b.dataset.index);
    routePicker.close();
    if (pickerMode === 'themes') {
      const t = themes[i],
        locations = t.places.map((id) => byId.get(id));
      change(() => {
        if (!b.hasAttribute('data-append')) {
          doc.points = [];
          doc.notes = [];
          doc.routes = [];
          doc.title = t.name;
          doc.view = camera('korea');
        }
        doc.points.push(...locations.filter((p) => !doc.points.some((m) => samePlace(m, p))).map(sheetPoint));
        mode = 'move';
        activeRoute = routeStart = null;
        selected = doc.points.length ? { kind: 'points', index: 0 } : null;
        fit(locations);
      });
      return;
    }
    const p = places[i];
    if (mode === 'route') {
      routeTo(p.lon, p.lat);
      return;
    }
    change(() => {
      let index = doc.points.findIndex((m) => samePlace(m, p));
      if (index < 0) index = doc.points.push(sheetPoint(p)) - 1;
      selected = { kind: 'points', index };
      mode = 'move';
      fit([p]);
    });
  };
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
      doc.routes[activeRoute].push([lon, lat]);
    });
  }
  $('tools').onclick = (e) => {
    const b = e.target.closest('[data-mode]');
    if (b) setMode(b.dataset.mode);
  };
  $('finish').onclick = () => {
    if ((doc.routes[activeRoute]?.length || 0) < 2) {
      message('경로에 지점을 한 곳 더 추가하세요.');
      return;
    }
    setMode('move');
  };
  $('base').onchange = (e) => change(() => (doc.view = camera(e.target.value)));
  function zoom(factor) {
    const span = Math.max(0.5, Math.min(360, doc.view.span * factor));
    if (span !== doc.view.span) change(() => (doc.view.span = span));
  }
  $('plus').onclick = () => zoom(0.75);
  $('minus').onclick = () => zoom(1 / 0.75);
  $('reset').onclick = () =>
    change(() => {
      const coordinates = [
        ...doc.points,
        ...doc.notes,
        ...doc.routes.flat().map(([lon, lat]) => ({ lon, lat })),
      ];
      doc.view = camera(coordinates.length ? 'korea' : doc.view.base);
      fit(coordinates);
    });
  $('undo').onclick = () => history(past, future);
  $('redo').onclick = () => history(future, past);

  const dialog = $('dialog'),
    body = $('dialog-body');
  $('close-dialog').onclick = () => dialog.close('cancel');
  function modal(title, html) {
    $('dialog-title').textContent = title;
    body.innerHTML = html;
    dialog.returnValue = '';
    dialog.showModal();
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
  $('new').onclick = () =>
    ask('새 지도', '제목 없는 지도', '만들기', (name) => {
      setMode('move');
      change(() => {
        doc = fresh();
        doc.title = name;
      });
      selected = null;
      render();
    });
  function save() {
    try {
      const lib = read(libraryKey, {});
      lib[doc.id] = structuredClone(doc);
      localStorage.setItem(libraryKey, JSON.stringify(lib));
      message('이 브라우저의 내 지도에 저장했습니다.');
    } catch {
      message('저장 공간을 사용할 수 없습니다. 지도를 내보내세요.');
    }
  }
  $('save').onclick = save;
  $('gallery').onclick = () => {
    const maps = Object.values(read(libraryKey, {})).filter(valid);
    modal(
      '내 지도',
      maps.length
        ? maps
            .map(
              (m, i) =>
                '<button type="button" data-open="' + i + '" class="saved">' + esc(m.title) + '</button>',
            )
            .join('')
        : '<p>편집한 지도에서 저장을 누르면 여기에 모입니다.</p>',
    );
    body.querySelectorAll('[data-open]').forEach(
      (b) =>
        (b.onclick = () => {
          dialog.close();
          mode = 'move';
          activeRoute = null;
          routeStart = null;
          selected = null;
          change(() => (doc = openDrawing(structuredClone(maps[Number(b.dataset.open)]))));
        }),
    );
  };
  let drag = null;
  function locationOf(e) {
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
    return [pt.x, pt.y];
  }
  function shift(view, dx, dy) {
    const [lon, lat] = ll(view, W / 2 - dx, mapHeight(view) / 2 - dy);
    return { ...view, lon: Math.max(-180, Math.min(180, lon)), lat: Math.min(78, Math.max(-70, lat)) };
  }
  svg.onpointerdown = (e) => {
    if (e.button !== 0 || drag) return;
    const [x, y] = locationOf(e);
    if (x < 0 || x > W || y < 0 || y > mapHeight(doc.view)) return;
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
  svg.onpointercancel = () => {
    if (drag) {
      if (drag.before) doc = drag.before;
      else doc.view = drag.view;
      drag = null;
      paint();
    }
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
      } else {
        doc.view = d.view;
        paint();
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
      const index = doc[kind].push({ lon, lat, name: kind === 'notes' ? '새 메모' : '새 지점' }) - 1;
      selected = { kind, index };
      mode = 'move';
    });
    $('label').focus();
    $('label').select();
  }
  svg.onkeydown = (e) => {
    const item = e.target.closest('[data-point],[data-note]');
    if (mode === 'move' && item && ['Enter', ' '].includes(e.key)) {
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
      dialog.open ||
      routePicker.open ||
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
    const copy = svg.cloneNode(false);
    const H = mapHeight(doc.view);
    copy.innerHTML = definitions(bases) + draw(doc, bases, W / (svg.clientWidth || W));
    const title = document.createElementNS(svg.namespaceURI, 'title');
    title.textContent = doc.title;
    copy.prepend(title);
    copy.setAttribute('font-family', 'Apple SD Gothic Neo,Malgun Gothic,sans-serif');
    copy.setAttribute('width', W * 2);
    copy.setAttribute('height', H * 2);
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
      canvas.width = W * 2;
      canvas.height = H * 2;
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
  render();
  new ResizeObserver(paint).observe(svg);
}
start().catch(() => {
  $('status').textContent = '지도 자료를 불러오지 못했습니다. 페이지를 새로 고쳐 주세요.';
});
