import {relationTypes} from '../swimlane-data.js';
export function parseDashboardCSV(text, parseCSV, tab) {
  const [firstRow = [], ...rows] = parseCSV(text);
  const columns = firstRow.flatMap((value, index) => value.trim() ? [[value.trim(), index]] : []);
  const headers = columns.map(([header]) => header);
  if (new Set(headers).size !== headers.length || headers.includes('__proto__')) throw new Error('열 이름을 확인해 주세요.');
  // shortcut: 현재 공개 공간 시트의 첫 열 오타만 허용하며 원본 제목이 정정되면 제거한다.
  if (tab === '공간' && columns[0]?.[0] === 'ㅇ' && columns[0][1] === 0 && !headers.includes('공간ID') &&
      rows.length && rows.every(row => /^geo_[a-z0-9_]+$/.test(row[0])) &&
      new Set(rows.map(row => row[0])).size === rows.length) {
    columns[0][0] = headers[0] = '공간ID';
  }
  return {
    headers,
    records: rows.map(row => Object.fromEntries(columns.map(([header, index]) => [header, row[index] ?? ''])))
  };
}

export function geographyLinks(data) {
  const spaces = new Map(data['공간'].map((row, index) => [row.공간ID, {row, index, children: [], events: new Set()}]));
  const shapes = new Set(data['지도도형'].map(row => row.지도참조키).filter(Boolean));
  const roots = [];
  for (const [id, space] of spaces) {
    const parent = spaces.get(space.row.상위공간ID);
    if (parent && parent !== space) parent.children.push(id);
    else roots.push(id);
  }
  const eventIds = new Set(data['사건'].map(row => row.사건ID));
  for (const row of data['사건_공간']) {
    if (eventIds.has(row.사건ID)) spaces.get(row.공간ID)?.events.add(row.사건ID);
  }
  return {spaces, shapes, roots};
}

export function relationEndpointTab(type) {
  const key = String(type ?? '').trim().toLowerCase();
  return key === 'event' ? '사건' : key === 'category' ? '카테고리' :
    ['actor','state','territory','organization','army','institution','person'].includes(key) ? '주체' : '';
}

export function findRelationEndpoint(data, type, id) {
  const tab = relationEndpointTab(type);
  const idField = {사건:'사건ID', 카테고리:'카테고리ID', 주체:'주체ID'}[tab];
  const row = id && data[tab]?.find(record => record[idField] === id);
  return {tab,row};
}

export function eventActorLinks(data, eventId, actors) {
  const actorKeys = new Set();
  for (const row of actors) {
    const key = JSON.stringify([row.주체ID,row.역할]);
    if (actorKeys.has(key)) throw new Error('같은 주체와 역할이 두 번 연결되어 있어요.');
    actorKeys.add(key);
    if (!data.사건_주체.some(original => original.사건ID === eventId && original.주체ID === row.주체ID && original.역할 === row.역할) &&
        (!row.역할 || !findRelationEndpoint(data,'actor',row.주체ID).row)) {
      throw new Error('참여 주체와 역할을 확인해 주세요.');
    }
  }
  return [...data.사건_주체.filter(row => row.사건ID !== eventId), ...actors];
}

export {relationTypes};

export function eventPackageLinks(data) {
  if (data.사건_패키지) return data.사건_패키지;
  const byCategory = new Map(data.카테고리.map(row => [row.카테고리ID,row.패키지ID]));
  const seen = new Set();
  return data.사건_카테고리.flatMap(({사건ID,카테고리ID}) => {
    const 패키지ID = byCategory.get(카테고리ID);
    const key = JSON.stringify([사건ID,패키지ID]);
    if (!패키지ID || seen.has(key)) return [];
    seen.add(key);
    return [{사건ID,패키지ID}];
  });
}

export function relationPackages(data, from, to) {
  const byCategory = new Map(data.카테고리.map(row => [row.카테고리ID,row.패키지ID]));
  const packageLinks = eventPackageLinks(data);
  const memberships = ({type,id}) => {
    if (type === 'category') return new Set([byCategory.get(id)].filter(Boolean));
    const events = type === 'event' ? new Set([id]) :
      new Set(data.사건_주체.filter(row => row.주체ID === id).map(row => row.사건ID));
    const packages = new Set(packageLinks.filter(row => events.has(row.사건ID)).map(row => row.패키지ID));
    if (type === 'actor') {
      for (const row of data.관계) {
        if (row.패키지ID && ['출발','도착'].some(side => row[side+'ID'] === id && relationEndpointTab(row[side+'유형']) === '주체')) {
          packages.add(row.패키지ID);
        }
      }
    }
    return packages;
  };
  const fromPackages = memberships(from);
  const toPackages = memberships(to);
  const shared = data.패키지.filter(row =>
    (!fromPackages.size || fromPackages.has(row.패키지ID)) && (!toPackages.size || toPackages.has(row.패키지ID)));
  return shared.length ? shared : data.패키지;
}

