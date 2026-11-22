// Each relationship has its own label lane. Lines sharing a source meet at one port.
export function mountRelationWires(section,{curve,esc,status,edit,drop,remove,relation}){
  const canvas=section.querySelector('#gs-rel-canvas'),list=canvas.parentElement;
  const svg=canvas.querySelector('svg'),paths=svg.querySelector('g'),rubber=svg.querySelector('.gs-rel-draft');
  const bin=section.querySelector('#gs-rel-bin'),events=new AbortController();
  let selection=null,drag=null,frame=0,scrollFrame=0,ignoreClick=false;
  const on=(el,type,fn)=>el.addEventListener(type,fn,{signal:events.signal});
  const nodeRef=el=>({type:el.dataset.type,id:el.dataset.id});
  const linkEnds=label=>({
    from:label.closest('.gs-rel-group').querySelector('[data-rel-side=from]'),
    to:label.closest('.gs-rel-link').querySelector('[data-rel-side=to]')
  });
  const labelFor=id=>canvas.querySelector('.gs-rel-tag[data-id="'+CSS.escape(id)+'"]');
  function point(el,origin){
    const r=el.getBoundingClientRect();
    return {x:r.left+r.width/2-origin.left,y:r.top+r.height/2-origin.top};
  }
  function layout(){
    frame=0;
    const origin=canvas.getBoundingClientRect();
    if(!origin.width)return;
    paths.innerHTML=Array.from(canvas.querySelectorAll('.gs-rel-tag'),label=>{
      const ends=linkEnds(label),a=point(ends.from.querySelector('i'),origin),b=point(ends.to.querySelector('i'),origin);
      const mid=point(label.querySelector('strong'),origin),d=curve(a,mid)+' '+curve(mid,b);
      const arrow='M'+(b.x-10)+','+(b.y-3)+' l5,3 -5,3';
      return '<g data-wire-id="'+esc(label.dataset.id)+'" data-tone="'+esc(label.dataset.tone)+'"><path class="gs-rel-stroke" d="'+d+'"/><path class="gs-rel-stroke" d="'+arrow+'"/><path class="gs-wire-hit" d="'+d+'"/></g>';
    }).join('');
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(layout);}
  function clearSelection(){
    selection?.setAttribute('aria-pressed','false');selection=null;
  }
  function hit(el){
    if(!el||!section.contains(el))return null;
    if(el.closest('#gs-rel-bin'))return bin;
    const node=el.closest('[data-rel-side]');if(node)return node;
    const edge=el.closest('.gs-rel-tag,[data-wire-id]');
    return edge?.dataset.wireId?labelFor(edge.dataset.wireId):edge;
  }
  function connectNodes(a,b){
    if(a.dataset.relSide===b.dataset.relSide)return;
    const from=a.dataset.relSide==='from'?a:b,to=from===a?b:a;
    drop(null,nodeRef(from),nodeRef(to));
  }
  function activate(el){
    if(!el||el===bin)return;
    if(!el.dataset.relSide){clearSelection();edit(el.dataset.id);return;}
    if(el===selection){clearSelection();return;}
    if(selection&&selection.dataset.relSide!==el.dataset.relSide){
      const previous=selection;clearSelection();connectNodes(previous,el);return;
    }
    clearSelection();selection=el;el.setAttribute('aria-pressed','true');
    status(el.dataset.relSide==='from'?'도착 대상을 선택하세요.':'출발 대상을 선택하세요.');
  }
  function cancel(){
    if(!drag)return;
    const d=drag;drag=null;
    cancelAnimationFrame(scrollFrame);scrollFrame=0;
    if(section.hasPointerCapture(d.pointer))section.releasePointerCapture(d.pointer);
    d.start.classList.remove('gs-lifted');d.target?.classList.remove('gs-drop-target');
    bin.setAttribute('aria-disabled','true');rubber.setAttribute('hidden','');
  }
  function trackTarget(){
    const d=drag,origin=canvas.getBoundingClientRect();
    const target=hit(document.elementFromPoint(d.x,d.y));
    const side=target?.dataset.relSide;
    const valid=(side&&(d.edge||side!==d.start.dataset.relSide))||(target===bin&&d.edge);
    d.target?.classList.remove('gs-drop-target');
    d.target=valid?target:null;d.target?.classList.add('gs-drop-target');
    const free=side&&d.edge?side:d.free;
    const anchor=d.ends[free==='from'?'to':'from'];
    const fixed=point(anchor.querySelector('i'),origin);
    const cursor=valid&&side?point(target.querySelector('i'),origin):{x:d.x-origin.left,y:d.y-origin.top};
    rubber.setAttribute('d',free==='to'?curve(fixed,cursor):curve(cursor,fixed));
    rubber.removeAttribute('hidden');
  }
  function autoScroll(){
    scrollFrame=0;
    if(!drag?.moving)return;
    const r=list.getBoundingClientRect(),y=drag.y;
    if(drag.x<r.left||drag.x>r.right||y<r.top||y>r.bottom)return;
    const step=y<r.top+26?-9:y>r.bottom-26?9:0;
    if(step){
      const old=list.scrollTop;list.scrollTop+=step;
      if(old!==list.scrollTop){trackTarget();scrollFrame=requestAnimationFrame(autoScroll);}
    }
  }
  on(section,'pointerdown',ev=>{
    ignoreClick=false;
    if(ev.button!==0||!ev.isPrimary||drag)return;
    const start=hit(ev.target);if(!start||start===bin)return;
    const side=start.dataset.relSide,edge=side?null:relation(start.dataset.id);
    if(!side&&!edge)return;
    const ends=edge?linkEnds(start):{[side]:start},r=canvas.getBoundingClientRect();
    const free=edge?(ev.clientX<r.left+r.width/2?'from':'to'):(side==='from'?'to':'from');
    drag={start,edge,ends,free,pointer:ev.pointerId,x:ev.clientX,y:ev.clientY,moving:false,target:null};
  });
  on(document,'pointermove',ev=>{
    if(!drag||ev.pointerId!==drag.pointer)return;
    if(!drag.moving){
      if(Math.hypot(ev.clientX-drag.x,ev.clientY-drag.y)<5)return;
      drag.moving=true;clearSelection();section.setPointerCapture(ev.pointerId);
      drag.start.classList.add('gs-lifted');bin.setAttribute('aria-disabled',String(!drag.edge));
    }
    drag.x=ev.clientX;drag.y=ev.clientY;trackTarget();
    if(!scrollFrame)scrollFrame=requestAnimationFrame(autoScroll);
  });
  on(document,'pointerup',ev=>{
    if(!drag||drag.pointer!==ev.pointerId)return;
    const d=drag;
    if(d.moving){d.x=ev.clientX;d.y=ev.clientY;trackTarget();}
    const target=d.target;cancel();
    if(!d.moving)return;
    ignoreClick=true;
    if(!target)return;
    if(target===bin){remove(d.edge.id);return;}
    if(!d.edge){connectNodes(d.start,target);return;}
    const ends={...d.ends,[target.dataset.relSide]:target};
    drop(d.edge,nodeRef(ends.from),nodeRef(ends.to));
  });
  on(document,'pointercancel',ev=>{if(ev.pointerId===drag?.pointer)cancel();});
  // Touch starts with implicit capture on the port before the board takes over.
  on(section,'lostpointercapture',ev=>{if(ev.target===section&&ev.pointerId===drag?.pointer)cancel();});
  on(section,'click',ev=>{
    if(ignoreClick&&ev.detail){ignoreClick=false;ev.stopPropagation();return;}
    const el=hit(ev.target);if(!el)return;
    ev.stopPropagation();activate(el);
  });
  on(document,'keydown',ev=>{if(ev.key==='Escape'&&(selection||drag)){clearSelection();cancel();}});
  const observer=new ResizeObserver(schedule);observer.observe(canvas);
  bin.setAttribute('aria-disabled','true');
  return {
    refresh(){clearSelection();cancel();schedule();},
    dispose(){cancel();cancelAnimationFrame(frame);events.abort();observer.disconnect();}
  };
}
