import { loadSheetLibrary, sheetPoint, refreshDrawing } from './sheet-library.js';
import { W, H, camera, presets, xy, ll, esc, definitions, draw } from './cartography.js';

const $ = (id) => document.getElementById(id);
const paths = {
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
  '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="' +
  paths[k] +
  '"/></svg>';
document.querySelectorAll('[data-icon]').forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
const modes = {
  move: ['이동', '지도를 끌어 이동하고, 이름이나 메모를 끌어 배치하세요.'],
  pin: ['지점', '지도를 눌러 새 지점을 표시하세요.'],
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
  const [library, bases] = await Promise.all([
    json('presets.json').then((presets) =>
      loadSheetLibrary(SHEET_CONFIG, presets, SheetData.sheetRecords, storage),
    ),
    json('bases.json'),
  ]);
  const { places, themes, eras } = library;
  const byId = new Map(places.map((p) => [p.id, p]));
  const example = themes.find((t) => t.source === '시트 주제' && t.name === '한국전쟁') ?? themes[0];
  const source = $('source-sheet');
  const sheetUrl = new URL(SHEET_CONFIG.url);
  sheetUrl.hash = 'gid=' + SHEET_CONFIG.spaceSheetId;
  source.href = sheetUrl;
  source.textContent =
    library.source === 'live'
      ? '구글 시트 · 지명 ' + places.length + '곳 ↗'
      : library.source === 'cached'
        ? '시트 연결 실패 · 저장된 지명 ' + places.length + '곳 ↗'
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
  let doc = read(draftKey, null);
  if (valid(doc)) refreshDrawing(doc, byId);
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
  let tab = themes.length ? 'themes' : 'places',
    mode = 'move',
    activeRoute = null,
    routeStart = null,
    era = '',
    query = '';
  const past = [],
    future = [];
  function message(s) {
    $('hint').textContent = s;
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
  $('era').value = era;
  $('base').innerHTML = Object.entries(bases)
    .map(([key, b]) => '<option value="' + key + '">' + b.name + '</option>')
    .join('');
  const svg = $('map');
  svg.innerHTML = definitions(bases) + '<g id="scene"></g>';
  const scene = $('scene');
  // Share the two coastline paths across all theme previews.
  const mini = document.createElementNS(svg.namespaceURI, 'svg');
  mini.setAttribute('aria-hidden', 'true');
  mini.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  mini.innerHTML =
    '<defs>' +
    ['east', 'world', 'globe']
      .map((key) => '<path id="mini-' + key + '" d="' + bases[key].land + '"/>')
      .join('') +
    '</defs>';
  document.body.append(mini);
  function thumb(theme) {
    const locations = theme.places.map((n) => byId.get(n));
    const [west, east, south, north] = bases.east.bbox;
    const key = locations.every((p) => p.lon >= west && p.lon <= east && p.lat >= south && p.lat <= north)
      ? 'east'
      : locations.every(
            (p) =>
              p.lon >= bases.world.bbox[0] &&
              p.lon <= bases.world.bbox[1] &&
              p.lat >= bases.world.bbox[2] &&
              p.lat <= bases.world.bbox[3],
          )
        ? 'world'
        : 'globe';
    const b = bases[key];
    const coords = locations.map((p) => {
      const v = { lon: b.bbox[0], lat: b.bbox[3], span: ((b.bbox[1] - b.bbox[0]) * W) / b.w };
      const [x, y] = xy(v, p.lon, p.lat);
      return [x - W / 2, y - H / 2];
    });
    const xs = coords.map((p) => p[0]),
      ys = coords.map((p) => p[1]),
      span =
        Math.max(46, Math.max(...xs) - Math.min(...xs), 1.2 * (Math.max(...ys) - Math.min(...ys))) * 1.65;
    const x = (Math.max(...xs) + Math.min(...xs) - span) / 2,
      y = (Math.max(...ys) + Math.min(...ys) - span * 0.84) / 2;
    return (
      '<svg class="thumb" aria-hidden="true" viewBox="' +
      [x, y, span, span * 0.84].join(' ') +
      '"><use href="#mini-' +
      key +
      '" fill="#e9e8cd" stroke="#879c87" stroke-width="' +
      span / 140 +
      '"/>' +
      coords
        .map(([a, b]) => '<circle cx="' + a + '" cy="' + b + '" r="' + span / 29 + '" fill="#a65037"/>')
        .join('') +
      '</svg>'
    );
  }
  const thumbs = themes.map(thumb);
  function row(key, name, sub, lead, selected, action) {
    return (
      '<button class="row ' +
      (selected ? 'on' : '') +
      '" data-row="' +
      esc(key) +
      '" aria-label="' +
      esc(name + ' ' + action) +
      '">' +
      lead +
      '<span class="labels"><strong>' +
      esc(name) +
      '</strong>' +
      (sub ? '<small>' + esc(sub) + '</small>' : '') +
      '</span><span aria-hidden="true" class="indicator">' +
      (action === '삭제' ? '×' : selected ? '✓' : '+') +
      '</span></button>'
    );
  }
  function list() {
    const selected = new Set(
      places.filter((p) => doc.points.some((mark) => samePlace(mark, p))).map((p) => p.id),
    );
    document
      .querySelectorAll('[data-tab]')
      .forEach((b) => b.setAttribute('aria-pressed', String(tab === b.dataset.tab)));
    document.querySelector('.filters').hidden = tab === 'mine' || !!query;
    const html = [];
    if (tab === 'themes' || (query && tab !== 'mine'))
      themes.forEach((t, i) => {
        if (query ? !t.name.includes(query) : era && t.era !== era) return;
        const all = t.places.every((n) => selected.has(n));
        html.push(
          row(
            't' + i,
            t.name,
            (t.era ? t.era + ' · ' : '') + t.source + ' · ' + t.places.length + '곳',
            thumbs[i],
            all,
            all ? '표시한 곳 보기' : '지도에 추가',
          ),
        );
      });
    if (tab === 'places' || (query && tab !== 'mine'))
      places.forEach((p, i) => {
        if (
          query
            ? ![p.name, p.keywords].some((s) => s.includes(query))
            : era && p.eras.length && !p.eras.includes(era)
        )
          return;
        html.push(
          row(
            'p' + i,
            p.name,
            p.kind,
            icon('pin'),
            selected.has(p.id),
            mode === 'route' ? '경로에 추가' : selected.has(p.id) ? '위치 보기' : '지도에 추가',
          ),
        );
      });
    if (tab === 'mine') {
      for (const [prefix, items, label] of [
        ['m', doc.points, '지점'],
        ['n', doc.notes, '메모'],
        ['r', doc.routes, '경로'],
      ]) {
        items.forEach((p, i) => {
          const name = prefix === 'r' ? '경로 ' + (i + 1) : p.name;
          if (!query || name.includes(query))
            html.push(
              row(
                prefix + i,
                name,
                prefix === 'r' ? p.length + '곳' : label,
                icon({ m: 'pin', n: 'note', r: 'route' }[prefix]),
                false,
                '삭제',
              ),
            );
        });
      }
    }
    $('results').innerHTML =
      html.join('') ||
      '<p class="empty">' +
        (query
          ? '검색 결과가 없습니다.'
          : tab === 'mine'
            ? '지도에 지점이나 경로를 추가하세요.'
            : '이 시대에 등록된 자료가 없습니다.') +
        '</p>';
  }
  function paint() {
    scene.innerHTML = draw(doc, bases, Math.max(1, Math.min(2.2, W / (svg.clientWidth || W))));
    if (mode === 'route' && routeStart) {
      const [x, y] = xy(doc.view, ...routeStart);
      scene.insertAdjacentHTML(
        'beforeend',
        '<circle cx="' + x + '" cy="' + y + '" r="6" fill="#bc553e" stroke="white" stroke-width="2"/>',
      );
    }
    svg.setAttribute('aria-label', doc.title + ' 지도');
    $('reset').textContent = Math.round((100 * presets[doc.view.base][2]) / doc.view.span) + '%';
  }
  function render() {
    paint();
    list();
    $('map-name').textContent = doc.title;
    $('base').value = doc.view.base;
    svg.dataset.tool = mode;
    document
      .querySelectorAll('[data-mode]')
      .forEach((b) => b.setAttribute('aria-pressed', String(mode === b.dataset.mode)));
    $('finish').hidden = mode !== 'route' || activeRoute === null;
    $('undo').disabled = !past.length;
    $('redo').disabled = !future.length;
    $('counts').textContent =
      '지점 ' + doc.points.length + ' · 경로 ' + doc.routes.length + ' · 메모 ' + doc.notes.length;
    message(modes[mode][1]);
  }
  function switchTab(key) {
    tab = key;
    query = '';
    $('search').value = '';
    list();
    $('results').scrollTop = 0;
  }
  function fit(points) {
    if (!points.length) return;
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
    const probe = { lon, lat, span: 1 };
    const span = Math.max(
      points.length === 1 ? doc.view.span : 5,
      ...points.map((p) => {
        const [x, y] = xy(probe, p.lon, p.lat);
        return Math.max(Math.abs(x - W / 2) / (W / 2 - 70), Math.abs(y - H / 2) / (H / 2 - 85));
      }),
    );
    const base = points.some(
      (p) =>
        p.lon < bases.world.bbox[0] ||
        p.lon > bases.world.bbox[1] ||
        p.lat < bases.world.bbox[2] ||
        p.lat > bases.world.bbox[3],
    )
      ? 'globe'
      : span > 55
        ? 'world'
        : span > 22
          ? 'east'
          : lon > 122 && lon < 133 && lat > 31 && lat < 44
            ? 'korea'
            : 'east';
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
  $('results').onclick = (e) => {
    const key = e.target.closest('[data-row]')?.dataset.row;
    if (!key) return;
    const i = Number(key.slice(1));
    if (key[0] === 't') {
      const t = themes[i],
        missing = t.places.filter((n) => !doc.points.some((mark) => samePlace(mark, byId.get(n))));
      if (!missing.length) {
        switchTab('mine');
        return;
      }
      change(() => {
        if (!doc.points.length && doc.title === '제목 없는 지도') doc.title = t.name;
        doc.points.push(...missing.map((n) => sheetPoint(byId.get(n))));
        fit(t.places.map((n) => byId.get(n)));
      });
      message(t.name + ' 지점 ' + missing.length + '곳을 추가했습니다.');
    } else if (key[0] === 'p') {
      const p = places[i];
      if (mode === 'route') {
        routeTo(p.lon, p.lat);
        return;
      }
      change(() => {
        if (!doc.points.some((mark) => samePlace(mark, p))) doc.points.push(sheetPoint(p));
        fit([p]);
      });
    } else {
      change(() => {
        doc[{ m: 'points', n: 'notes', r: 'routes' }[key[0]]].splice(i, 1);
        activeRoute = null;
        routeStart = null;
      });
    }
  };
  $('tabs').onclick = (e) => {
    const b = e.target.closest('[data-tab]');
    if (b) switchTab(b.dataset.tab);
  };
  $('search').oninput = (e) => {
    query = e.target.value.trim();
    list();
    $('results').scrollTop = 0;
  };
  $('era').onchange = (e) => {
    era = e.target.value;
    list();
    $('results').scrollTop = 0;
  };
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
  $('reset').onclick = () => change(() => (doc.view = camera(doc.view.base)));
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
      switchTab('themes');
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
          change(() => (doc = refreshDrawing(structuredClone(maps[Number(b.dataset.open)]), byId)));
        }),
    );
  };
  let drag = null;
  function locationOf(e) {
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
    return [pt.x, pt.y];
  }
  function shift(view, dx, dy) {
    const [lon, lat] = ll(view, W / 2 - dx, H / 2 - dy);
    return { ...view, lon: Math.max(-180, Math.min(180, lon)), lat: Math.min(78, Math.max(-70, lat)) };
  }
  svg.onpointerdown = (e) => {
    if (e.button !== 0 || drag) return;
    const [x, y] = locationOf(e);
    if (x < 0 || x > W || y < 0 || y > H) return;
    const label = e.target.closest('[data-point],[data-note]');
    const kind = label?.hasAttribute('data-point') ? 'points' : 'notes';
    const item =
      mode === 'move' && label ? doc[kind][Number(label.dataset.point ?? label.dataset.note)] : null;
    drag = {
      x,
      y,
      kind,
      item,
      index: item ? doc[kind].indexOf(item) : -1,
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
        paint();
        const items = doc[d.kind];
        const index = d.index;
        if (index >= 0)
          ask(d.kind === 'notes' ? '메모 수정' : '지점 이름 수정', items[index].name, '적용', (name) =>
            change(() => (items[index].name = name)),
          );
      } else {
        doc.view = d.view;
        paint();
      }
      return;
    }
    if (Math.hypot(x - d.x, y - d.y) > 8) return;
    const [lon, lat] = ll(doc.view, x, y);
    if (mode === 'route') {
      routeTo(lon, lat);
      return;
    }
    const isNote = mode === 'note';
    ask(isNote ? '메모 추가' : '지점 추가', '', '추가', (name) =>
      change(() => doc[isNote ? 'notes' : 'points'].push({ name, lon, lat })),
    );
  };
  svg.onkeydown = (e) => {
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
      else
        ask(mode === 'note' ? '중심에 메모 추가' : '중심에 지점 추가', '', '추가', (name) =>
          change(() => doc[mode === 'note' ? 'notes' : 'points'].push({ lon, lat, name })),
        );
    }
  };
  document.addEventListener('keydown', (e) => {
    if (dialog.open || e.target.matches('input,select,textarea') || !(e.ctrlKey || e.metaKey)) return;
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
    copy.innerHTML = definitions(bases) + draw(doc, bases);
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
  $('hint').textContent = '지도 자료를 불러오지 못했습니다. 페이지를 새로 고쳐 주세요.';
});
