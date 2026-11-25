'use strict';
globalThis.SheetData = (() => {
  const fields = {
    events:['event_id','title','start_date','end_date','summary','short_title','date_qualifier','inquiry_question','game_eligible','review_status','source_id','origin_ref'],
    topics:['topic_id','name'], event_topics:['event_id','topic_id'],
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
    events:['event_id','title','start_date','summary','images','country_names','category_names','date_qualifier','game_eligible','review_status','end_date'],
    countries:['actor_id','name','actor_type','iso3'],
    tenure_periods:['tenure_id','country_id','name','office_title','start_date','end_date','notes','person_id','original_name','institution_id','office_id','role_type','office_start_date','office_end_date','office_order','office_status','date_qualifier','appointment_type','review_status','office_notes'],
    categories:['topic_id','name'],
    event_countries:['event_id','actor_id','role'],
    event_categories:['event_id','topic_id'],
    event_packages:['event_id','package_id']
  };
  const requiredFeedNames=Object.keys(feedFields).filter(name=>name!=='event_packages');
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
  function parseCSV(input, keepEmptyRows = false, delimiter = ',') {
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
      } else if (char === delimiter || char === '\n' || char === '\r') {
        row.push(cell); cell=''; closed=false;
        if (char !== delimiter) { rows.push(row); row=[]; if(char==='\r'&&source[i+1]==='\n')i++; }
      } else {if(closed) fail('CSV 인용 부호 뒤에 문자가 있습니다.'); cell+=char;}
    }
    if (quoted) fail('CSV가 끝까지 오지 않았습니다.');
    if (cell || closed || row.length) {row.push(cell); rows.push(row);}
    return keepEmptyRows ? rows : rows.filter(row=>row.some(value=>value!==''));
  }
  function readFeedTables(rows) {
    const tables = {}, headers = {};
    for (const [name,...cells] of rows) {
      if (!Object.hasOwn(feedFields,name)) fail('앱 출력 탭의 형식이 잘못됐습니다.');
      if (!headers[name]) {
        const keys = cells.filter(Boolean);
        if(new Set(keys).size!==keys.length || feedFields[name].some(key=>!keys.includes(key))) fail(`${name} 헤더를 확인하세요.`);
        headers[name]=keys; tables[name]=[];
      } else if(!headers[name].some((key,i)=>key.endsWith('_id')&&cells[i]?.startsWith('draft:'))){
        tables[name].push(Object.fromEntries(headers[name].map((key,i)=>[key,cells[i]??''])));
      }
    }
    if(requiredFeedNames.some(name=>!headers[name]))fail('사건·국가·재임기간·카테고리 시트 형식이 아직 게시되지 않았습니다.');
    return tables;
  }
  const eventCategoryTypes=Object.freeze({시기:'period',사건군:'arc',주제:'theme'});
  const previousCategoryNames = new Map([
    ['japan_manchuria', '만주·연해주'],
    ['japan_china', '중국 관내'],
    ['japan_allied', '연합군 협력']
  ]);
  function categoryLinks(events,categories) {
    const labels=new Map();
    for(const category of categories) {
      for(const label of new Set([category.topic_id,category.name,previousCategoryNames.get(category.topic_id)].filter(Boolean))) {
        if(!labels.has(label))labels.set(label,[]);
        labels.get(label).push(category);
      }
    }
    const split=value=>text(value).split(/[,;|]/).map(item=>item.trim()).filter(Boolean);
    return events.flatMap(row=>{
      const event_id=text(row['사건ID']).trim();
      if(!event_id)return [];
      const typed=Object.keys(eventCategoryTypes).some(field=>Object.hasOwn(row,field));
      const ids=typed?Object.entries(eventCategoryTypes).flatMap(([field,type])=>split(row[field]).map(label=>{
        const matches=(labels.get(label)||[]).filter(item=>!item.category_type||item.category_type===type);
        if(matches.length!==1)fail(`${event_id}의 ${field} 카테고리를 확인하세요: ${label}`);
        return matches[0].topic_id;
      })):split(row['카테고리ID']);
      return [...new Set(ids)].map(topic_id=>({event_id,topic_id}));
    });
  }
  async function sheetCSV(config,name,request=fetch) {
    const gid=config.sheetIds?.[name]??{사건:config.eventSheetId,카테고리:config.categorySheetId,
      관계:config.relationSheetId,공간:config.spaceSheetId,사건_공간:config.eventSpaceSheetId}[name];
    const endpoint=gid?'export':'gviz/tq';
    const source=new URL(`https://docs.google.com/spreadsheets/d/${config.id}/${endpoint}`);
    source.search=new URLSearchParams(gid?{format:'csv',gid:String(gid)}:{sheet:name,headers:'1',tqx:'out:csv'});
    const response=await request(source,{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(10000)});
    if(!response.ok)fail(`${name} 탭을 읽지 못했습니다.`);
    const text=await response.text();
    // Some published versions of the space table have a mistyped first column.
    const csv=name==='공간'?text.replace(/^\uFEFF?(?:"ㅇ"|ㅇ)(?=,)/,'공간ID'):text;
    if(!csv.includes('작성 중'))return csv;
    const [header,...rows]=parseCSV(csv,true),column=header.indexOf('작성상태');
    if(column<0)return csv;
    // Keep sheet row numbers stable for original-row links.
    return [header,...rows.map(row=>row[column]==='작성 중'?[]:row)].map(row=>row.map(value=>'"'+value.replaceAll('"','""')+'"').join(',')).join('\n');
  }
  const eventSheetCSV=(config,request)=>sheetCSV(config,'사건',request);
  async function sheetRecords(config,name,required,request,includeRowNumber=false) {
    const [header=[],...rows]=parseCSV(await sheetCSV(config,name,request),includeRowNumber);
    if(!required.every(field=>header.includes(field)))fail(`${name} 탭의 열을 확인하세요.`);
    return rows.flatMap((row,index)=>{
      if(includeRowNumber && !row.some(value=>value!==''))return [];
      const record=Object.fromEntries(header.flatMap((field,i)=>field?[[field,text(row[i]).trim()]]:[]));
      if(includeRowNumber)record.sheetRow=index+2;
      return [record];
    });
  }
  async function readCategoryLinks(config,request=fetch) {
    const rows=await sheetRecords(config,'사건_카테고리',['사건ID','카테고리ID'],request);
    return rows.map(row=>({event_id:row.사건ID,topic_id:row.카테고리ID}));
  }
  function linkedSpaceNames(spaces,links,field) {
    const names=new Map(spaces.map(row=>[row.공간ID,row.공간명]));
    const byRecord=new Map();
    for(const link of links) {
      const key=link[field],name=names.get(link.공간ID);
      if(!key||!name)continue;
      if(!byRecord.has(key))byRecord.set(key,new Set());
      byRecord.get(key).add(name);
    }
    return byRecord;
  }
  async function readPublishedTables(rows,config,request=fetch) {
    const hasLinkTable=rows.some(row=>row[0]==='event_categories');
    const brokenLinks=rows.at(-2)?.[0]==='event_categories'&&rows.at(-2)?.[1]==='event_id'&&rows.at(-1)?.[0]==='#REF!';
    const tables=readFeedTables(!hasLinkTable?[...rows,['event_categories','event_id','topic_id']]:brokenLinks?rows.slice(0,-1):rows);
    const needsLinks=!hasLinkTable||brokenLinks;
    const isoDate=/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/;
    const needsStartDates=tables.events.some(row=>!isoDate.test(row.start_date));
    const needsEndDates=tables.events.some(row=>row.end_date&&!isoDate.test(row.end_date));
    const needsMetadata=tables.events.some(row=>!row.date_qualifier||!row.review_status||!row.game_eligible);
    const needsPackages=Boolean(config.sheetIds?.사건_패키지&&!tables.event_packages);
    if(needsPackages) {
      const packages=await sheetRecords(config,'사건_패키지',['사건ID','패키지ID'],request);
      tables.event_packages=packages.map(row=>({event_id:row.사건ID,package_id:row.패키지ID}));
    }
    if(!needsLinks&&!needsStartDates&&!needsEndDates&&!needsMetadata)return tables;
    // The public feed can omit links and export formatted dates as serial numbers.
    const [header,...records]=parseCSV(await eventSheetCSV(config,request));
    const typed=Object.keys(eventCategoryTypes).every(field=>header?.includes(field));
    const separateLinks=!typed&&!header?.includes('카테고리ID')&&header?.includes('사건유형');
    if(!header?.includes('사건ID')||needsLinks&&!(typed||separateLinks||header.includes('카테고리ID'))||
       needsStartDates&&!header.includes('날짜')||needsEndDates&&!header.includes('종료일'))fail('사건 탭의 열을 확인하세요.');
    const sourceRows=new Map();
    for(const record of records) {
      const row=Object.fromEntries(header.map((field,index)=>[field,record[index]??'']));
      const id=row['사건ID'];
      if(!id)continue;
      if(sourceRows.has(id))fail('사건ID가 중복됐습니다.');
      sourceRows.set(id,row);
    }
    const matchedRows=tables.events.map(event=>{
      const sourceRow=sourceRows.get(event.event_id);
      if(!sourceRow)fail('사건 탭에서 사건ID를 찾지 못했습니다.');
      if(sourceRow['날짜'])event.start_date=sourceRow['날짜'];
      if(Object.hasOwn(sourceRow,'종료일'))event.end_date=sourceRow['종료일'];
      if(typed||separateLinks) {
        event.date_qualifier||='stated';
        event.review_status||='summary';
        event.game_eligible||='FALSE';
      }
      return sourceRow;
    });
    if(needsLinks) {
      const publishedIds=new Set(tables.events.map(event=>event.event_id));
      tables.event_categories=separateLinks?(await readCategoryLinks(config,request)).filter(row=>publishedIds.has(row.event_id)):
        categoryLinks(matchedRows,tables.categories);
    }
    return tables;
  }
  const decodeFeed = rows => relationalTables(readFeedTables(rows));
  function readRelations([header,...rows],packageId,data) {
    const keys=['관계ID','패키지ID','출발유형','출발ID','도착유형','도착ID','관계유형','라벨','설명','출처','검토상태'];
    const columns=keys.map(key=>header?.indexOf(key)??-1);
    if(columns.includes(-1))fail('관계 탭의 머리글을 확인하세요.');
    const targets={
      event:new Set(data.events.map(event=>event.id)),
      actor:new Set(data.actors.map(actor=>actor.actor_id)),
      category:new Set((data.topics||[]).map(topic=>topic.topic_id))
    };
    const ids=new Set();
    return rows.flatMap(row=>{
      const [id,pkg,fromType,from,toType,to,type,label,notes,source,status]=columns.map(i=>text(row[i]).trim());
      if(pkg!==packageId)return [];
      if(!id||ids.has(id)||!Object.hasOwn(targets,fromType)||!targets[fromType].has(from)||
        !Object.hasOwn(targets,toType)||!targets[toType].has(to)||(fromType===toType&&from===to)||
        !['cause','succession','split','integration','shift','action','background'].includes(type)||
        !['draft','verified'].includes(status))fail('관계 탭의 ID, 유형, 연결 대상을 확인하세요.');
      ids.add(id);
      return [{id,fromType,from,toType,to,type,label,notes,source:url(source),status}];
    });
  }
  function linkedActors(events,actors) {
    const used=new Set(events.flatMap(event=>event.actorIds));
    return actors.filter(actor=>used.has(actor.actor_id)).sort((a,b)=>a.name.localeCompare(b.name,'ko'));
  }
  function actorFilterOptions(events,actors) {
    const linked=linkedActors(events,actors);
    const groups=new Map();
    for(const actor of linked){
      const group=actor.actor_type==='person'?'인물':['state','territory'].includes(actor.actor_type)?'국가·지역':'단체·기관';
      if(!groups.has(group))groups.set(group,[]);
      groups.get(group).push(actor);
    }
    const leans=[...new Set(linked.map(actor=>text(actor.lean).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
    return {groups:[...groups],leans};
  }
  function filterActorEvents(events,actors,selection) {
    if(!selection)return events;
    const value=selection.slice(selection.indexOf(':')+1);
    const ids=new Set(selection.startsWith('actor:')?[value]:actors.filter(actor=>text(actor.lean).trim()===value).map(actor=>actor.actor_id));
    return events.filter(event=>event.actorIds.some(id=>ids.has(id)));
  }
  function orderCategories(categories,events,links) {
    const starts=new Map(events.map(row=>[row.event_id,dateRange(row.start_date).start]));
    const first=new Map();
    for(const {event_id,topic_id} of links) {
      const start=starts.get(event_id);
      if(start!==undefined&&start<(first.get(topic_id)??Number.MAX_VALUE))first.set(topic_id,start);
    }
    return [...categories].sort((a,b)=>(first.get(a.topic_id)??Number.MAX_VALUE)-(first.get(b.topic_id)??Number.MAX_VALUE)
      || a.name.localeCompare(b.name,'ko') || a.topic_id.localeCompare(b.topic_id));
  }
  function scopePackage(id,input) {
    if(!Array.isArray(input.categories))return input;
    const categories=input.categories.filter(row=>Object.hasOwn(row,'package_id')?row.package_id===id:id==='cold-war');
    const names=new Map(categories.map(row=>[row.topic_id,row.name]));
    const members=input.event_packages&&new Set(input.event_packages.filter(row=>row.package_id===id).map(row=>row.event_id));
    const event_categories=input.event_categories.filter(row=>names.has(row.topic_id)&&(!members||members.has(row.event_id)));
    const ordered=orderCategories(categories,input.events,event_categories);
    const rank=new Map(ordered.map((topic,index)=>[topic.topic_id,index]));
    event_categories.sort((a,b)=>rank.get(a.topic_id)-rank.get(b.topic_id));
    const topicsByEvent=new Map();
    for(const {event_id,topic_id} of event_categories){
      if(!topicsByEvent.has(event_id))topicsByEvent.set(event_id,[]);
      topicsByEvent.get(event_id).push(names.get(topic_id));
    }
    return {...input,
      categories:ordered,
      events:input.events.flatMap(row=>{
        const topics=topicsByEvent.get(row.event_id);
        return (members?members.has(row.event_id):topics)?[{...row,category_names:(topics||[]).join(', ')}]:[];
      }),
      event_categories,
      event_countries:input.event_countries.filter(row=>(members||topicsByEvent).has(row.event_id)),
    };
  }
  function relationalTables(input) {
    if(!Object.hasOwn(input,'countries')&&!Object.hasOwn(input,'tenure_periods')&&!Object.hasOwn(input,'categories'))return input;
    if(Object.keys(input).some(name=>!Object.hasOwn(feedFields,name)))fail('이전 탭 형식과 현재 형식을 섞지 마세요.');
    for(const [name,required] of Object.entries(feedFields)) {
      if(name==='event_packages'&&!Object.hasOwn(input,name))continue;
      if(!Array.isArray(input[name])||input[name].some(row=>required.some(key=>!Object.hasOwn(row,key))))fail(`${name}에 필요한 열이 없습니다.`);
    }
    const tables=Object.fromEntries(Object.keys(fields).map(name=>[name,[]]));
    tables.actors=input.countries;tables.topics=input.categories;
    tables.event_actors=input.event_countries.map(row=>({...row,role:row.actor_role||row.role}));tables.event_topics=input.event_categories;
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
      tables.events.push({event_id:row.event_id,legacy_event_id:row.legacy_event_id,title:row.title,start_date:row.start_date,end_date:row.end_date,summary:row.summary,event_type:row.event_type,origin_label:row.origin_label,short_title:'',date_qualifier:row.date_qualifier,inquiry_question:'',game_eligible:row.game_eligible,review_status:row.review_status,source_id:'',origin_ref:row.source_url??''});
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
    for(const row of tables.event_actors)if(!['initiator','counterparty','participant','mediator','affected','related','leader','executor','author','founder'].includes(row.role))fail('사건 참여 역할을 확인하세요.');
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
    const legacyIds = tables.events.flatMap(row=>row.legacy_event_id?[row.legacy_event_id]:[]);
    if(new Set(legacyIds).size!==legacyIds.length||legacyIds.some(id=>masters.events.has(id)))fail('기존 사건ID가 중복됐습니다.');
    const links = {events:{source_id:'sources'}, event_topics:{event_id:'events',topic_id:'topics'},offices:{country_id:'actors',institution_id:'actors'},tenures:{person_id:'people',office_id:'offices',source_id:'sources'},event_actors:{event_id:'events',actor_id:'actors'},event_places:{event_id:'events',place_id:'places'},source_leader_tags:{event_id:'events',person_id:'people',actor_id:'actors'},event_media:{event_id:'events',media_id:'media_assets'},boundary_versions:{actor_id:'actors',asset_id:'map_assets'}};
    const optional = new Set(['events.source_id','tenures.source_id','offices.country_id','offices.institution_id']);
    for(const [name,columns] of Object.entries(links)) for(const row of tables[name]) for(const [key,target] of Object.entries(columns)) {
      if (!row[key] && optional.has(`${name}.${key}`)) continue;
      if (!masters[target].has(row[key])) fail(`${name}.${key}에 연결되지 않은 ID가 있습니다.`);
    }
    for(const [name,keys] of Object.entries({event_topics:['event_id','topic_id'],event_actors:['event_id','actor_id','role'],event_places:['event_id','place_id','role'],event_media:['event_id','media_id'],source_leader_tags:['event_id','person_id','actor_id']})) {
      const values=tables[name].map(row=>JSON.stringify(keys.map(key=>row[key])));
      if(new Set(values).size!==values.length) fail(`${name} 관계가 중복됐습니다.`);
    }
    for(const office of tables.offices) {
      if(!office.country_id&&!office.institution_id) fail('직위에는 국가 또는 기관이 필요합니다.');
      if(office.country_id&&!['state','territory'].includes(masters.actors.get(office.country_id).actor_type)) fail('직위의 국가 유형을 확인하세요.');
      if(office.institution_id&&!['organization','army','institution'].includes(masters.actors.get(office.institution_id).actor_type)) fail('직위의 기관 유형을 확인하세요.');
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
    const topics=orderCategories(tables.topics,tables.events,tables.event_topics).map(({parent_topic_id,...topic})=>topic);
    const events = tables.events.map(row=>{
      if(!text(row.title).trim() || !['draft','verified','summary'].includes(row.review_status) || !['stated','approximate'].includes(row.date_qualifier))fail('사건 이름과 검토 상태를 확인하세요.');
      const bounds=dateRange(row.start_date),end=row.end_date?dateRange(row.end_date):null;
      if(end&&bounds.start>end.end)fail('사건 종료일이 시작일보다 빠릅니다.');
      const membership=new Set(tables.event_topics.filter(link=>link.event_id===row.event_id).map(link=>link.topic_id));
      const directTopics=topics.filter(topic=>membership.has(topic.topic_id));
      const topicIds=directTopics.map(topic=>topic.topic_id);
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
      if(row.event_type&&!['period','policy','event','context','publication'].includes(row.event_type))fail('사건유형을 확인하세요.');
      return {id:row.event_id,...(row.legacy_event_id?{legacyId:row.legacy_event_id}:{}),...(row.event_type?{eventType:row.event_type}:{}),...(row.origin_label?{originLabel:row.origin_label}:{}),year:bounds.year,date:row.start_date,dateQualifier:row.date_qualifier,endDate:row.end_date,bounds,title:row.title,shortTitle:row.short_title||row.title,description:row.summary,question:row.inquiry_question,place:placeLabel,point:coordinates.get(primary.get(row.event_id))||null,locationPrecision:primaryPlace?.location_precision,category:directTopics.map(topic=>topic.name).join(' · '),topicIds,directTopicIds:topicIds,actorIds:[...new Set(actors)],tagActorIds:[...new Set(tables.source_leader_tags.filter(link=>link.event_id===row.event_id).map(link=>link.actor_id))],leaders,leaderTags,media,source:url(row.origin_ref||masters.sources.get(row.source_id)?.url),reviewStatus:row.review_status,gameEligible:boolean(row.game_eligible)&&row.review_status==='verified'&&row.date_qualifier==='stated'};
    }).sort((a,b)=>a.bounds.start-b.bounds.start||a.bounds.end-b.bounds.end||a.id.localeCompare(b.id));
    const tenures=tenureRanges.map(row=>{
      const office=masters.offices.get(row.office_id),person=masters.people.get(row.person_id);
      return {id:row.tenure_id,actorId:office.country_id,officeId:row.office_id,organizationId:office.institution_id,personId:row.person_id,title:office.title,person:person.name,start:row.start,end:row.end,startDate:row.start_date,endDate:row.end_date,status:row.review_status==='verified'&&office.review_status==='verified'?'verified':'draft',source:url(masters.sources.get(row.source_id)?.url||row.notes?.match(/https?:\/\/[^\s]+/)?.[0])};
    });
    return {events,topics,actors:tables.actors,tenures,relations,years:[...new Set(events.map(event=>event.year))].sort((a,b)=>a-b)};
  }
  function gamePool(events) {
    const result=[];
    for(const event of events.filter(event=>event.gameEligible).sort((a,b)=>a.bounds.end-b.bounds.end)) if(!result.length||result.at(-1).bounds.end<event.bounds.start)result.push(event);
    return result;
  }
  return {parseCSV,readFeedTables,readPublishedTables,sheetCSV,sheetRecords,eventSheetCSV,readCategoryLinks,linkedSpaceNames,categoryLinks,eventCategoryTypes,readRelations,linkedActors,actorFilterOptions,filterActorEvents,decodeFeed,scopePackage,build,dateRange,gamePool,orderCategories};
})();
