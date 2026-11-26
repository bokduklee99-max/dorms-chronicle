import { studioCatalog } from '../../assets/studio-catalog.js';

const designs = [
  { id: 'desk', name: '편집 데스크', short: '네 시트 한눈에', tone: '#a35335', theme: 'Vintage Paper',
    summary: '패키지와 카테고리, 사건과 관계를 한 화면에서 훑고 바로 편집합니다.',
    refs: [['북마크 탭', 'https://21st.dev/@k3menn/components/tabs-like-bookmark'], ['shadcn Tabs', 'https://ui.shadcn.com/docs/components/tabs']] },
  { id: 'grid', name: '시트 작업대', short: '행 검색·편집', tone: '#3e62b3', theme: 'Clean Slate',
    summary: '행이 많은 초안에서 검색과 열 정렬을 쓰고, 옆에서 선택한 기록을 수정합니다.',
    refs: [['Origin UI 필터 테이블', 'https://21st.dev/@originui/components/table/data-table-with-filters-made-with-tan-stack-table'], ['shadcn Command', 'https://ui.shadcn.com/docs/components/command'], ['shadcn Sheet', 'https://ui.shadcn.com/docs/components/sheet']] },
  { id: 'guide', name: '수업 설계 순서', short: '처음부터 단계별로', tone: '#426748', theme: 'Sage Garden',
    summary: '수업 범위를 정한 뒤 카테고리, 사건, 관계를 한 단계씩 작성합니다.',
    refs: [['21st Stepper', 'https://21st.dev/@ebnsina/components/stepper/vertical'], ['shadcn Field', 'https://ui.shadcn.com/docs/components/field']] },
  { id: 'map', name: '관계 작업대', short: '방향·근거 확인', tone: '#247d83', theme: 'Ocean Breeze',
    summary: '하나의 사건에서 뻗는 관계와 방향을 보고, 선택한 연결의 근거를 옆에서 읽습니다.',
    refs: [['shadcn Sidebar · 21st', 'https://dev.21st.dev/@shadcn/components/sidebar'], ['shadcn Resizable', 'https://ui.shadcn.com/docs/components/resizable']] },
  { id: 'review', name: '검토 보드', short: '출처 누락 확인', tone: '#9c680c', theme: 'Amber Minimal',
    summary: '출처가 비어 있는 사건부터 확인하고, 수정한 뒤 검토 완료로 넘깁니다.',
    refs: [['Origin UI 필터 테이블', 'https://21st.dev/@originui/components/table/data-table-with-filters-made-with-tan-stack-table'], ['shadcn Sheet', 'https://ui.shadcn.com/docs/components/sheet']] },
];
const sections = [['package', '패키지'], ['categories', '카테고리'], ['events', '사건'], ['relations', '관계']];
const catKinds = { period: '시기', arc: '사건군', theme: '주제' };
const relationKinds = { cause: '원인·계기', shift: '전환·변화', action: '활동·실행', integration: '통합·편입', split: '분열·개편', background: '구조적 배경' };
const levels = { core: '핵심·전환점', major: '주요 사건', detail: '심화·보충' };
const demoIds = ['E206', 'E248', 'E306', 'E187', 'E278', 'E279'];
const photoId = 'E306';
const preview = document.querySelector('#preview');
const nav = document.querySelector('#variants');
const editor = document.querySelector('#editor');
const command = document.querySelector('#command');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

let draft, design = designs[0], sheet = 'events', step = 2, query = '', reverse = false;
let activeEdge = 'R001', activeReview = 'E306', reviewFilter = 'pending', atlasShare = 66;
const reviewed = new Set();

function button(label, data, cls = '', attrs = '') {
  return `<button type="button" class="${cls}" ${data} ${attrs}>${label}</button>`;
}
const title = (id) => draft.events.find(event => event.id === id)?.title || draft.categories.find(category => category.id === id)?.name || '연결 대상';
const editButton = (type, id = '', label = '편집', cls = 'quiet') => button(label, `data-edit="${type}" data-id="${esc(id)}"`, cls);
const sectionTitle = key => sections.find(([id]) => id === key)?.[1] || '';
const pill = label => `<span class="pill">${esc(label)}</span>`;

