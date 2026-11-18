import {dashboardTables,historyDataTables} from './src/data-explorer-model';
import {koreanHistory} from './src/korean-history';
import {packages} from './src/workspace-model';

(() => {
  const schemas = {
    packages: {
      title: '패키지', id: 'package_id', name: 'name',
      description: '패키지에 속한 카테고리를 확인할 수 있습니다.',
      placeholder: '패키지명, ID', columns: ['name', 'package_id'],
      fields: {package_id:'패키지ID', name:'패키지명'}
    },
    events: {
      title: '사건', id: 'event_id', name: 'title',
      description: '사건명을 누르면 본문, 사진, 관련 기록이 열립니다.',
      placeholder: '사건명, 날짜, 패키지, ID', columns: ['title', 'start_date', 'package_id', 'category_names', 'review_status'],
      fields: {event_id:'사건ID', title:'사건명', package_id:'패키지ID', start_date:'날짜', end_date:'종료일', summary:'내용', images:'이미지', source_url:'출처', country_names:'국가·지역·조직', category_names:'카테고리', us_leader:'미국 지도자 원본 표기', ussr_leader:'소련 지도자 원본 표기', date_qualifier:'날짜유형', game_eligible:'게임출제', review_status:'검토상태'}
    },
    countries: {
      title: '국가·지역·조직', id: 'actor_id', name: 'name',
      description: '국가·지역·조직을 사건과 재임기간에서 같은 국가ID로 참조합니다.',
      placeholder: '국가·조직명, 국가코드, ID', columns: ['name', 'actor_type', 'iso3', 'actor_id'],
      fields: {actor_id:'국가ID', name:'국가·조직명', actor_type:'구분', iso3:'국가코드'}
    },
    tenure_periods: {
      title: '재임기간', id: 'tenure_id', name: 'name',
      description: '한 행은 한 인물이 한 직위를 맡은 기간입니다. 겸직과 재취임은 별도 행으로 기록합니다.',
      placeholder: '이름, 국가, 직위, 기간', columns: ['name', 'country_id', 'office_title', 'start_date', 'end_date'],
      fields: {tenure_id:'재임ID', country_id:'국가ID', name:'이름', office_title:'직위', start_date:'시작일', end_date:'종료일', notes:'설명', person_id:'인물ID', original_name:'원어명', institution_id:'조직ID', office_id:'직위ID', role_type:'직위유형', office_start_date:'직위 시작일', office_end_date:'직위 종료일', office_order:'직위 표시순서', office_status:'직위 검토상태', date_qualifier:'날짜유형', appointment_type:'재임유형', review_status:'검토상태', office_notes:'직위 설명'}
    },
    categories: {
      title: '카테고리', id: 'topic_id', name: 'name',
      description: '상위카테고리ID는 같은 표의 다른 카테고리를 가리킵니다.',
      placeholder: '이름, 패키지, 상위 카테고리', columns: ['name', 'package_id', 'parent_topic_id', 'topic_id'],
      fields: {topic_id:'카테고리ID', name:'이름', package_id:'패키지ID', parent_topic_id:'상위카테고리ID', sort_order:'표시순서'}
    },
    event_countries: {
      title: '사건–국가·지역·조직',
      description: '한 행이 사건과 관련 국가·지역·조직을 연결합니다.',
      placeholder: '사건명, 국가, 역할, 패키지', columns: ['event_id', 'actor_id', 'role', 'package_id'],
      fields: {event_id:'사건ID', actor_id:'국가ID', role:'역할', package_id:'패키지ID'}
    },
    event_categories: {
      title: '사건–카테고리',
      description: '한 행이 사건과 카테고리를 연결합니다.',
      placeholder: '사건명, 카테고리, 패키지', columns: ['event_id', 'topic_id', 'package_id'],
      fields: {event_id:'사건ID', topic_id:'카테고리ID', package_id:'패키지ID'}
    }
  };
  const references = {package_id:'packages', event_id:'events', actor_id:'countries', country_id:'countries', institution_id:'countries', topic_id:'categories', parent_topic_id:'categories'};
  const listHeaders = {package_id:'패키지', event_id:'사건', actor_id:'국가·지역·조직', country_id:'국가', topic_id:'카테고리', parent_topic_id:'상위 카테고리'};
  const terms = {
    actor_type:{state:'국가', territory:'지역', organization:'조직'},
    role:{initiator:'개시', counterparty:'상대', participant:'참여', mediator:'중재', affected:'영향을 받음'},
    review_status:{draft:'초안', verified:'검토 완료', summary:'요약', '':'미분류'},
    office_status:{draft:'초안', verified:'검토 완료'},
    date_qualifier:{stated:'기록에 명시', approximate:'추정'},
    appointment_type:{regular:'정식', acting:'대행', interim:'임시'},
    game_eligible:{TRUE:'선택', FALSE:'미선택'}
  };
  const get = id => document.getElementById(id);
  const tableButtons = [...document.querySelectorAll('[data-table]')];
  const tableChoices = [...document.querySelectorAll('.table-types [data-table]')];
  const guide = get('structure');
  const overview = get('overview');
  const tableScroll = document.querySelector('.table-scroll');
  const search = get('search');
  const detail = get('detail');
  const detailBack = get('detail-back');
  const status = get('source-status');
  const reload = get('reload');
  const clearFilter = get('clear-filter');
  const sheetPackage = 'cold-war';
  const exampleId = 'evt_117e14c7dc3d478b82e85d88ad66a922';
  const example = get('open-example');
  const packageScope = get('package-scope');
  const history = [];
  let selected = 'events';
  let eventFilter;
  let activePackage = '';
  let sheetTables = SHEET_SNAPSHOT.tables;
  let sheetStatus = '공개 시트를 읽는 중입니다.';
  let tables;
  let index;
  let lastRead;
  let detailTrigger;

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  const recordKey = (table,id,packageId) => table==='events'||table==='categories' ? JSON.stringify([packageId,id]) : id;

  function indexTables() {
    index = Object.fromEntries(Object.entries(schemas).filter(([,schema]) => schema.id).map(([key,schema]) => [key, new Map(tables[key].map(row => [recordKey(key,row[schema.id],row.package_id),row]))]));
  }

  function loadTables() {
    const datasets = {[sheetPackage]:sheetTables, 'korean-history':historyDataTables(koreanHistory([]),sheetTables.tenure_periods)};
    tables = dashboardTables(packages.map(pkg=>({...pkg,tables:datasets[pkg.id]})),activePackage);
    indexTables();
    example.hidden = !sheetTables.events.some(row=>row.event_id===exampleId);
  }

  function renderSource() {
    const sheetScope = !activePackage || activePackage===sheetPackage;
    const sharedTenures = !sheetScope && tables.tenure_periods.length>0;
    get('sheet-actions').hidden = !sheetScope && !sharedTenures;
    if (sheetScope) status.textContent = activePackage ? sheetStatus : `앱 데이터 · ${sheetStatus}`;
    else status.textContent = sharedTenures ? `앱 데이터 · 재임기간 시트 연동 (${sheetStatus})` : '앱에 포함된 데이터';
  }

  const decadeOf = event => Math.floor(Number(event.start_date.slice(0, 4)) / 10) * 10;
  const filterLabel = (key, value) => key === 'decade' ? `${value}년대` : translate('review_status', value);

  function renderOverview() {
    const counts = new Map();
    const review = new Map();
    for (const event of tables.events) {
      const decade = decadeOf(event);
      counts.set(decade, (counts.get(decade) ?? 0) + 1);
      const state = event.review_status ?? '';
      review.set(state,(review.get(state)??0)+1);
    }

    const chart = get('decade-chart');
    const maximum = Math.max(1, ...counts.values());
    const bars = document.createDocumentFragment();
    for (const [decade,count] of [...counts].sort(([a],[b])=>a-b)) {
      const button = element('button', undefined, 'decade-bar');
      button.type = 'button';
      button.dataset.filter = 'decade';
      button.dataset.value = String(decade);
      button.setAttribute('aria-label', `${decade}년대 사건 ${count}건`);
      const plot = element('span', undefined, 'decade-plot');
      const bar = element('span', undefined, 'decade-fill');
      bar.style.setProperty('--fill', `${count / maximum * 100}%`);
      bar.append(element('strong', count));
      plot.append(bar);
      button.append(plot, element('span', decade, 'decade-label'));
      bars.append(button);
    }
    chart.replaceChildren(counts.size ? bars : element('p','등록된 사건이 없습니다.','decade-empty'));

    const total = tables.events.length;
    get('review-rate').textContent = total && review.has('verified') ? `검토 완료 ${Math.round(review.get('verified') / total * 100)}%` : '';
    const reviewRows = document.createDocumentFragment();
    for (const state of [...new Set(['verified','draft',...review.keys()])].filter(state=>review.has(state))) {
      const count = review.get(state);
      const button = element('button');
      button.type = 'button';
      button.dataset.filter = 'review_status';
      button.dataset.value = state;
      const track = element('span',undefined,state==='draft'?'review-track draft':'review-track');
      track.setAttribute('aria-hidden','true');
      track.style.setProperty('--fill',`${count / total * 100}%`);
      button.append(element('span',translate('review_status',state)),element('strong',`${count}건`),track);
      reviewRows.append(button);
    }
    get('review-list').replaceChildren(reviewRows);
    renderFilter();
  }

  function renderFilter() {
    for (const button of document.querySelectorAll('[data-filter]')) {
      const active = eventFilter?.key === button.dataset.filter && eventFilter.value === button.dataset.value;
      button.setAttribute('aria-pressed', String(active));
    }
    clearFilter.hidden = !eventFilter;
    if (eventFilter) clearFilter.textContent = `${filterLabel(eventFilter.key, eventFilter.value)} 필터 해제 ×`;
  }

  const translate = (key, value) => Object.hasOwn(terms, key) && Object.hasOwn(terms[key], value) ? terms[key][value] : value;
  function referencedRecord(table, key, value, packageId) {
    const target = Object.hasOwn(references, key) && references[key];
    const row = key !== schemas[table].id && index[target]?.get(recordKey(target,value,packageId));
    return row && {table: target, row};
  }
  function display(table, key, value, packageId) {
    const reference = referencedRecord(table, key, value, packageId);
    return reference ? reference.row[schemas[reference.table].name] : translate(key, value);
  }

  function recordButton(table, row, label) {
    const button = element('button', label, 'record-link');
    button.type = 'button';
    button.addEventListener('click', () => {
      if (!detail.open) detailTrigger = button;
      history.push({table, row});
      showRecord();
    });
    return button;
  }

  function renderRows() {
    const schema = schemas[selected];
    const query = search.value.normalize().toLowerCase().trim().split(/\s+/).filter(Boolean);
    const rows = tables[selected].filter(row => {
      if (eventFilter) {
        const value = eventFilter.key === 'decade' ? String(decadeOf(row)) : row.review_status ?? '';
        if (value !== eventFilter.value) return false;
      }
      if (!query.length) return true;
      const values = Object.entries(row).flatMap(([key,value]) => [value, display(selected, key, value,row.package_id)]).join(' ').normalize().toLowerCase();
      return query.every(term => values.includes(term));
    });
    const body = get('table-body');
    const records = document.createDocumentFragment();
    for (const row of rows) {
      const tr = element('tr');
      schema.columns.forEach((key, column) => {
        const label = String(display(selected,key,row[key],row.package_id) ?? '').replace(/\r?\n/g, ', ') || '—';
        const cell = element(column ? 'td' : 'th', column ? label : undefined, key.endsWith('_date') || key === 'review_status' ? 'date' : undefined);
        if (!column) {
          cell.scope = 'row';
          const button = recordButton(selected, row, label);
          if (!schema.id) button.setAttribute('aria-label', `${label} · ${display(selected,schema.columns[1],row[schema.columns[1]],row.package_id)} 연결 상세`);
          cell.append(button);
        }
        tr.append(cell);
      });
      records.append(tr);
    }
    if (!rows.length) {
      const row = element('tr'), cell = element('td', query.length || eventFilter ? '조건에 맞는 기록이 없습니다.' : '등록된 기록이 없습니다.');
      cell.colSpan = schema.columns.length;
      row.append(cell);
      records.append(row);
    }
    body.replaceChildren(records);
    get('result-count').textContent = query.length || eventFilter ? `결과 ${rows.length}건 / 전체 ${tables[selected].length}건` : `전체 ${rows.length}건`;
    tableScroll.scrollTop = 0;
  }

  function selectTable(table, filter) {
    selected = table;
    eventFilter = filter;
    const schema = schemas[table];
    for (const button of tableChoices) button.setAttribute('aria-pressed', String(button.dataset.table === table));
    get('table-title').textContent = schema.title;
    get('table-description').textContent = schema.description;
    search.value = '';
    search.placeholder = schema.placeholder;
    const header = element('tr');
    for (const key of schema.columns) {
      const th = element('th', referencedRecordLabel(table, key));
      th.scope = 'col';
      header.append(th);
    }
    get('table-head').replaceChildren(header);
    get('table-body').dataset.kind = table;
    tableScroll.scrollLeft = 0;
    renderFilter();
    renderRows();
  }

  function showTable(table, filter) {
    if (overview.hidden) {
      location.hash = 'records';
      showPage();
    }
    selectTable(table, filter);
    get('table-title').focus({preventScroll:true});
    get('records').scrollIntoView({block:'start'});
  }

  function showPage() {
    const anchor = location.hash.slice(1);
    if (anchor === 'main-content') return;
    const viewingData = anchor === 'overview' || anchor === 'records';
    const changed = overview.hidden === viewingData;
    guide.hidden = viewingData;
    overview.hidden = !viewingData;
    get(viewingData ? 'records-link' : 'guide-link').setAttribute('aria-current','page');
    get(viewingData ? 'guide-link' : 'records-link').removeAttribute('aria-current');
    if (changed) (get(anchor) ?? guide).scrollIntoView({block:'start'});
  }

  function referencedRecordLabel(table, key) {
    return key !== schemas[table].id && Object.hasOwn(listHeaders, key) ? listHeaders[key] : schemas[table].fields[key];
  }

  function externalLink(href, label) {
    if (!URL.canParse(href, location.href)) return element('span',href);
    const url = new URL(href, location.href);
    if (!['http:','https:'].includes(url.protocol)) return element('span',href);
    const link = element('a', label);
    link.href = url.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  }

  function detailField(table, key, label, value, packageId) {
    const field = element('div', undefined, 'field');
    const cell = element('dd');
    const reference = referencedRecord(table,key,value,packageId);
    if (reference) {
      cell.append(recordButton(reference.table,reference.row,reference.row[schemas[reference.table].name]),element('br'),element('code',value));
    } else if (key === 'images' && value) {
      value.split(/\r?\n/).map(url => url.trim()).filter(Boolean).forEach((url, i) => {
        if (i) cell.append(element('br'));
        cell.append(externalLink(Object.hasOwn(SHEET_MEDIA, url) ? './'+SHEET_MEDIA[url] : url, `사진 ${i+1} 열기 ↗`));
      });
    } else if (key === 'source_url' && value) {
      cell.append(externalLink(value,'출처 열기 ↗'));
    } else {
      cell.textContent = String(translate(key, value) ?? '') || '—';
    }
    field.append(element('dt', label), cell);
    return field;
  }

  function relationGroups(table, row) {
    const samePackage = record => record.package_id===row.package_id;
    switch (table) {
      case 'packages': return [
        ['카테고리','categories',tables.categories.filter(samePackage).map(topic=>[topic.topic_id])]
      ];
      case 'events': return [
        ['관련 국가·지역·조직', 'countries', tables.event_countries.filter(link=>samePackage(link)&&link.event_id===row.event_id).map(link=>[link.actor_id,translate('role',link.role)])],
        ['카테고리', 'categories', tables.event_categories.filter(link=>samePackage(link)&&link.event_id===row.event_id).map(link=>[link.topic_id])]
      ];
      case 'countries': return [
        ['관련 사건', 'events', tables.event_countries.filter(link=>link.actor_id===row.actor_id).map(link=>[link.event_id,translate('role',link.role),link.package_id])],
        ['재임기간', 'tenure_periods', tables.tenure_periods.filter(tenure => tenure.country_id === row.actor_id).map(tenure => [tenure.tenure_id, `${tenure.office_title} · ${tenure.start_date}${tenure.end_date ? `–${tenure.end_date}` : '–'}`])]
      ];
      case 'categories': return [
        ['하위 카테고리', 'categories', tables.categories.filter(topic=>samePackage(topic)&&topic.parent_topic_id===row.topic_id).map(topic=>[topic.topic_id])],
        ['직접 연결된 사건', 'events', tables.event_categories.filter(link=>samePackage(link)&&link.topic_id===row.topic_id).map(link=>[link.event_id])]
      ];
      default: return [];
    }
  }

  function showRecord() {
    const {table, row} = history.at(-1);
    const schema = schemas[table];
    const title = get('detail-title');
    title.textContent = schema.name ? row[schema.name] : schema.columns.slice(0,2).map(key=>display(table,key,row[key],row.package_id)).join(' · ');
    get('detail-fields').replaceChildren(...Object.entries(schema.fields).filter(([key])=>Object.hasOwn(row,key)).map(([key,label])=>detailField(table,key,label,row[key],row.package_id)));
    const links = get('detail-links');
    links.replaceChildren();
    for (const [label, target, records] of relationGroups(table, row)) {
      const section = element('section', undefined, 'linked-records');
      section.append(element('h3', `${label} ${records.length}건`));
      if (records.length) {
        const list = element('ul');
        for (const [id, context, packageId=row.package_id] of records) {
          const linked = index[target].get(recordKey(target,id,packageId));
          const item = element('li');
          item.append(recordButton(target, linked, linked[schemas[target].name]));
          if (context) item.append(element('span', ` · ${context}`, 'link-context'));
          list.append(item);
        }
        section.append(list);
      }
      links.append(section);
    }
    detailBack.hidden = history.length === 1;
    if (!detail.open) detail.showModal();
    else title.focus({preventScroll:true});
    detail.scrollTop = 0;
  }

  async function refresh() {
    if (reload.getAttribute('aria-disabled') === 'true') return;
    reload.setAttribute('aria-disabled', 'true');
    sheetStatus = '공개 시트를 읽는 중입니다.';
    renderSource();
    try {
      const response = await fetch(SHEET_CONFIG.feedUrl + '&v=' + Math.floor(Date.now()/60000), {
        credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error('공개 시트를 읽지 못했습니다.');
      const fresh = SheetData.readFeedTables(SheetData.parseCSV(await response.text()));
      SheetData.build(fresh);
      if (detail.open) await new Promise(resolve => detail.addEventListener('close', resolve, {once:true}));
      const scrollTop = tableScroll.scrollTop;
      const rowHadFocus = get('table-body').contains(document.activeElement);
      sheetTables = fresh;
      loadTables();
      renderOverview();
      renderRows();
      tableScroll.scrollTop = scrollTop;
      if (rowHadFocus) search.focus({preventScroll:true});
      lastRead = new Intl.DateTimeFormat('ko-KR', {dateStyle:'short', timeStyle:'short'}).format(new Date());
      sheetStatus = `공개 시트 · ${lastRead}에 읽음`;
    } catch {
      sheetStatus = lastRead
        ? `시트 연결 실패 · 마지막으로 읽은 데이터 (${lastRead})`
        : `시트 연결 실패 · 저장된 사본 (${SHEET_SNAPSHOT.exportedAt})`;
    } finally {
      reload.setAttribute('aria-disabled', 'false');
      renderSource();
    }
  }

  get('open-sheet').href = SHEET_CONFIG.url;
  get('package-sheet').href = SHEET_CONFIG.url.split('#')[0] + '#gid=1965822688';
  function selectPackage(id) {
    if(activePackage===id)return;
    activePackage = id;
    for(const item of packageScope.children)item.setAttribute('aria-pressed',String(item.dataset.packageId===id));
    loadTables();
    renderSource();
    renderOverview();
    selectTable(selected);
  }
  for (const {id,name} of [{id:'',name:'전체 패키지'},...packages]) {
    const button = element('button',name);
    button.type = 'button';
    button.dataset.packageId = id;
    button.setAttribute('aria-pressed',String(id===activePackage));
    button.addEventListener('click',()=>selectPackage(id));
    packageScope.append(button);
  }
  example.addEventListener('click',()=>{
    if(activePackage&&activePackage!==sheetPackage)selectPackage(sheetPackage);
    const row = index.events.get(recordKey('events',exampleId,sheetPackage));
    if(!row)return;
    detailTrigger = example;
    history.push({table:'events',row});
    showRecord();
  });
  for (const button of tableButtons) button.addEventListener('click', () => showTable(button.dataset.table));
  document.querySelector('.charts').addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    const filter = button.getAttribute('aria-pressed') === 'true' ? undefined : {key:button.dataset.filter, value:button.dataset.value};
    showTable('events', filter);
  });
  clearFilter.addEventListener('click', () => {
    eventFilter = undefined;
    renderFilter();
    renderRows();
    search.focus({preventScroll:true});
  });
  search.addEventListener('input', renderRows);
  detailBack.addEventListener('click', () => { history.pop(); showRecord(); });
  detail.addEventListener('close', () => {
    history.length = 0;
    (detailTrigger?.isConnected ? detailTrigger : search).focus({preventScroll:true});
  });
  reload.addEventListener('click', refresh);
  window.addEventListener('hashchange', showPage);
  showPage();
  loadTables();
  renderSource();
  renderOverview();
  selectTable(selected);
  reload.setAttribute('aria-disabled', 'false');
  void refresh();
})();
