'use strict';
globalThis.SheetData = (() => {
  const fields = {
    events:['event_id','title','start_date','end_date','summary','short_title','date_qualifier','inquiry_question','game_eligible','review_status','source_id','origin_ref'],
    topics:['topic_id','name','parent_topic_id'], event_topics:['event_id','topic_id'],
    people:['person_id','name'], actors:['actor_id','name','actor_type'],
    offices:['office_id','country_id','institution_id','title','review_status'],
    tenures:['tenure_id','person_id','office_id','start_date','end_date','date_qualifier','review_status'],
    event_actors:['event_id','actor_id','role'], places:['place_id','name','latitude','longitude','location_precision'],
    event_places:['event_id','place_id','role','is_primary'], sources:['source_id','title','url'],
    source_leader_tags:['event_id','person_id','actor_id','source_label'],
    media_assets:['media_id','title','media_type','url'], event_media:['event_id','media_id','sort_order','caption'],
    map_assets:['asset_id','url','format'], boundary_versions:['boundary_version_id','actor_id','asset_id','start_date','end_date','review_status'],
    event_relations:['from_event_id','to_event_id','relation_type','review_status','source_id','citation_detail','notes']
  };
  const feedFields = {
    events:['event_id','title','start_date','summary','images','country_names','category_names','us_leader','ussr_leader','date_qualifier','game_eligible','review_status','end_date'],
    countries:['actor_id','name','actor_type','iso3'],
    tenure_periods:['tenure_id','country_id','name','office_title','start_date','end_date','notes','person_id','original_name','institution_id','office_id','role_type','office_start_date','office_end_date','office_order','office_status','date_qualifier','appointment_type','review_status','office_notes'],
    categories:['topic_id','name','parent_topic_id','sort_order'],
    event_countries:['event_id','actor_id','role'],
    event_categories:['event_id','topic_id']
  };
  const fail = message => { throw new Error(message); };
  const text = value => String(value ?? '');
  const boolean = value => value === true || value === 'TRUE' ? true : value === false || value === 'FALSE' ? false : fail('체크박스는 TRUE 또는 FALSE여야 합니다.');
  function url(value) {
    if (!value) return '';
    const parsed = new URL(value);
    if (!['https:','http:'].includes(parsed.protocol)) fail('허용되지 않는 링크입니다.');
    return parsed.href;
  }
  function dateRange(value) {
    const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(text(value));
    if (!match || Number(match[1]) < 1) fail('날짜는 YYYY, YYYY-MM, YYYY-MM-DD 형식이어야 합니다.');
    const year = Number(match[1]), month = Number(match[2] || 1), day = Number(match[3] || 1);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
    if (month < 1 || month > 12 || day < 1 || day > days[month-1]) fail('달력에 없는 날짜입니다.');
    const stamp = (m,d) => Date.parse(`${match[1]}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}T00:00:00Z`);
    return {year,start:stamp(month,day),end:stamp(match[2]?month:12,match[3]?day:match[2]?days[month-1]:31)};
  }
  function parseCSV(input) {
    const rows = []; let row = [], cell = '', quoted = false, closed = false;
    const source = input.replace(/^\uFEFF/,'');
    for (let i=0;i<source.length;i++) {
      const char = source[i];
      if (quoted) {
        if (char === '"' && source[i+1] === '"') {cell += '"'; i++;}
        else if (char === '"') {quoted=false; closed=true;}
        else cell += char;
      } else if (char === '"') {
        if (cell || closed) fail('CSV 인용 부호가 잘못됐습니다.');
        quoted=true;
      } else if (char === ',' || char === '\n' || char === '\r') {
        row.push(cell); cell=''; closed=false;
        if (char !== ',') { rows.push(row); row=[]; if(char==='\r'&&source[i+1]==='\n')i++; }
      } else {if(closed) fail('CSV 인용 부호 뒤에 문자가 있습니다.'); cell+=char;}
    }
    if (quoted) fail('CSV가 끝까지 오지 않았습니다.');
    if (cell || closed || row.length) {row.push(cell); rows.push(row);}
    return rows.filter(row=>row.some(value=>value!==''));
  }
  function readFeedTables(rows) {
    const tables = {}, headers = {};
    for (const [name,...cells] of rows) {
      if (!Object.hasOwn(feedFields,name)) fail('앱 출력 탭의 형식이 잘못됐습니다.');
      if (!headers[name]) {
        const keys = cells.filter(Boolean);
        if(new Set(keys).size!==keys.length || feedFields[name].some(key=>!keys.includes(key))) fail(`${name} 헤더를 확인하세요.`);
        headers[name]=keys; tables[name]=[];
      } else tables[name].push(Object.fromEntries(headers[name].map((key,i)=>[key,cells[i]??''])));
    }
    if(Object.keys(feedFields).some(name=>!headers[name]))fail('사건·국가·재임기간·카테고리 시트 형식이 아직 게시되지 않았습니다.');
    return tables;
  }
  const decodeFeed = rows => relationalTables(readFeedTables(rows));
  function relationalTables(input) {
    if(!Object.hasOwn(input,'countries')&&!Object.hasOwn(input,'tenure_periods')&&!Object.hasOwn(input,'categories'))return input;
    if(Object.keys(input).some(name=>!Object.hasOwn(feedFields,name)))fail('이전 탭 형식과 현재 형식을 섞지 마세요.');
    for(const [name,required] of Object.entries(feedFields)) {
      if(!Array.isArray(input[name])||input[name].some(row=>required.some(key=>!Object.hasOwn(row,key))))fail(`${name}에 필요한 열이 없습니다.`);
    }
    const tables=Object.fromEntries(Object.keys(fields).map(name=>[name,[]]));
    tables.actors=input.countries;tables.topics=input.categories;
    tables.event_actors=input.event_countries;tables.event_topics=input.event_categories;
    const people=new Map(),offices=new Map();
    const unique=(map,id,row,label)=>{
      if(!text(id).trim())fail(`${label} ID가 비었습니다.`);
      if(map.has(id)&&JSON.stringify(map.get(id))!==JSON.stringify(row))fail(`같은 ${label} ID의 내용이 다릅니다.`);
      map.set(id,row);
    };
    for(const row of input.tenure_periods) {
      if(!text(row.name).trim()||!text(row.office_title).trim())fail('재임자 이름과 직위를 확인하세요.');
      if(!['stated','approximate'].includes(row.date_qualifier)||!['regular','acting','interim'].includes(row.appointment_type)||!['draft','verified'].includes(row.review_status)||!['draft','verified'].includes(row.office_status))fail('재임 기간의 날짜 유형·역할·검토 상태를 확인하세요.');
      const start=row.office_start_date?dateRange(row.office_start_date):null,end=row.office_end_date?dateRange(row.office_end_date):null;
      if(end&&(!start||start.start>end.end))fail('직위의 존재 기간을 확인하세요.');
      unique(people,row.person_id,{person_id:row.person_id,name:row.name,original_name:row.original_name},'인물');
      unique(offices,row.office_id,{office_id:row.office_id,country_id:row.country_id,institution_id:row.institution_id,title:row.office_title,role_type:row.role_type,start_date:row.office_start_date,end_date:row.office_end_date,display_order:row.office_order,review_status:row.office_status,notes:row.office_notes},'직위');
      tables.tenures.push({tenure_id:row.tenure_id,person_id:row.person_id,office_id:row.office_id,start_date:row.start_date,end_date:row.end_date,date_qualifier:row.date_qualifier,appointment_type:row.appointment_type,review_status:row.review_status,source_id:'',notes:row.notes});
    }
    tables.people=[...people.values()];tables.offices=[...offices.values()];
    const byOriginalName=new Map();
    for(const person of tables.people)if(person.original_name){
      if(byOriginalName.has(person.original_name))fail('지도자 원어명이 중복되어 인물을 구별할 수 없습니다.');
      byOriginalName.set(person.original_name,person);
    }
    const lines=value=>text(value).split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
    for(const row of input.events) {
      tables.events.push({event_id:row.event_id,title:row.title,start_date:row.start_date,end_date:row.end_date,summary:row.summary,short_title:'',date_qualifier:row.date_qualifier,inquiry_question:'',game_eligible:row.game_eligible,review_status:row.review_status,source_id:'',origin_ref:''});
      for(const [index,image] of lines(row.images).entries()) {
        const media_id=`${row.event_id}_image_${index+1}`;
        tables.media_assets.push({media_id,title:`${row.title} 사진 ${index+1}`,media_type:'image',url:image});
        tables.event_media.push({event_id:row.event_id,media_id,sort_order:index,caption:''});
      }
      for(const [key,actor_id]of [['us_leader','actor_usa'],['ussr_leader','actor_ussr']])for(const label of lines(row[key])){
        const person=byOriginalName.get(label);
        if(!person)fail('사건의 지도자 표기를 재임기간의 인물과 연결할 수 없습니다.');
        tables.source_leader_tags.push({event_id:row.event_id,person_id:person.person_id,actor_id,source_label:label});
      }
    }
    for(const row of tables.event_actors)if(!['initiator','counterparty','participant','mediator','affected'].includes(row.role))fail('사건 참여 역할을 확인하세요.');
    return tables;
  }
  function build(tables) {
    tables=relationalTables(tables);
    for (const [name,required] of Object.entries(fields)) {
      if(name==='event_relations'&&tables[name]===undefined)continue;
      if (!Array.isArray(tables[name])) fail(`${name} 탭을 읽지 못했습니다.`);
      for(const row of tables[name]) if(required.some(key=>!Object.hasOwn(row,key))) fail(`${name}에 필요한 열이 없습니다.`);
    }
    const masters = {};
    for (const [name,key] of Object.entries({events:'event_id',topics:'topic_id',people:'person_id',actors:'actor_id',offices:'office_id',tenures:'tenure_id',places:'place_id',sources:'source_id',media_assets:'media_id',map_assets:'asset_id',boundary_versions:'boundary_version_id'})) {
      masters[name] = new Map();
      for (const row of tables[name]) {
        if(!text(row[key]).trim() || masters[name].has(row[key])) fail(`${name} ID가 비었거나 중복됐습니다.`);
        masters[name].set(row[key],row);
      }
    }
    if (!tables.events.length) fail('빈 사건 목록으로 기존 데이터를 바꾸지 않았습니다.');
    const links = {events:{source_id:'sources'}, topics:{parent_topic_id:'topics'},event_topics:{event_id:'events',topic_id:'topics'},offices:{country_id:'actors',institution_id:'actors'},tenures:{person_id:'people',office_id:'offices',source_id:'sources'},event_actors:{event_id:'events',actor_id:'actors'},event_places:{event_id:'events',place_id:'places'},source_leader_tags:{event_id:'events',person_id:'people',actor_id:'actors'},event_media:{event_id:'events',media_id:'media_assets'},boundary_versions:{actor_id:'actors',asset_id:'map_assets'}};
    const optional = new Set(['events.source_id','tenures.source_id','topics.parent_topic_id','offices.country_id','offices.institution_id']);
    for(const [name,columns] of Object.entries(links)) for(const row of tables[name]) for(const [key,target] of Object.entries(columns)) {
      if (!row[key] && optional.has(`${name}.${key}`)) continue;
      if (!masters[target].has(row[key])) fail(`${name}.${key}에 연결되지 않은 ID가 있습니다.`);
    }
    for(const [name,keys] of Object.entries({event_topics:['event_id','topic_id'],event_actors:['event_id','actor_id','role'],event_places:['event_id','place_id','role'],event_media:['event_id','media_id'],source_leader_tags:['event_id','person_id','actor_id']})) {
      const values=tables[name].map(row=>JSON.stringify(keys.map(key=>row[key])));
      if(new Set(values).size!==values.length) fail(`${name} 관계가 중복됐습니다.`);
    }
    for(const topic of tables.topics) {
      const seen = new Set(); let current=topic;
      while(current) {if(seen.has(current.topic_id))fail('주제의 상위 관계가 순환합니다.');seen.add(current.topic_id);current=masters.topics.get(current.parent_topic_id);}
    }
    for(const office of tables.offices) {
      if(!office.country_id&&!office.institution_id) fail('직위에는 국가 또는 기관이 필요합니다.');
      if(office.country_id&&!['state','territory'].includes(masters.actors.get(office.country_id).actor_type)) fail('직위의 국가 유형을 확인하세요.');
      if(office.institution_id&&masters.actors.get(office.institution_id).actor_type!=='organization') fail('직위의 기관 유형을 확인하세요.');
    }
    const coordinates = new Map();
    for(const place of tables.places) {
      const lat=text(place.latitude).trim(),lon=text(place.longitude).trim();
      if(!lat&&!lon) continue;
      if(!lat||!lon||!Number.isFinite(Number(lat))||!Number.isFinite(Number(lon))||Math.abs(Number(lat))>90||Math.abs(Number(lon))>180)fail('장소 좌표의 범위를 확인하세요.');
      coordinates.set(place.place_id,[Number(lon),Number(lat)]);
    }
    const primary = new Map();
    for(const link of tables.event_places) if(boolean(link.is_primary)) {
      if(primary.has(link.event_id))fail('사건의 기본 장소는 하나만 지정하세요.');
      primary.set(link.event_id,link.place_id);
    }
    const tenureRanges = tables.tenures.map(row=>{
      if(!['stated','approximate'].includes(row.date_qualifier))fail('재임 날짜의 확실성 구분을 확인하세요.');
      const start=dateRange(row.start_date),end=row.end_date?dateRange(row.end_date):null;
      if(end&&start.start>end.end)fail('재임 종료일이 시작일보다 빠릅니다.');
      return {...row,start,end};
    });
    const relations=(tables.event_relations||[]).map(row=>{
      if(!masters.events.has(row.from_event_id)||!masters.events.has(row.to_event_id)||row.from_event_id===row.to_event_id)fail('사건 관계의 ID를 확인하세요.');
      if(!['causes','responds_to','part_of'].includes(row.relation_type)||!['draft','verified'].includes(row.review_status)||(row.source_id&&!masters.sources.has(row.source_id)))fail('사건 관계의 유형과 출처를 확인하세요.');
      return {id:JSON.stringify([row.from_event_id,row.to_event_id,row.relation_type]),from:row.from_event_id,to:row.to_event_id,type:row.relation_type,status:row.review_status,notes:row.notes,citation:row.citation_detail,source:url(masters.sources.get(row.source_id)?.url)};
    });
    if(new Set(relations.map(row=>row.id)).size!==relations.length)fail('사건 관계가 중복됐습니다.');
    function visit(id,path=new Set()) {
      if(path.has(id))fail('사건 구성 관계가 순환합니다.');
      const next=new Set(path);next.add(id);
      for(const row of relations.filter(row=>row.from===id&&row.type==='part_of'))visit(row.to,next);
    }
    for(const row of relations.filter(row=>row.type==='part_of'))visit(row.from);
    for(const asset of [...tables.map_assets,...tables.media_assets])url(asset.url);
    const events = tables.events.map(row=>{
      if(!text(row.title).trim() || !['draft','verified'].includes(row.review_status) || !['stated','approximate'].includes(row.date_qualifier))fail('사건 이름과 검토 상태를 확인하세요.');
      const bounds=dateRange(row.start_date),end=row.end_date?dateRange(row.end_date):null;
      if(end&&bounds.start>end.end)fail('사건 종료일이 시작일보다 빠릅니다.');
      const directTopics=tables.event_topics.filter(link=>link.event_id===row.event_id).map(link=>masters.topics.get(link.topic_id));
      const topicIds=new Set();
      for(const topic of directTopics){let current=topic;while(current){topicIds.add(current.topic_id);current=masters.topics.get(current.parent_topic_id);}}
      const places=tables.event_places.filter(link=>link.event_id===row.event_id).map(link=>masters.places.get(link.place_id));
      const actors=tables.event_actors.filter(link=>link.event_id===row.event_id).map(link=>link.actor_id);
      const leaders=tenureRanges.filter(tenure=>{
        const office=masters.offices.get(tenure.office_id);
        return tenure.review_status==='verified' && tenure.date_qualifier==='stated' && office.review_status==='verified' && actors.includes(office.country_id) && tenure.start.end<=bounds.start && (!tenure.end||tenure.end.start>=bounds.end);
      }).map(tenure=>`${masters.offices.get(tenure.office_id).title} · ${masters.people.get(tenure.person_id).name}`);
      const leaderTags=tables.source_leader_tags.filter(link=>link.event_id===row.event_id).map(link=>`${masters.actors.get(link.actor_id).name} · ${masters.people.get(link.person_id).name}`);
      const media=tables.event_media.filter(link=>link.event_id===row.event_id).sort((a,b)=>Number(a.sort_order)-Number(b.sort_order)).map(link=>({...masters.media_assets.get(link.media_id),caption:link.caption}));
      const primaryPlace=masters.places.get(primary.get(row.event_id));
      const placeLabel=places.map(place=>place.name).join(' · ');
      return {id:row.event_id,year:bounds.year,date:row.start_date,dateQualifier:row.date_qualifier,endDate:row.end_date,bounds,title:row.title,shortTitle:row.short_title||row.title,description:row.summary,question:row.inquiry_question,place:placeLabel,point:coordinates.get(primary.get(row.event_id))||null,locationPrecision:primaryPlace?.location_precision,category:directTopics.map(topic=>topic.name).join(' · '),topicIds:[...topicIds],directTopicIds:directTopics.map(topic=>topic.topic_id),actorIds:[...new Set(actors)],tagActorIds:[...new Set(tables.source_leader_tags.filter(link=>link.event_id===row.event_id).map(link=>link.actor_id))],leaders,leaderTags,media,source:url(row.origin_ref||masters.sources.get(row.source_id)?.url),reviewStatus:row.review_status,gameEligible:boolean(row.game_eligible)&&row.review_status==='verified'&&row.date_qualifier==='stated'};
    }).sort((a,b)=>a.bounds.start-b.bounds.start||a.bounds.end-b.bounds.end||a.id.localeCompare(b.id));
    const topics=[...tables.topics].sort((a,b)=>Number(a.sort_order)-Number(b.sort_order));
    const tenures=tenureRanges.map(row=>{
      const office=masters.offices.get(row.office_id),person=masters.people.get(row.person_id);
      return {id:row.tenure_id,actorId:office.country_id,officeId:row.office_id,title:office.title,person:person.name,start:row.start,end:row.end,startDate:row.start_date,endDate:row.end_date,status:row.review_status==='verified'&&office.review_status==='verified'?'verified':'draft',source:url(masters.sources.get(row.source_id)?.url||row.notes?.match(/https?:\/\/[^\s]+/)?.[0])};
    });
    return {events,topics,actors:tables.actors,tenures,relations,years:[...new Set(events.map(event=>event.year))].sort((a,b)=>a-b)};
  }
  function gamePool(events) {
    const result=[];
    for(const event of events.filter(event=>event.gameEligible).sort((a,b)=>a.bounds.end-b.bounds.end)) if(!result.length||result.at(-1).bounds.end<event.bounds.start)result.push(event);
    return result;
  }
  return {parseCSV,readFeedTables,decodeFeed,build,dateRange,gamePool};
})();