function table(labels, rows) {
  return `<div class="table-scroll" tabindex="0" role="region" aria-label="기록 표"><table>
    <thead><tr>${labels.map(label => `<th scope="col">${label}</th>`).join('')}</tr></thead>
    <tbody>${rows.length ? rows.map(cells => `<tr>${cells.map(cell => `<td>${cell || '—'}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${labels.length}">검색 결과가 없습니다.</td></tr>`}</tbody>
  </table></div>`;
}

function eventTable(events, compact = false) {
  const dates = compact && design.id === 'grid'
    ? button(`날짜 ${reverse ? '↓' : '↑'}`, 'data-sort', 'header-button', 'aria-label="날짜 정렬"')
    : '날짜';
  return table([dates, '사건명', '카테고리', compact ? '출처' : '중요도'], events.map(event => [
    `<time>${esc(event.date)}</time>`,
    editButton('events', event.id, esc(event.title), 'row-link'),
    esc(event.groups.map(title).join(' · ')),
    compact ? (event.source ? `<span class="reviewed-text">입력됨</span>` : '<span class="muted">미입력</span>') : pillarForEvent(event)
  ]));
}
const pillarForEvent = event => event.importance ? pill(levels[event.importance] || event.importance) : '';
function categoryList() {
  return `<div class="category-list">${draft.categories.map(category => `<div>
    <div><span class="item-kicker">${esc(catKinds[category.kind] || category.kind)}</span>
    ${editButton('categories', category.id, esc(category.name), 'row-link')}</div>
    <time>${esc([category.start, category.end].join(' – '))}</time></div>`).join('')}</div>`;
}
function relationList() {
  return `<div class="relation-list">${draft.relations.map(relation => `<div>
    ${editButton('relations', relation.id, esc(relation.label || '관계 편집'), 'row-link')}
    <small>${esc(title(relation.fromId))} → ${esc(title(relation.toId))}</small>
  </div>`).join('')}</div>`;
}
const packageFacts = () => `<dl class="package-facts"><div><dt>패키지명</dt><dd>${esc(draft.name)}</dd></div><div><dt>학교급</dt><dd>${esc(draft.school)}</dd></div><div><dt>과목</dt><dd>${esc(draft.subject)}</dd></div><div><dt>수업 범위</dt><dd>${esc(draft.description)}</dd></div></dl>`;

function deskView() {
  const photo = draft.events.find(event => event.id === photoId);
  return `<div class="desk">
    <header class="desk-mast"><span>편집 데스크</span><span>${esc(draft.school)} ${esc(draft.subject)}</span></header>
    <div class="desk-cover">
      <div class="desk-title"><span class="item-kicker">패키지</span><h2>${esc(draft.name)}</h2><p>${esc(draft.description)}</p>${editButton('package', '', '패키지 편집')}</div>
      <figure><img src="../../assets/timeline-images/E306-01.webp" alt="상하이 대한민국 임시정부 청사의 태극기"><figcaption><time>${esc(photo.date)}</time>${editButton('events', photo.id, esc(photo.title), 'row-link')}<a href="${esc(photo.media)}" target="_blank" rel="noreferrer" aria-label="사진 출처">↗</a></figcaption></figure>
    </div>
    <div class="desk-body">
      <aside class="desk-index"><div><h3>카테고리</h3>${categoryList()}</div><div><h3>관계</h3>${relationList()}</div></aside>
      <section class="desk-events"><div class="panel-head"><h3>사건 <small>${draft.events.length}건</small></h3>${editButton('events', '', '＋ 사건 추가')}</div>${eventTable(draft.events)}</section>
    </div>
  </div>`;
}

function gridTarget() {
  const search = query.trim().toLocaleLowerCase();
  if (sheet === 'events') {
    const events = draft.events.filter(event => [event.title, event.date, ...event.groups.map(title)].some(value => value.toLocaleLowerCase().includes(search)));
    events.sort((a, b) => reverse ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
    return eventTable(events, true);
  }
  if (sheet === 'categories') return table(['이름', '유형', '기간'], draft.categories.filter(c => c.name.includes(search)).map(c => [
    editButton('categories', c.id, esc(c.name), 'row-link'), esc(catKinds[c.kind]), esc([c.start, c.end].join(' – '))
  ]));
  if (sheet === 'relations') return table(['출발', '관계', '도착'], draft.relations.filter(r => [r.label, title(r.fromId), title(r.toId)].some(x => x.includes(search))).map(r => [
    esc(title(r.fromId)), editButton('relations', r.id, esc(r.label), 'row-link'), esc(title(r.toId))
  ]));
  return packageFacts();
}
function gridView() {
  return `<div class="grid-work">
    <aside class="grid-nav"><span class="item-kicker">패키지 제작실</span><strong>${esc(draft.name)}</strong>
      <nav aria-label="시트 선택">${sections.map(([id, label], i) => button(`<span aria-hidden="true">${['▤','▦','≡','↳'][i]}</span> ${label}`, `data-sheet="${id}"`, '', `aria-pressed="${sheet === id}"`)).join('')}</nav>
    </aside>
    <div class="grid-main"><div class="grid-path">핵심 시트 <span> / </span> ${sectionTitle(sheet)}</div>
      <header class="panel-head"><h2>${sectionTitle(sheet)}</h2>${sheet === 'events' ? editButton('events', '', '＋ 사건 추가', 'primary') : sheet === 'package' ? editButton('package') : ''}</header>
      <div class="tools">${sheet !== 'package' ? `<label class="search"><span aria-hidden="true">⌕</span><input type="search" data-query value="${esc(query)}" aria-label="현재 시트 검색" placeholder="현재 시트 검색"></label>` : ''}
      ${button('빠른 찾기 <kbd>⌘ / Ctrl K</kbd>', 'data-command', 'quiet')}</div>
      <div id="grid-target">${gridTarget()}</div>
    </div>
  </div>`;
}

function guideView() {
  const [key, label] = sections[step];
  const descriptions = ['수업 이름과 다룰 범위를 정합니다.', '시기, 사건군, 주제의 범위를 정합니다.', '수업에서 다룰 사건을 고르고 날짜와 출처를 확인합니다.', '어떤 사건이 무엇으로 이어지는지 근거와 함께 기록합니다.'];
  const ready = [draft.name && draft.description, draft.categories.length,
    draft.events.length && draft.events.every(event => event.date && event.source),
    draft.relations.length && draft.relations.every(relation => relation.body && relation.source)];
  const body = { package: () => packageFacts()+editButton('package'), categories: categoryList, events: () => eventTable(draft.events), relations: relationList }[key]();
  return `<div class="guide"><header class="guide-head"><span class="item-kicker">수업 설계 순서</span><h2>${esc(draft.name)}</h2></header>
    <div class="guide-body"><ol class="step-list">${sections.map(([, name], i) => `<li>${button(`<span>${i < step && ready[i] ? '✓' : i + 1}</span><b>${name}</b>`, `data-step="${i}"`, '', i === step ? 'aria-current="step"' : '')}</li>`).join('')}</ol>
      <section class="step-panel"><header class="panel-head"><div><span class="item-kicker">${step + 1} / ${sections.length} 단계</span><h3>${label}</h3><p>${descriptions[step]}</p></div>
      ${key === 'events' ? editButton('events', '', '＋ 사건 추가', 'quiet') : ''}</header>${body}
      <footer>${step ? button('← 이전', `data-step="${step-1}"`, 'quiet') : '<span></span>'}
      ${step < sections.length - 1 ? button(sections[step+1][1]+' 작성으로 →', `data-step="${step+1}"`, 'primary') : button('패키지로 돌아가기', 'data-step="0"', 'primary')}</footer></section>
    </div>
  </div>`;
}

function mapView() {
  const edge = draft.relations.find(relation => relation.id === activeEdge) || draft.relations[0];
  return `<div class="relation-work"><header class="relation-top"><div><span class="item-kicker">${esc(draft.name)}</span><h2>관계 작업대</h2></div></header>
    <div class="atlas-layout" style="--atlas-share:${atlasShare}%">
      <section class="atlas" aria-label="사건 관계도"><div class="atlas-bar"><span>출발 대상</span><span>도착 대상</span></div>
        <div class="route-root">${editButton('events', edge.fromId, esc(title(edge.fromId)), 'route-node')}</div>
        <div class="branches">${draft.relations.filter(r => r.fromId === edge.fromId).map(r => button(
          `<span class="branch-kind">${esc(relationKinds[r.kind] || r.kind)}</span><span class="connector" aria-hidden="true"></span><strong>${esc(title(r.toId))}</strong>`,
          `data-edge="${esc(r.id)}"`, 'branch', `aria-pressed="${edge.id === r.id}"`)).join('')}</div>
      </section>
      <div class="atlas-handle" role="separator" tabindex="0" aria-orientation="vertical" aria-label="관계도 너비" aria-valuemin="38" aria-valuemax="73" aria-valuenow="${atlasShare}"></div>
      <aside class="inspector"><span class="item-kicker">선택한 관계</span><h3>${esc(edge.label)}</h3>
       <ol class="endpoints"><li><small>출발</small><b>${esc(title(edge.fromId))}</b></li><li><small>도착</small><b>${esc(title(edge.toId))}</b></li></ol>
       ${pill(relationKinds[edge.kind] || edge.kind)}<h4>근거 설명</h4><p>${esc(edge.body || '근거 설명이 없습니다.')}</p>
       ${sourceLink(edge.source)}${editButton('relations', edge.id, '관계 편집', 'primary')}
      </aside>
    </div>
  </div>`;
}

function sourceLink(source) {
  if (!source) return '<span class="muted">출처 미입력</span>';
  try {
    const url = new URL(source);
    if (url.protocol === 'https:' || url.protocol === 'http:') return `<a class="record-source" href="${esc(url.href)}" target="_blank" rel="noreferrer">${esc(url.hostname)} ↗</a>`;
  } catch { /* A bibliography entry can be plain text. */ }
  return `<span class="record-source">${esc(source)}</span>`;
}

function reviewView() {
  const pending = draft.events.filter(e => !reviewed.has(e.id));
  const done = draft.events.filter(e => reviewed.has(e.id));
  const options = reviewFilter === 'pending' ? pending : done;
  const event = options.find(row => row.id === activeReview) || options[0];
  return `<div class="review-work"><header class="review-head"><div><span class="item-kicker">${esc(draft.name)}</span><h2>검토 보드</h2></div><div class="review-metric"><strong>${pending.filter(e => !e.source).length}</strong><span>출처 미입력</span></div></header>
    <div class="review-layout">
      <div class="review-list"><nav aria-label="검토 상태">${[['pending', '확인 필요', pending], ['done','검토 완료',done]].map(([id, text, rows]) =>
        button(`${text} <span>${rows.length}</span>`, `data-review-filter="${id}"`, '', `aria-pressed="${reviewFilter === id}"`)).join('')}</nav>
        ${options.length ? options.map(item => button(`<time>${esc(item.date)}</time><strong>${esc(item.title)}</strong><span>${reviewed.has(item.id) ? '완료' : item.source ? '확인 필요' : '출처 추가'}</span>`,
          `data-review-id="${esc(item.id)}"`, 'review-item', `aria-pressed="${event?.id === item.id}"`)).join('') : '<p class="message">표시할 사건이 없습니다.</p>'}
      </div>
      <section class="review-detail">${event ? `<time>${esc(event.date)}</time><h3>${esc(event.title)}</h3><p>${esc(event.body)}</p><div class="review-source"><span class="item-kicker">출처</span>${sourceLink(event.source)}</div>
        <div class="tools">${editButton('events', event.id, event.source ? '출처 수정' : '＋ 출처 추가', event.source ? 'quiet' : 'primary')}
        ${!reviewed.has(event.id) ? button('검토 완료', `data-reviewed="${esc(event.id)}"`, 'quiet', event.source ? '' : 'disabled title="출처를 먼저 입력하세요"') : ''}</div>` : '<p class="message">검토할 사건을 선택하세요.</p>'}</section>
    </div>
  </div>`;
}

const renderers = { desk: deskView, grid: gridView, guide: guideView, map: mapView, review: reviewView };
function render() {
  for (const link of nav.querySelectorAll('a')) {
    if (link.hash === '#'+design.id) link.setAttribute('aria-current','true');
    else link.removeAttribute('aria-current');
  }
  preview.dataset.design = editor.dataset.design = command.dataset.design = design.id;
  document.querySelector('#variant-info').innerHTML = `<p>${design.summary}</p><div class="reference-links">
    <a href="https://tweakcn.com/editor/theme" target="_blank" rel="noreferrer">${design.theme} · tweakcn ↗</a>
    ${design.refs.map(([label, url]) => `<a href="${url}" target="_blank" rel="noreferrer">${label} ↗</a>`).join('')}</div>`;
  if (draft) preview.innerHTML = renderers[design.id]();
}
function changeDesign() {
  design = designs.find(item => location.hash === '#'+item.id) || designs[0];
  render();
}

function field(name, label, value, options) {
  const control = options ? `<select name="${name}"><option value="">선택</option>${Object.entries(options).map(([key, text]) =>
    `<option value="${esc(key)}" ${key === value ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select>`
    : name === 'body' || name === 'description' ? `<textarea name="${name}" rows="3">${esc(value)}</textarea>`
      : `<input name="${name}" value="${esc(value)}" ${name === 'title' || name === 'name' || name === 'date' ? 'required' : ''}>`;
  return `<label>${label}${control}</label>`;
}
function openEditor(type, id) {
  const record = type === 'package' ? draft : draft[type].find(item => item.id === id) || {};
  const forms = {
    package: () => field('name','패키지명',record.name)+field('school','학교급',record.school)+field('subject','과목',record.subject)+field('description','수업 범위',record.description),
    events: () => field('title','사건명',record.title)+field('date','날짜',record.date)+field('importance','중요도',record.importance,levels)+field('source','출처',record.source),
    categories: () => field('name','카테고리명',record.name)+field('kind','유형',record.kind,catKinds)+field('start','시작일',record.start)+field('end','종료일',record.end),
    relations: () => field('label','관계 이름',record.label)+field('kind','관계 유형',record.kind,relationKinds)+field('body','근거 설명',record.body)+field('source','출처',record.source),
  };
  editor.className = design.id === 'grid' || design.id === 'review' ? 'side-editor' : '';
  editor.innerHTML = `<form><header><h2 id="editor-title">${sectionTitle(type)} ${id || type === 'package' ? '편집' : '추가'}</h2>
    ${button('×','data-close-dialog','close','aria-label="닫기"')}</header>
    <div class="dialog-fields">${forms[type]()}</div><footer><button class="primary" type="submit">시안에 저장</button></footer></form>`;
  editor.querySelector('form').onsubmit = event => {
    event.preventDefault();
    Object.assign(record, Object.fromEntries(new FormData(event.currentTarget)));
    if (type === 'events' && !id) draft.events.push({id:crypto.randomUUID(), groups:[], body:'', ...record});
    editor.close();
    render();
    preview.querySelector(`[data-edit="${type}"][data-id="${CSS.escape(id)}"]`)?.focus({preventScroll:true});
  };
  editor.showModal();
}
function commandResults(query = '') {
  return draft.events.filter(e => (e.title+' '+e.date).includes(query.trim())).map(e =>
    button(`<strong>${esc(e.title)}</strong><time>${esc(e.date)}</time>`, `data-edit="events" data-id="${esc(e.id)}"`, 'command-row')).join('') || '<p class="message">검색 결과가 없습니다.</p>';
}
function openCommand() {
  command.innerHTML = `<header><h2 id="command-title">사건 빠른 찾기</h2>${button('×','data-close-dialog','close','aria-label="닫기"')}</header>
    <input type="search" autofocus data-command-input aria-label="사건명 또는 날짜 검색" placeholder="사건명 또는 날짜"><div id="command-results">${commandResults()}</div>`;
  command.showModal();
}

nav.innerHTML = designs.map((item, index) => `<a href="#${item.id}" style="--swatch:${item.tone}">
  <span class="number">${String(index + 1).padStart(2,'0')}</span><strong>${item.name}</strong><small>${item.short}</small></a>`).join('');
window.addEventListener('hashchange', changeDesign);
changeDesign();

function resizeAtlas(handle, share) {
  atlasShare = Math.max(38, Math.min(73, Math.round(share)));
  handle.parentElement.style.setProperty('--atlas-share', atlasShare + '%');
  handle.setAttribute('aria-valuenow', atlasShare);
}
preview.addEventListener('pointerdown', event => {
  if (!event.target.matches('.atlas-handle')) return;
  event.target.setPointerCapture(event.pointerId);
});
preview.addEventListener('pointermove', event => {
  const handle = event.target;
  if (!handle.matches('.atlas-handle') || !handle.hasPointerCapture(event.pointerId)) return;
  const layout = handle.parentElement.getBoundingClientRect();
  resizeAtlas(handle, 100 * (event.clientX - layout.left) / layout.width);
});

document.addEventListener('click', event => {
  const btn = event.target.closest('button');
  if (!btn || !draft) return;
  const data = btn.dataset;
  if ('closeDialog' in data) { btn.closest('dialog').close(); return; }
  if (data.edit) { if (command.open) command.close(); openEditor(data.edit, data.id); return; }
  if ('command' in data) { openCommand(); return; }
  if (data.sheet) { sheet = data.sheet; query = ''; render(); preview.querySelector(`[data-sheet="${sheet}"]`).focus(); }
  if ('sort' in data) { reverse = !reverse; document.querySelector('#grid-target').innerHTML = gridTarget(); preview.querySelector('[data-sort]').focus(); }
  if ('step' in data) { step = Number(data.step); render(); preview.querySelector('[aria-current="step"]').focus(); }
  if (data.edge) { activeEdge = data.edge; render(); preview.querySelector('[data-edge][aria-pressed=true]').focus(); }
  if (data.reviewFilter) { reviewFilter = data.reviewFilter; render(); preview.querySelector('[data-review-filter][aria-pressed=true]').focus(); }
  if (data.reviewId) { activeReview = data.reviewId; render(); preview.querySelector('[data-review-id][aria-pressed=true]').focus(); }
  if (data.reviewed) { reviewed.add(data.reviewed); render(); preview.querySelector('[data-review-filter][aria-pressed=true]').focus(); }
});
document.addEventListener('input', event => {
  if (event.target.matches('[data-query]')) {
    query = event.target.value;
    document.querySelector('#grid-target').innerHTML = gridTarget();
  }
  if (event.target.matches('[data-command-input]')) document.querySelector('#command-results').innerHTML = commandResults(event.target.value);
});
document.addEventListener('keydown', event => {
  if (event.target.matches?.('.atlas-handle') && ['ArrowLeft','ArrowRight'].includes(event.key)) {
    event.preventDefault();
    resizeAtlas(event.target, atlasShare + (event.key === 'ArrowRight' ? 4 : -4));
    return;
  }
  if (command.open && ['ArrowDown','ArrowUp'].includes(event.key)) {
    const rows = [...command.querySelectorAll('.command-row')];
    if (rows.length) {
      event.preventDefault();
      const index = rows.indexOf(document.activeElement);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      rows[index < 0 ? (step > 0 ? 0 : rows.length - 1) : (index + step + rows.length) % rows.length].focus();
    }
  }
  if (event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey) && draft && design.id === 'grid' && !editor.open && !command.open) {
    event.preventDefault();
    openCommand();
  }
});

try {
  const response = await fetch('../../assets/studio-catalog.json');
  if (!response.ok) throw Error('Missing sample');
  const source = studioCatalog(await response.json()).open('japan');
  const categories = source.categories.filter(cat => ['무단 통치','문화 통치','국내 민족운동','중국 관내의 독립운동','만주·연해주의 독립운동'].includes(cat.name));
  draft = { ...source, categories, events: source.events.filter(event => demoIds.includes(event.id))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(event => ({ ...event, groups: categories.filter(cat => cat.members.includes(event.id)).map(cat => cat.id) })),
    relations: source.relations.filter(relation => ['R001','R002'].includes(relation.id)) };
  render();
} catch (error) {
  console.error(error);
  preview.innerHTML = '<p class="message" role="status">예시 패키지를 불러오지 못했습니다. 페이지를 다시 열어 주세요.</p>';
}
