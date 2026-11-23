import { xy, ll, esc } from '../../assets/history-map/cartography.js';
import { loadSheetLibrary } from '../../assets/history-map/sheet-library.js';

const $ = (id) => document.getElementById(id);
const icons = {
  atlas: 'M2 6l6-3 8 3 6-3v15l-6 3-8-3-6 3z M8 3v15m8-12v15',
  sheet: 'M4 3h16v18H4z M4 9h16 M4 15h16 M10 9v12',
  external: 'M7 17 18 6 M8 6h10v10',
  download: 'M12 3v12m-5-5 5 5 5-5 M4 16v5h16v-5',
  undo: 'M8 4 3 9l5 5 M3 9h10a7 7 0 0 1 7 7v2',
  plus: 'M12 4v16M4 12h16',
  pin: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0z M14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
  layers: 'M2 9l10-6 10 6-10 6z M3 13l9 5 9-5 M3 17l9 5 9-5',
  stack: 'M4 4h16v15H4z M7 22h15V7',
  pointer: 'M5 3l14 10-7 1-3 7z',
  search: 'M16 16l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  trash: 'M3 7h18M9 7V4h6v3 M6 7l1 14h10l1-14 M10 10v8m4-8v8',
};
function icon(key) {
  return (
    '<svg class="ic" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="' +
    icons[key] +
    '"/></svg>'
  );
}
document.querySelectorAll('[data-icon]').forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
const svg = $('atlas'),
  W = 900;
const text = (x, y, content, attrs = '') =>
  '<text x="' + x + '" y="' + y + '" ' + attrs + '>' + esc(content) + '</text>';
const elPath = (d, attrs) => (d ? '<path d="' + d + '" ' + attrs + '/>' : '');
const formatCoord = (p) =>
  Math.abs(p.lat).toFixed(4) +
  '° ' +
  (p.lat < 0 ? 'S' : 'N') +
  '  ' +
  Math.abs(p.lon).toFixed(4) +
  '° ' +
  (p.lon < 0 ? 'W' : 'E');
