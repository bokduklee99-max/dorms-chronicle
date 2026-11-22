import {eventMapExamples,linkedMapEvents} from '../event-map-links.js';
import {renderSpaceMap} from './space-preview-map.js';

const $ = id => document.getElementById(id);
if (new URLSearchParams(location.search).has('embedded')) document.documentElement.classList.add('embedded');
const required = {
  사건:['사건ID','날짜','사건명','내용'], 사건_공간:['사건ID','공간ID'], 공간:['공간ID','공간명','지도참조키'],
  지도도형:['지도참조키','도형유형'], 영토변화:['계기사건ID','지도참조키','영토유형'],
  주체:['주체ID','주체명'], 사건_카테고리:['사건ID','카테고리ID'], 카테고리:['카테고리ID','카테고리명','카테고리유형']
};
const featuredIds = ['E056','E018','E195','E083'];
const compact = matchMedia('(max-width: 800px)');
const library = $('library');
let catalog, groups, sequence, index, timer;

function fitLibrary() {
  if (library.open) library.close();
  if (!compact.matches) library.setAttribute('open','');
}
function eventButton(event,select) {
  const node = button('',()=>{
    select();
    if (compact.matches) library.close();
  });
  const date = document.createElement('time');
  date.textContent = event.날짜;
  node.append(date,document.createTextNode(event.사건명));
  node.dataset.id = event.사건ID;
  return node;
}
function markCurrent() {
  const id = sequence[index]?.사건ID;
  for (const list of [$('events'),$('featured')]) {
    list.querySelector('[aria-current]')?.removeAttribute('aria-current');
    const current = list.querySelector('[data-id="'+CSS.escape(id)+'"]');
    if (!current) continue;
    current.setAttribute('aria-current','true');
    if (list.clientHeight) {
      const row = current.getBoundingClientRect(), box = list.getBoundingClientRect();
      if (row.top < box.top) list.scrollTop += row.top-box.top;
      else if (row.bottom > box.bottom) list.scrollTop += row.bottom-box.bottom;
    }
  }
}
function listEvents() {
  const query = $('search').value.trim().toLocaleLowerCase();
  const rows = sequence.flatMap((event,i)=>
    [event.날짜,event.사건명].join(' ').toLocaleLowerCase().includes(query)
      ? [eventButton(event,()=>{stop();show(i);})] : []);
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.textContent = '검색 결과가 없습니다.';
    rows.push(empty);
  }
  $('events').replaceChildren(...rows);
}
function setMode(featured) {
  $('featured').hidden = !featured;
  $('events').hidden = $('group-tools').hidden = featured;
  $('by-feature').setAttribute('aria-pressed',String(featured));
  $('by-group').setAttribute('aria-pressed',String(!featured));
  markCurrent();
}
function button(text,action) {
  const node = document.createElement('button');
  node.type = 'button';
  node.textContent = text;
  node.onclick = action;
  return node;
}
function stop() {
  clearInterval(timer);
  timer = undefined;
  $('play').textContent = '날짜순 재생';
}
function selectGroup(group,id) {
  stop();
  $('groups').value = group.id;
  sequence = group.events;
  $('search').value = '';
  $('group-name').textContent = group.name;
  listEvents();
  show(Math.max(0,sequence.findIndex(e=>e.사건ID===id)));
}
function show(position) {
  index = position;
  const event = sequence[index];
  markCurrent();
  $('date').textContent = [event.날짜,event.종료일].filter(Boolean).join(' – ');
  $('title').textContent = event.사건명;
  $('body').textContent = event.내용;
  $('source').href = SHEET_CONFIG.url.split('#')[0]+'#gid='+SHEET_CONFIG.eventSheetId+'&range=A'+event.sheetRow;
  $('position').textContent = (index+1)+' / '+sequence.length;
  $('prev').disabled = index===0;
  $('next').disabled = index===sequence.length-1;
  $('play').disabled = sequence.length<2;
  if ($('next').disabled) stop();


  function selectLayer(layer) {
    for (const [i,node] of Array.from($('layers').children).entries()) node.setAttribute('aria-pressed',String(event.layers[i]===layer));
    const canvas = document.createElement('div');
    canvas.className = 'space-map';
    $('maps').replaceChildren(canvas);
    $('caption').textContent = [layer.period,layer.shape?.기준시점,layer.note].filter(Boolean).join(' · ');
    const shape = layer.shape;
    if (!shape || !(shape.지도데이터URL || shape.파일경로 || (shape.경도 && shape.위도))) {
      canvas.textContent = '시트에 연결된 지도 도형 자료가 없습니다.';
      return;
    }
    canvas.textContent = '지도를 불러오는 중입니다.';
    void renderSpaceMap(canvas,layer.space,shape,{date:layer.start || event.날짜,registered:true});
  }
  $('layers').replaceChildren(...event.layers.map(layer=>button(layer.label,()=>{stop();selectLayer(layer);})));
  selectLayer(event.layers[0]);
}
async function load() {
  $('status').textContent = '사건과 연결된 지도를 불러오는 중입니다.';
  $('retry').hidden = true;
  try {
    const entries = await Promise.all(Object.entries(required).map(async ([name,fields]) =>
      [name,name==='사건' ? eventMapExamples(SheetData.parseCSV(await SheetData.eventSheetCSV(SHEET_CONFIG),true)) : await SheetData.sheetRecords(SHEET_CONFIG,name,fields)]));
    const tables = Object.fromEntries(entries);
    catalog = linkedMapEvents(tables);
    if (!catalog.length) {
      $('status').textContent = '원본 시트에 공간이나 영토 변화가 연결된 사건이 없습니다.';
      return;
    }
    groups = [{id:'',name:'전체 사건',events:catalog},...tables.카테고리.filter(c=>c.카테고리유형==='arc').map(c=>({
      id:c.카테고리ID,name:c.카테고리명,events:catalog.filter(e=>e.groups.has(c.카테고리ID))
    })).filter(g=>g.events.length)];
    $('groups').replaceChildren(...groups.map(g=>new Option(g.name,g.id)));
    const featured = featuredIds.map(id=>catalog.find(e=>e.사건ID===id)).filter(Boolean);
    function openEvent(event) {
      selectGroup(groups.find(g=>event.groups.has(g.id)) || groups[0],event.사건ID);
    }
    $('featured').replaceChildren(...featured.map(event=>eventButton(event,()=>openEvent(event))));
    $('by-feature').hidden = !featured.length;
    $('reader').hidden=false;
    fitLibrary();
    openEvent(featured[0] || catalog[0]);
    $('status').textContent='';
  } catch {
    $('status').textContent='원본 시트를 불러오지 못했습니다.';
    $('retry').hidden=false;
  }
}
$('groups').onchange=()=>selectGroup(groups.find(g=>g.id===$('groups').value));
$('search').oninput=()=>{listEvents();markCurrent();};
$('by-group').onclick=()=>setMode(false);
$('by-feature').onclick=()=>setMode(true);
$('browse').onclick=()=>{
  stop();
  library.showModal();
  ($('group-tools').hidden ? $('by-feature') : $('search')).focus();
  markCurrent();
};
$('close-library').onclick=()=>library.close();
library.addEventListener('keydown',event=>{
  if (event.key==='Escape' && library.matches(':modal')) {
    event.preventDefault();
    library.close();
  }
});
library.addEventListener('close',()=>{if (compact.matches && !library.open) $('browse').focus({preventScroll:true});});
compact.addEventListener('change',()=>{if (!$('reader').hidden) fitLibrary();});
$('prev').onclick=()=>{stop();show(index-1);};
$('next').onclick=()=>{stop();show(index+1);};
$('play').onclick=()=>{
  if (timer) return stop();
  if (index===sequence.length-1) show(0);
  $('play').textContent='일시정지';
  timer=setInterval(()=>show(index+1),6000);
};
window.addEventListener('pagehide',stop);
document.addEventListener('visibilitychange',()=>{if(document.hidden) stop();});
$('retry').onclick=load;
void load();
