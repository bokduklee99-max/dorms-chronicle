import {gridState,gridContent} from './studio-grid-model.js';
import {mountRelationWires} from './studio-relation-wires.js';
const paths={'link-2':'M10 13a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-2 2 M14 11a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l2-2','unlink-2':'M8 16l-2 2a3 3 0 0 1-4-4l3-3 M16 8l2-2a3 3 0 0 1 4 4l-3 3 M9 3v3 M3 9h3 M16 21v-3 M22 15h-3','clipboard-paste':'M8 5H5v16h14v-6 M9 3h6v4H9z M13 11h9l-3-3 M22 11l-3 3','map-pin':'M18 9c0 5-6 11-6 11S6 14 6 9a6 6 0 1 1 12 0z','users':'M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M1 21v-2a7 7 0 0 1 14 0v2 M16 5a4 4 0 0 1 0 7 M17 15a6 6 0 0 1 5 6','folder':'M3 6h7l2 2h9v12H3z','calendar-days':'M3 5h18v16H3z M3 10h18 M8 2v5 M16 2v5'};
paths.book='M4 4h13a2 2 0 0 1 2 2v14H6a3 3 0 0 1-3-3V6a2 2 0 0 1 1-2Z M7 4v12 M3 17c0-1 1-2 3-2h13';
function makeIcon(name){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS(svg.namespaceURI,'path');
 svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');path.setAttribute('d',paths[name]||'');
 path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','1.6');svg.append(path);return svg;
}

let mapsPromise;
function previewMaps(){
  return mapsPromise??=fetch('./assets/swimlane-gallery-maps.json').then(r=>r.json()).catch(()=>({공간:[],지도도형:[]}));
}