async function asset(n) {
  const r = await fetch('../../assets/history-map/' + n + '.json');
  if (!r.ok) throw Error(n);
  return r.json();
}
async function start() {
  let storage;
  try {
    storage = localStorage;
  } catch {}
  const periods = new Map();
  const read = async (...args) => {
    const rows = await SheetData.sheetRecords(...args);
    if (args[1] === '카테고리')
      for (const r of rows) {
        if (r.시작일 || r.종료일) periods.set(r.카테고리명, [r.시작일, r.종료일].filter(Boolean).join(' — '));
      }
    return rows;
  };
  const [bases, library] = await Promise.all([
    asset('bases'),
    asset('presets').then((p) => loadSheetLibrary(SHEET_CONFIG, p, read, storage)),
  ]);
  const lookup = new Map(library.places.map((p) => [p.id, p]));
  const source = $('source');
  source.href = SHEET_CONFIG.url.split('#')[0] + '#gid=' + SHEET_CONFIG.spaceSheetId;
  source.querySelector('span').textContent =
    library.source === 'unavailable'
      ? '시트 연결을 확인하세요'
      : (library.source === 'cached' ? '저장된 시트' : '연결된 시트') + ' · 지명 ' + lookup.size + '곳';
  const history = [];
  let marks = [],
    selected = null,
    themeTitle = '',
    mode = 'select',
    labels = true,
    camera = { lon: 127.5, lat: 37.55, span: 15 },
    initialSpan = 15,
    portrait = true,
    H = 610,
    dialogMode = 'places',
    drag = null;
  const rect = (x, y, w, h, attrs) =>
    '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" ' + attrs + '/>';
  // Match the reference's default Korean base: white land, gray water and dashed borders.
  const defs = Object.entries(bases)
    .map(
      ([key, b]) =>
        '<svg id="geo-' +
        key +
        '" width="' +
        b.w +
        '" height="' +
        b.h +
        '" overflow="hidden">' +
        rect(0, 0, b.w, b.h, 'fill="#d9d9d9"') +
        elPath(b.land, 'fill="#fff" fill-rule="evenodd"') +
        (key === 'korea' || key === 'north'
          ? elPath(
              b.border,
              'fill="none" stroke="#444" stroke-width=".8" stroke-dasharray="3 2" vector-effect="non-scaling-stroke"',
            )
          : '') +
        elPath(
          b.coast,
          'fill="none" stroke="#111" stroke-width=".8" stroke-linejoin="round" vector-effect="non-scaling-stroke"',
        ) +
        '</svg>',
    )
    .join('');
  svg.innerHTML = '<defs>' + defs + '</defs><g id="scene"></g>';
  const scene = $('scene');
  function project(lon, lat) {
    const [x, y] = xy(camera, lon, lat);
    return [x, y + (H - 610) / 2];
  }
  function invert(x, y) {
    return ll(camera, x, y - (H - 610) / 2);
  }
  function fit() {
    const [lo, hi, bottom, top] = bases.korea.bbox;
    portrait = marks.every((p) => p.lon >= lo && p.lon <= hi && p.lat >= bottom && p.lat <= top);
    svg.dataset.layout = portrait ? 'portrait' : 'wide';
    H = (W * svg.clientHeight) / (svg.clientWidth || W);
    if (portrait) {
      camera = { lon: (lo + hi) / 2, lat: top, span: hi - lo };
      camera.lat = ll(camera, W / 2, 305 + ((bases.korea.h / bases.korea.w) * W) / 2)[1];
      initialSpan = camera.span;
      return;
    }
    const lons = marks.map((p) => p.lon),
      lats = marks.map((p) => p.lat);
    const west = Math.min(...lons),
      east = Math.max(...lons),
      south = Math.min(...lats),
      north = Math.max(...lats);
    camera = { lon: (west + east) / 2, lat: (north + south) / 2, span: 1 };
    const dy = Math.max(...marks.map((p) => Math.abs(project(p.lon, p.lat)[1] - H / 2)));
    camera.span = Math.max(4, (east - west) * 1.65, (dy * 2) / Math.max(100, H * 0.7));
    initialSpan = camera.span;
  }
  function remember() {
    history.push(structuredClone({ marks, selected, themeTitle, camera, initialSpan, portrait }));
    if (history.length > 30) history.shift();
    $('undo').disabled = false;
  }
  $('undo').onclick = () => {
    if (!history.length) return;
    ({ marks, selected, themeTitle, camera, initialSpan, portrait } = history.pop());
    mode = 'select';
    $('undo').disabled = !history.length;
    render();
  };
  function placeMarks(unit) {
    const size = 13 * unit,
      gap = 7 * unit;
    const pins = marks.map((p) => ({ p, at: project(p.lon, p.lat) }));
    const used = pins.map(({ at: [x, y] }) => ({
      x: x - 4 * unit,
      y: y - 4 * unit,
      w: 8 * unit,
      h: 8 * unit,
    }));
    return pins
      .map(({ p, at: [x, y] }) => {
        if (x < 0 || x > W || y < 0 || y > H) return '';
        const width = Array.from(p.name).length * size;
        let chosen;
        positions: for (const row of [0, -1, 1, -2, 2, -3, 3]) {
          for (const right of [true, false]) {
            const bx = right ? x + gap : x - gap - width,
              by = y + row * (size + 4 * unit) - size * 0.55;
            const box = { x: bx, y: by, w: width, h: size + 2 * unit };
            if (!chosen) chosen = box;
            if (bx < 2 || bx + width > W - 2 || by < 2 || by + size > H - 2) continue;
            if (
              used.some(
                (b) => bx < b.x + b.w + unit && bx + width > b.x - unit && by < b.y + b.h && by + box.h > b.y,
              )
            )
              continue;
            chosen = box;
            break positions;
          }
        }
        used.push(chosen);
        const cy = chosen.y + size * 0.55;
        const leader =
          labels && Math.abs(cy - y) > unit
            ? elPath(
                'M' + x + ' ' + y + 'L' + Math.max(chosen.x, Math.min(x, chosen.x + width)) + ' ' + cy,
                'stroke="#444" stroke-width="' + 0.65 * unit + '" fill="none"',
              )
            : '';
        const dot = (r, attrs) =>
          '<circle cx="' + x + '" cy="' + y + '" r="' + r * unit + '" ' + attrs + '/>';
        return (
          '<g data-id="' +
          esc(p.id) +
          '" role="button" aria-label="' +
          esc(p.name) +
          ' 선택" tabindex="0">' +
          dot(9, 'fill="transparent"') +
          leader +
          dot(3.1, 'fill="#111"') +
          (p.id === selected
            ? dot(
                6.3,
                'data-selection="" fill="none" stroke="#555" stroke-dasharray="' +
                  2 * unit +
                  ' ' +
                  2 * unit +
                  '" stroke-width="' +
                  unit +
                  '"',
              )
            : '') +
          (labels
            ? text(
                chosen.x,
                chosen.y + size * 0.93,
                p.name,
                'font-size="' +
                  size +
                  '" fill="#111" stroke="#fff" stroke-width="' +
                  1.6 * unit +
                  '" paint-order="stroke" stroke-linejoin="round"',
              )
            : '') +
          '</g>'
        );
      })
      .join('');
  }
  function draw() {
    svg.dataset.layout = portrait ? 'portrait' : 'wide';
    H = (W * svg.clientHeight) / (svg.clientWidth || W);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    const unit = W / (svg.clientWidth || W);
    const [west, north] = invert(0, 0),
      [east, south] = invert(W, H);
    const isKorea = camera.span < 35 && east > 123 && west < 133 && south < 44 && north > 32;
    let map = '';
    for (const key of ['globe', 'world', 'east', ...(isKorea ? ['korea'] : [])]) {
      const b = bases[key],
        [lo, hi, , top] = b.bbox,
        [x, y] = project(lo, top);
      map +=
        '<use href="#geo-' +
        key +
        '" transform="translate(' +
        x +
        ' ' +
        y +
        ') scale(' +
        ((hi - lo) * W) / camera.span / b.w +
        ')"/>';
    }
    const seaNames = isKorea
      ? [
          ['동해', 130.4, 38.7],
          ['황해', 124.9, 36.9],
        ]
      : [
          ['동해', 134.5, 40],
          ['황해', 123.6, 35.6],
        ];
    const seas =
      camera.span <= 55
        ? seaNames
            .map(([name, lon, lat]) => {
              const [x, y] = project(lon, lat);
              return x > 26 * unit && x < W - 26 * unit && y > 16 * unit && y < H - 8 * unit
                ? text(
                    x,
                    y,
                    name,
                    'text-anchor="middle" font-size="' +
                      13 * unit +
                      '" font-style="italic" font-family="Batang,AppleMyungjo,serif" fill="#444"',
                  )
                : '';
            })
            .join('')
        : '';
    const [isletX, isletY] = project(131.87, 37.24);
    const dokdo = isKorea
      ? '<ellipse cx="' +
        isletX +
        '" cy="' +
        isletY +
        '" rx="' +
        1.3 * unit +
        '" ry="' +
        1.3 * unit +
        '" fill="white" stroke="#111" stroke-width="' +
        0.8 * unit +
        '"/>'
      : '';
    scene.innerHTML =
      rect(0, 0, W, H, 'fill="#d9d9d9"') +
      map +
      dokdo +
      seas +
      placeMarks(unit) +
      rect(
        unit / 2,
        unit / 2,
        W - unit,
        H - unit,
        'fill="none" stroke="#222" stroke-width="' + unit + '" pointer-events="none"',
      );
    $('reset').textContent = Math.round((100 * initialSpan) / camera.span) + '%';
    svg.dataset.mode = mode;
  }
  function inspector() {
    const p = marks.find((m) => m.id === selected);
    if (!p) {
      $('inspect').innerHTML = '<h3>지점 편집</h3><p class="empty">지도나 목록에서 지점을 선택하세요.</p>';
      return;
    }
    $('inspect').innerHTML =
      '<h3>선택한 지점</h3><div class="edit-head"><i>' +
      icon('pin') +
      '</i><strong>' +
      esc(p.sourceName) +
      '</strong><button id="remove" title="지도에서 빼기" aria-label="지도에서 빼기">' +
      icon('trash') +
      '</button></div><p class="coord">' +
      formatCoord(p) +
      '</p><label>지도에 표시할 이름<input class="name-input" id="label" maxlength="48"></label>';
    const input = $('label');
    input.value = p.name;
    let original = true;
    input.onfocus = () => {
      original = true;
    };
    input.oninput = () => {
      if (original) {
        remember();
        original = false;
      }
      p.name = input.value.trim() || p.sourceName;
      list();
      draw();
    };
    input.onchange = () => {
      input.value = p.name;
    };
    input.onkeydown = (e) => {
      if (e.key === 'Enter') input.blur();
    };
    $('remove').onclick = () => {
      remember();
      marks = marks.filter((m) => m.id !== p.id);
      selected = marks[0]?.id;
      render();
    };
  }
  function list() {
    $('count').textContent = marks.length;
    $('pins').innerHTML =
      marks
        .map(
          (p) =>
            '<button class="place" data-row="' +
            esc(p.id) +
            '" aria-pressed="' +
            (p.id === selected) +
            '"><i>' +
            icon('pin') +
            '</i>' +
            esc(p.name) +
            (p.id === selected ? '<span class="current">선택됨</span>' : '') +
            '</button>',
        )
        .join('') || '<p class="empty">지명을 추가하세요.</p>';
  }
  function render() {
    $('title').textContent = themeTitle || '새 지도';
    document.querySelector('.category').textContent =
      periods.get(themeTitle) || library.themes.find((t) => t.name === themeTitle)?.era || '';
    list();
    inspector();
    draw();
    $('status').textContent =
      mode === 'pin'
        ? '추가할 위치를 지도에서 클릭하세요.'
        : '지점을 선택하면 이름과 좌표를 확인할 수 있습니다.';
    $('select').setAttribute('aria-pressed', String(mode === 'select'));
    $('manual').setAttribute('aria-pressed', String(mode === 'pin'));
  }
  function mark(p) {
    return { ...p, sourceName: p.name };
  }
  function applyTheme(t) {
    themeTitle = t?.name || '새 지도';
    marks = (t?.places || [])
      .map((id) => lookup.get(id))
      .filter(Boolean)
      .map(mark);
    selected = marks.find((p) => p.name === '인천')?.id || marks[0]?.id;
    mode = 'select';
    fit();
    render();
  }
  function choose(id) {
    selected = id;
    const p = marks.find((m) => m.id === id);
    if (p) {
      const [x, y] = project(p.lon, p.lat);
      if (x < 10 || x > W - 10 || y < 10 || y > H - 10) {
        camera.lon = p.lon;
        camera.lat = p.lat;
      }
    }
    render();
  }
  $('pins').onclick = (e) => {
    const b = e.target.closest('[data-row]');
    if (b) choose(b.dataset.row);
  };
  const picker = $('picker'),
    query = $('query');
  function choices() {
    const themes = dialogMode === 'themes',
      rows = themes ? library.themes : library.places;
    const match = rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => [r.name, r.keywords || ''].some((s) => s.includes(query.value.trim())));
    $('choices').innerHTML =
      match
        .map(
          ({ r, i }) =>
            '<button class="choice" data-index="' +
            i +
            '"><span>' +
            esc(r.name) +
            '</span><small>' +
            (themes
              ? esc(r.source) + ' · ' + r.places.length + '곳'
              : marks.some((p) => p.id === r.id)
                ? '지도에서 선택'
                : '추가 ＋') +
            '</small></button>',
        )
        .join('') || '<p class="empty">검색 결과가 없습니다.</p>';
  }
  function openPicker(which) {
    dialogMode = which;
    $('picker-title').textContent = which === 'themes' ? '지도 주제 변경' : '시트에서 지명 추가';
    query.placeholder = which === 'themes' ? '주제 검색' : '지명 또는 옛 이름 검색';
    query.value = '';
    choices();
    picker.showModal();
    query.focus();
  }
  $('browse').onclick = () => openPicker('places');
  $('themes').onclick = () => openPicker('themes');
  $('close').onclick = () => picker.close();
  query.oninput = choices;
  $('choices').onclick = (e) => {
    const b = e.target.closest('[data-index]');
    if (!b) return;
    const i = Number(b.dataset.index);
    picker.close();
    if (dialogMode === 'themes') {
      remember();
      applyTheme(library.themes[i]);
      return;
    }
    const p = library.places[i];
    if (!marks.some((m) => m.id === p.id)) {
      remember();
      marks.push(mark(p));
    }
    mode = 'select';
    choose(p.id);
  };
  $('manual').onclick = () => {
    mode = 'pin';
    render();
  };
  $('select').onclick = () => {
    mode = 'select';
    render();
  };
  function addPoint(x, y) {
    remember();
    const [lon, lat] = invert(x, y),
      p = { id: crypto.randomUUID(), name: '새 지점', lon, lat };
    marks.push(mark(p));
    selected = p.id;
    mode = 'select';
    render();
    $('label').focus();
    $('label').select();
  }
  function pointer(e) {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
    return [p.x, p.y];
  }
  svg.onpointerdown = (e) => {
    if (e.button !== 0 || drag) return;
    const [x, y] = pointer(e);
    drag = { x, y, id: e.pointerId, view: { ...camera }, target: e.target.closest('[data-id]')?.dataset.id };
    svg.setPointerCapture(e.pointerId);
  };
  svg.onpointermove = (e) => {
    if (drag?.id !== e.pointerId || mode !== 'select') return;
    const [x, y] = pointer(e);
    if (Math.hypot(x - drag.x, y - drag.y) < 4) return;
    const [lon, lat] = ll(drag.view, W / 2 + drag.x - x, 305 + drag.y - y);
    camera = { ...drag.view, lon: Math.max(-180, Math.min(180, lon)), lat: Math.max(-75, Math.min(75, lat)) };
    draw();
  };
  svg.onpointerup = (e) => {
    if (drag?.id !== e.pointerId) return;
    const d = drag;
    drag = null;
    const [x, y] = pointer(e);
    if (Math.hypot(x - d.x, y - d.y) > 6) return;
    if (mode === 'pin') addPoint(x, y);
    else if (d.target) choose(d.target);
  };
  svg.onpointercancel = () => {
    drag = null;
  };
  svg.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const target = e.target.closest('[data-id]');
      if (target) choose(target.dataset.id);
      else if (mode === 'pin') addPoint(W / 2, H / 2);
    } else if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      const d = { ArrowLeft: [-45, 0], ArrowRight: [45, 0], ArrowUp: [0, -45], ArrowDown: [0, 45] }[e.key];
      [camera.lon, camera.lat] = invert(W / 2 + d[0], H / 2 + d[1]);
      camera.lat = Math.max(-75, Math.min(75, camera.lat));
      draw();
    }
  };
  $('labels').onclick = () => {
    labels = !labels;
    $('labels').setAttribute('aria-pressed', String(labels));
    draw();
  };
  function zoom(f) {
    camera.span = Math.max(0.6, Math.min(360, camera.span * f));
    draw();
  }
  $('plus').onclick = () => zoom(0.78);
  $('minus').onclick = () => zoom(1 / 0.78);
  $('reset').onclick = () => {
    fit();
    draw();
  };
  $('export').onclick = () => {
    const copy = svg.cloneNode(true);
    copy.querySelector('[data-selection]')?.remove();
    copy.setAttribute('width', 1350);
    copy.setAttribute('height', String(H * 1.5));
    copy.setAttribute('font-family', 'Apple SD Gothic Neo,Malgun Gothic,sans-serif');
    const title = document.createElementNS(svg.namespaceURI, 'title');
    title.textContent = themeTitle;
    copy.prepend(title);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml' }),
    );
    a.download = themeTitle + '.svg';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 8000);
  };
  applyTheme(library.themes.find((t) => t.name === '한국전쟁') || library.themes[0]);
  new ResizeObserver(draw).observe(svg);
}
start().catch(() => {
  $('status').textContent = '지도 자료를 열 수 없습니다. 새로고침해 주세요.';
});
