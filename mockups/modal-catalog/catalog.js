(()=>{
  const {items,byId,projectPath,groups,order,battle,gov,answer,blankAnswer}=catalogue;
  const {esc,key,name,go,get,rows}=records;
  const $=s=>document.querySelector(s),grid=$('#grid'),dialog=$('#viewer'),content=$('#content'),notice=$('#notice'),search=$('#search'),filters=$('#filters');
  const session={fields:new Map(),attempt:null,slots:[],pick:null,comments:[],trail:[],assisted:false};
  document.body.classList.toggle('embedded',new URLSearchParams(location.search).get('embed')==='1');
  let current='',record='',opener=null,pushed=false,group='all';
  $('#original-book').href=records.workbook;
  $('#snapshot-date').textContent=new Date(catalogSnapshot.readAt).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric'});
  function body(item,mini=false,ref=''){
    return item.render({mini,record:ref,attempt:mini?null:session.attempt});
  }
  grid.innerHTML=items.map(item=>`<article class="entry" data-id="${item.id}" data-group="${item.group}" data-look="${item.layout}">
    <div class="stage" inert aria-hidden="true"><div class="mini surface ${item.layout}">${body(item,true)}</div></div>
    <div class="entry-footer"><div><p><i></i>${groups[item.group]}</p><h3><label class="pick-modal"><input type="checkbox" data-pick-modal="${esc(item.id)}" aria-label="${esc(item.name)} 적용 선택"></label>${esc(item.name)}</h3></div><span>↗</span></div>
    <button class="open-card" type="button" data-open="${item.id}" aria-label="${item.name} 목업 열기" aria-haspopup="dialog"></button></article>`).join('');
  const pickKey='chronicle.modal-catalog.pick.';
  const picks=[...grid.querySelectorAll('[data-pick-modal]')];
  const selectionCount=$('#selection-count');
  function countPicks(){selectionCount.textContent='적용 선택 '+picks.filter(input=>input.checked).length+'개';}
  function restorePicks(){
    try{for(const input of picks)input.checked=localStorage.getItem(pickKey+input.dataset.pickModal)==='1';}
    catch{/* Selection still works for the current page. */}
    countPicks();
  }
  grid.addEventListener('change',event=>{
    const input=event.target.closest('[data-pick-modal]');if(!input)return;
    countPicks();
    try{
      const key=pickKey+input.dataset.pickModal;
      if(input.checked)localStorage.setItem(key,'1');else localStorage.removeItem(key);
    }catch{selectionCount.textContent+=' · 이 화면에서만 유지';}
  });
  window.addEventListener('storage',e=>{if(!e.key||e.key.startsWith(pickKey))restorePicks();});
  window.addEventListener('pageshow',restorePicks);
  restorePicks();
  const resize=new ResizeObserver(entries=>{for(const {target,contentRect:r} of entries){if(r.width)target.firstElementChild.style.setProperty('--scale',r.width/420);}});
  grid.querySelectorAll('.stage').forEach(n=>resize.observe(n));
  filters.innerHTML=Object.entries({all:'전체',...groups}).map(([id,n])=>`<button data-group="${id}" type="button">${n}</button>`).join('');
  function filter(){
    let n=0;const q=search.value.trim().toLowerCase();
    for(const card of grid.children){
      const item=byId.get(card.dataset.id);
      card.hidden=(group!=='all'&&group!==item.group)||!(item.name+' '+groups[item.group]+' '+card.querySelector('.mini').textContent).toLowerCase().includes(q);
      if(!card.hidden)n++;
    }
    $('#count').textContent=group==='all'&&!q?'전체 '+n+'종':n+' / '+items.length+'종';
    $('#empty').hidden=n>0;for(const b of filters.children)b.setAttribute('aria-pressed',String(b.dataset.group===group));
  }
  filters.onclick=e=>{const b=e.target.closest('button');if(b){group=b.dataset.group;filter();}};
  search.oninput=filter;$('#reset').onclick=()=>{group='all';search.value='';filter();search.focus();};filter();
  function clearSession(){session.fields.clear();session.assisted=false;session.attempt=null;session.slots=[];session.pick=null;session.comments=[];session.trail=[];}
  function remember(){
    if(!current)return;
    const state=Array.from(content.querySelectorAll('input:not([readonly]),textarea,[data-choice] button')).map(n=>n.matches('button')?n.getAttribute('aria-pressed'):n.value);
    session.fields.set(current+'/'+record,state);
  }
  function drawOrder(){
    const boxes=[...content.querySelectorAll('[data-act^="slot:"]')];
    boxes.forEach((b,i)=>{const placed=session.slots[i];b.textContent=placed?name(get('사건',placed)):(i+1)+'번째 자리';});
    for(const b of content.querySelectorAll('[data-act^="pick:"]')){
      b.draggable=true;b.setAttribute('aria-pressed',String(b.dataset.act.slice(5)===session.pick));
    }
    const placed=content.querySelector('[data-placed]');
    if(placed)placed.textContent=session.attempt?.origin==='order'?'':session.slots.filter(Boolean).length+' / '+order.length+'개 배치';
  }
  function drawComments(){
    for(const [sel,resolved] of [['[data-comments]',false],['[data-resolved]',true]]){
      const box=content.querySelector(sel);if(!box)continue;
      const threads=session.comments.filter(x=>x.resolved===resolved);
      box.innerHTML=threads.length?threads.map(t=>`<article class="comment"><p>${esc(t.text)}</p>${t.replies.map(s=>'<blockquote>'+esc(s)+'</blockquote>').join('')}${resolved?'':`<label class="field"><span>답글</span><textarea rows="2"></textarea></label>${go('reply:'+t.id,'답글 등록')}`}${go('resolve:'+t.id,resolved?'다시 열기':'해결')}</article>`).join(''):`<p class="empty-note">${resolved?'해결된':'등록된'} 댓글이 없습니다.</p>`;
    }
  }
  function show(id,ref=''){
    const item=byId.get(id);if(!item)return;
    remember();current=id;record=ref;notice.textContent='';
    dialog.dataset.look=item.layout;dialog.dataset.id=id;
    const previous=session.trail.length?`<button class="back" data-act="back" aria-label="이전 항목으로" aria-keyshortcuts="${recordBackShortcut.keys}" title="${recordBackShortcut.hint}">← 이전 항목</button>`:'';
    content.innerHTML=previous+`<article class="surface ${item.layout}">${body(item,false,ref)}</article>`;
    content.querySelectorAll('.places-atlas').forEach(catalogPlaceMaps.bind);
    const saved=session.fields.get(current+'/'+record);
    if(saved)Array.from(content.querySelectorAll('input:not([readonly]),textarea,[data-choice] button')).forEach((el,i)=>{if(saved[i]!==undefined){if(el.matches('button'))el.setAttribute('aria-pressed',saved[i]);else el.value=saved[i];}});
    for(const input of content.querySelectorAll('[type=search]'))applySearch(input);
    const share=content.querySelector('[data-share]');if(share){const url=new URL(location.href);url.hash=id==='share'?'person':'package-preview';share.value=url.href;}
    if(id==='map-examples'&&saved)content.querySelector('[data-space][aria-pressed=true]')?.click();
    if(id==='order')drawOrder();if(id==='comments')drawComments();
    if(!dialog.open)dialog.showModal();
    for(const list of content.querySelectorAll('.scroll-list')){
      const row=list.querySelector('[aria-current=step]')?.closest('li');
      if(row)list.scrollTop+=row.getBoundingClientRect().top-list.getBoundingClientRect().top-(list.clientHeight-row.offsetHeight)/2;
    }
    dialog.scrollTop=0;$('#exit').focus({preventScroll:true});
  }
  function visit(target,fromBack=false){
    const [id,ref='']=target.split('/');
    if(!byId.has(id))return;
    const live=projectPath(id,ref);
    if(live){window.open(live,'_blank','noopener');return;}
    if(dialog.open&&!fromBack&&current+'/'+record!==id+'/'+ref)session.trail.push(current+(record?'/'+record:''));
    const u=new URL(location.href);u.hash=id+(ref?'/'+encodeURIComponent(ref):'');
    if(!dialog.open){history.pushState({mockup:true},'',u);pushed=true;}else history.replaceState(history.state,'',u);
    show(id,ref);
  }
  // Preserve links to the tabbed first edition. The corresponding record opens in the new spread.
  const previousStates={'row-edit/1':'row-edit/관계~'+get('관계','R001').n,'row-edit/2':'row-add','package/0':'package-new','data-confirm/1':'data-revert','studio-delete/1':'category-delete','studio-delete/2':'unlink','review/1':'review-actor','review/2':'review-place','review/3':'review-category','score/1':'round-result','score/2':'order-result','score/3':'journey-result','board/1':'board/org_uiyeoldan','board/2':'board/japan_manchuria','board/3':'board/R001'};
  function locationChanged(){
    let hash=location.hash.slice(1);try{hash=decodeURIComponent(hash);}catch{return;}
    hash=previousStates[hash]||hash;
    let [id,ref='']=hash.split('/');if(/^\d+$/.test(ref))ref='';
    const live=projectPath(id,ref);
    if(live){location.replace(live);return;}
    if(byId.has(id)){if(!dialog.open){clearSession();opener=grid.querySelector('[data-open="'+id+'"]');pushed=Boolean(history.state?.mockup);}show(id,ref);}
    else if(dialog.open)dialog.close();
  }
  function dismiss(){if(pushed){history.back();return;}const u=new URL(location.href);u.hash='';history.replaceState(null,'',u);dialog.close();}
  function goBack(){
    const prev=session.trail.pop();
    if(prev)visit(prev,true);else dismiss();
  }
  dialog.addEventListener('keydown',event=>{if(dialog.open)recordBackShortcut.handle(event,goBack);});
  $('#exit').onclick=dismiss;dialog.addEventListener('cancel',ev=>{ev.preventDefault();dismiss();});
  dialog.addEventListener('click',ev=>{if(ev.target!==dialog)return;const b=dialog.getBoundingClientRect();if(ev.clientX<b.left||ev.clientX>b.right||ev.clientY<b.top||ev.clientY>b.bottom)dismiss();});
  dialog.addEventListener('close',()=>{if(dialog.open)return;content.replaceChildren();current='';record='';pushed=false;clearSession();opener?.focus({preventScroll:true});});
  window.addEventListener('popstate',locationChanged);
  grid.onclick=ev=>{const b=ev.target.closest('[data-open]');if(b){clearSession();opener=b;visit(b.dataset.open);}};
  const msg=s=>{notice.textContent=s;notice.scrollIntoView({block:'nearest'});};
  function applySearch(input){
    const host=input.closest('.picker,.event-picker,.person-editor');if(!host)return;
    const options=Array.from(host.querySelectorAll('.rows button,[data-person-row]'));
    options.forEach(b=>{b.hidden=!b.textContent.includes(input.value.trim());});
    for(const tier of host.querySelectorAll('.priority'))tier.hidden=!tier.querySelector('.rows button:not([hidden])');
    const empty=host.querySelector('.no-matches');if(empty)empty.hidden=options.some(b=>!b.hidden);
  }
  function summary(){const node=content.querySelector('[data-summary]');if(node)node.textContent=[...content.querySelectorAll('.choices button[aria-pressed=true]')].slice(0,12).map(b=>b.textContent).join(' · ')||'선택된 항목이 없습니다.';}
  content.addEventListener('input',ev=>{if(ev.target.matches('input[type=search]'))applySearch(ev.target);summary();});
  content.addEventListener('keydown',ev=>{if(ev.key==='Enter'&&!ev.isComposing&&ev.target.matches('[data-answer]')){ev.preventDefault();content.querySelector('[data-act^="grade-"]')?.click();}});
  const normalized=s=>String(s).normalize('NFKC').trim().replace(/\s+/g,'');
  function grade(row,expected,submitted){
    if(!submitted){msg('답을 입력하거나 선택해 주세요.');return;}
    const correct=normalized(expected)===normalized(submitted);
    session.attempt={row,origin:current,expected,submitted,correct,assisted:session.assisted};visit(correct?'correct':'incorrect');
  }
  async function exportMap(type){
    const original=content.querySelector('.shape-map-face>svg');if(!original)return;
    const svg=original.cloneNode(true),width=1200,height=Math.round(width*original.viewBox.baseVal.height/original.viewBox.baseVal.width);
    svg.setAttribute('xmlns','http://www.w3.org/2000/svg');svg.setAttribute('width',width);svg.setAttribute('height',height);
    // The downloaded SVG lives outside the page stylesheet. Preserve the displayed map colours and labels.
    const elements=original.querySelectorAll('g,path,text,circle,rect');
    svg.querySelectorAll('g,path,text,circle,rect').forEach((node,i)=>{
      const style=getComputedStyle(elements[i]);
      for(const prop of ['fill','fill-opacity','stroke','stroke-width','stroke-dasharray','stroke-linejoin','paint-order','font-family','font-size','font-weight'])node.style.setProperty(prop,style.getPropertyValue(prop));
    });
    const bg=document.createElementNS(svg.namespaceURI,'rect');bg.setAttribute('width','100%');bg.setAttribute('height','100%');bg.setAttribute('fill',getComputedStyle(original).backgroundColor);svg.prepend(bg);
    const vector=new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'});let blob=vector;
    if(type==='png'){const img=new Image(),url=URL.createObjectURL(vector);try{img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d').drawImage(img,0,0);blob=await new Promise(resolve=>canvas.toBlob(resolve));}finally{URL.revokeObjectURL(url);}}
    if(!blob)throw Error();const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=key(catalogue.shape)+'.'+type;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  content.addEventListener('dragstart',event=>{
    const card=event.target.closest('[data-act^="pick:"]');if(!card)return;
    session.pick=card.dataset.act.slice(5);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',session.pick);drawOrder();
  });
  content.addEventListener('dragover',event=>{if(session.pick&&event.target.closest('[data-act^="slot:"]'))event.preventDefault();});
  content.addEventListener('drop',event=>{
    const slot=event.target.closest('[data-act^="slot:"]');if(!slot||!session.pick)return;
    event.preventDefault();slot.click();
  });
  content.addEventListener('click',async ev=>{
    const b=ev.target.closest('button');if(!b)return;
    const set=b.closest('[data-choice]');
    if(set){const multi=set.dataset.choice==='many',next=multi?b.getAttribute('aria-pressed')!=='true':true;
      if(!multi)set.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed','false'));b.setAttribute('aria-pressed',String(next));
      if(current==='typing'&&set.querySelector('legend').textContent==='풀이 방식'){const prompt=content.querySelector('.exam-question h2');prompt.textContent=b.textContent.includes('따라')?name(battle):'이 역의 사건명은 무엇인가요?';}
      if(current==='map-examples'){
        const place=get('공간',b.dataset.space);
        if(place){
          content.querySelector('.shape-atlas').outerHTML=records.mapGraphic(place,true);
          catalogPlaceMaps.bind(content.querySelector('.shape-atlas'));
        }
      }
      if(current==='find-event'&&set.classList.contains('category-filter')){const category=rows.카테고리.find(c=>name(c)===b.textContent);const names=new Set(records.events(category).map(r=>r.날짜+'　'+name(r)));content.querySelectorAll('.picker .rows button').forEach(x=>{x.disabled=!names.has(x.textContent);});}
      summary();return;
    }
    const [cmd,param='']=(b.dataset.act||'').split(':');const typed=content.querySelector('[data-answer]')?.value.trim();
    switch(cmd){
      case 'go':if(param==='hint')session.assisted=true;visit(param);break;
      case 'back':goBack();break;
      case 'close':dismiss();break;
      case 'grade-person':grade(battle,answer,content.querySelector('.answers [aria-pressed=true] span')?.textContent);break;
      case 'grade-blank':grade(gov,blankAnswer,typed?.replace(/년$/,''));break;
      case 'grade-typing':grade(battle,name(battle),typed);break;
      case 'gap':grade(battle,'사이',['이전','사이','이후'][Number(param)]);break;
      case 'retry':{const origin=session.attempt?.origin||(current==='order-result'?'order':'person');session.fields.delete(origin+'/');session.attempt=null;session.slots=[];session.pick=null;visit(origin);break;}
      case 'pick':session.pick=param;drawOrder();break;
      case 'place-record':session.pick=param;visit('order');break;
      case 'slot':{
        const i=Number(param);if(!session.pick){if(session.slots[i])session.pick=session.slots[i];else msg('먼저 사건을 선택하세요.');break;}
        const old=session.slots.indexOf(session.pick),displaced=session.slots[i];if(old>=0)session.slots[old]=displaced||null;
        session.slots[i]=session.pick;session.pick=null;drawOrder();break;
      }
      case 'clear-order':session.slots=[];session.pick=null;drawOrder();break;
      case 'unpick':session.pick=null;drawOrder();break;
      case 'grade-order':if(order.every((_,i)=>session.slots[i]))grade(order[0],order.map(name).join(' → '),session.slots.map(id=>name(get('사건',id))).join(' → '));else msg('모든 자리에 사건을 배치하세요.');break;
      case 'example-picked':{
        const value=content.querySelector('[data-space][aria-pressed=true]')?.dataset.space;
        const place=get('공간',value)||get('공간','geo_cuba');visit(records.route(place));break;
      }
      case 'map-picked':{const picked=content.querySelector('.picker .rows [aria-pressed=true]:not(:disabled)');const r=rows.사건.find(r=>r.날짜+'　'+name(r)===picked?.textContent);if(r)visit(records.route(r));else msg('지도에서 볼 사건을 선택하세요.');break;}
      case 'copy':{const input=content.querySelector('[data-share]');try{await navigator.clipboard.writeText(input.value);if(input.isConnected)msg('미리보기 링크를 복사했습니다.');}catch{input.select();msg('선택한 주소를 복사하세요.');}break;}
      case 'export-svg':case 'export-png':try{await exportMap(cmd.slice(7));}catch{msg('지도 파일을 만들지 못했습니다.');}break;
      case 'bulk':{const tier=b.closest('.priority'),bs=[...tier.querySelectorAll('.rows button:not([hidden])')],next=bs.some(x=>x.getAttribute('aria-pressed')!=='true');bs.forEach(x=>x.setAttribute('aria-pressed',String(next)));b.textContent=next?'전체 해제':'전체 선택';break;}
      case 'include-all':case 'exclude-all':content.querySelectorAll('.event-picker .rows button:not([hidden])').forEach(x=>x.setAttribute('aria-pressed',String(cmd==='include-all')));summary();break;
      case 'uncheck':case 'remove-selected':content.querySelectorAll('.choices [aria-pressed=true]').forEach(x=>{if(cmd==='uncheck')x.setAttribute('aria-pressed','false');else x.remove();});break;
      case 'remove-role':b.previousElementSibling?.remove();b.remove();break;
      case 'new-reference':{const field=b.previousElementSibling.querySelector('input');if(field.value.trim())msg('목업에 입력한 항목 · '+field.value.trim());else field.focus();break;}
      case 'add-question':{const list=content.querySelector('[data-question-list]'),clone=list.firstElementChild.cloneNode(true);clone.querySelector('h3').textContent=(list.children.length+1)+'번 문항의 사건';clone.querySelectorAll('[aria-pressed=true]').forEach(b=>b.setAttribute('aria-pressed','false'));clone.insertAdjacentHTML('beforeend',go('remove-question','문항 삭제'));list.append(clone);break;}
      case 'remove-question':b.closest('section').remove();break;
      case 'add-comment':{const input=content.querySelector('.form-sections > section:last-child textarea');if(!input.value.trim()){input.focus();break;}session.comments.push({id:session.comments.length,text:input.value.trim(),replies:[],resolved:false});input.value='';drawComments();break;}
      case 'reply':{const c=session.comments[Number(param)],field=b.closest('.comment').querySelector('textarea');if(field.value.trim()){c.replies.push(field.value.trim());drawComments();}break;}
      case 'resolve':{const c=session.comments[Number(param)];c.resolved=!c.resolved;drawComments();break;}
      case 'refresh-comments':drawComments();break;
      case 'finish':msg('목업에서 ‘'+param+'’ 동작을 확인했습니다.');break;
    }
  });
  locationChanged();
})();