export function mountStudioGrid(container,host){
  container.innerHTML=`<div id="chronicle-grid-studio" lang="ko">
  <section id="gs-start" class="gs-main" hidden>
    <header class="gs-library-head"><h1 tabindex="-1">패키지 초안 목록</h1><button class="gs-primary" data-act="new-package">＋ 새 패키지</button></header>
    <div class="gs-library-nav"><div role="group" aria-label="초안 목록 선택">
      <button data-act="library-group" data-id="shared" aria-controls="gs-library">공동 초안 <span></span></button>
      <button data-act="library-group" data-id="local" aria-controls="gs-local-library">개인 초안 <span></span></button>
    </div><button data-act="reload-drafts">새로고침</button></div>
    <div id="gs-library" role="region" aria-label="공동 초안 목록"></div>
    <div id="gs-local-library" role="region" aria-label="개인 초안 목록" hidden></div>
  </section>
  <div class="gs-main" id="gs-main">
    <div id="gs-location-slot"><nav id="gs-location" aria-label="현재 패키지 위치">
      <button type="button" data-act="packages"><span aria-hidden="true">←</span> <span id="gs-origin"></span></button><span class="gs-location-leaf" hidden><span aria-hidden="true">/</span><strong id="gs-location-name" aria-current="page"></strong></span>
    </nav></div>
    <header class="gs-current-package">
      <div class="gs-package-info"><h1 id="gs-name" tabindex="-1"></h1><p id="gs-course"></p></div>
      <div class="gs-buttons"><button type="button" data-act="edit-package">정보 수정</button><button type="button" data-act="preview">최종 미리보기</button></div>
    </header>
    <div id="gs-sharing"></div>
    <section id="gs-review" aria-label="입력 중 추가된 데이터"><header class="gs-head"><h2>입력 중 추가된 데이터</h2><div class="gs-filters" id="gs-filters"></div></header><div id="gs-queue"></div></section>
    <section id="gs-records" aria-labelledby="gs-records-title">
    <h2 class="gs-work-title" id="gs-records-title">카테고리와 사건 입력</h2>
    <div class="gs-wire-tools">
      <span id="gs-wire-hint">양쪽 점을 이어 연결하고, 선을 끌어 옮기세요.</span>
      <button id="gs-wire-bin" type="button" aria-disabled="true"><i data-lucide="unlink-2" aria-hidden="true"></i> 연결 해제</button>
    </div>
    <div class="gs-grid" id="gs-board">
      <section class="gs-categories" aria-label="카테고리"><header class="gs-head"><h2>카테고리 <span id="gs-c-count"></span></h2><button id="gs-edit-selected" data-act="edit-cat" hidden>편집</button></header><div id="gs-cats"></div></section>
      <div id="gs-wires" aria-label="카테고리와 사건 연결점" role="group">
        <svg class="gs-wire-svg" aria-hidden="true"><g id="gs-edges"></g><path id="gs-rubber" visibility="hidden" fill="none"></path></svg>
        <div id="gs-ports"></div>
      </div>
      <section id="gs-mobile-events" aria-label="연결할 사건"><header class="gs-head"><h2>사건</h2></header><div id="gs-mobile-rows"></div></section>
      <section class="gs-events" aria-label="사건 시트"><header class="gs-head"><div class="gs-event-heading"><h2><b id="gs-event-heading">사건</b> <span id="gs-e-count"></span></h2><button id="gs-clear-category" data-act="clear-category" hidden>전체 사건 보기</button></div><div class="gs-buttons"><button data-act="reuse-event">기존 사건 찾기</button><button class="gs-primary" data-act="add-event">＋ 사건 행</button></div></header>
        <div class="gs-tools"><span>열 이동</span><div class="gs-jumps"><button data-jump="title">기본 정보</button><button data-jump="end">기간·자료</button><button data-jump="actor">연결 항목</button></div></div>
        <div class="gs-scroll" id="gs-scroll" role="region" tabindex="0" aria-label="사건 입력 표"><table id="gs-sheet"><caption class="gs-sr">사건을 행별로 입력하는 표</caption></table></div>
        <div class="gs-sheet-foot"><span><i data-lucide="clipboard-paste" aria-hidden="true"></i> 엑셀 여러 셀 붙여넣기</span><button data-act="add-event">＋ 행 추가</button></div>
      </section>
    </div>
    </section>
    <section id="gs-relations" aria-labelledby="gs-rel-heading">
      <header class="gs-work-head"><h2 class="gs-work-title" id="gs-rel-heading">관계 연결 <span id="gs-rel-count"></span></h2><div class="gs-buttons"><input type="search" id="gs-rel-filter" aria-label="패키지 관계 검색" placeholder="관계 검색"><button type="button" class="gs-primary" data-act="add-relation">＋ 관계 추가</button></div></header>
      <div class="gs-relation-board">
      <div class="gs-rel-tools"><span>양쪽 점을 이으세요. 선을 옮기거나 유형을 눌러 편집할 수 있습니다.</span><button type="button" id="gs-rel-bin" aria-label="끌어온 관계 연결 해제"><i data-lucide="unlink-2"></i> 연결 해제</button></div>
      <div class="gs-rel-columns"><div><h3>출발 대상</h3><button type="button" data-act="find-wire-node" data-id="from" aria-label="출발 대상 찾기">대상 찾기</button></div><div><h3>도착 대상</h3><button type="button" data-act="find-wire-node" data-id="to" aria-label="도착 대상 찾기">대상 찾기</button></div></div>
      <div id="gs-rel-list"><div id="gs-rel-canvas"><svg id="gs-rel-svg" aria-hidden="true"><g></g><path class="gs-rel-draft" hidden></path></svg><div id="gs-rel-groups"></div></div></div>
      </div>
    </section>
    <p class="gs-status" id="gs-status" role="status" aria-live="polite"></p>
  </div>
  <dialog id="gs-dialog" aria-labelledby="gs-dia-title"><div class="gs-dialog-head"><h2 id="gs-dia-title"></h2><button type="button" data-act="close" aria-label="닫기">×</button></div><div id="gs-dia-body"></div></dialog>
</div>`;
  const root=container.firstElementChild,get=id=>root.querySelector('#gs-'+id),dlg=get('dialog'),base=host.catalog;
  const abort=new AbortController();
  const listen=(target,type,fn)=>target.addEventListener(type,fn,{signal:abort.signal});
  const types={event:'사건',policy:'정책·조치',publication:'선언·보고서',context:'배경·정세',period:'시기·국면'};
  const importance={core:'핵심·전환점',major:'주요 사건',detail:'심화·보충'};
  const cats={period:'시기',arc:'사건군',theme:'주제'};
  const actors={state:'국가·정부',organization:'단체·정당',alliance:'동맹·국제기구',army:'군대·무장부대',person:'인물',institution:'기관·학교',territory:'영토·지역'};
  const places={point:'지점·도시',area:'권역·지역',line:'경계·선'};
  const roles={initiator:'주도자',participant:'참여자',affected:'피영향자',counterparty:'대립 상대방',mediator:'중재자',leader:'지도자',executor:'실행자',author:'작성자',founder:'창설자',related:'관련자'};
  const rels={cause:'원인·계기',shift:'전환·변화',action:'활동·실행',integration:'통합·편입',split:'분열·개편',background:'구조적 배경'};
  const names={actor:'주체',place:'공간',category:'카테고리',event:'사건'};
  const linkLabels={actor:'행위주체',place:'공간',category:'카테고리',event:'관련 사건'};
  const norm=s=>String(s||'').normalize('NFKC').replace(/\s+/g,'').toLocaleLowerCase();
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid=()=>globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2)+Date.now().toString(36);
  let s=gridState(host.draft), view=null,filter='pending',tab='title',trigger=null;
  const P=()=>s.packages.find(p=>p.id===s.active);
  const by=(kind,id)=>kind==='category'?P().categories.find(c=>c.id===id):s.over[kind]?.[id]||base[kind]?.[id];
  const title=(kind,id)=>{const r=by(kind,id);return r?.name||r?.title||'이름 미입력';};
  const record=(kind,id)=>{
    if(kind==='category')return by(kind,id);
    if(!s.over[kind][id])s.over[kind][id]=structuredClone(base[kind][id]);
    return s.over[kind][id];
  };
  const objects=k=>k==='category'?P().categories:Object.values({...base[k],...s.over[k]});
  const searchHint={event:'사건명 또는 날짜',actor:'주체명, 원어명 또는 구분',place:'공간명, 시대별 명칭 또는 유형',category:'카테고리명 또는 종류'};
  function searchDetail(kind,r){
    if(kind==='event')return [r.date,r.end].filter(Boolean).join(' – ');
    if(kind==='actor')return [actors[r.kind]||r.kind,r.original].filter(Boolean).join(' · ');
    if(kind==='place')return [places[r.kind]||r.kind,r.alias].filter(Boolean).join(' · ');
    return cats[r.kind]||r.kind||'';
  }
  function searchRecords(kind,query,exclude,assigned=new Set()){
    const pool=objects(kind).filter(r=>r.id!==exclude);
    const inPackage=new Set(kind==='event'?P().ids:[]);
    const rank=r=>(query&&norm(r.name||r.title)===query?4:0)+(inPackage.has(r.id)?2:0)+(assigned.has(r.id)?1:0);
    const matches=pool.filter(r=>!query||[r.name||r.title,searchDetail(kind,r)].some(s=>norm(s).includes(query)))
      .sort((a,b)=>rank(b)-rank(a));
    const scope=kind==='category'?'이 패키지의 카테고리':'전체 '+names[kind];
    const summary=(query?'검색 결과 '+matches.length+'건 · ':'')+scope+' '+pool.length+'건';
    return {matches,summary};
  }
  function searchArea(id){
    return '<p id="gs-'+id+'-count" class="gs-result-count" role="status"></p><div id="gs-'+id+'" class="gs-result-list" tabindex="0" role="region" aria-labelledby="gs-'+id+'-count"></div>';
  }
  function fillResults(id,summary,html,resetScroll){
    const list=get(id),top=resetScroll?0:list.scrollTop,focused=list.contains(document.activeElement)?document.activeElement.dataset.id:null;
    get(id+'-count').textContent=summary;
    list.innerHTML=html||'<p class="gs-empty">검색 결과가 없습니다.</p>';
    list.scrollTop=top;
    if(focused){
      const same=list.querySelector('button[data-id="'+CSS.escape(focused)+'"]:enabled');
      (same||list).focus({preventScroll:true});
    }
  }
  let categoryId=host.sheetView?.categoryId||'';
  const visibleIds=()=>categoryId?P().ids.filter(id=>linkList('category',id).includes(categoryId)):P().ids.slice();
  const idOf=x=>typeof x==='string'?x:x.toId??x.id;
  const icon=n=>'<i aria-hidden="true" data-lucide="'+n+'"></i>';
  const icons=()=>{for(const el of root.querySelectorAll('i[data-lucide]'))el.replaceWith(makeIcon(el.dataset.lucide));};
  const btn=(label,act,id='',extra='')=>'<button type="button" data-act="'+act+'" data-id="'+esc(id)+'" '+extra+'>'+label+'</button>';
  const opts=(list,v)=>(v&&!Object.hasOwn(list,v)?'<option selected value="'+esc(v)+'">'+esc(v)+'</option>':'')+'<option value="">선택</option>'+Object.entries(list).map(([k,n])=>'<option value="'+esc(k)+'" '+(k===v?'selected':'')+'>'+esc(n)+'</option>').join('');
  const status=t=>get('status').textContent=t;
  function persist(){host.change(gridContent(s,base));}
  const later=persist;
  // This editor lives in an auto-height iframe. Keep its modal in the visible part of the parent page.
  function positionDialog(){
    const frame=window.frameElement;if(!frame)return;
    const rect=frame.getBoundingClientRect(),top=Math.max(0,-rect.top),bottom=Math.min(rect.height,parent.innerHeight-rect.top);
    if(bottom<=top)return;
    dlg.style.top=(top+(bottom-top)/2)+'px';dlg.style.bottom='auto';dlg.style.marginBlock='0';
    dlg.style.transform='translateY(-50%)';dlg.style.maxHeight=Math.max(80,bottom-top-24)+'px';
    dlg.style.setProperty('--gs-dialog-room',dlg.style.maxHeight);
  }
  if(window.frameElement){
    for(const type of ['resize','scroll'])listen(parent,type,()=>{if(dlg.open)positionDialog();});
  }
  function show(v,t,body){
    if(!dlg.open)trigger=root.contains(document.activeElement)?document.activeElement:null;
    view=v;dlg.classList.toggle('gs-preview',v.mode==='preview');get('dia-title').textContent=t;get('dia-body').innerHTML=body+'<div class="gs-error" id="gs-err" role="alert"></div>';
    positionDialog();if(!dlg.open)dlg.showModal();icons();
    const field=get('dia-body').querySelector('[data-autofocus]');if(field)field.focus();
  }
  function close(){if(dlg.open)dlg.close();view=null;}
  function error(t){get('err').textContent=t;}
  const cols=[
    ['title','사건명',172],['date','날짜',110],['body','내용',215],['importance','중요도',123],['type','유형',119],
    ['end','종료일',110],['image','이미지 주소',165],['actor','행위주체',153],['place','공간',133],['category','카테고리',145],['event','관련 사건',143],['remove','행 작업',78]
  ];
  function linkList(kind,owner,ownerKind='event',write=false){
    if(ownerKind==='package')return P().ids;
    const o=by(ownerKind,owner);
    if(ownerKind==='event'&&kind==='event')return P().relations.filter(r=>r.fromType==='event'&&r.fromId===owner&&r.toType==='event');
    if(ownerKind==='event'&&kind==='category'){
      if(!write)return P().links[owner]?.[kind]||[];
      const group=P().links[owner]??={};return group[kind]??=[];
    }
    if(!write)return o?.[kind]||[];
    const obj=record(ownerKind,owner);return obj[kind]??=[];
  }
  function tableCell(e,k){
    const val=esc(e[k]),attrs=' data-field="'+k+'" aria-label="'+esc((e.title||'새 사건')+' '+cols.find(c=>c[0]===k)[1])+'"';
    if(k==='remove')return btn('행 제외','remove-event',e.id,'aria-label="'+esc((e.title||'새 사건')+' 행 제외')+'"');
    if(linkLabels[k]){
      const ids=linkList(k,e.id).map(idOf),labels=ids.map(id=>title(k,id));
      const chips=ids.map((id,i)=>{
        const type=k==='category'?' data-wire-type="'+esc(by(k,id)?.kind)+'"':'';
        return '<span class="gs-chip"'+type+'>'+esc(labels[i])+'</span>';
      }).join('');
      return btn(chips||'<span class="gs-connect-prompt">＋ 연결</span>','links',e.id,'class="gs-cell-link" data-kind="'+k+'" aria-haspopup="dialog" aria-label="'+esc((e.title||'새 사건')+' '+linkLabels[k]+' 연결')+'" aria-description="'+esc(labels.join(', '))+'"');
    }
    if(k==='importance'||k==='type')return '<select'+attrs+'>'+opts(k==='importance'?importance:types,e[k])+'</select>';
    if(k!=='body'&&k!=='title')return '<input'+attrs+' value="'+val+'">';
    const field='<div class="gs-wrap-field" data-text="'+val+'"><textarea rows="1"'+attrs+(k==='title'?' placeholder="사건명"':'')+'>\n'+val+'</textarea></div>';
    if(k==='body')return field;
    return '<div class="gs-name-cell">'+field+btn(icon('link-2'),'links',e.id,'data-kind="actor" aria-label="'+esc((e.title||'새 사건')+' 연결 편집')+'"')+'</div>';
  }
  function table(){
    const ids=visibleIds();
    const t=get('sheet');t.innerHTML='<caption class="gs-sr">사건 입력 표</caption><colgroup>'+cols.map(c=>'<col style="width:'+c[2]+'px">').join('')+'</colgroup><thead><tr>'+cols.map(([key,label],i)=>'<th scope="col" data-col="'+key+'" class="'+(!i?'gs-sticky':'')+'">'+label+'</th>').join('')+'</tr></thead><tbody>'+ids.map(id=>{
      const e=by('event',id);return '<tr data-row="'+esc(id)+'">'+cols.map(([k],i)=>'<td class="'+(!i?'gs-sticky':'')+'">'+tableCell(e,k)+'</td>').join('')+'</tr>';
    }).join('')+'</tbody>';
    const empty=get('scroll').parentElement.querySelector('.gs-sheet-empty');empty?.remove();
    if(!ids.length)get('scroll').insertAdjacentHTML('afterend','<p class="gs-empty gs-sheet-empty">'+(categoryId?'이 카테고리에 연결된 사건이 없습니다.':'사건 행을 추가하거나 기존 사건을 가져오세요.')+'</p>');
  }
  function reviewRows(){
    const all=s.queue.filter(r=>r.pkg===s.active),done=filter==='done',rows=all.filter(r=>r.done===done);
    get('filters').innerHTML=all.length?[['pending','검토 대기'],['done','검토 완료']].map(([k,n])=>btn(n+' '+all.filter(r=>r.done===(k==='done')).length,'filter',k,'aria-pressed="'+(filter===k)+'"')).join(''):'<span>검토할 항목 없음</span>';
    get('queue').hidden=!all.length;
    get('queue').innerHTML=rows.length?rows.map(r=>'<div class="gs-qrow"><span class="gs-kind">'+icon(({actor:'users',place:'map-pin',category:'folder',event:'calendar-days'})[r.kind])+names[r.kind]+'</span><strong>'+esc(title(r.kind,r.id))+'</strong><small>'+esc((r.originKind==='package'?P().name:title(r.originKind,r.origin))+'에서 추가')+'</small>'+btn(done?'다시 열기':'정보 보완','review',r.id,'data-kind="'+esc(r.kind)+'"')+'</div>').join(''):'<p class="gs-empty">'+(done?'검토를 마친 항목이 없습니다.':'보완할 새 항목이 없습니다.')+'</p>';
  }
  let renderedShared='',renderedLocal='';
  function refreshLibrary(){
    const items=host.library(),state=host.libraryState(),directory=host.directory;
    const focused=document.activeElement?.closest('.gs-library-item')?.dataset.id;
    const rows=list=>list.map(p=>{
      const recent=p.id===directory.lastId,meta=[p.school,p.course].filter(Boolean).join(' · ');
      return btn('<span class="gs-book-icon">'+icon('book')+'</span><span class="gs-draft-title"><strong>'+esc(p.name)+'</strong>'+(recent?'<small>마지막으로 연 초안</small>':'')+'</span><span class="gs-draft-course">'+esc(meta)+'</span><span class="gs-row-arrow" aria-hidden="true">→</span>',
        'choose-package',p.id,'class="gs-library-item"'+(recent?' data-recent=""':''));
    }).join('');
    const shared=items.filter(p=>!p.local),local=items.filter(p=>p.local),isLocal=directory.group==='local';
    const message=state==='error'?'공동 초안 목록을 불러오지 못했습니다.':state==='loading'?'공동 초안을 불러오는 중입니다.':'함께 작성 중인 초안이 없습니다.';
    const nextStep=state==='ready'?'<p>새 패키지를 만든 뒤 ‘공동 초안으로 등록’을 누르면 여기에 표시됩니다.</p>':'';
    const sharedHtml=rows(shared)+(!shared.length||state==='error'?'<div class="gs-library-note" role="status"><div><strong>'+message+'</strong>'+nextStep+'</div>'+(state==='error'?btn('Google로 목록 열기','authenticate-list'):'')+'</div>':'');
    const localHtml=rows(local)||'<p class="gs-library-note">이 탭에서 시작한 개인 초안이 없습니다.</p>';
    if(sharedHtml!==renderedShared){get('library').innerHTML=sharedHtml;renderedShared=sharedHtml;}
    if(localHtml!==renderedLocal){get('local-library').innerHTML=localHtml;renderedLocal=localHtml;}
    get('library').hidden=isLocal;get('local-library').hidden=!isLocal;
    for(const b of get('start').querySelectorAll('[data-act=library-group]')){
      b.setAttribute('aria-pressed',String(b.dataset.id===directory.group));
      b.querySelector('span').textContent=b.dataset.id==='local'?local.length:state==='ready'||shared.length?shared.length:'';
    }
    const reload=get('start').querySelector('[data-act=reload-drafts]');reload.disabled=state==='loading';reload.hidden=isLocal;
    icons();
    if(focused)get('start').querySelector('.gs-library-item[data-id="'+CSS.escape(focused)+'"]')?.focus({preventScroll:true});
  }
  function draw(){
    const initial=host.empty();get('start').hidden=!initial;get('main').hidden=initial;if(initial)refreshLibrary();
    const p=P();get('course').textContent=[p.school,p.course].filter(Boolean).join(' · ');get('name').textContent=p.name||'새 패키지';
    get('origin').textContent=host.draft.cloud?'공동 초안 목록':'개인 초안 목록';get('location-name').textContent=get('name').textContent;
    const category=by('category',categoryId);
    if(!category)categoryId='';
    get('c-count').textContent=p.categories.length;get('e-count').textContent=visibleIds().length;
    get('event-heading').textContent=category?category.name+' · 사건':'사건';
    get('clear-category').hidden=!category;
    const edit=get('edit-selected');edit.hidden=!category;edit.dataset.id=categoryId;
    if(category)edit.setAttribute('aria-label',category.name+' 카테고리 편집');
    get('cats').innerHTML=Object.entries(cats).map(([k,n])=>'<div class="gs-cat-group" data-wire-type="'+k+'"><div class="gs-cat-head"><h3>'+n+'</h3>'+btn('＋','new-cat',k,'aria-label="'+n+' 추가"')+'</div>'+p.categories.filter(c=>c.kind===k).map(c=>btn('<span>'+esc(c.name)+'</span><small>'+p.ids.filter(id=>linkList('category',id).includes(c.id)).length+'건</small>','filter-category',c.id,'class="gs-cat-item" aria-pressed="'+(c.id===categoryId)+'"')).join('')+'</div>').join('');
    table();relationRows();reviewRows();icons();jumpState(tab);resetWires();
  }
  function jumpState(k){tab=k;root.querySelectorAll('[data-jump]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.jump===k)));}
  function scrollColumn(k){
    const sc=get('scroll'),th=get('sheet').querySelector('[data-col="'+k+'"]'),first=get('sheet').querySelector('th');
    sc.scrollLeft=k==='title'?0:sc.scrollLeft+th.getBoundingClientRect().left-sc.getBoundingClientRect().left-first.offsetWidth;
    jumpState(k);
  }
  function includeInSheet(id){
    if(!P().ids.includes(id))P().ids.push(id);
    if(categoryId&&!linkList('category',id).includes(categoryId))linkList('category',id,'event',true).push(categoryId);
  }
  function newEvent(name=''){
    const id=uid();s.over.event[id]={id,title:name,date:'',body:'',importance:'',type:'',end:'',image:''};
    includeInSheet(id);return id;
  }
  function afterChange(note){draw();persist();if(note)status(note);}
  function setCategory(id){
    categoryId=id;get('scroll').scrollTop=0;get('mobile-rows').scrollTop=0;draw();
  }
  function showRow(id){
    if(categoryId&&P().ids.includes(id)&&!linkList('category',id).includes(categoryId))setCategory('');
  }
  function focusRow(id){showRow(id);const input=get('sheet').querySelector('[data-row="'+CSS.escape(id)+'"] [data-field="title"]');if(input){input.focus({preventScroll:true});input.scrollIntoView({block:'nearest',inline:'nearest'});}}
  function field(label,key,val,choices,full=false){
    const a=' name="'+key+'" aria-label="'+esc(label)+'"';let control;
    if(choices==='area')control='<textarea rows="2"'+a+'>'+esc(val)+'</textarea>';
    else if(choices)control='<select'+a+'>'+opts(choices,val)+'</select>';
    else control='<input'+a+' value="'+esc(val)+'">';
    return '<label class="'+(full?'gs-full':'')+'">'+label+control+'</label>';
  }
  const fields=(rows)=>'<div class="gs-fields">'+rows.join('')+'</div>';
  const actions=(buttons)=>'<div class="gs-actions">'+buttons+'</div>';
  const primary='class="gs-primary"';
  const endpointTypes={event:'사건',category:'카테고리',actor:'행위주체'};
  const sideLabels={from:'출발 대상',to:'도착 대상'};
  const endpointType=type=>type==='event'||type==='category'?type:'actor';
  const endpointName=(r,side)=>title(endpointType(r[side+'Type']),r[side+'Id']);
  const pinned={from:null,to:null};
  function sameRelation(a,b){
    return a.id!==b.id&&a.kind===b.kind&&['from','to'].every(side=>
      endpointType(a[side+'Type'])===endpointType(b[side+'Type'])&&a[side+'Id']===b[side+'Id']);
  }
  function relationRows(){
    const all=P().relations,query=norm(get('rel-filter').value),groups=new Map();
    get('rel-count').textContent=all.length;
    const node=(side,type,id,span=1)=>btn('<small>'+endpointTypes[endpointType(type)]+'</small><span>'+esc(title(endpointType(type),id))+'</span><i aria-hidden="true"></i>',
      'wire-node',id,'class="gs-rel-node" data-rel-side="'+side+'" data-type="'+esc(type)+'" style="grid-row:span '+span+'" aria-label="'+esc(sideLabels[side]+' · '+title(endpointType(type),id))+'" aria-pressed="false"');
    for(const r of all){
      if(query&&![endpointName(r,'from'),endpointName(r,'to'),rels[r.kind]||r.kind,r.label].some(v=>norm(v).includes(query)))continue;
      const key=JSON.stringify([endpointType(r.fromType),r.fromId]);
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(r);
    }
    let html='';
    for(const side of ['from','to']){
      const ref=pinned[side];
      if(ref&&!by(ref.type,ref.id))pinned[side]=null;
    }
    if(pinned.from||pinned.to){
      html='<div class="gs-rel-group gs-rel-pinned">'+['from','to'].map(side=>pinned[side]?node(side,pinned[side].type,pinned[side].id):'').join('')+'</div>';
    }
    if(!all.length&&!query){
      const starters=[...P().ids.map(id=>({type:'event',id})),...P().categories.map(c=>({type:'category',id:c.id}))].slice(0,3);
      for(const {type,id} of starters)html+='<div class="gs-rel-group">'+node('from',type,id)+node('to',type,id)+'</div>';
    }
    for(const rows of groups.values()){
      const first=rows[0];
      html+='<div class="gs-rel-group">'+node('from',first.fromType,first.fromId,rows.length)+rows.map(r=>{
        const kind=rels[r.kind]||r.kind||'유형 선택',desc=endpointName(r,'from')+' → '+endpointName(r,'to')+' · '+kind;
        return '<div class="gs-rel-link">'+btn('<strong>'+esc(kind)+'</strong>'+(r.label?'<small>'+esc(r.label)+'</small>':''),'edit-relation',r.id,
          'class="gs-rel-tag" data-tone="'+esc(r.kind)+'" aria-label="'+esc(desc+' 관계 편집')+'"')+node('to',r.toType,r.toId)+'</div>';
      }).join('')+'</div>';
    }
    if(!groups.size&&(query||!html))html+='<p class="gs-empty">'+(query?'검색 결과가 없습니다.':'양쪽에서 대상을 찾아 첫 관계를 연결하세요.')+'</p>';
    get('rel-groups').innerHTML=html;relationWires.refresh();
  }
  function findWireNode(side,type='event'){
    show({mode:'wire-picker',side,type,edge:{}},sideLabels[side]+' 찾기',endpointPicker(side,type));
    relationOptions();get('rel-query').focus();
  }
  function endpointPicker(side,type){
    const choices=Object.entries(endpointTypes).map(([k,n])=>btn(n,'rel-type',k,'aria-pressed="'+(k===type)+'"')).join('');
    return '<div class="gs-choice" role="group" aria-label="'+sideLabels[side]+' 종류">'+choices+'</div>'+
      '<input id="gs-rel-query" type="search" aria-label="'+sideLabels[side]+' 검색" placeholder="'+searchHint[type]+'">'+
      searchArea('rel-options')+(type==='event'?'<p class="gs-muted">패키지 밖의 사건은 관계를 연결할 때 함께 담깁니다.</p>':'');
  }
  function wireDrop(original,from,to){
    if(from.id===to.id&&endpointType(from.type)===endpointType(to.type)){status('서로 다른 대상을 연결하세요.');return;}
    const edge={id:uid(),kind:'',label:'',source:'',...original,fromType:from.type,fromId:from.id,toType:to.type,toId:to.id};
    if(!original){relationForm({mode:'relation',edge,existing:false,side:'',type:'event'});dlg.querySelector('[data-act=rel-kind]').focus();return;}
    if(P().relations.some(r=>sameRelation(r,edge))){status('같은 방향과 유형으로 연결한 관계가 있습니다.');return;}
    Object.assign(original,edge);finishRelationEdit(edge,'연결 대상을 옮겼습니다.');
  }
  function removeRelation(id){
    P().relations=P().relations.filter(r=>r.id!==id);afterChange('관계를 해제했습니다.');
  }
  function finishRelationEdit(edge,message){
    for(const side of ['from','to']){
      const id=edge[side+'Id'],type=endpointType(edge[side+'Type']);
      if(type==='event'&&!P().ids.includes(id))P().ids.push(id);
      if(pinned[side]?.id===id&&pinned[side].type===type)pinned[side]=null;
    }
    afterChange(message);
    const list=get('rel-list'),selector='[data-act="edit-relation"][data-id="'+CSS.escape(edge.id)+'"]';
    if(!list.querySelector(selector)&&get('rel-filter').value){get('rel-filter').value='';relationRows();}
    const row=list.querySelector(selector);
    if(row){list.scrollTop+=row.getBoundingClientRect().top-list.getBoundingClientRect().top-list.clientHeight/2+row.offsetHeight/2;row.focus({preventScroll:true});}
    else get('relations').querySelector('[data-act=add-relation]').focus({preventScroll:true});
  }
  function editRelation(id){
    const existing=P().relations.find(r=>r.id===id);
    const edge=existing?{...existing}:{id:uid(),fromType:'event',fromId:'',toType:'event',toId:'',kind:'',label:'',source:''};
    relationForm({mode:'relation',edge,existing:!!existing,side:existing?'':'from',type:endpointType(edge.fromType)});
  }
  function relationForm(v){
    const r=v.edge;
    const endpoint=side=>btn('<small>'+sideLabels[side]+'</small><strong>'+esc(r[side+'Id']?endpointName(r,side):'선택하세요')+'</strong>'+
      (r[side+'Id']&&r[side+'Type']==='event'&&!P().ids.includes(r[side+'Id'])?'<small>연결 시 패키지에 추가</small>':''),
      'rel-side',side,'class="gs-rel-end" aria-expanded="'+(v.side===side)+'"');
    const pair='<div class="gs-rel-pair">'+endpoint('from')+'<span aria-hidden="true">→</span>'+endpoint('to')+'</div>';
    const picker=v.side?'<div class="gs-rel-picker">'+endpointPicker(v.side,v.type)+'</div>':'';
    const kinds=Object.entries(rels).map(([k,n])=>btn(n,'rel-kind',k,'aria-pressed="'+(k===r.kind)+'"')).join('');
    const buttons=(v.existing?btn('관계 해제','delete-relation','','class="gs-rel-delete"'):'')+
      btn(v.existing?'수정 저장':'관계 추가','save-relation','',primary+(!r.fromId||!r.toId||!r.kind?' disabled':''));
    show(v,v.existing?'관계 편집':'관계 추가',pair+picker+'<div class="gs-rel-kinds"><h3>관계 유형</h3><div class="gs-choice" role="group" aria-label="관계 유형">'+kinds+'</div></div>'+
      fields([field('관계 이름','label',r.label),field('출처','source',r.source)])+actions(buttons));
    if(v.side){relationOptions();get('rel-query').focus();}
  }
  function relationOptions(resetScroll=false){
    const {edge,type,side}=view,other=side==='from'?'to':'from',query=norm(get('rel-query').value);
    const excluded=edge[other+'Id']&&type===endpointType(edge[other+'Type'])?edge[other+'Id']:null;
    const {matches,summary}=searchRecords(type,query,excluded);
    const options=matches.map(item=>{
      const name=item.name||item.title||'이름 미입력';
      const detail=searchDetail(type,item);
      const membership=type==='event'&&P().ids.includes(item.id)?'이 패키지에 담김':'';
      const selected=item.id===edge[side+'Id']&&type===endpointType(edge[side+'Type']);
      return btn('<span>'+esc(name)+'</span><small>'+esc([detail,membership].filter(Boolean).join(' · '))+'</small>','rel-pick',item.id,'aria-pressed="'+selected+'"');
    }).join('');
    fillResults('rel-options',summary,options,resetScroll);
  }
  function saveRelation(){
    const {edge,existing}=view;
    if(P().relations.some(r=>sameRelation(r,edge))){error('같은 방향과 유형으로 연결한 관계가 있습니다.');return;}
    if(existing)Object.assign(P().relations.find(r=>r.id===edge.id),edge);
    else P().relations.push(edge);
    trigger=null;close();finishRelationEdit(edge,existing?'관계를 수정했습니다.':'관계를 추가했습니다.');
  }
  function packageForm(edit=false){const p=edit?P():{};
    show({mode:'package',edit},edit?'패키지 편집':'새 패키지',fields([field('패키지명','name',p.name,null,true),field('학교급','school',p.school),field('과목','course',p.course),field('설명','description',p.description,'area',true)])+actions(btn(edit?'저장':'이 패키지로 시작','save-package','',primary)));get('dia-body').querySelector('[name=name]').focus();}
  function catForm(kind,id){const c=id?by('category',id):{kind};
    const group=Object.entries(cats).map(([k,n])=>btn(n,'cat-kind',k,'aria-pressed="'+(k===kind)+'"')).join('');
    const spaceNames=id?linkList('place',id,'category').map(x=>title('place',x)).join(', '):'';
    show({mode:'cat',kind,id},id?'카테고리 편집':cats[kind]+' 추가','<div class="gs-choice" aria-label="카테고리 종류">'+group+'</div>'+fields([field('카테고리명','name',c.name,null,true),field('시작일','start',c.start),field('종료일','end',c.end),field('설명','body',c.body,'area',true)])+(spaceNames?'<p class="gs-muted">관련 공간 · '+esc(spaceNames)+'</p>':'')+actions(btn('저장 후 공간 연결','save-cat-place')+btn('저장','save-cat','',primary)));get('dia-body').querySelector('[name=name]').focus();
  }
  function values(){return Object.fromEntries([...get('dia-body').querySelectorAll('[name]')].map(el=>[el.name,el.value.trim()]));}
  function dateString(value){try{return !value||Boolean(SheetData.dateRange(value));}catch{return false;}}
  function dateError(data){
    const start=data.start||data.date,end=data.end;
    if(!dateString(start)||!dateString(end))return '날짜를 연도, 연월, 연월일로 적어 주세요.';
    return start&&end&&SheetData.dateRange(start).start>SheetData.dateRange(end).end?'종료일이 시작일보다 앞섭니다.':'';
  }
  function eventIssue(event){
    if(!event.title?.trim())return ['title','사건명을 입력해 주세요.'];
    if(!event.date?.trim())return ['date','사건 날짜를 입력해 주세요.'];
    const issue=dateError(event);
    if(issue)return [dateString(event.date)?'end':'date',issue];
    for(const address of (event.image||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean)){
      try{if(['http:','https:'].includes(new URL(address).protocol))continue;}catch{}
      return ['image','이미지는 http 또는 https 주소를 한 줄에 하나씩 입력해 주세요.'];
    }
  }
  function focusCell(id,key){
    showRow(id);
    const input=get('sheet').querySelector('[data-row="'+CSS.escape(id)+'"] [data-field="'+CSS.escape(key)+'"]');
    if(input){scrollColumn(['end','image'].includes(key)?'end':'title');input.focus();input.scrollIntoView({block:'nearest',inline:'nearest'});}
    return input;
  }
  function validateForPublish(){
    const p=P();
    for(const [key,label] of [['name','패키지명'],['school','학교급'],['course','과목'],['description','설명']]){
      if(p[key]?.trim())continue;
      packageForm(true);error(label+'을 입력해 주세요.');
      dlg.querySelector('[name="'+key+'"]').focus();return false;
    }
    const pending=s.queue.find(r=>r.pkg===p.id&&!r.done);
    if(pending){review(pending.kind,pending.id);error('이 항목을 검토한 뒤 업로드해 주세요.');return false;}
    if(!p.ids.length){const add=get('main').querySelector('[data-act=add-event]');add.focus();status('업로드할 사건을 한 행 이상 입력해 주세요.');return false;}
    for(const id of p.ids){
      const issue=eventIssue(by('event',id));
      if(!issue)continue;
      const cell=focusCell(id,issue[0]);cell.setCustomValidity(issue[1]);cell.reportValidity();return false;
    }
    const relation=p.relations.find(r=>!r.kind);
    if(relation){
      if(relation.fromType==='event'&&relation.toType==='event'){
        finder(relation.fromId,'event','event');
        dlg.querySelector('[data-role="'+CSS.escape(relation.id)+'"]')?.focus();
      }else{
        editRelation(relation.id);
      }
      error('관계유형을 선택해 주세요.');return false;
    }
    return true;
  }
  function preview(mode='list',category=''){
    const d=host.draft,events=d.events.filter(e=>e.title?.trim()&&e.date&&dateString(e.date)&&!dateError(e));
    const modes='<div class="gs-choice" aria-label="미리보기 방식">'+[['list','사건 목록'],['lanes','스윔레인']].map(([key,label])=>btn(label,'preview-mode',key,'aria-pressed="'+(key===mode)+'"')).join('')+'</div>';
    let body='';
    if(!events.length)body='<p class="gs-empty">날짜와 사건명을 입력하면 연표가 표시됩니다.</p>';
    else if(mode==='lanes')body='<div id="gs-preview-lanes"></div>';
    else{
      const groups=P().categories,rows=events.filter(e=>!category||linkList('category',e.id).includes(category)).sort((a,b)=>a.date.localeCompare(b.date));
      if(groups.length)body='<label class="gs-preview-filter">카테고리 <select data-preview-category><option value="">전체</option>'+groups.map(g=>'<option value="'+esc(g.id)+'" '+(category===g.id?'selected':'')+'>'+esc(g.name)+'</option>').join('')+'</select></label>';
      body+=rows.length?'<ol class="gs-preview-list">'+rows.map(e=>'<li><time>'+esc([e.date,e.end].filter(Boolean).join(' – '))+'</time><strong>'+esc(e.title)+'</strong>'+(e.body?'<p>'+esc(e.body)+'</p>':'')+'</li>').join('')+'</ol>':'<p class="gs-empty">이 카테고리에 연결된 사건이 없습니다.</p>';
    }
    const footer='<footer class="gs-publish-footer"><span>패키지 전체 · 사건 '+P().ids.length+'건</span>'+btn('패키지 업로드','finish','',primary)+'</footer>';
    show({mode:'preview',layout:mode,category},d.name+' · 최종 미리보기',modes+body+footer);
    if(mode==='lanes'&&events.length){
      const frame=document.createElement('iframe');
      frame.title=d.name+' 스윔레인';frame.dataset.packageDraft='';
      const placeNames=ids=>(ids||[]).map(id=>title('place',id)).join(', ');
      const categories=d.categories.map(c=>({...c,place:placeNames(c.spaceIds),start:dateString(c.start)?c.start:'',end:dateString(c.end)?c.end:''}));
      const items=events.map(e=>{
        const groups=linkList('category',e.id).map(id=>by('category',id)),names=kind=>groups.filter(c=>c.kind===kind).map(c=>c.name);
        return {...e,place:placeNames(e.spaceIds),periodNames:names('period'),arcs:names('arc'),themes:names('theme'),actors:e.participants.map(a=>({...a,name:title('actor',a.id)}))};
      });
      const actors=d.actors.filter(a=>d.relations.some(r=>r.fromId===a.id||r.toId===a.id));
      const labels=new Map([...items,...categories,...actors].map(r=>[r.id,r.title||r.name]));
      const relations=d.relations.filter(r=>labels.has(r.fromId)&&labels.has(r.toId)).map(r=>({...r,fromName:labels.get(r.fromId),toName:labels.get(r.toId)}));
      frame.lessonSwimlane={name:d.name,events:items,categories,periods:categories.filter(c=>c.kind==='period'&&(c.start||c.end)),actors,detailActors:d.actors,relations};
      frame.draftGeography=previewMaps().then(maps=>{
        const known=new Map(maps.공간.map(r=>[r.공간ID,r]));
        for(const place of objects('place'))known.set(place.id,{...known.get(place.id),공간ID:place.id,공간명:place.name,공간유형:place.kind,상위공간ID:place.parent});
        return {공간:[...known.values()],지도도형:maps.지도도형};
      });
      frame.src='./swimlane-focus.html?embedded';get('preview-lanes').append(frame);
    }
  }
  function finder(owner,ownerKind,kind,q='',newKind='theme'){
    const isPkg=ownerKind==='package', isParent=ownerKind==='place', group=ownerKind==='event';
    const tabs=group?'<div class="gs-choice" aria-label="연결할 항목">'+Object.keys(linkLabels).map(k=>btn(linkLabels[k],'link-tab',k,'aria-pressed="'+(k===kind)+'"')).join('')+'</div>':'';
    const caption=isPkg?'기존 사건 찾기':isParent?'상위 공간 선택':title(ownerKind,owner)+' · 연결';
    show({mode:'finder',owner,ownerKind,kind,q,newKind},caption,tabs+'<div id="gs-chosen" class="gs-links"></div><input type="search" data-search data-autofocus aria-label="'+names[kind]+' 검색" placeholder="'+searchHint[kind]+'" value="'+esc(q)+'">'+searchArea('results')+'<div id="gs-create-options"></div>'+actions(btn('완료','close','',primary)));
    chosen();results();
  }
  function choices(v){if(v.ownerKind==='package')return visibleIds();if(v.ownerKind==='place'){const id=by('place',v.owner).parent;return id?[id]:[];}return linkList(v.kind,v.owner,v.ownerKind);}
  function chosen(){
    const v=view;if(v.mode!=='finder')return;
    const wrap=get('chosen'),xs=choices(v);
    if(v.ownerKind==='package'){wrap.innerHTML='';return;}
    wrap.innerHTML=xs.map(item=>{
      const id=idOf(item), role=v.kind==='actor'?roles:v.kind==='event'?rels:null;
      const key=v.kind==='event'?item.id:id;
      const select=role?'<select aria-label="'+esc(title(v.kind,id))+' '+(v.kind==='actor'?'역할':'관계유형')+'" data-role="'+esc(key)+'">'+opts(role,v.kind==='event'?item.kind:item.role)+'</select>':'';
      const line=v.kind==='event'?'<input data-evidence="'+esc(key)+'" aria-label="'+esc(title(v.kind,id))+' 관계 출처" value="'+esc(item.source)+'" placeholder="관계 출처">':'';
      return '<div class="gs-chosen"><span>'+esc((v.kind==='event'?'→ ':'')+title(v.kind,id))+'</span>'+select+line+btn('×','unlink',key,'aria-label="'+esc(title(v.kind,id))+' 연결 해제"')+'</div>';
    }).join('');
  }
  function wouldCycle(owner,id){const seen=new Set([owner]);let next=id;while(next){if(seen.has(next))return true;seen.add(next);next=by('place',next)?.parent;}return false;}
  function results(resetScroll=false){
    const v=view,k=v.kind,q=norm(v.q);
    const assigned=new Set(choices(v).map(idOf));
    const {matches,summary}=searchRecords(k,q,v.ownerKind===k?v.owner:null,assigned);
    const exact=objects(k).some(r=>norm(r.name||r.title)===q&&(k!=='category'||r.kind===v.newKind));
    const html=matches.map(r=>{const used=assigned.has(r.id),sub=searchDetail(k,r);
      const label=used?'연결됨':v.ownerKind==='package'?(categoryId?'카테고리에 담기':'패키지에 담기'):k==='event'&&!P().ids.includes(r.id)?'담고 연결':'연결';
      return '<div class="gs-result"><span>'+esc(r.name||r.title||'이름 미입력')+'<small>'+esc(sub)+'</small></span>'+btn(label,'pick',r.id,used?'disabled':'')+'</div>';}).join('');
    fillResults('results',summary,html,resetScroll);
    let create='';
    if(q&&k==='category')create='<div class="gs-choice gs-find-new">추가할 종류 '+Object.entries(cats).map(([key,n])=>btn(n,'create-kind',key,'aria-pressed="'+(key===v.newKind)+'"')).join('')+'</div>';
    if(q&&!exact)create+='<div class="gs-find-new">'+btn('＋ ‘'+esc(v.q.trim())+'’ '+names[k]+' 시트에 추가','create-ref','',primary)+'</div>';
    get('create-options').innerHTML=create;
  }
  function addLink(id){
    const v=view,k=v.kind;
    if(v.ownerKind==='place'){if(wouldCycle(v.owner,id)){error('상위 공간이 순환하지 않도록 다른 공간을 고르세요.');return false;}record('place',v.owner).parent=id;return true;}
    if(v.ownerKind==='package'){includeInSheet(id);return true;}
    const list=linkList(k,v.owner,v.ownerKind,true);
    if(list.some(x=>idOf(x)===id))return true;
    if(k==='event'){if(!P().ids.includes(id))P().ids.push(id);P().relations.push({id:uid(),fromType:'event',fromId:v.owner,toType:'event',toId:id,kind:'',label:'',source:''});}
    else list.push(k==='actor'?{id,role:''}:id);
    return true;
  }
  function createRef(){
    const v=view,k=v.kind,name=v.q.trim();if(!name)return;
    const existing=objects(k).find(r=>norm(r.name||r.title)===norm(name)&&(k!=='category'||r.kind===v.newKind));
    if(existing){if(addLink(existing.id))updateFinder();return;}
    const id=uid();
    if(k==='category')P().categories.push({id,name,kind:v.newKind});
    else if(k==='event')s.over.event[id]={id,title:name,date:'',body:'',type:'',importance:'',end:'',image:''};
    else s.over[k][id]={id,name,kind:''};
    if(!addLink(id))return;
    s.queue.push({id,kind:k,pkg:P().id,origin:v.owner,originKind:v.ownerKind,done:false});
    filter='pending';updateFinder();status('‘'+name+'’ 항목을 '+names[k]+' 시트에 추가하고 연결했습니다.');
  }
  function updateFinder(){chosen();results();draw();persist();}
  function unlink(id){
    const v=view;if(v.ownerKind==='place')record('place',v.owner).parent='';
    else if(v.kind==='event')P().relations=P().relations.filter(r=>r.id!==id);
    else{const list=linkList(v.kind,v.owner,v.ownerKind,true),i=list.findIndex(x=>idOf(x)===id);if(i>=0)list.splice(i,1);}
    updateFinder();
  }
  function review(kind,id){
    const r=by(kind,id),row=s.queue.find(x=>x.kind===kind&&x.id===id&&x.pkg===s.active);
    if(!r||!row)return;
    let fs=[];let extra='';
    if(kind==='actor')fs=[field('주체명','name',r.name),field('주체 구분','kind',r.kind,actors),field('원어명','original',r.original),field('출처','source',r.source),field('존속 시작일','start',r.start),field('존속 종료일','end',r.end),field('소개','body',r.body,'area',true)];
    if(kind==='place')fs=[field('공간명','name',r.name),field('공간유형','kind',r.kind,places),field('시대별 명칭','alias',r.alias),field('설명','body',r.body,'area',true)];
    if(kind==='actor'||kind==='place'){
      const parent=kind==='place'&&r.parent?title('place',r.parent):'',label=kind==='place'?'상위 공간':'관련 공간';
      extra='<div class="gs-result"><span>'+label+(parent?' · '+esc(parent):'')+(kind==='actor'&&r.place?.length?' · '+esc(r.place.map(x=>title('place',x)).join(', ')):'')+'</span>'+btn('저장 후 선택','review-place')+'</div>';
    }
    if(kind==='category')fs=[field('카테고리명','name',r.name),field('종류','kind',r.kind,cats),field('시작일','start',r.start),field('종료일','end',r.end),field('설명','body',r.body,'area',true)];
    if(kind==='event')fs=[field('사건명','title',r.title,null,true),field('날짜','date',r.date),field('종료일','end',r.end),field('중요도','importance',r.importance,importance),field('유형','type',r.type,types),field('내용','body',r.body,'area',true),field('이미지 주소','image',r.image)];
    show({mode:'review',kind,id},title(kind,id)+' · '+names[kind]+' 정보',fields(fs)+extra+actions(btn('보완 저장','save-review')+btn('검토 완료','finish-review','',primary)));
  }
  function saveReview(finish,openPlace=false){
    const {kind,id}=view,data=values();
    if(!(data.name||data.title)){error('이름을 입력해 주세요.');return;}
    if(objects(kind).some(r=>r.id!==id&&norm(r.name||r.title)===norm(data.name||data.title)&&(kind!=='category'||r.kind===data.kind))){error('같은 이름의 항목이 있습니다. 이름을 확인해 주세요.');return;}
    if(dateError(data)){error(dateError(data));return;}
    if(finish&&((kind==='actor'||kind==='place')&&!data.kind||kind==='event'&&!data.date)){error(kind==='event'?'사건 날짜를 입력해 주세요.':'종류를 선택해 주세요.');return;}
    Object.assign(record(kind,id),data);
    const row=s.queue.find(x=>x.pkg===s.active&&x.kind===kind&&x.id===id);row.done=finish;
    if(!finish)filter='pending';
    afterChange(finish?'검토 완료로 옮겼습니다.':'추가 정보를 저장했습니다.');
    if(openPlace)finder(id,kind,'place');else close();
  }
  function saveCat(connect){
    const v=view,data=values(),p=P();if(!data.name){error('카테고리명을 입력해 주세요.');return;}
    if(p.categories.some(c=>c.id!==v.id&&c.kind===v.kind&&norm(c.name)===norm(data.name))){error('이 종류에 같은 이름이 있습니다.');return;}
    if(dateError(data)){error(dateError(data));return;}
    const id=v.id||uid(),obj=v.id?by('category',id):{id};Object.assign(obj,data,{kind:v.kind});
    if(!v.id)p.categories.push(obj);afterChange('카테고리를 저장했습니다.');if(connect)finder(id,'category','place');else close();
  }
  const writable=(id,k,val)=>{record('event',id)[k]=val;};
  root.addEventListener('click',ev=>{
    const b=ev.target.closest('button');if(!b||b.disabled)return;
    const {act,id,kind,jump}=b.dataset;if(jump){scrollColumn(jump);return;}
    switch(act){
      case 'packages':host.open(null);break;
      case 'library-group':host.directory.group=id;refreshLibrary();break;
      case 'reload-drafts':case 'authenticate-list':void host.refresh(act==='authenticate-list');break;
      case 'filter-category':case 'clear-category':{
        const previous=categoryId;setCategory(act==='clear-category'||id===categoryId?'':id);
        get('cats').querySelector('[data-id="'+CSS.escape(id||previous)+'"].gs-cat-item')?.focus({preventScroll:true});
        break;
      }
      case 'edit-package':packageForm(true);break;
      case 'new-package':packageForm();break;
      case 'choose-package':if(id!==P().id){close();host.open(id);}else close();break;
      case 'preview':preview();break;
      case 'preview-mode':preview(id,view.category);break;
      case 'finish':trigger=null;close();void host.publish();break;
      case 'add-relation':case 'edit-relation':editRelation(id);break;
      case 'rel-side':
        view.side=view.side===id?'':id;view.type=endpointType(view.edge[id+'Type']);relationForm(view);
        if(!view.side)dlg.querySelector('[data-act=rel-side][data-id="'+id+'"]').focus();
        break;
      case 'find-wire-node':findWireNode(id);break;
      case 'rel-type':if(view.mode==='wire-picker')findWireNode(view.side,id);else{view.type=id;relationForm(view);}break;
      case 'rel-pick':{
        if(view.mode==='wire-picker'){
          const side=view.side;
          pinned[side]={type:view.type,id};trigger=null;close();relationRows();get('rel-list').scrollTop=0;
          get('rel-groups').querySelector('.gs-rel-pinned [data-rel-side="'+side+'"]').focus({preventScroll:true});break;
        }
        const side=view.side,r=view.edge;
        r[side+'Type']=view.type;r[side+'Id']=id;
        view.side=side==='from'&&!r.toId?'to':'';
        view.type=endpointType(r.toType);relationForm(view);
        if(!view.side)(dlg.querySelector('[data-act=rel-kind][aria-pressed=true]')||dlg.querySelector('[data-act=rel-kind]')).focus();
        break;
      }
      case 'rel-kind':
        view.edge.kind=id;view.side='';relationForm(view);
        dlg.querySelector('[data-act=rel-kind][aria-pressed=true]').focus();break;
      case 'save-relation':saveRelation();break;
      case 'delete-relation':{
        const r=view.edge;
        if(!confirm(endpointName(r,'from')+' → '+endpointName(r,'to')+' 관계를 해제할까요?'))break;
        close();removeRelation(r.id);get('relations').querySelector('[data-act=add-relation]').focus({preventScroll:true});break;
      }
      case 'save-package':{
        const d=values();if(!d.name){error('패키지명을 입력해 주세요.');return;}
        if(host.packageNames().some(p=>p.id!==(view.edit?s.active:null)&&norm(p.name)===norm(d.name))){error('같은 이름의 패키지가 있습니다.');return;}
        if(view.edit){Object.assign(P(),d);close();afterChange('패키지 정보를 수정했습니다.');}else{close();host.create(d);}break;
      }
      case 'new-cat':catForm(id);break;
      case 'edit-cat':catForm(by('category',id).kind,id);break;
      case 'cat-kind':view.kind=id;get('dia-body').querySelectorAll('[data-act="cat-kind"]').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));break;
      case 'save-cat':case 'save-cat-place':saveCat(act==='save-cat-place');break;
      case 'add-event':{const k=newEvent();afterChange();scrollColumn('title');focusRow(k);break;}
      case 'remove-event':{
        if(!confirm((title('event',id)||'이 사건')+'을 이 패키지에서 제외할까요?'))break;
        const p=P();p.ids=p.ids.filter(key=>key!==id);delete p.links[id];
        p.relations=p.relations.filter(r=>!(r.fromType==='event'&&r.fromId===id||r.toType==='event'&&r.toId===id));
        s.queue=s.queue.filter(r=>!(r.kind==='event'&&r.id===id));
        afterChange('패키지에서 사건을 제외했습니다.');break;
      }
      case 'reuse-event':finder(P().id,'package','event');break;
      case 'links':finder(id,'event',kind);break;
      case 'link-tab':finder(view.owner,view.ownerKind,id);break;
      case 'create-kind':view.newKind=id;results();break;
      case 'pick':if(addLink(id)){updateFinder();status('기존 '+names[view.kind]+' 항목을 연결했습니다.');}break;
      case 'create-ref':createRef();break;
      case 'unlink':unlink(id);break;
      case 'filter':filter=id;reviewRows();icons();break;
      case 'review':review(kind,id);break;
      case 'save-review':case 'finish-review':case 'review-place':saveReview(act==='finish-review',act==='review-place');break;
      case 'close':close();break;
    }
  });
  root.addEventListener('input',ev=>{
    const t=ev.target;if(t.matches('[data-search]')){view.q=t.value;results(true);return;}
    if(t===get('rel-filter')){relationRows();return;}
    if(t===get('rel-query')){relationOptions(true);return;}
    if(view?.mode==='relation'&&['label','source'].includes(t.name)){view.edge[t.name]=t.value;return;}
    if(t.matches('[data-evidence]')){const edge=P().relations.find(r=>r.id===t.dataset.evidence);if(edge){edge.source=t.value;later();}return;}
    if(t.matches('[data-field]')){
      if(t.matches('textarea'))t.parentElement.dataset.text=t.value;
      t.setCustomValidity('');writable(t.closest('tr').dataset.row,t.dataset.field,t.value);later();
    }
  });
  root.addEventListener('change',ev=>{
    const t=ev.target;
    if(t.matches('[data-preview-category]')){preview('list',t.value);dlg.querySelector('[data-preview-category]').focus();return;}
    if(t.matches('[data-role]')){
      const item=choices(view).find(r=>r.id===t.dataset.role);if(!item)return;
      if(view.kind==='event'){
        if(P().relations.some(r=>sameRelation(r,{...item,kind:t.value}))){t.value=item.kind;error('같은 방향과 유형으로 연결한 관계가 있습니다.');return;}
        item.kind=t.value;relationRows();error('');
      }else item.role=t.value;
      persist();return;
    }
    if(t.matches('[data-field]')){const id=t.closest('tr').dataset.row;writable(id,t.dataset.field,t.value);persist();
      if(t.dataset.field==='date'||t.dataset.field==='end'){const n=host.normalizeDate(t.value);t.value=n;writable(id,t.dataset.field,n);persist();}
      if(t.dataset.field==='title'){
        const row=t.closest('tr'), name=t.value.trim()||'새 사건';
        row.querySelectorAll('[data-field]').forEach(input=>input.setAttribute('aria-label',name+' '+cols.find(c=>c[0]===input.dataset.field)[1]));
        row.querySelector('.gs-name-cell button').setAttribute('aria-label',name+' 연결 편집');
        row.querySelectorAll('.gs-cell-link').forEach(b=>b.setAttribute('aria-label',name+' '+linkLabels[b.dataset.kind]+' 연결'));
        resetWires();
        relationRows();reviewRows();icons();
      }
      if(['date','end'].includes(t.dataset.field))status(dateError(by('event',id))||'');}
  });
  root.addEventListener('paste',ev=>{
    const t=ev.target;if(!t.matches('[data-field]'))return;
    const text=ev.clipboardData?.getData('text/plain');if(!text||!/[\t\r\n]/.test(text))return;
    ev.preventDefault();
    const ids=visibleIds(),r0=ids.indexOf(t.closest('tr').dataset.row),c0=cols.findIndex(c=>c[0]===t.dataset.field);
    const rows=text.replace(/\r\n?/g,'\n').replace(/\n$/,'').split('\n').map(r=>r.split('\t'));
    const changes=[];for(let i=0;i<rows.length;i++){for(let j=0;j<rows[i].length;j++){
      const k=cols[c0+j]?.[0];let val=rows[i][j].trim();if(!k||linkLabels[k]||k==='remove'){status('연결 열은 이름 검색으로 입력하세요. 붙여넣을 범위를 확인해 주세요.');return;}
      const options=k==='importance'?importance:k==='type'?types:null;
      if(val&&options){const code=Object.keys(options).find(c=>c===val||options[c]===val);if(!code){status('붙여넣은 '+cols[c0+j][1]+' 값을 확인해 주세요.');return;}val=code;}
      changes.push([i,k,val]);
    }}
    while(ids.length<r0+rows.length)ids.push(newEvent());
    for(const [i,k,val] of changes)writable(ids[r0+i],k,val);
    afterChange(rows.length+'행에 붙여넣었습니다.');focusRow(ids[r0]);
  });
  root.addEventListener('keydown',ev=>{
    const t=ev.target;
    if(ev.isComposing||!t.matches('[data-field]')||ev.key!=='Enter'||ev.shiftKey||ev.ctrlKey||ev.metaKey)return;
    ev.preventDefault();const ids=visibleIds(),idx=ids.indexOf(t.closest('tr').dataset.row),key=t.dataset.field;
    let next=ids[idx+1];
    if(!next){next=newEvent();afterChange();}
    const input=get('sheet').querySelector('[data-row="'+CSS.escape(next)+'"] [data-field="'+key+'"]');
    input?.focus();

  });
  dlg.addEventListener('close',()=>{if(dlg.open)return;get('dia-body').replaceChildren();view=null;if(trigger?.isConnected)trigger.focus({preventScroll:true});trigger=null;});
  const lane=get('wires'), edgeLayer=get('edges'), portLayer=get('ports'), bin=get('wire-bin');
  const wireHelp='양쪽 점을 이어 연결하고, 선을 끌어 옮기세요.';
  let points={category:new Map(),event:new Map()}, selection=null, hoverItem=null, drag=null, frame=0;
  const edge=(category,event)=>({category,event});
  const full=item=>Boolean(item?.category&&item?.event);
  const sameEdge=(a,b)=>Boolean(a&&b&&a.category===b.category&&a.event===b.event);
  const labelEdge=e=>title('category',e.category)+' ↔ '+title('event',e.event);
  function portButton(side,id,kind){
    return '<button type="button" class="gs-port" data-side="'+side+'" data-id="'+esc(id)+'" data-wire-type="'+esc(kind||'')+'" aria-label="'+esc(title(side,id))+' '+(side==='category'?'카테고리':'사건')+' 연결점" aria-pressed="false"></button>';
  }
  function resetWires(){
    cancelDrag();selection=null;hoverItem=null;
    const p=P();
    portLayer.innerHTML=p.categories.map(c=>portButton('category',c.id,c.kind)).join('')+visibleIds().map(id=>portButton('event',id)).join('');
    get('mobile-rows').innerHTML=visibleIds().map(id=>btn(esc(title('event',id)),'jump-event',id)).join('');
    scheduleWires();
  }
  function scheduleWires(){if(!frame)frame=requestAnimationFrame(layoutWires);}
  function curve(a,b){const mid=(a.x+b.x)/2;return 'M'+a.x+','+a.y+' C'+mid+','+a.y+' '+mid+','+b.y+' '+b.x+','+b.y;}
  function layoutWires(){
    frame=0;
    const rect=lane.getBoundingClientRect(),compact=get('mobile-events').getBoundingClientRect().width>0;
    const cats=root.querySelectorAll('.gs-cat-item'), events=compact?get('mobile-rows').children:get('sheet').tBodies[0].rows;
    const categoryBox=get('cats').getBoundingClientRect();
    const eventBox=(compact?get('mobile-rows'):get('scroll')).getBoundingClientRect();
    const eventTop=eventBox.top+(compact?0:get('sheet').tHead.offsetHeight);
    const controls=new Map(Array.from(portLayer.children,p=>[p.dataset.side+':'+p.dataset.id,p]));
    points={category:new Map(),event:new Map()};
    // Measure both scroll panes before moving ports so scrolling needs only one layout pass.
    const centers=elements=>Array.from(elements,el=>{
      const box=el.getBoundingClientRect();return [el,box.top+box.height/2];
    });
    const categoryCenters=centers(cats),eventCenters=centers(events);
    function anchor(side,id,el,center,x,top,bottom){
      const port=controls.get(side+':'+id);if(!port)return;
      const hidden=center<top||center>bottom;
      if(port.hidden!==hidden)port.hidden=hidden;
      port.classList.remove('gs-linked');
      if(hidden){el.classList.remove('gs-wire-active');return;}
      const y=center-rect.top;
      port.style.left=x+'px';port.style.top=y+'px';points[side].set(id,{x,y,el,port});
    }
    for(const [el,center] of categoryCenters)anchor('category',el.dataset.id,el,center,9,categoryBox.top,categoryBox.bottom);
    for(const [el,center] of eventCenters)anchor('event',compact?el.dataset.id:el.dataset.row,el,center,rect.width-9,eventTop,eventBox.bottom);
    const paths=[];
    for(const [ev,to] of points.event){
      for(const cat of linkList('category',ev)){
        const from=points.category.get(cat);if(!from)continue;
        const d=curve(from,to);from.port.classList.add('gs-linked');to.port.classList.add('gs-linked');
        paths.push('<g class="gs-wire-edge" data-cat="'+esc(cat)+'" data-ev="'+esc(ev)+'" data-wire-type="'+esc(by('category',cat).kind)+'"><path class="gs-wire-path" d="'+d+'"/><path class="gs-wire-hit" d="'+d+'"/></g>');
      }
    }
    edgeLayer.innerHTML=paths.join('');paintState();
  }
  function matchesWire(item,c,e){return item&&(!item.category||item.category===c)&&(!item.event||item.event===e);}
  function paintState(){
    const active=drag?.item||selection||hoverItem;
    const litEnds={category:new Set(),event:new Set()};
    for(const g of edgeLayer.children){
      const lit=matchesWire(active,g.dataset.cat,g.dataset.ev);
      if(lit){litEnds.category.add(g.dataset.cat);litEnds.event.add(g.dataset.ev);}
      g.classList.toggle('gs-lit',Boolean(lit));g.classList.toggle('gs-dim',Boolean(active?!lit:categoryId&&g.dataset.cat!==categoryId));
      g.classList.toggle('gs-lifted',Boolean(drag?.moving&&full(drag.item)&&lit));
    }
    for(const side of ['category','event'])for(const [id,p] of points[side]){
      const target=drag?.target?.[side]===id;
      p.port.setAttribute('aria-pressed',String(selection?.[side]===id));p.port.classList.toggle('gs-target',target);
      p.el.classList.toggle('gs-wire-active',Boolean(active?.[side]===id||target||litEnds[side].has(id)));
    }
    const canRemove=full(drag?.item||selection);bin.setAttribute('aria-disabled',String(!canRemove));
    bin.classList.toggle('gs-drop-over',Boolean(drag?.moving&&drag.target?.remove&&canRemove));
    let msg=wireHelp;
    if(full(active))msg=labelEdge(active)+(drag?.moving?' · 새 끝점이나 ‘연결 해제’에 놓으세요.':selection?' · 새 끝점을 고르거나 연결을 해제하세요.':'');
    else if(active&&(selection||drag))msg=active.category?title('category',active.category)+' → 사건 연결점을 고르세요.':title('event',active.event)+' → 카테고리 연결점을 고르세요.';
    const hint=get('wire-hint');hint.textContent=msg;
    if(hint.scrollWidth>hint.clientWidth||hint.scrollHeight>hint.clientHeight)hint.dataset.tooltip=msg;else delete hint.dataset.tooltip;
  }
  function itemAt(node,rows=false){
    if(!node||!root.contains(node))return null;
    if(node.closest('#gs-wire-bin'))return {remove:true};
    const port=node.closest('.gs-port');if(port)return {[port.dataset.side]:port.dataset.id};
    const g=node.closest('.gs-wire-edge');if(g)return edge(g.dataset.cat,g.dataset.ev);
    if(rows){const cat=node.closest('.gs-cat-item'),ev=node.closest('tr[data-row],[data-act="jump-event"]');
      if(cat)return {category:cat.dataset.id};if(ev)return {event:ev.dataset.row||ev.dataset.id};
    }
    return null;
  }
  function finishLink(original,next,toggle=false){
    const pkg=P();
    const valid=e=>pkg.ids.includes(e.event)&&pkg.categories.some(c=>c.id===e.category);
    if((original&&!valid(original))||(next&&!valid(next)))return;
    if(original&&!linkList('category',original.event).includes(original.category))return;
    if(sameEdge(original,next)){status('같은 연결입니다.');return;}
    const already=next&&linkList('category',next.event).includes(next.category);
    if(already){
      if(!toggle||original){status('이미 연결된 카테고리와 사건입니다.');return;}
      original=next;next=null;
    }
    if(original){const list=linkList('category',original.event,'event',true);list.splice(list.indexOf(original.category),1);}
    if(next)linkList('category',next.event,'event',true).push(next.category);
    const message=next?labelEdge(next)+(original?' 연결로 옮겼습니다.':' 연결을 추가했습니다.'):labelEdge(original)+' 연결을 해제했습니다.';
    afterChange(message);
  }
  function compose(start,target){
    if(!target||full(target)||target.remove)return null;
    if(target.category&&start.event)return edge(target.category,start.event);
    if(target.event&&start.category)return edge(start.category,target.event);
    return null;
  }
  function choose(item,keyboard=false){
    if(!item||item.remove)return;
    if(sameEdge(selection,item)){selection=null;paintState();return;}
    if(full(item)){selection=item;paintState();return;}
    const next=selection&&compose(selection,item);
    if(next){
      const old=full(selection)?selection:null;selection=null;hoverItem=null;finishLink(old,next,!old);
      if(keyboard){const side=item.category?'category':'event';[...portLayer.children].find(b=>b.dataset.side===side&&b.dataset.id===item[side])?.focus({preventScroll:true});}
    }else selection=item;
    paintState();
  }
  function cancelDrag(){
    if(!drag)return;const id=drag.pointer;drag=null;
    if(lane.hasPointerCapture(id))lane.releasePointerCapture(id);
    get('rubber').setAttribute('visibility','hidden');
  }
  function previewDrag(ev){
    const rect=lane.getBoundingClientRect(), d=drag, t=d.target;
    const next=compose(d.item,t);
    let a,b;
    if(next){a=points.category.get(next.category);b=points.event.get(next.event);}
    else {
      const cursor={x:Math.max(0,Math.min(rect.width,ev.clientX-rect.left)),y:ev.clientY-rect.top};
      if(d.free==='event'){a=points.category.get(d.item.category);b=cursor;}
      else{a=cursor;b=points.event.get(d.item.event);}
    }
    const path=get('rubber');if(a&&b){path.setAttribute('d',curve(a,b));path.setAttribute('visibility','visible');path.dataset.wireType=by('category',next?.category||d.item.category)?.kind||'';}
  }
  lane.addEventListener('pointerdown',ev=>{
    if(ev.button!==0||!ev.isPrimary||drag)return;
    const hit=itemAt(document.elementFromPoint(ev.clientX,ev.clientY))||itemAt(ev.target);if(!hit||hit.remove)return;
    const selectedEnd=full(selection)&&!full(hit)&&((hit.category&&hit.category===selection.category)||(hit.event&&hit.event===selection.event));
    const item=selectedEnd?selection:hit;
    const rect=lane.getBoundingClientRect();
    const free=selectedEnd?(hit.category?'category':'event'):full(item)?(ev.clientX-rect.left<rect.width/2?'category':'event'):(item.category?'event':'category');
    drag={item,hit,free,pointer:ev.pointerId,x:ev.clientX,y:ev.clientY,moving:false,target:null};
    lane.setPointerCapture(ev.pointerId);ev.preventDefault();
  });
  lane.addEventListener('pointermove',ev=>{
    if(!drag||drag.pointer!==ev.pointerId)return;
    if(!drag.moving&&Math.hypot(ev.clientX-drag.x,ev.clientY-drag.y)<4)return;
    drag.moving=true;selection=null;
    drag.target=itemAt(document.elementFromPoint(ev.clientX,ev.clientY),true);
    previewDrag(ev);paintState();
  });
  lane.addEventListener('pointerup',ev=>{
    if(!drag||drag.pointer!==ev.pointerId)return;
    const d=drag,target=itemAt(document.elementFromPoint(ev.clientX,ev.clientY),true);
    cancelDrag();hoverItem=null;
    if(!d.moving){choose(d.hit);return;}
    const original=full(d.item)?d.item:null, next=compose(d.item,target);
    if(target?.remove&&original)finishLink(original,null);
    else if(next)finishLink(original,next);
    paintState();
  });
  for(const type of ['pointercancel','lostpointercapture'])lane.addEventListener(type,ev=>{if(drag?.pointer===ev.pointerId){cancelDrag();paintState();}});
  lane.addEventListener('click',ev=>{if(ev.detail===0)choose(itemAt(ev.target),true);});
  lane.addEventListener('pointerover',ev=>{if(!drag&&ev.pointerType==='mouse'){hoverItem=itemAt(ev.target);paintState();}});
  lane.addEventListener('pointerleave',()=>{if(!drag){hoverItem=null;paintState();}});
  bin.addEventListener('click',()=>{if(full(selection)){const old=selection;selection=null;finishLink(old,null);paintState();}});
  listen(document,'keydown',ev=>{if(ev.key==='Escape'&&(drag||selection)){cancelDrag();selection=null;hoverItem=null;paintState();}});
  get('mobile-rows').addEventListener('click',ev=>{const b=ev.target.closest('button');if(b){scrollColumn('title');focusRow(b.dataset.id);}});
  const wireObserver=new ResizeObserver(scheduleWires);
  for(const node of [lane,get('cats'),get('sheet'),get('mobile-rows')])wireObserver.observe(node);
  for(const id of ['scroll','cats','mobile-rows'])listen(get(id),'scroll',scheduleWires);
  listen(window,'resize',scheduleWires);document.fonts?.ready.then(()=>{if(root.isConnected)scheduleWires();});
  const relationWires=mountRelationWires(get('relations'),{
    curve,esc,status,edit:editRelation,drop:wireDrop,remove:removeRelation,relation:id=>P().relations.find(r=>r.id===id)
  });
  // The iframe grows with the editor, so its parent owns the page scrollbar.
  const locationSlot=get('location-slot'),locationBar=get('location'),locationLeaf=locationBar.querySelector('.gs-location-leaf');
  let locationFrame=0;
  function positionLocation(){
    locationFrame=0;
    if(get('main').hidden||window.frameElement?.hidden)return;
    const frameTop=window.frameElement?.getBoundingClientRect().top||0;
    const top=locationSlot.getBoundingClientRect().top+frameTop;
    const shift=Math.max(0,Math.min(-top,get('main').getBoundingClientRect().bottom+frameTop-top-locationBar.offsetHeight));
    locationBar.style.transform=shift?'translateY('+shift+'px)':'';
    locationBar.classList.toggle('gs-pinned',shift>0);
    locationLeaf.hidden=!shift||get('name').getBoundingClientRect().bottom+frameTop>locationBar.offsetHeight;
  }
  function scheduleLocation(){if(!locationFrame)locationFrame=requestAnimationFrame(positionLocation);}
  listen(window.frameElement?parent:window,'scroll',scheduleLocation);listen(window,'resize',scheduleLocation);
  draw();
  scheduleLocation();
  if(host.sheetView){
    const v=host.sheetView;get('scroll').scrollTop=v.top;get('scroll').scrollLeft=v.left;
    get('cats').scrollTop=v.cats;get('mobile-rows').scrollTop=v.mobile;jumpState(v.tab);
  }
  return {
    sheetView:()=>({categoryId,top:get('scroll').scrollTop,left:get('scroll').scrollLeft,cats:get('cats').scrollTop,mobile:get('mobile-rows').scrollTop,tab}),
    refreshLibrary,focusCell,validateForPublish,preview,
    refreshSearch(){if(view?.mode==='finder')results();else if(get('rel-options')&&dlg.open)relationOptions();},
    previewState:()=>view?.mode==='preview'?view:null,
    isEditingDialogOpen:()=>dlg.open&&view?.mode!=='preview',
    dispose(){relationWires.dispose();cancelDrag();abort.abort();cancelAnimationFrame(frame);cancelAnimationFrame(locationFrame);wireObserver.disconnect();}
  };
}
