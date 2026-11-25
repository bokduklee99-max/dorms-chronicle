// Shared by the lesson reader and the design showroom.
globalThis.createChronicleRecordViews = function(rows,{key,id='',points={},flagFor,assetRoot='',mapRenderer,placeSection,participantPlaceholder}){
  const indexes=Object.fromEntries(Object.entries(rows).map(([tab,arr])=>[tab,new Map(arr.map(r=>[key(r),r]))]));
  const get=(tab,id)=>indexes[tab]?.get(id);
  const find=id=>get('사건',id)||get('카테고리',id)||get('주체',id)||get('공간',id)||get('관계',id);
  const name=r=>r?.사건명||r?.카테고리명||r?.주체명||r?.공간명||r?.패키지명||r?.직위명||r?.라벨||r?.지도참조키||'';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // Only call this on date-bearing labels and fields. Keep their text intact for search and quiz answers.
  const markedDates=value=>esc(value).replace(/(?<![\w-])(?:\d{4}(?:-\d{2}){0,2}년?|\d{1,2}월(?:\s*\d{1,2}일)?)(?![\w-])/g,
    stamp=>'<time class="date-value">'+stamp+'</time>');
  const isDateField=label=>/날짜$|시작일$|종료일$|^기간$|^기준시점$|^연도$|^이동할 연월$/.test(label);
  const date=r=>[r?.날짜||r?.시작일||r?.['존속 시작일'],r?.종료일||r?.['존속 종료일']].filter(Boolean).join(' – ');
  const ordered=rs=>rs.slice().sort((a,b)=>a.날짜.localeCompare(b.날짜)||a.n-b.n);
  function related(r,via,from,to,tab){return rows[via].filter(x=>x[from]===key(r)).map(x=>get(tab,x[to])).filter(Boolean);}
  const categories=r=>related(r,'사건_카테고리','사건ID','카테고리ID','카테고리');
  const participants=r=>rows.사건_주체.filter(x=>x.사건ID===key(r)).map(x=>({actor:get('주체',x.주체ID),role:x.역할,link:x})).filter(x=>x.actor);
  const places=r=>related(r,r.tab+'_공간',r.tab+'ID','공간ID','공간');
  const events=r=>ordered(related(r,'사건_'+r.tab,r.tab+'ID','사건ID','사건'));
  const relations=r=>rows.관계.filter(x=>x.출발ID===key(r)||x.도착ID===key(r));
  const workbook='https://docs.google.com/spreadsheets/d/'+id+'/edit';
  const vocab={period:'시기',arc:'사건군',theme:'주제',state:'국가',territory:'지역',organization:'단체',institution:'기관',army:'군사 조직',person:'인물',event:'사건',policy:'정책·조치',publication:'선언·보고서',context:'배경·정세',cause:'원인·계기',shift:'전환·변화',action:'활동·실행',background:'구조적 배경',integration:'통합·편입',split:'분열·개편',succession:'계승',initiator:'주도',participant:'참여',related:'관련',affected:'영향을 받음',counterparty:'상대',mediator:'중재',leader:'지도',executor:'실행',author:'저술',founder:'창립',verified:'검토 완료',draft:'초안',line:'선',point:'점',area:'면',core:'핵심',major:'주요',detail:'세부'};
  const label=v=>vocab[v]||v||'';
  function source(url,title,detail='',icon='↗'){
    if(!/^https?:\/\//i.test(url||''))return '';
    let host;try{host=new URL(url).hostname;}catch{return '';}
    return `<a class="citation" href="${esc(url)}" target="_blank" rel="noopener noreferrer"><i aria-hidden="true">${esc(icon)}</i><span><b>${esc(title)}</b><small>${esc(detail||host)}</small></span><strong aria-hidden="true">↗</strong></a>`;
  }
  const sources=(...links)=>links.filter(Boolean).length?'<div class="citations">'+[...new Set(links.filter(Boolean))].join('')+'</div>':'';
  const go=(cmd,title,cl='small-btn')=>`<button type="button" class="${cl}" data-act="${esc(cmd)}">${esc(title)}</button>`;
  function route(r){return ({사건:'event',카테고리:r.카테고리유형,주체:'actor',관계:'relation',공간:'map-source'})[r.tab]+'/'+encodeURIComponent(key(r));}
  const jump=(r,text)=>r?go('go:'+route(r),text||name(r),'text-jump'):'';
  const box=(title,html,cl='')=>html?`<section class="block ${cl}"><h3>${esc(title)}</h3>${html}</section>`:'';
  const prose=v=>v?`<p class="prose">${esc(v)}</p>`:'';
  const facts=pairs=>`<dl class="datum">${pairs.filter(([,v])=>v!==undefined&&v!==null&&v!=='').map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${isDateField(k)||k==='정답'&&/^\d{4}$/.test(v)?markedDates(v):esc(v)}</dd></div>`).join('')}</dl>`;
  const list=rs=>rs.length?`<ol class="chronology">${rs.map(r=>`<li><time>${esc(r.날짜)}</time>${jump(r)}</li>`).join('')}</ol>`:'';
  const imageUrls=r=>(r.이미지||'').split(/\r?\n/).map(x=>x.trim()).filter(x=>/^https?:\/\//i.test(x));
  function localImage(url){const original=TimelineImage.src(url);return original.startsWith('/assets/')?assetRoot+original:original;}
  function imageCredits(url){
    const credit=TimelineImage.credit(TimelineImage.src(url));
    return credit?`<figcaption class="photo-credit">${esc(credit.by)} · <a href="${esc(credit.licenseUrl)}" target="_blank" rel="noreferrer">${esc(credit.license)}</a> · WebP 변환</figcaption>`:'';
  }
  function photo(r,compact=false){
    const urls=imageUrls(r);if(!urls.length)return '';
    return `<div class="photo-set">${urls.map((url,i)=>`<figure><a href="${esc(url)}" target="_blank" rel="noreferrer" aria-label="${esc(name(r))} 사진 ${i+1} 원본 열기">${localImage(url)?`<img src="${esc(localImage(url))}" alt="${esc(name(r))} 시트에 등록된 사진 ${i+1}">`:'원본 이미지 ↗'}</a>${compact?'':prose(r.images?.find(img=>img.url===url)?.caption)+imageCredits(url)}</figure>`).join('')}</div>`;
  }
  function yearChart(rs){
    const counts=new Map();
    for(const r of rs){const y=Number(r.날짜.slice(0,4));if(y)counts.set(y,(counts.get(y)||0)+1);}
    if(!counts.size)return '';
    const low=Math.min(...counts.keys()),high=Math.max(...counts.keys()),peak=Math.max(...counts.values());
    return box('연도별 사건 수',`<div class="bars" role="img" aria-label="${Array.from(counts,([y,n])=>y+'년 '+n+'건').join(', ')}">${Array.from({length:high-low+1},(_,i)=>`<i title="${low+i}년 · ${counts.get(low+i)||0}건" style="--h:${100*(counts.get(low+i)||0)/peak}%"></i>`).join('')}</div><div class="axis"><time>${low}</time><span>최다 ${peak}건</span><time>${high}</time></div>`);
  }
  function mapGraphic(space,compact=false){
    const overview=!compact&&space.지도참조키==='geo_berlin_wall'?get('지도도형','geo_germany'):null;
    const encoded=overview?.지도데이터URL;
    const extent=encoded?.startsWith('data:image/svg+xml;base64,')?atob(encoded.split(',')[1]).match(/viewBox="([\d. -]+)"/)?.[1]:'';
    const center=points.geo_berlin,year=overview?.기준시점?.match(/\d{4}/)?.[0];
    const marker=extent&&center?`<svg viewBox="${esc(extent)}" aria-hidden="true"><circle cx="${center[0]}" cy="${-center[1]}" r=".35" fill="#be4a35" stroke="#fff7df" stroke-width=".12"/></svg>`:'';
    const inset=extent?`<div class="locator"><div><img src="${esc(encoded)}" alt="${esc(overview.기준시점)}">${marker}</div><small>독일 내 위치${year?' · <time>'+year+'</time>':''}</small></div>`:'';
    return mapRenderer().render([space],esc,{shape:true,compact,inset});
  }
  function placeIntroduction(space){
    // The gazetteer import puts its classification and review note in the description column.
    return (space.설명||'').trim().replace(/^[가-힣·]+[ \t]+·[ \t]+[가-힣·]+[ \t]*\(history-map-maker 지명 사전, 좌표 검수 전\)[ \t]*\r?\n?/gm,'').trim();
  }
  function geoSection(r){
    if(placeSection)return placeSection(r);
    const spaces=[...new Set(places(r))];
    if(!spaces.length)return '';
    const details=spaces.map((s,i)=>`<li><span class="place-index">${i+1}</span><div>${jump(s)}${prose(placeIntroduction(s))}</div></li>`).join('');
    return box('장소',mapRenderer().render(spaces,esc)+`<ol class="place-key">${details}</ol>`);
  }
  function participantSection(event){
    const links=participants(event);
    if(!links.length)return '';
    const groups=new Map(links.map(({actor})=>[key(actor),{actor,terms:[]}]));
    const directLeaders=new Set(links.filter(x=>x.role==='leader'&&x.actor.구분==='person').map(x=>key(x.actor)));
    const nestedPeople=new Set();
    const firstDay=event.날짜?SheetData.dateRange(event.날짜).start:Infinity;
    const lastDay=event.종료일||event.날짜?SheetData.dateRange(event.종료일||event.날짜).end:-Infinity;
    for(const term of rows.재임){
      if(!term.시작일||SheetData.dateRange(term.시작일).start>lastDay||
        (term.종료일&&SheetData.dateRange(term.종료일).end<firstDay))continue;
      const job=get('직위',term.직위ID),person=get('주체',term.주체ID);
      if(!job||!person)continue;
      const owner=groups.get(job.조직ID)||groups.get(job.국가ID);
      const group=owner||(directLeaders.has(key(person))&&groups.get(key(person)));
      if(!group)continue;
      group.terms.push({person,term,job});
      if(owner)nestedPeople.add(key(person));
    }
    const entries=[];
    for(const [id,{actor,terms}] of groups){
      if(nestedPeople.has(id)&&!terms.length)continue;
      const flag=flagFor(actor,event.날짜);
      const icon=flag?.src?`<img src="${esc(assetRoot+flag.src)}" alt="">`:flag?.symbol?`<span aria-hidden="true">${esc(flag.symbol)}</span>`:'';
      const leaders=terms.map(({person,term,job})=>{
        const dates=`<time>${esc(term.시작일)}</time> – ${term.종료일?'<time>'+esc(term.종료일)+'</time>':'종료 미기재'}`;
        return `<li>${person!==actor?jump(person):''}<span class="term-dates">${dates}</span><span>${esc(name(job))}</span></li>`;
      }).join('');
      entries.push(`<li class="participant-group"><h4>${icon}${jump(actor)}</h4>${leaders?'<ul class="participant-terms" aria-label="지도자와 재임 기간, 직위">'+leaders+'</ul>':''}</li>`);
    }
    return box('참여 주체','<ul class="participant-list">'+entries.join('')+'</ul>');
  }
  function relationCard(r,{primary=false,nodeStyle='name',mini=false}={}){
    const type=label(r.관계유형),caption=r.라벨;
    function endpoint(id,side,fallback){
      const item=find(id);
      if(!item)return `<span class="relation-node">${esc(fallback||id)}</span>`;
      let before='',after='';
      if(nodeStyle==='dated')before=`<time>${esc(item.날짜)}</time>`;
      if(nodeStyle==='detail'){
        before=`<small>${side}</small>`;
        const info=[date(item),label(item.카테고리유형||item.구분||item.사건유형)].filter(Boolean).join(' · ');
        if(info)after=`<span>${markedDates(info)}</span>`;
      }
      return `<button type="button" class="relation-node" data-act="go:${esc(route(item))}">${before}<strong>${esc(name(item))}</strong>${after}</button>`;
    }
    const connector=`<span class="relation-connector"><span class="relation-type">${!caption&&!primary?jump(r,type):esc(type)}</span><i class="relation-arrow" role="img" aria-label="에서 다음 항목으로"></i></span>`;
    const heading=primary?title(caption||type||'관계',mini):caption?`<h4 class="relation-title">${jump(r,caption)}</h4>`:'';
    const explanation=mini?'':prose(r.설명);
    return `<div class="relation-card"><div class="relation-route">${endpoint(r.출발ID,'출발',r.출발명)}${connector}${endpoint(r.도착ID,'도착',r.도착명)}</div>${heading}${primary?box('연결 근거',explanation):explanation}</div>`;
  }
  function relationList(rs,options){
    return rs.length?`<ul class="relation-list">${rs.map(r=>'<li>'+relationCard(r,options)+'</li>').join('')}</ul>`:'';
  }
  const chips=rs=>rs.map(r=>go('go:'+route(r),name(r),'chip-link')).join(' ');
  function eventCategories(categories){
    if(!categories.length)return '';
    const types=new Set(categories.map(cat=>cat.카테고리유형));
    const groups=Array.from(types,type=>{
      const members=categories.filter(cat=>cat.카테고리유형===type);
      return `<div><dt>${esc(label(type))}</dt><dd>${members.map(cat=>go('go:'+route(cat),name(cat),'category-member')).join('')}</dd></div>`;
    }).join('');
    return `<section class="event-categories"><h3>카테고리</h3><dl>${groups}</dl></section>`;
  }
  const title=(v,mini)=>`<h2 class="record-title"${mini?'':' id="modal-title" tabindex="-1"'}>${esc(v)}</h2>`;
  function eventView(r,mini=false){
    const c=[...new Set(categories(r))],pics=imageUrls(r),intro=`<div class="event-intro"><time>${esc(date(r))}</time>${title(name(r),mini)}${mini?'<span hidden>'+c.map(x=>esc(name(x))).join(' ')+'</span>':''}</div>`;
    if(mini)return `<div class="event-cover">${photo(r,true)}${intro}</div>`;
    const lanes=c.map(cat=>{
      const seq=events(cat),i=seq.findIndex(x=>key(x)===key(r));
      const steps=[i>0?go('go:'+route(seq[i-1]),'← 이전 사건'):'',i<seq.length-1?go('go:'+route(seq[i+1]),'다음 사건 →'):''].join('');
      const controls=steps?`<div class="lane-steps">${steps}</div>`:'';
      return box(name(cat)+' 연표',`${controls}<div class="scroll-list" tabindex="0" aria-label="${esc(name(cat))} 사건 연표">${list(seq).replace('data-act="go:'+route(r)+'"','aria-current="step" data-act="go:'+route(r)+'"')}</div>`);
    }).join('');
    const kindInfo=facts([['사건 유형',label(r.사건유형)],['중요도',label(r.중요도)]]);
    const fullPhoto=pics.length?photo(r):'';
    return `<div class="photo-feature${pics.length?'':' no-photo'}">${fullPhoto}<div>${intro}<div class="event-class">${kindInfo}${eventCategories(c)}</div>${sources(source(r.출처,'사건 자료'))}</div></div>
      <div class="event-board"><div>${box('사건 내용',prose(r.내용)+prose(r.originLabel))}${box('연결된 역사 관계',relationList(relations(r)))}</div>
      <div>${participantPlaceholder ? participantPlaceholder(r) : participantSection(r)}${geoSection(r)}</div><div class="linked-lanes">${lanes}</div></div>`;
  }
  function categorySources(r){
    return sources(source(r.출처,'자료 출처'));
  }

  function categoryTitle(r,mini){
    const type=r.카테고리유형;
    return `<small class="category-schema">${esc(r.tab)} › ${esc(label(type))} (${esc(type)})</small>${title(name(r),mini)}`;
  }
  function periodView(r,members,mini){
    const periods=rows.카테고리.filter(p=>p.패키지ID===r.패키지ID&&p.카테고리유형==='period');
    const year=value=>Number(value?.slice(0,4))||null;
    const years=periods.flatMap(p=>[year(p.시작일),year(p.종료일)]).filter(Boolean);
    const low=Math.min(...years),high=Math.max(...years),start=year(r.시작일),end=year(r.종료일);
    const endpoint=(value,caption)=>value?`<time aria-label="${caption} ${esc(value)}">${esc(value)}</time>`:'';
    let ruler=[endpoint(r.시작일,'시작'),endpoint(r.종료일,'종료')].filter(Boolean).join(' – ');
    if(start&&end&&high>low){
      const offset=y=>100*(y-low)/(high-low);
      const pkg=name(get('패키지',r.패키지ID));
      const tick=(year,value,caption)=>`<div class="era-tick" style="--at:${offset(year)}%;--shift:${year===low?0:year===high?-100:-50}%">${endpoint(value,caption)}</div>`;
      ruler=`<figure class="era-scale"><div class="scale-track"${(end-start)/(high-low)<.3?' data-short-range':''} style="--from:${offset(start)}%;--to:${offset(end)}%;--tick:${100/(high-low)}%"><b aria-hidden="true"></b>${tick(start,r.시작일,'시작')}${tick(end,r.종료일,'종료')}</div><figcaption><time>${low}</time><span>${pkg?esc(pkg)+' · ':''}시기 범위</span><time>${high}</time></figcaption></figure>`;
    }
    const header=`<header class="era-cover">${categoryTitle(r,mini)}${ruler}</header>`;
    if(mini)return header;
    const description=prose(r.설명);
    const references=categorySources(r);
    const overview=description?box('시기 설명',description+references,'era-description'):references;
    return header+`<div class="era-body"><div class="era-context">${overview}${yearChart(members)}</div>
      <div class="era-events">${box('이 시기의 사건 · '+members.length+'건',list(members))}</div>
      <div class="era-notes">${box('역사 관계',relationList(relations(r)))}${geoSection(r)}</div></div>`;
  }

  function arcView(r,members,mini){
    const ids=new Set(members.map(key));
    const edges=rows.관계.filter(edge=>ids.has(edge.출발ID)&&ids.has(edge.도착ID)&&edge.출발ID!==edge.도착ID);
    // Prefer two consecutive source rows that actually connect three distinct events.
    let path=edges.slice(0,1);
    for(const first of edges){
      const next=edges.find(edge=>edge.출발ID===first.도착ID&&edge.도착ID!==first.출발ID);
      if(next){path=[first,next];break;}
    }
    let flow;
    if(path.length){
      flow=relationList(path,{nodeStyle:'dated',mini});
    }else{
      const featured=members.filter((e,i)=>i===0||i===Math.floor((members.length-1)/2)||i===members.length-1);
      const stations=featured.map(event=>`<div class="flow-stop"><time>${esc(event.날짜)}</time><i aria-hidden="true"></i>${jump(event)}</div>`).join('<div class="flow-connector"><i aria-hidden="true"></i></div>');
      flow=stations?`<div class="flow-stations"${featured.some(e=>e.날짜.length>4)?' data-full-dates':''}>${stations}</div>`:'';
    }
    const header=`<header class="flow-cover"><div class="flow-heading">${categoryTitle(r,mini)}<p>${markedDates(date(r))}</p></div>${flow?'<figure class="flow-route"><figcaption>'+(path.length?'사건 사이의 관계':'시간 순서로 본 사건')+'</figcaption>'+flow+'</figure>':''}</header>`;
    if(mini)return header;
    const years=new Map();
    for(const event of members){
      const y=event.날짜.slice(0,4);
      if(!years.has(y))years.set(y,[]);
      years.get(y).push(event);
    }
    function monthDay(event){
      const [,month,day]=event.날짜.split('-');
      return month?'<small>'+esc(Number(month)+'월'+(day?' '+Number(day)+'일':''))+'</small>':'';
    }
    const timeline=Array.from(years,([y,rs])=>`<li><time>${esc(y)}</time><div>${rs.map(event=>'<div>'+jump(event)+monthDay(event)+'</div>').join('')}</div></li>`).join('');
    return header+`<div class="flow-body"><section><h3>전체 사건 흐름 <small>${members.length}건</small></h3><ol class="flow-years">${timeline}</ol></section><aside>${prose(r.설명)}${categorySources(r)}${yearChart(members)}${box('역사 관계',relationList(relations(r)))}${geoSection(r)}</aside></div>`;
  }

  function themeView(r,members,mini){
    const grouped=new Map();
    for(const event of members){
      const periods=categories(event).filter(p=>p.카테고리유형==='period');
      for(const p of new Set(periods.length?periods:[null])){
        if(!grouped.has(p))grouped.set(p,[]);
        grouped.get(p).push(event);
      }
    }
    const groups=Array.from(grouped).sort(([a],[b])=>!a?1:!b?-1:a.시작일.localeCompare(b.시작일)||a.n-b.n);
    const branches=groups.map(([p,rs])=>{
      const entry=rs.find(e=>e.중요도==='core')||rs[0];
      return `<li class="theme-branch"><div class="branch-period">${p?jump(p):'<strong>시기 미기재</strong>'}<small>${rs.length}건</small></div><div class="branch-example"><time>${esc(entry.날짜)}</time>${jump(entry)}</div></li>`;
    }).join('');
    const header=`<header class="theme-network"><div class="theme-root">${categoryTitle(r,mini)}<time>${esc(date(r))}</time></div>${branches?'<ul class="theme-branches" aria-label="주제에 연결된 시기와 사건">'+branches+'</ul>':''}</header>`;
    if(mini)return header;
    const shelves=groups.map(([p,rs])=>`<section class="theme-shelf"><h4>${p?jump(p):'시기 미기재'}</h4>${p?'<time>'+esc(date(p))+'</time>':''}${list(rs)}</section>`).join('');
    return header+`<div class="theme-body"><div class="theme-intro">${prose(r.설명)}${categorySources(r)}</div>${box('시기별 관련 사건','<div class="theme-shelves">'+shelves+'</div>')}<div class="theme-notes"><div>${yearChart(members)}${box('역사 관계',relationList(relations(r)))}</div>${geoSection(r)}</div></div>`;
  }

  function categoryView(r,mini=false){
    const members=events(r);
    if(r.카테고리유형==='period')return periodView(r,members,mini);
    if(r.카테고리유형==='arc')return arcView(r,members,mini);
    if(r.카테고리유형==='theme')return themeView(r,members,mini);
    const head=`<div class="actor-seal">${esc(name(r).slice(0,1))}</div><div class="index-heading"><span>${esc(label(r.구분))}</span>${title(name(r),mini)}<time>${esc(date(r))}</time></div>`;
    if(mini)return head+prose(r.소개);
    const memberList=members.map(e=>`<div class="actor-row"><time>${esc(e.날짜)}</time> ${jump(e)} <small>${esc(label(participants(e).find(x=>key(x.actor)===key(r))?.role))}</small></div>`).join('');
    return head+`<div class="record-columns"><div>${prose(r.소개||r.설명)}${prose(r['기간 설명'])}${facts([['원어명',r.원어명],['성향',r.성향],['검토 상태',label(r.검토상태)]])}${yearChart(members)}${geoSection(r)}</div><div>${box('참여 사건 · '+members.length+'건',memberList)}${box('역사 관계',relationList(relations(r)))}</div></div>`;
  }
  function shapeDetails(sh,includeDate=false){
    if(!sh)return '';
    const fields=['도형유형','데이터형식','파일경로','외부도형ID','좌표상태'];
    if(includeDate)fields.push('기준시점');
    return `<div class="map-key">${facts([...fields.map(f=>[f,sh[f]||'미기재']),...(sh.geometryInfo?[['실제 지오메트리',sh.geometryInfo]]:[])])}${prose(sh['도형 추출·사용 설명'])}</div>`;
  }
  function shapeSources(sh,primary=''){
    if(!sh)return '';
    return sources(primary,source(sh.지도데이터URL,'원본 도형 파일'),key(sh)==='geo_berlin_wall'?source(get('지도도형','geo_germany')?.출처,'위치도 원자료'):'')+(!/^https?:/i.test(sh.출처)?prose(sh.출처):'');
  }
  function mapView(s,mini=false){
    const sh=get('지도도형',s.지도참조키);
    const note=sh?.기준시점||s.공간유형;
    const header=`<header class="map-caption">${title(name(s),mini)}${note?`<p>${markedDates(note)}</p>`:''}</header>`;
    const cover=mapGraphic(s)+header;
    if(mini)return cover;
    const metadata=[['시대별 명칭',s.시대별칭],['상위 공간',name(get('공간',s.상위공간ID))]].filter(([,value])=>value);
    const dossier=box('공간 기록',prose(placeIntroduction(s))+(metadata.length?facts(metadata):''))+box('도형 정보',shapeDetails(sh));
    const references=shapeSources(sh,source(sh?.출처,'지도 원자료'));
    return cover+`<div class="map-dossier">${dossier}</div>`+(references?`<footer class="map-sources"><h3>출처</h3>${references}</footer>`:'');
  }
  return {shapeDetails,shapeSources,mapView,rows,get,key,find,name,esc,date,markedDates,isDateField,events,ordered,categories,participants,places,relations,label,workbook,sources,source,go,route,jump,box,prose,facts,list,photo,imageCredits,imageUrls,yearChart,mapGraphic,placeIntroduction,geoSection,participantSection,relationList,relationCard,chips,title,eventView,categoryView};
};