export function updateCategoryEvents(events, categories, previous, category, {eventCategoryTypes,categoryLinks}) {
  if (!previous || (previous.카테고리명 === category.카테고리명 && previous.카테고리유형 === category.카테고리유형)) return events;
  const id = category.카테고리ID;
  const registry = categories.map(row => ({topic_id:row.카테고리ID,name:row.카테고리명,category_type:row.카테고리유형}));
  const updated = registry.map(row => row.topic_id === id ? {...row,name:category.카테고리명,category_type:category.카테고리유형} : row);
  const names = new Map(updated.map(row => [row.topic_id,row.name]));
  const links = categoryLinks(events,registry);
  const byEvent = new Map();
  for (const {event_id,topic_id} of links) {
    if (!byEvent.has(event_id)) byEvent.set(event_id,[]);
    byEvent.get(event_id).push(topic_id);
  }
  const fields = Object.keys(eventCategoryTypes);
  const destination = fields.find(field => eventCategoryTypes[field] === category.카테고리유형);
  const resolve = (eventId,field,value,definitions) =>
    categoryLinks([{사건ID:eventId,[field]:value}],definitions).map(link => link.topic_id);
  let newLabel = id;
  try {
    const matches = resolve(id,destination,category.카테고리명,updated);
    if (matches.length === 1 && matches[0] === id) newLabel = category.카테고리명;
  } catch { /* Use the stable ID when a name is ambiguous. */ }
  const nextEvents = events.map(row => {
    const ids = byEvent.get(row.사건ID);
    if (!ids?.includes(id)) return row;
    const next = {...row};
    if (Object.hasOwn(row,'카테고리명')) next.카테고리명 = ids.map(key => names.get(key) || key).join(', ');
    if (!fields.some(field => Object.hasOwn(row,field))) return next;

    for (const field of fields) {
      const tokens = String(row[field] ?? '').split(/[,;|]/).map(value => value.trim()).filter(Boolean);
      const oldIds = tokens.map(token => resolve(row.사건ID,field,token,registry)[0]);
      if (!oldIds.includes(id) && field !== destination) continue;
      if (field === '시기' && field === destination && oldIds.some(key => key !== id) && !oldIds.includes(id)) {
        throw new Error(`‘${row.사건명}’에 이미 시기가 지정되어 있어요.`);
      }
      const values = tokens.flatMap((token,index) => oldIds[index] !== id ? [token] :
        field !== destination ? [] : [token === id ? id : newLabel]);
      if (field === destination && !oldIds.includes(id)) values.push(newLabel);
      next[field] = values.join(', ');
    }
    return next;
  });
  const linkKeys = rows => rows.map(link => JSON.stringify([link.event_id,link.topic_id])).sort().join('\n');
  if (linkKeys(categoryLinks(nextEvents,updated)) !== linkKeys(links)) {
    throw new Error('카테고리 변경 후에도 기존 사건 연결이 유지되는지 확인해 주세요.');
  }
  return nextEvents;
}

export function relationConnects(row, from, to) {
  return row.출발ID === from.id && row.도착ID === to.id &&
    relationEndpointTab(row.출발유형) === relationEndpointTab(from.type) &&
    relationEndpointTab(row.도착유형) === relationEndpointTab(to.type);
}

export function createRelation(data, headers, {from,to,type,packageId}, id) {
  if (!from || !to || !['event','actor','category'].includes(from.type) || !['event','actor','category'].includes(to.type) ||
      (from.type === to.type && from.id === to.id) ||
      !findRelationEndpoint(data,from.type,from.id).row || !findRelationEndpoint(data,to.type,to.id).row) {
    throw new Error('서로 다른 출발 대상과 도착 대상을 선택해 주세요.');
  }
  if (!relationTypes.includes(type)) throw new Error('관계 유형을 선택해 주세요.');
  if (!packageId || !relationPackages(data,from,to).some(row => row.패키지ID === packageId)) {
    throw new Error('관계를 저장할 패키지를 선택해 주세요.');
  }
  if (data.관계.some(row => relationConnects(row,from,to) &&
      String(row.관계유형 ?? '').trim().toLowerCase() === type && (!row.패키지ID || row.패키지ID === packageId))) {
    throw new Error('이미 저장된 관계예요.');
  }
  return {
    ...Object.fromEntries(headers.map(header => [header,''])),
    관계ID:id, 패키지ID:packageId, 출발유형:from.type, 출발ID:from.id, 도착유형:to.type, 도착ID:to.id, 관계유형:type, 검토상태:'draft'
  };
}

export function groupRelationsByDirection(relations) {
  const directions = new Map();
  for (const relation of relations) {
    const from = relationEndpointTab(relation.row['출발유형']) || '기타';
    const to = relationEndpointTab(relation.row['도착유형']) || '기타';
    const key = `${from}→${to}`;
    if (!directions.has(key)) directions.set(key, []);
    directions.get(key).push(relation);
  }
  return directions;
}

export function filterRelationDirections(directions, from = '', to = '') {
  return new Map([...directions].filter(([key]) => {
    const [source, destination] = key.split('→');
    return (!from || source === from) && (!to || destination === to);
  }));
}
