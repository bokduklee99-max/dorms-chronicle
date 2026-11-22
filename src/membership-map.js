// Representative events keep both packages readable together. Edges come from the sheet.
const examples = {
  'cold-war': [/^독일 항복$/, /서베를린 봉쇄.*Blockade|^서베를린 봉쇄$/, /케네디.*베를린 연설/, /대공미사일 쿠바/],
  'korean-history': [/강화도 조약/, /3·1 운동/, /8·15 광복/, /6·25 전쟁 발발/]
};

export function membershipMap(body, status, onEvent) {
  const svgNS = 'http://www.w3.org/2000/svg';
  let routes = [];
  let selected = '';
  let contextEventId = '';
  let frame;
  const nodes = new Map();

  function draw() {
    const bounds = body.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const svg = document.createElementNS(svgNS, 'svg');
    svg.classList.add('map-lines');
    svg.setAttribute('aria-hidden', 'true');
    const active = routes.filter(route => route.includes(selected));
    const highlighted = new Set(active.flat());
    const edges = new Map();
    for (const route of routes) {
      for (const i of [0, 1]) {
        const key = JSON.stringify(route.slice(i, i + 2));
        if (!edges.has(key)) edges.set(key, {from: route[i], to: route[i+1], stage:i, lit:false});
        if (route.includes(selected)) edges.get(key).lit = true;
      }
    }
    for (const {from,to,stage,lit} of edges.values()) {
      const source = nodes.get(from);
      const a = source.getBoundingClientRect(), b = nodes.get(to).getBoundingClientRect();
      const x = a.right - bounds.left, y = a.top + a.height/2 - bounds.top;
      const endX = b.left - bounds.left, endY = b.top + b.height/2 - bounds.top;
      const mid = (x + endX)/2;
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M '+x+' '+y+' C '+mid+' '+y+', '+mid+' '+endY+', '+endX+' '+endY);
      path.setAttribute('stroke', getComputedStyle(source).getPropertyValue('--branch').trim());
      path.setAttribute('pathLength','1');
      path.style.setProperty('--delay', stage ? '.32s' : '0s');
      if (selected) path.classList.add(lit ? 'traced' : 'muted');
      svg.append(path);
    }
    body.querySelector('svg')?.remove();
    body.append(svg);
    for (const [key,node] of nodes) {
      node.classList.toggle('muted', Boolean(selected) && !highlighted.has(key));
      node.setAttribute('aria-pressed', String(selected === key));
    }
    status.textContent = selected ? [...highlighted].map(key => nodes.get(key).textContent).join(', ') : '';
  }

  new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  }).observe(body);

  return function render(tables) {
    const focus = document.activeElement.dataset.mapKey;
    nodes.clear();
    routes = [];
    body.replaceChildren();
    function node(column, key, name, year) {
      if (nodes.has(key)) return;
      const button = document.createElement('button');
      button.className = 'map-node';
      button.type = 'button';
      button.dataset.mapKey = key;
      if (year) {
        const time = document.createElement('time');
        time.textContent = year;
        button.append(time, ' ');
      }
      button.append(name);
      button.onclick = () => {
        selected = selected === key ? '' : key;
        draw();
        const match = routes.find(route => route.includes(key));
        if (match) showContext(match[2]);
      };
      nodes.set(key, button);
      column.append(button);
      return button;
    }
    function showContext(key) {
      contextEventId = key;
      onEvent(tables.events.find(row => 'event:'+row.event_id === key), tables);
    }
    for (const pkg of tables.packages) {
      const id = pkg.package_id;
      const links = tables.event_categories.filter(link => link.package_id === id);
      const eventIds = new Set(links.map(link => link.event_id));
      const events = tables.events.filter(event => event.package_id === id && eventIds.has(event.event_id));
      const chosen = new Set((examples[id] ?? []).map(pattern => events.find(event => pattern.test(event.title))).filter(Boolean));
      for (const event of events) {
        if (chosen.size >= 4) break;
        chosen.add(event);
      }
      if (!chosen.size) continue;
      const band = document.createElement('div');
      band.className = 'map-band';
      const columns = Array.from({length:3}, () => {
        const col = document.createElement('div');
        col.className = 'map-column';
        band.append(col);
        return col;
      });
      body.append(band);
      const packageKey = 'package:'+id;
      const packageButton = node(columns[0], packageKey, pkg.name);
      for (const [label,value] of [['학교급',pkg.schoolLevel],['과목',pkg.subject],['설명',pkg.description]]) {
        if (!value) continue;
        const field = document.createElement('span');
        field.className = 'map-package-field';
        const fieldLabel = document.createElement('span');
        fieldLabel.textContent = label;
        const fieldValue = document.createElement('span');
        fieldValue.textContent = value;
        field.append(fieldLabel, ' ', fieldValue);
        packageButton.append(field);
      }
      for (const event of chosen) {
        const eventKey = 'event:'+event.event_id;
        node(columns[2], eventKey, event.title.replace(/\s*\([A-Za-z][^)]*\)$/, ''), event.start_date.slice(0,4));
        for (const link of links.filter(link => link.event_id === event.event_id)) {
          const category = tables.categories.find(row => row.package_id === id && row.topic_id === link.topic_id);
          if (!category) continue;
          const categoryKey = JSON.stringify([id, category.topic_id]);
          node(columns[1], categoryKey, category.name);
          routes.push([packageKey, categoryKey, eventKey]);
        }
      }
    }
    if (!nodes.has(selected)) selected = '';
    const defaultRoute = routes.find(route => nodes.get(route[2]).textContent.includes('서베를린 봉쇄')) ?? routes[0];
    showContext(nodes.has(contextEventId) ? contextEventId : defaultRoute?.[2]);
    nodes.get(focus)?.focus({preventScroll:true});
    draw();
  };
}
