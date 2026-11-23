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
const palette = {
  sea: '#173e52',
  land: '#aabfc0',
  korea: '#d8e2d4',
  shore: '#547984',
  river: '#72a1a6',
  pin: '#153d51',
  active: '#aa4926',
  cream: '#fbfaf1',
};
const svg = $('atlas'),
  W = 900;
const text = (x, y, content, attrs = '') =>
  '<text x="' + x + '" y="' + y + '" ' + attrs + '>' + esc(content) + '</text>';
const elPath = (d, attrs) => (d ? '<path d="' + d + '" ' + attrs + '/>' : '');
const fixed = (n) => Number(n).toFixed(1);
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
    H = 610,
    dialogMode = 'places',
    drag = null;
  const rect = (x, y, w, h, attrs) =>
    '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" ' + attrs + '/>';
  const color = palette;
  const defs = Object.entries(bases)
    .map(
      ([k, b]) =>
        '<svg id="geo-' +
        k +
        '" width="' +
        b.w +
        '" height="' +
        b.h +
        '" overflow="hidden">' +
        rect(0, 0, b.w, b.h, 'fill="' + color.sea + '"') +
        elPath(
          b.coast,
          'fill="none" stroke="#426678" stroke-width="2" opacity=".55" vector-effect="non-scaling-stroke"',
        ) +
        elPath(b.land, 'fill="' + color.land + '"') +
        elPath(b.krLand, 'fill="' + color.korea + '"') +
        elPath(
          b.coast,
          'fill="none" stroke="' + color.shore + '" stroke-width=".7" vector-effect="non-scaling-stroke"',
        ) +
        (b.rivers || [])
          .map((r) =>
            elPath(
              r.d,
              'fill="none" stroke="' +
                color.river +
                '" stroke-width=".85" vector-effect="non-scaling-stroke"',
            ),
          )
          .join('') +
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
    H = (W * svg.clientHeight) / (svg.clientWidth || W);
    if (!marks.length) {
      camera = { lon: 127.5, lat: 37.55, span: 15 };
      initialSpan = 15;
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
    // The Korean War map also needs coastline around the connected places.
    if (themeTitle === '한국전쟁' && east - west < 7 && north - south < 10) {
      camera.lon = 127.5;
      camera.lat = 37.8;
      camera.span = Math.max(camera.span, Math.min(17, (10.4 * W) / H));
    }
    initialSpan = camera.span;
  }
  function remember() {
    history.push(structuredClone({ marks, selected, themeTitle, camera, initialSpan }));
    if (history.length > 30) history.shift();
    $('undo').disabled = false;
  }
  $('undo').onclick = () => {
    if (!history.length) return;
    ({ marks, selected, themeTitle, camera, initialSpan } = history.pop());
    mode = 'select';
    $('undo').disabled = !history.length;
    render();
  };
  function placeMarks(mobile) {
    const used = [],
      size = mobile ? 30 : 15;
    return [...marks.filter((p) => p.id !== selected), ...marks.filter((p) => p.id === selected)]
      .map((p) => {
        const [x, y] = project(p.lon, p.lat);
        if (x < 10 || x > W - 10 || y < 10 || y > H - 10) return '';
        const active = p.id === selected,
          radius = mobile ? 8 : 5.4;
        const width = Array.from(p.name).length * size + (active ? 22 : 4);
        const choices = [
          [1, 0],
          [-1, 0],
          [1, -1],
          [-1, 1],
          [1, 1],
          [-1, -1],
          [1, -2],
          [-1, 2],
        ];
        let pos;
        for (const [sign, step] of choices) {
          const bx = sign === 1 ? x + 12 : x - 12 - width,
            by = y + step * (size + 6) - size * 0.78;
          const box = { x: bx, y: by, w: width, h: size + 6 };
          if (!pos) pos = box;
          if (
            bx > 16 &&
            bx + width < W - 16 &&
            by > 18 &&
            by + size < H - 20 &&
            !used.some(
              (b) => bx < b.x + b.w + 4 && bx + width > b.x - 4 && by < b.y + b.h && by + size + 6 > b.y,
            )
          ) {
            pos = box;
            break;
          }
        }
        used.push(pos);
        const pin = active ? color.active : color.pin;
        const leader =
          labels && Math.abs(pos.y + size * 0.78 - y) > 8
            ? elPath(
                'M' +
                  x +
                  ' ' +
                  y +
                  'L' +
                  Math.max(pos.x, Math.min(x, pos.x + pos.w)) +
                  ' ' +
                  (pos.y + size * 0.6),
                'stroke="' + color.shore + '" stroke-width="1.1" fill="none"',
              )
            : '';
        const label = labels
          ? (active
              ? rect(pos.x - 2, pos.y - 2, pos.w, pos.h + 2, 'fill="' + color.active + '" rx="3"')
              : '') +
            text(
              pos.x + (active ? 8 : 0),
              pos.y + size,
              p.name,
              'font-size="' +
                size +
                '" font-weight="650" fill="' +
                (active ? 'white' : color.pin) +
                '" ' +
                (active
                  ? ''
                  : 'stroke="' +
                    color.cream +
                    '" stroke-width="3.2" paint-order="stroke" stroke-linejoin="round"'),
            )
          : '';
        return (
          '<g data-id="' +
          esc(p.id) +
          '" role="button" aria-label="' +
          esc(p.name) +
          ' 선택" tabindex="0">' +
          leader +
          (active
            ? '<circle cx="' +
              x +
              '" cy="' +
              y +
              '" r="' +
              (radius + 6) +
              '" fill="#ffad70" fill-opacity=".55" stroke="#b15937" stroke-width="1"/>'
            : '') +
          '<circle cx="' +
          x +
          '" cy="' +
          y +
          '" r="' +
          radius +
          '" fill="' +
          pin +
          '" stroke="' +
          color.cream +
          '" stroke-width="1.8"/>' +
          label +
          '</g>'
        );
      })
      .join('');
  }
  function draw() {
    H = (W * svg.clientHeight) / (svg.clientWidth || W);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    const mobile = svg.clientWidth < 550;
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
    const step = [0.25, 0.5, 1, 2, 5, 10, 20, 45, 90].find((n) => n >= camera.span / 7) || 90;
    let grid = '',
      ticks = '';
    const fs = mobile ? 17 : 10;
    for (let lon = Math.ceil(west / step) * step; lon < east; lon += step) {
      const [x] = project(lon, camera.lat);
      grid += 'M' + fixed(x) + ' 0V' + fixed(H);
      if (x > 40 && x < W - 40)
        ticks += text(x, H - 8, Math.abs(lon) + '°' + (lon >= 0 ? 'E' : 'W'), 'text-anchor="middle"');
    }
    for (let lat = Math.ceil(south / step) * step; lat < north; lat += step) {
      const [, y] = project(camera.lon, lat);
      grid += 'M0 ' + fixed(y) + 'H900';
      if (y > 30 && y < H - 35) ticks += text(8, y - 5, Math.abs(lat) + '°' + (lat >= 0 ? 'N' : 'S'));
    }
    const seas =
      camera.span < 34
        ? [
            ['황해', 124.0, 36.7],
            ['동해', 131.1, 38.35],
            ['남해', 128.5, 33.6],
          ]
            .map(([n, lon, lat]) => {
              const [x, y] = project(lon, lat);
              if (y < 30 || y > H - 25 || x < 45 || x > W - 45) return '';
              return text(
                x,
                y,
                n,
                'text-anchor="middle" font-family="AppleMyungjo,serif" font-size="' +
                  (mobile ? 27 : 21) +
                  '" letter-spacing="6" fill="#b5ced5"',
              );
            })
            .join('')
        : '';
    const compass =
      '<g transform="translate(846 56)" stroke="#f1f2d9"><circle r="18" fill="#16394e" stroke-width=".7"/><path d="M0 -24L5 4L0 0L-5 4Z" fill="#f2f1da"/><path d="M0 20L-3 0L0 3L3 0Z" fill="#2a5466"/><path d="M-12 0h24" stroke-width=".6"/></g>' +
      text(
        846,
        24,
        'N',
        'font-family="Georgia,serif" font-size="14" text-anchor="middle" fill="white" stroke="#203f50" stroke-width="2" paint-order="stroke"',
      );
    const kmPerUnit = (camera.span / W) * 111.32 * Math.cos((camera.lat * Math.PI) / 180);
    const km =
      [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000].filter((n) => n / kmPerUnit < 110).at(-1) || 1;
    const scale =
      '<g transform="translate(26 ' +
      (H - 39) +
      ')">' +
      rect(-6, -16, km / kmPerUnit + 15, 30, 'rx="2" fill="#183b50" fill-opacity=".85"') +
      text(0, -2, km + ' km', 'font-size="' + (mobile ? 17 : 11) + '" fill="white" font-family="monospace"') +
      '<path d="M0 3v5h' +
      km / kmPerUnit +
      'v-5" fill="none" stroke="#eef2dd" stroke-width="1.5"/></g>';
    scene.innerHTML =
      rect(0, 0, W, H, 'fill="' + color.sea + '"') +
      map +
      elPath(grid, 'fill="none" stroke="#72949a" stroke-width=".8" stroke-dasharray="2 5"') +
      '<g font-family="monospace" font-size="' +
      fs +
      '" fill="#d4e1db" stroke="#375567" stroke-width="2" paint-order="stroke">' +
      ticks +
      '</g>' +
      seas +
      placeMarks(mobile) +
      compass +
      scale;
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
