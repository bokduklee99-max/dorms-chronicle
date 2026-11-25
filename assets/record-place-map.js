// Draw every linked sheet geometry in the same geographic frame.
globalThis.createChroniclePlaceMap=function(atlas,getRecords){
  const width=400,height=224;
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  function mappedPlaces(spaces){
    const {points,mapLayers}=atlas;
    return spaces.flatMap((space,i)=>{
      const ref=space.지도참조키, point=points[ref], layer=mapLayers[ref];
      if(!point&&!layer)return [];
      const bounds=point?[point[0],-point[1],point[0],-point[1]]:layer.bounds;
      return [{space,number:i+1,ref,bounds,kind:point?'point':layer.kind,layer}];
    });
  }
  function fit(features){
    if(!features.length)return {cx:0,cy:0,span:360,aspect:1};
    const west=Math.min(...features.map(f=>f.bounds[0])),east=Math.max(...features.map(f=>f.bounds[2]));
    const north=Math.min(...features.map(f=>f.bounds[1])),south=Math.max(...features.map(f=>f.bounds[3]));
    const cx=(west+east)/2,cy=(north+south)/2;
    const aspect=Math.cos(cy*Math.PI/180);
    const sy=Math.min((width-76)/(Math.max(.02,east-west)*aspect),(height-68)/Math.max(.20,south-north));
    return {cx,cy,span:Math.min(360,width/(sy*aspect)),aspect};
  }
  function frame(view){
    // Ease the local longitude correction back to an equirectangular world view when zooming out.
    const aspect=view.aspect+(1-view.aspect)*clamp((view.span-15)/345,0,1);
    const sx=width/view.span,sy=sx/aspect;
    return {sx,sy,tx:width/2-view.cx*sx,ty:height/2-view.cy*sy};
  }
  function backdropFor({sx,sy,tx,ty}){
    const backgrounds=atlas.backgrounds;
    return backgrounds.find(({box:[x,y,w,h]})=>
      -tx/sx>=x && (width-tx)/sx<=x+w && -ty/sy>=y && (height-ty)/sy<=y+h)||backgrounds.at(-1);
  }
  const path=(d,style)=>d?`<path class="${style}" d="${d}" fill-rule="evenodd" vector-effect="non-scaling-stroke"/>`:'';
  const berlin=atlas.backgrounds.find(b=>b.region==='berlin');
  function berlinDetail(backdrop,features){
    return backdrop.region==='germany'&&features.some(f=>f.ref==='geo_berlin_wall')?berlin:null;
  }
  function terrain(backdrop,features){
    const detail=berlinDetail(backdrop,features);
    return path(backdrop.land,'map-land')+path(detail?.cityBoundary||backdrop.cityBoundary,'map-city-boundary')+
      path(backdrop.lakes,'map-water')+path(backdrop.rivers,'map-river')+path(detail?.lakes,'map-water');
  }
  function overlays(features,esc){
    // Put wider areas underneath smaller areas and keep lines above them.
    const extent=f=>(f.bounds[2]-f.bounds[0])*(f.bounds[3]-f.bounds[1]);
    return features.filter(f=>f.layer).sort((a,b)=>
      Number(a.kind==='line')-Number(b.kind==='line')||extent(b)-extent(a)
    ).map(f=>`<g data-geometry="${esc(f.ref)}">${path(f.layer.path,'map-'+f.kind)}</g>`).join('');

  }
  function markers(features,{sx,sy,tx,ty},esc){
    // Keep the actual coordinates fixed. Offset labels, with a leader when necessary.
    const occupied=[],pins=[],showNames=features.length<=3;
    for(const {bounds,kind,number,space,ref} of features){
      const x=(bounds[0]+bounds[2])/2*sx+tx,y=(bounds[1]+bounds[3])/2*sy+ty;
      if(x<0||x>width||y<0||y>height)continue;
      const caption=showNames?space.공간명:'';
      const nameWidth=[...caption].reduce((sum,c)=>sum+(/[\u0000-\u00ff]/.test(c)?7.3:13),0);
      const w=caption?Math.min(nameWidth+32,width-20):22;
      const anchorLeft=x<width/2?x-w-7:x+7;
      const alternate=x<width/2?x+7:x-w-7;
      let left,top,placed=false;
      for(let step=0;step<10&&!placed;step++){
        for(const dy of step?[-step*23,step*23]:[0]){
          for(const start of (caption?[anchorLeft,alternate]:[x-11,x+15,x-37])){
            left=clamp(start,4,width-w-4);top=clamp(y-11+dy,5,height-27);
            if(occupied.every(b=>left+w+3<b.left||left>b.right+3||top+23<b.top||top>b.bottom+2)){
              placed=true;break;
            }
          }
          if(placed)break;
        }
      }
      occupied.push({left,right:left+w,top,bottom:top+22});
      const endX=clamp(x,left+3,left+w-3),endY=clamp(y,top+3,top+19);
      const pointer=Math.hypot(endX-x,endY-y)>4?`<path d="M${x} ${y}L${endX} ${endY}" class="map-leader"/>`:'';
      const dot=kind==='point'?`<circle cx="${x}" cy="${y}" r="3.6" class="map-pin"/>`:'';
      pins.push(`<g data-place="${esc(ref)}"><title>${esc(space.공간명)}</title>${pointer}${dot}<rect x="${left}" y="${top}" width="${w}" height="22" rx="7" class="pin-tag"/><circle cx="${left+11}" cy="${top+11}" r="9" class="pin-number-bg"/><text x="${left+11}" y="${top+15}" text-anchor="middle" class="pin-number">${number}</text>${caption?`<text x="${left+25}" y="${top+15.5}" class="pin-name">${esc(caption)}</text>`:''}</g>`);
    }
    return pins.join('');
  }
  function scaleBar({sx},cy){
    const pixelsPerDegree=sx/Math.cos(cy*Math.PI/180);
    const targetKm=50/pixelsPerDegree*111.32,power=10**Math.floor(Math.log10(targetKm));
    const km=([5,2,1].find(n=>n*power<=targetKm)||1)*power;
    const bar=km*pixelsPerDegree/111.32;
    return `<path d="M15 203v4h${bar}v-4"/><text x="15" y="199">${Number(km.toPrecision(3))} km</text>`;
  }
  function creditLine(features,backdrop){
    const credit=(href,title)=>`<a href="${href}" target="_blank" rel="noopener noreferrer">${title} <span aria-hidden="true">↗</span></a>`;
    const credits=[credit('https://www.naturalearthdata.com/about/terms-of-use/','Natural Earth · 현대 국경')];
    if(backdrop.region==='berlin'||berlinDetail(backdrop,features))credits.push(
      credit('https://daten.berlin.de/datensaetze/alkis-berlin-landesgrenze-wfs-07b1347b','현대 베를린시 경계'),
      credit('https://daten.berlin.de/datensaetze/gewasserverzeichnis-wfs-353f1716','베를린시 수역')
    );
    if(features.some(f=>f.layer?.fromContext)){
      credits.push(credit('https://icr.ethz.ch/data/cshapes/','CShapes 2.1'),credit('https://creativecommons.org/licenses/by-nc-sa/4.0/','CC BY-NC-SA 4.0'));
    }
    return credits.join('');
  }
  function clusterFrame(features,all){
    if(features.length<3)return null;
    // A compact majority can otherwise disappear beside a distant place or a continent-sized overlay.
    let best=null,bestCount=0;
    const fraction=.16;
    for(const seed of features){
      const near=features.filter(f=>fit([seed,f]).span<all.span*fraction);
      if(near.length<Math.max(2,Math.ceil(features.length/2))||near.length<bestCount)continue;
      const view=fit(near);
      if(view.span<all.span*fraction&&(near.length>bestCount||!best||view.span<best.span)){
        best=view;bestCount=near.length;
      }
    }
    return best;
  }
  const matrix=({sx,sy,tx,ty})=>`matrix(${sx} 0 0 ${sy} ${tx} ${ty})`;
  function nearbyPoints(feature){
    if(!feature||feature.kind!=='line')return [];
    const [west,north,east,south]=feature.bounds,dx=east-west,dy=south-north;
    if(Math.max(dx,dy)>2)return [];
    return getRecords().rows.공간.flatMap(space=>{
      const pt=atlas.points[space.지도참조키];
      return pt&&pt[0]>=west-.2*dx&&pt[0]<=east+.2*dx&&-pt[1]>=north-.2*dy&&-pt[1]<=south+.2*dy
        ?[{point:pt,name:space.공간명}]:[];
    });
  }
  function shapeMarkers(features,nearby,f,esc){
    if(features[0]?.kind==='point')return markers(features,f,esc);
    if(f.sx<width/3)return '';
    return nearby.map(({point:[lon,lat],name})=>{
      const x=lon*f.sx+f.tx,y=-lat*f.sy+f.ty;
      const left=x>width-58||nearby.some(({point})=>point[0]>lon&&(point[0]-lon)*f.sx<60&&Math.abs(point[1]-lat)*f.sy<24);
      return `<g><circle cx="${x}" cy="${y}" r="2.3" class="map-pin"/><text x="${x+(left?-4:4)}" y="${y-4}" text-anchor="${left?'end':'start'}" class="map-city-label">${esc(name)}</text></g>`;
    }).join('');
  }
  function render(spaces,esc,{shape=false,compact=false,inset=''}={}){
    const features=mappedPlaces(spaces);
    if(!features.length&&!shape)return '';
    const initial=fit(features),f=frame(initial),backdrop=backdropFor(f);
    const tool=(action,label,text)=>`<button type="button" data-map-action="${action}" aria-label="${label}" title="${label}">${text}</button>`;
    const fitButton=features.length?tool('fit',shape?'선택한 도형에 맞추기':'연결된 모든 장소에 맞추기',shape?'도형 맞춤':'장소 맞춤'):'';
    const buttons=tool('out','지도 축소','−')+tool('in','지도 확대','+')+fitButton+
      (clusterFrame(features,initial)?tool('cluster','장소가 밀집한 지역 확대','밀집 지역'):'')+tool('world','세계 지도 보기','세계');
    const kind=features[0]?.kind;
    const legend=shape&&kind?`<span class="shape-legend" data-kind="${esc(kind)}">${esc(spaces[0].공간명)} <span>${esc(getRecords().label(kind))}</span></span>`:'';
    const toolbar=`<div class="place-map-tools" role="group" aria-label="지도 보기">${legend}${buttons}</div>`;
    const title=shape?spaces[0].공간명+' '+getRecords().label(kind)+' 도형 지도':features.map(f=>f.number+' '+f.space.공간명).join(', ')+' 위치 지도';
    const pins=shape?shapeMarkers(features,nearbyPoints(features[0]),f,esc):markers(features,f,esc);
    const svg=`<svg viewBox="0 0 ${width} ${height}" tabindex="0" role="img" aria-label="${esc(title)}" aria-keyshortcuts="+ - ArrowLeft ArrowRight ArrowUp ArrowDown Home"><g class="place-camera" transform="${matrix(f)}"><g class="place-terrain">${terrain(backdrop,features)}</g>${path(atlas.countryBorders,'map-country-border')}${overlays(features,esc)}</g><g class="place-north" aria-hidden="true"><path d="M18 30l3-10 3 10-3-2Z"/><text x="21" y="16" text-anchor="middle">N</text></g><g class="place-ruler">${scaleBar(f,initial.cy)}</g><g class="place-markers">${pins}</g></svg>`;
    const empty=features.length?'':'<p class="shape-empty">시트에 도형 좌표가 없습니다.</p>';
    return `<figure class="places-atlas${shape?' shape-atlas':''}${compact?' compact':''}" data-spaces="${esc(JSON.stringify(spaces.map(s=>s.공간ID)))}">${shape?`<div class="shape-map-face">${svg}${inset}</div>${empty}${toolbar}`:toolbar+svg}<figcaption>${creditLine(features,backdrop)}</figcaption></figure>`;
  }
  function bind(figure){
    const features=mappedPlaces(JSON.parse(figure.dataset.spaces).map(id=>getRecords().get('공간',id)));
    const shape=figure.classList.contains('shape-atlas'),nearby=shape?nearbyPoints(features[0]):[];
    const initial=fit(features),cluster=clusterFrame(features,initial);
    const svg=figure.querySelector('svg'),camera=svg.querySelector('.place-camera');
    const pins=svg.querySelector('.place-markers'),ruler=svg.querySelector('.place-ruler');
    const base=svg.querySelector('.place-terrain'),credit=figure.querySelector('figcaption');
    const minus=figure.querySelector('[data-map-action=out]'),plus=figure.querySelector('[data-map-action=in]');
    const minSpan=.01,center=[width/2,height/2];
    let view=initial,backdrop=backdropFor(frame(view)),pending=false;
    function paint(){
      pending=false;
      if(!figure.isConnected)return;
      const f=frame(view),next=backdropFor(f);
      camera.setAttribute('transform',matrix(f));
      if(backdrop!==next){
        backdrop=next;base.innerHTML=terrain(next,features);credit.innerHTML=creditLine(features,next);
      }
      pins.innerHTML=shape?shapeMarkers(features,nearby,f,getRecords().esc):markers(features,f,getRecords().esc);ruler.innerHTML=scaleBar(f,view.cy);
      minus.disabled=view.span>=360;plus.disabled=view.span<=minSpan;
    }
    function move(next){
      view=next;
      if(!pending){pending=true;requestAnimationFrame(paint);}
    }
    function navigate(factor,from=center,to=from){
      const old=frame(view),span=clamp(view.span*factor,minSpan,360);
      const next={...view,span},f=frame(next);
      const worldX=(from[0]-old.tx)/old.sx,worldY=(from[1]-old.ty)/old.sy;
      const limitX=Math.max(0,180-width/(2*f.sx)),limitY=Math.max(0,90-height/(2*f.sy));
      next.cx=clamp(worldX-(to[0]-center[0])/f.sx,-limitX,limitX);
      next.cy=clamp(worldY-(to[1]-center[1])/f.sy,-limitY,limitY);
      move(next);
    }
    function command(action){
      if(action==='in'||action==='out')navigate(action==='in'?1/1.6:1.6);
      else if(action==='fit')move(initial);
      else if(action==='cluster'&&cluster)move(cluster);
      else if(action==='world')move({...initial,cx:0,cy:0,span:360});
    }
    minus.disabled=view.span>=360;
    figure.querySelector('.place-map-tools').addEventListener('click',e=>{
      const button=e.target.closest('[data-map-action]');
      if(button)command(button.dataset.mapAction);
    });
    function local(e){
      const rect=svg.getBoundingClientRect();
      return [(e.clientX-rect.left)*width/rect.width,(e.clientY-rect.top)*height/rect.height];
    }
    svg.addEventListener('wheel',e=>{
      if(!e.deltaY)return;
      e.preventDefault();
      const pixels=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?height:1);
      navigate(Math.exp(clamp(pixels*.0025,-1,1)),local(e));
    },{passive:false});
    const keys={'+':'in','=':'in','-':'out',Home:'fit'};
    const arrows={ArrowLeft:[45,0],ArrowRight:[-45,0],ArrowUp:[0,32],ArrowDown:[0,-32]};
    svg.addEventListener('keydown',e=>{
      if(e.ctrlKey||e.metaKey||e.altKey||(!keys[e.key]&&!arrows[e.key]))return;
      e.preventDefault();
      if(keys[e.key])command(keys[e.key]);
      else {const [x,y]=arrows[e.key];navigate(1,center,[center[0]+x,center[1]+y]);}
    });
    const contacts=new Map();
    function gesture(){
      const [a,b]=contacts.values();
      if(!b)return {center:a,distance:0};
      return {center:[(a[0]+b[0])/2,(a[1]+b[1])/2],distance:Math.hypot(a[0]-b[0],a[1]-b[1])};
    }
    svg.addEventListener('pointerdown',e=>{
      if(e.button!==0||contacts.size>=2)return;
      contacts.set(e.pointerId,local(e));svg.setPointerCapture(e.pointerId);
      svg.classList.add('dragging');
    });
    svg.addEventListener('pointermove',e=>{
      if(!contacts.has(e.pointerId))return;
      const before=gesture();
      contacts.set(e.pointerId,local(e));
      const after=gesture();
      const factor=before.distance>1&&after.distance>1?before.distance/after.distance:1;
      navigate(factor,before.center,after.center);
    });
    function end(e){
      contacts.delete(e.pointerId);
      if(!contacts.size)svg.classList.remove('dragging');
    }
    for(const type of ['pointerup','pointercancel','lostpointercapture'])svg.addEventListener(type,end);
  }
  return {render,bind};
};
