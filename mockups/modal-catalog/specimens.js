const catalogue=(()=>{
  const {rows,get,key,find,name,esc,date,markedDates,isDateField,events,ordered,categories,participants,places,relations,label,sources,source,go,route,jump,box,prose,facts,list,photo,imageUrls,yearChart,mapGraphic,placeIntroduction,relationList,relationCard,chips,title,eventView,categoryView,shapeDetails,shapeSources,mapView}=records;
  const groups={read:'기록 탐색',quiz:'수업·퀴즈',map:'지도 제작',data:'데이터 편집',studio:'패키지 제작'};
  const adopted=new Set(['period','arc','theme','event','shape','actor','relations']);
  const items=[], byId=new Map();
  function add(id,group,name,layout,render){const item={id,group,name,layout,render};if(!adopted.has(id))items.push(item);byId.set(id,item);}
  const e=id=>get('사건',id), berlin=e('E018'), battle=e('E278'), march=e('E248'), gov=e('E306');
  const pkg=get('패키지','japan'),cat=get('카테고리','japan_manchuria'),actor=get('주체','org_uiyeoldan'),wall=get('공간','geo_berlin_wall');
  const rel=get('관계','R001'), shape=get('지도도형',wall.지도참조키);
  const japan=events(pkg), cats=rows.카테고리.filter(r=>r.패키지ID===key(pkg));
  const names=arr=>arr.map(name);
  const leaderLink=participants(battle).find(x=>x.role==='leader'&&x.actor.구분==='person'),answer=name(leaderLink.actor);
  const personChoices=['person_kim_wonbong',key(leaderLink.actor),'person_kim_jwajin','person_kim_gu'].map(id=>get('주체',id)).filter(Boolean);
  const order=ordered([march,gov,e('E187')]);
  const insert=[e('E187'),e('E279')],blankAnswer=gov.날짜.slice(0,4);
  const inspection={event:'사건',actor:'주체',period:'카테고리',arc:'카테고리',theme:'카테고리',relation:'관계','map-source':'공간'};
  const original=(tab,id,fallback)=>get(tab,id)||fallback;
  const ctl=(cmd,text,secondary=false)=>go(cmd,text,secondary?'secondary':'primary');
  const foot=(...buttons)=>'<div class="actionbar">'+buttons.join('')+'</div>';
  const finish=(text='저장')=>ctl('finish:'+text,text);
  const empty=text=>'<p class="empty-note">'+esc(text)+'</p>';
  const field=(label,value='',type='text')=>`<label class="field"><span>${esc(label)}</span>${type==='area'?`<textarea rows="2">${esc(value)}</textarea>`:`<input type="${type}" ${isDateField(label)?'class="date-input" ':''}value="${esc(value)}" ${type==='number'?'min="1"':''}>`}</label>`;
  const choose=(legend,values,{multi=false,selected=[],cl='',spaceIds=[]}={})=>`<fieldset class="choices ${cl}" data-choice="${multi?'many':'one'}"><legend>${markedDates(legend)}</legend><div>${values.map((v,i)=>`<button type="button" ${spaceIds[i]?'data-space="'+esc(spaceIds[i])+'" ':''}aria-pressed="${selected.includes(v)}">${cl==='answers'?`<i aria-hidden="true">${String.fromCharCode(65+i)}</i>`:''}<span>${markedDates(v)}</span></button>`).join('')}</div></fieldset>`;
  const picker=(legend,values,multi=true,options={})=>`<div class="picker"><label class="field"><span>${esc(legend)}</span><input type="search" placeholder="이름 또는 날짜 검색"></label>${choose('검색 결과',values,{multi,cl:'rows',...options})}<p class="no-matches" hidden>검색 결과가 없습니다.</p></div>`;
  const eventsPicker=(data=japan)=>`<div class="event-picker"><label class="field"><span>사건 검색</span><input type="search" placeholder="사건명 또는 연도"></label>${['core','major','detail',''].map(l=>{const match=data.filter(e=>(e.중요도||'')===l);return match.length?'<div class="priority"><div class="tier"><strong>'+esc(label(l)||'중요도 미지정')+'</strong>'+go('bulk','전체 선택')+'</div>'+choose('사건',match.map(e=>e.날짜+'　'+name(e)),{multi:true,cl:'rows'})+'</div>':'';}).join('')}<p class="no-matches" hidden>검색 결과가 없습니다.</p></div>`;
  const rangeForm=(a,b)=>'<div class="pair">'+field('시작일',a)+field('종료일',b)+'</div>';
  const formFields=(r,columns)=>columns.map(f=>field(f,r?.[f]||'',['내용','설명','소개','직위 설명','기간 설명','도형 추출·사용 설명'].includes(f)?'area':'text')).join('');
  const allFields=(r,tab=r.tab)=>formFields(r,catalogSnapshot.tables[tab].fields.filter(f=>f!=='작성상태'));
  function form(id,group,n,layout,body,actions=[]){
    add(id,group,n,layout,({mini})=>`${layout==='map-tools'?mapGraphic(id==='map-examples'?get('공간','geo_cuba'):wall,true):''}<div class="form-heading">${title(n,mini)}</div><div class="form-sections">${body(mini)}</div>${mini?'':foot(...actions)}`);
  }
  const banner=(txt,mini)=>`<div class="index-heading">${title(txt,mini)}</div>`;
  const dataLabel=r=>r.카테고리유형||r.구분||r.사건유형||r.관계유형;
  const relationsOfPackage=rows.관계.filter(r=>r.패키지ID===key(pkg));
  const lastButton=(id,text)=>ctl('go:'+id,text);
  const chipBar=arr=>'<div class="chips">'+chips(arr)+'</div>';
  for(const [id,n,r] of [['period','시기 상세',get('카테고리','japan_cultural_rule')],['arc','사건군 상세',cat],['theme','주제 상세',get('카테고리','japan_domestic')]]){
    add(id,'read',n,({period:'period-spread',arc:'sequence-spread',theme:'theme-spread'})[id],({record,mini})=>categoryView(original(r.tab,record,r),mini));
  }
  add('event','read','사건 상세','photo',({record,mini})=>eventView(original('사건',record,berlin),mini));
  function quizHeader(question,mini,r){return `<div class="exam-top"><span>관련 인물 퀴즈</span><span class="quiz-progress"><progress max="1" value="1" aria-label="전체 1문항 중 첫 문항"></progress>1 / 1 문항</span></div><div class="exam-question"><small>${markedDates(r.날짜)}</small>${title(question,mini)}</div>`;}
  function clues(r,mask='',withDate=true){
    const redact=v=>mask?String(v||'').split(mask).join('□□'):v;
    return box('사건 기록',facts([['사건명',name(r)],['날짜',withDate?r.날짜:''],['종료일',withDate?r.종료일:''],['카테고리',names(categories(r)).join(' · ')],['공간',names(places(r)).join(' · ')],['참여 주체',participants(r).map(x=>redact(name(x.actor))).join(' · ')],['사건 내용',redact(r.내용)]]));
  }
  add('person','quiz','관련 인물 퀴즈','exam',({mini})=>quizHeader(name(battle)+'에서 독립군을 지휘한 인물은?',mini,battle)+choose('정답 선택',names(personChoices),{cl:'answers'})+
    (mini?'':foot(ctl('grade-person','정답 확인'))+`<div class="evidence-grid">${clues(battle,answer)}${box('사건 연표',list([battle]))}</div>`));
  add('shape','map','지도 도형 미리보기','atlas',({mini})=>mapView(wall,mini));
  add('actor','read','주체 상세','profile',({record,mini})=>categoryView(original('주체',record,actor),mini));
  add('relation','read','관계 상세','connection',({record,mini})=>{const r=original('관계',record,rel);return relationCard(r,{primary:true,nodeStyle:'detail',mini});});
  add('relations','read','전체 관계','ledger',({mini})=>banner('전체 관계',mini)+(mini?relationList(relationsOfPackage.slice(0,2)):[...new Set(relationsOfPackage.map(r=>r.관계유형))].map(k=>box(label(k),relationList(relationsOfPackage.filter(r=>r.관계유형===k)))).join('')));
  add('board','read','한판 연표 상세','chronicle',({mini,record})=>{
    const r=find(record)||march,isRelation=r.tab==='관계';
    const header=isRelation?relationCard(r,{primary:true,nodeStyle:'detail',mini}):banner(name(r),mini);
    const description=r.tab==='공간'?placeIntroduction(r):r.내용||r.소개||r.설명;
    const body=facts([['종류',label(dataLabel(r))],['기간',date(r)],['검토 상태',label(r.검토상태)]])+(isRelation?'':prose(description));
    const linked=r.tab==='사건'?box('관련 주체',chipBar(participants(r).map(x=>x.actor)))+box('카테고리',chipBar(categories(r))):isRelation?'':box('관련 사건',list(events(r)));
    return header+body+(mini?'':linked+box('역사 관계',relationList(relations(r)))+sources(source(r.출처,'자료 출처')));
  });
  add('hover','read','사건 미리보기','photo',({mini,record})=>{const r=original('사건',record,berlin),seq=events(get('패키지','cold-war')),i=seq.findIndex(x=>key(x)===key(r));return mini?eventView(r,true):photo(r)+banner(name(r))+facts([['날짜',date(r)],['관련 국가',participants(r).filter(x=>['state','territory'].includes(x.actor.구분)).map(x=>name(x.actor)).join(' · ')]])+prose(r.내용)+foot(...[seq[i-1],seq[i+1]].map((x,j)=>x?ctl('go:hover/'+key(x),(j?'다음':'이전')+' · '+name(x),true):''),lastButton(route(r),'사진·관계망 자세히 보기'));});
  add('constellation','read','사건 별자리','sky-chart',({mini})=>{const rs=events(cat);return banner(name(cat),mini)+'<p class="constellation-range">'+markedDates(date(rs[0])+' – '+date(rs.at(-1)))+'</p>'+`<div class="stars">${(mini?rs.slice(0,5):rs).map((r,i)=>`<div style="--rise:${[12,0,22,5][i%4]}px">✦${jump(r)}<time>${esc(r.날짜)}</time></div>`).join('')}</div>`;});
  form('month','read','연월로 이동','small',()=>field('이동할 연월',berlin.날짜.slice(0,7),'month'),[finish('이동')]);
  form('topics','read','다른 주제 선택','finder',()=>picker('주제',names(rows.카테고리.filter(c=>c.카테고리유형==='theme')),false),[finish('선택 적용')]);

  const inputAnswer=label=>`<label class="field written"><span>${esc(label)}</span><input data-answer ${isDateField(label)?'class="date-input" ':''}autocomplete="off"></label>`;
  const worksheet=(n,r,question,mini,context=name(r))=>`<div class="exam-top"><span>${esc(n)}</span><span class="quiz-progress"><progress max="1" value="1" aria-label="전체 1문항 중 첫 문항"></progress>1 / 1 문항</span></div><div class="exam-question"><small>${markedDates(context)}</small>${title(question,mini)}</div>`;
  add('blank','quiz','빈칸 퀴즈','exam',({mini})=>worksheet('빈칸 퀴즈',gov,name(gov)+'은 몇 년의 사건인가요?',mini)+inputAnswer('연도')+(mini?'':foot(ctl('grade-blank','정답 확인'))+box('사건 기록',prose(gov.내용)+facts([['날짜','□□ · '+gov.날짜.split('-')[1]+'월'],['공간',names(places(gov)).join(' · ')],['참여 주체',names(participants(gov).map(x=>x.actor)).join(' · ')],['카테고리',names(categories(gov)).join(' · ')]]))+photo(gov)+box('출제 사건 연표',prose('□□ · '+name(gov)))));
  add('order','quiz','사건 순서 맞추기','sorting',({mini,attempt})=>{
    const graded=attempt?.origin==='order';
    const slots=order.map((r,i)=>graded?'<div>'+jump(r)+'<time>'+esc(r.날짜)+'</time></div>':go('slot:'+i,(i+1)+'번째 자리','order-slot')).join('');
    const deck=[order[2],order[0],order[1]].map(r=>`<div>${go('pick:'+key(r),name(r),'pick-card')}${mini?'':go('go:quiz-record/'+key(r),'기록 보기')}</div>`).join('');
    return banner(graded?'정답 시간선':'먼저 일어난 사건부터 배치하세요',mini)+
      (mini?'':'<div class="axis-label"><span>먼저 → 나중</span><output data-placed></output></div>')+'<div class="axis-slots">'+slots+'</div>'+
      (graded?'':box('배치할 사건','<div class="deck">'+deck+'</div>'))+
      (mini?'':(graded?foot(lastButton('order-result','내 배치 확인'),ctl('retry','다시 풀기',true),ctl('close','마치기')):foot(ctl('unpick','선택 해제',true),ctl('clear-order','다시 배치',true),ctl('grade-order','배치 확인'))));
  });
  add('insertion','quiz','하나씩 끼워넣기','sorting',({mini})=>worksheet('하나씩 끼워넣기 · 1라운드',battle,name(battle)+'는 어디에 놓을까요?',mini)+'<div class="axis-label">이른 사건 <span>→ 늦은 사건</span></div><div class="gap-line">'+[0,1,2].map((i)=>go('gap:'+i,'＋ '+['이전','사이','이후'][i],'gap')+(insert[i]?'<div><time>'+esc(insert[i].날짜)+'</time><b>'+esc(name(insert[i]))+'</b></div>':'')).join('')+'</div>'+(mini?'':clues(battle,'',false)));
  add('quiz-record','quiz','퀴즈 속 사건 기록','profile',({mini,record,attempt})=>{const r=original('사건',record,order[0]),graded=attempt?.origin==='order';return banner(name(r),mini)+clues(r,'',graded)+(mini?'':photo(r)+foot(graded?lastButton('order','시간선에서 보기'):ctl('place-record:'+key(r),'이 사건 배치하기')));});
  add('typing','quiz','연표 타이핑','exam',({mini})=>worksheet('연표 타이핑',battle,'이 역의 사건명은 무엇인가요?',mini,battle.날짜)+
    box('현재 역',prose(battle.내용)+inputAnswer('사건명'))+
    (mini?'':foot(ctl('go:hint','사건명 보기',true),ctl('grade-typing','정답 확인'))+
      choose('카테고리 노선',[name(cat)],{selected:[name(cat)]})+choose('풀이 방식',['사건명 맞히기','보고 따라 치기'],{selected:['사건명 맞히기']})+
      lastButton('share','학생용 링크')));
  form('hint','quiz','타이핑 힌트','small',()=>box('이 역의 사건명',prose(name(battle))),[lastButton('typing','입력으로 돌아가기')]);
  for(const [id,n] of [['correct','정답 피드백'],['incorrect','오답 피드백'],['score','풀이 결과']]){
    add(id,'quiz',n,'result',({mini,attempt})=>{const isScore=id==='score',correct=id==='correct',show=attempt&&(isScore||correct===attempt.correct),r=show?attempt.row:battle;
      const lead=isScore?(show?Number(attempt.correct)+' / 1':'풀이 전'):correct?'맞았어요':'답을 살펴보세요';
      return '<div class="result-stamp" aria-hidden="true">'+(isScore?'◎':correct?'✓':'↺')+'</div>'+banner(lead,mini)+facts([['사건',name(r)],...(show||(!isScore&&!correct)?[['내 답',show?attempt.submitted:'응답 전']]:[]),['정답',show?attempt.expected:answer]])+
        (mini?'':(isScore&&show&&attempt.origin==='order'?box('정답 순서',list(order)):'')+foot(isScore?ctl('close','마치기'):ctl('retry','다시 풀기',true),!isScore?lastButton(({order:'order-result',insertion:'round-result',typing:'journey-result'})[attempt?.origin]||'score','결과 보기'):'')+box('문항 기록',facts([['날짜',r.날짜]])+prose(r.내용)+photo(r)));});
  }
  const share=()=>'<label class="field"><span>미리보기 링크</span><input data-share readonly></label>';
  form('share','quiz','학생용 링크','small',share,[ctl('copy','링크 복사')]);
  add('video','quiz','퀴즈 소개 영상','film-layout',({mini})=>banner('퀴즈 소개 영상',mini)+(mini?'<div class="video-mark">▷</div>':[['person','관련 인물'],['blank','빈칸'],['order','사건 순서'],['insertion','하나씩 끼워넣기']].map(([k,n])=>box(n,`<video controls playsinline preload="none" aria-label="${n} 소개 영상" poster="../../assets/quiz-previews/${k}.png" src="../../assets/quiz-previews/${k}.mp4"></video>`)).join('')));
  const quizTitle=()=>field('퀴즈 제목');
  const editorActions=id=>[ctl('go:'+id,'칠판 미리보기',true),finish('출제 완료')];
  form('author-blank','quiz','빈칸 퀴즈 만들기','worksheet-edit',mini=>quizTitle()+choose('출제할 카테고리',names(mini?cats.slice(0,3):cats),{multi:true})+(mini?'':eventsPicker()+box('빈칸 지정',prose('가릴 낱말을 선택하세요.')+choose('사건 내용',gov.내용.split(/\s+/).filter(Boolean),{multi:true}))),editorActions('blank'));
  form('author-order','quiz','사건 순서 퀴즈 만들기','worksheet-edit',mini=>quizTitle()+box('문항',go('add-question','문항 추가')+'<div data-question-list>'+box('1번 문항의 사건',mini?'':eventsPicker())+'</div>'),editorActions('order'));
  form('author-person','quiz','관련 인물 퀴즈 만들기','worksheet-edit',mini=>quizTitle()+(mini?choose(name(battle),[answer]):'<div class="person-editor"><label class="field"><span>사건·인물 검색</span><input type="search"></label>'+japan.filter(r=>participants(r).some(x=>x.actor.구분==='person')).map(r=>'<div data-person-row>'+choose(r.날짜+'　'+name(r),names(participants(r).filter(x=>x.actor.구분==='person').map(x=>x.actor)),{cl:'answers'})+'</div>').join('')+'</div>'),editorActions('person'));
  form('author-insertion','quiz','끼워넣기 퀴즈 만들기','worksheet-edit',mini=>quizTitle()+'<div class="pair">'+field('라운드 수',1,'number')+field('라운드당 문제 수',1,'number')+'</div>'+(mini?'':eventsPicker()),editorActions('insertion'));

  const scopeOptions=()=>choose('데이터 패키지',names(rows.패키지),{selected:[name(pkg)]})+choose('카테고리',names(cats),{multi:true});
  form('lesson','quiz','수업 편집','workspace',mini=>box('현재 구성',facts([['패키지',name(pkg)],['시트 사건',japan.length+'개']]))+(mini?'':box('패키지와 카테고리',scopeOptions())+box('사건 편집',choose('범위',['선택한 카테고리','전체 사건'])+rangeForm('','')+picker('참여 주체',names(rows.주체))+picker('공간',names(rows.공간))+choose('사건 유형',[...new Set(japan.map(r=>label(r.사건유형)))])+choose('중요도',[...new Set(japan.map(r=>label(r.중요도)).filter(Boolean))])+choose('검토 상태',['검토 완료만 보기'],{multi:true})+eventsPicker()+go('include-all','검색 결과 모두 포함')+go('exclude-all','검색 결과 모두 제외'))+box('수업 설정',field('학교명')+choose('처음 열 화면',['스윔레인','기본 연표','시공간 레이더']))+box('저장할 변경','<output data-summary>변경된 내용이 없습니다.</output>')),[finish('수업 저장'),finish('저장하고 열기')]);
  const warn=(n,body,act)=>form(n[0],n[1],n[2],'decision',body,[ctl('close','취소',true),finish(act)]);
  warn(['lesson-delete','quiz','수업을 삭제할까요?'],()=>empty('이 브라우저에서 선택한 수업 구성을 삭제합니다.'),'수업 삭제');
  form('find-event','map','지도에서 사건 찾기','map-tools',mini=>(mini?'':box('사건군별',choose('사건군',names(rows.카테고리.filter(c=>c.카테고리유형==='arc')),{cl:'category-filter'})+picker('사건 검색',rows.사건.map(r=>r.날짜+'　'+name(r)),false))+box('대표 사건',chipBar(rows.사건.filter(r=>r.중요도==='core')))),[ctl('map-picked','선택한 사건 보기')]);
  form('map-lesson','map','지도 수업 선택','map-tools',mini=>(mini?'':scopeOptions()),[finish('지도 보기')]);
  const backgroundRows=rows.지도도형.filter(r=>/^world_\d{4}$/.test(r.지도참조키));
  form('map-settings','map','지도 구성','map-tools',mini=>(mini?'':choose('배경지도',['백지도',...backgroundRows.map(r=>r.지도참조키.replace('world_','')+'년')],{selected:['백지도']})+choose('표기',['지명 표시'],{multi:true,selected:['지명 표시']})),[finish('지도에 적용')]);
  form('maps','map','내 지도 보관함','shelf',()=>box('내 지도',empty('저장한 지도가 없습니다.'))+box('뺀 지도',empty('뺀 지도가 없습니다.')),[lastButton('map-name','새 지도'),finish('현재 지도 추가')]);
  const areaOptions=rows.공간.filter(s=>{
    const shape=get('지도도형',s.지도참조키);
    return shape?.도형유형==='area'&&(catalogSnapshot.mapLayers[s.지도참조키]||shape.지도데이터URL);
  });
  const areaNames=areaOptions.map(s=>name(s)+(areaOptions.some(other=>key(other)!==key(s)&&name(other)===name(s))?' · '+(get('지도도형',s.지도참조키).기준시점||s.시대별칭||key(s)):''));
  form('map-examples','map','예시 지도 선택','map-tools',mini=>mini?'':picker('시트 등록 지도',areaNames,false,{spaceIds:areaOptions.map(key),selected:[areaNames[areaOptions.findIndex(s=>key(s)==='geo_cuba')]]}),[ctl('example-picked','이 지도로 시작')]);
  form('map-name','map','새 지도','small',()=>field('이름'),[ctl('close','취소',true),lastButton('map-examples','예시 지도로 시작'),finish('만들기')]);
  form('map-rename','map','지도 제목 수정','small',()=>field('이름'),[ctl('close','취소',true),finish('적용')]);
  form('workbench','map','지도 작업대','map-tools',mini=>(mini?'':box('점',choose('지점',names([get('공간','geo_berlin'),get('공간','geo_west_berlin')]),{multi:true}))+box('선',choose('경로',[name(wall)],{multi:true}))+box('면',empty('선택된 면이 없습니다.'))+go('uncheck','전체 해제')+go('remove-selected','선택 삭제')+box('선택한 항목',field('이름',name(wall))+shapeDetails(shape,true)+shapeSources(shape))),[lastButton('map-source','출처와 표시 근거')]);
  add('map-source','map','지도 항목 원본과 출처','atlas',({mini,record})=>mapView(original('공간',record,wall),mini));
  form('export','map','지도 내보내기','map-tools',()=>'',[ctl('export-svg','SVG 저장',true),ctl('export-png','PNG 저장')]);
  const selectedRow=(record,fallback)=>{const [tab,n]=(record||'').split('~');return rows[tab]?.find(r=>r.n===Number(n))||fallback;};
  const rowRef=r=>r.tab+'~'+r.n;
  const rowFields=r=>facts(catalogSnapshot.tables[r.tab].fields.filter(k=>r[k]&&k!=='출처').map(k=>[k,r[k]]));
  add('record','data','시트 기록 미리보기','ledger',({mini,record})=>{const r=selectedRow(record,actor);return (r.tab==='관계'?relationCard(r,{primary:true,nodeStyle:'detail',mini}):banner(name(r)||r.tab,mini))+(r.tab==='공간'?mapGraphic(r,true):'')+rowFields(r)+(mini?'':sources(source(r.출처,'자료 출처'))+foot(lastButton('row-edit/'+rowRef(r),'편집')));});
  add('endpoints','data','연결 관계 목록','connection',({mini})=>banner(name(march),mini)+relationList(relations(march)));
  add('row-edit','data','시트 항목 편집','workspace',({mini,record})=>{const r=selectedRow(record,actor);return banner(r.tab+' 편집',mini)+'<div class="form-sections">'+(mini?formFields(r,catalogSnapshot.tables[r.tab].fields.slice(0,2)):allFields(r))+'</div>'+(mini?'':foot(lastButton('data-confirm','행 삭제'),ctl('close','취소',true),finish('사본에 저장')));});
  form('row-add','data','새 시트 항목','workspace',mini=>mini?field('주체명'):allFields({},'주체'),[ctl('close','취소',true),finish('사본에 추가')]);
  form('event-edit','data','사건 작업공간','workspace',mini=>mini?field('사건명',name(march)):box('사건 정보',allFields(march))+box('분류',choose('패키지',names(rows.패키지),{multi:true,selected:[name(pkg)]})+['period','arc','theme'].map(k=>choose(label(k),names(cats.filter(c=>c.카테고리유형===k)),{multi:true,selected:names(categories(march))})).join(''))+box('참여 주체',participants(march).map(x=>choose(name(x.actor),[...new Set(rows.사건_주체.map(x=>label(x.역할)).filter(Boolean))],{selected:[label(x.role)]})+go('remove-role','연결 해제')).join('')+lastButton('actor-picker','참여 주체 추가')),[ctl('close','취소',true),finish('브라우저 사본 저장')]);
  form('actor-picker','data','참여 주체 추가','finder',mini=>picker('주체 검색',names(mini?personChoices:rows.주체),false)+(mini?'':choose('역할',[...new Set(rows.사건_주체.map(x=>label(x.역할)).filter(Boolean))])),[finish('추가')]);
  warn(['data-confirm','data','항목 삭제 확인'],()=>rowFields(actor),'항목 삭제');
  warn(['data-revert','data','변경사항 되돌리기'],()=>prose('브라우저의 수정 내역을 취소하고 원본 시트 데이터를 다시 불러옵니다.'),'되돌리기');
  const pkgFields=['패키지명','학교급','과목','설명'];
  form('package','studio','패키지 편집','workspace',mini=>formFields(pkg,mini?pkgFields.slice(0,2):pkgFields),[finish()]);
  form('package-new','studio','새 패키지','workspace',mini=>formFields({},mini?pkgFields.slice(0,2):pkgFields),[finish('이 패키지로 시작')]);
  const catFields=['카테고리명','시작일','종료일','설명'];
  const categoryForm=(r,mini)=>choose('종류',['시기','사건군','주제'],{selected:r?[label(r.카테고리유형)]:[]})+formFields(r,mini?catFields.slice(0,1):catFields)+(mini||!r?'':box('관련 공간',chipBar(places(r))));
  form('category','studio','카테고리 편집','workspace',mini=>categoryForm(cat,mini),[lastButton('finder','저장 후 공간 연결'),finish()]);
  form('category-new','studio','카테고리 추가','workspace',mini=>categoryForm(null,mini),[finish()]);
  const relForm=(r,mini)=>(r?relationCard(r,{nodeStyle:'detail',mini}):go('go:wire-picker','출발 · 도착 대상 선택'))+(mini?'':lastButton('wire-picker','대상 찾기')+choose('관계 유형',[...new Set(rows.관계.map(r=>label(r.관계유형)))],{selected:r?[label(r.관계유형)]:[]})+formFields(r,['라벨','설명','출처']));
  form('studio-rel','studio','관계 편집','connection',mini=>relForm(rel,mini),[lastButton('unlink','관계 해제'),finish('수정 저장')]);
  form('studio-rel-new','studio','관계 추가','connection',mini=>relForm(null,mini),[finish('관계 추가')]);
  const targetPicker=(side,mini)=>box(side+' 대상',picker('사건',names(mini?order:japan),false)+(mini?'':picker('카테고리',names(cats),false)+picker('행위주체',names(rows.주체),false)));
  form('wire-picker','studio','출발·도착 대상 찾기','finder',mini=>targetPicker('출발',mini)+(mini?'':targetPicker('도착',false)),[lastButton('studio-rel','관계 연결')]);
  form('finder','studio','기존 자료 찾기·연결','finder',mini=>box('현재 연결',chipBar([...categories(march),...places(march),...participants(march).map(x=>x.actor)]))+(mini?'':['사건','주체','공간','카테고리'].map(tab=>box(tab,picker(tab+' 검색',names(rows[tab]))+field('새 '+tab+' 이름')+go('new-reference','새 항목 추가'))).join('')),[finish('완료')]);
  for(const [id,r] of [['review',battle],['review-actor',actor],['review-place',wall],['review-category',cat]]){
    form(id,'studio',r.tab+' 정보 보완','workspace',mini=>mini?field(r.tab+'명',name(r)):allFields(r)+(r.tab==='주체'||r.tab==='공간'?lastButton('finder','저장 후 공간 선택'):''),[finish('보완 저장'),finish('검토 완료')]);
  }
  warn(['studio-delete','studio','초안에서 사건 삭제'],()=>facts([['사건',name(march)],['연결된 카테고리',categories(march).length+'건'],['연결된 관계',relations(march).length+'건'],['공간',places(march).length+'건'],['주체',participants(march).length+'건']]),'사건 삭제');
  warn(['category-delete','studio','초안에서 카테고리 삭제'],()=>facts([['카테고리',name(cat)],['사건',events(cat).length+'건'],['관계',relations(cat).length+'건']])+prose('연결된 사건은 사건 시트에 남습니다.'),'카테고리 삭제');
  warn(['unlink','studio','관계 해제'],mini=>relationCard(rel,{nodeStyle:'detail',mini}),'관계 해제');
  add('package-preview','studio','패키지 최종 미리보기','chronicle',({mini})=>banner(name(pkg),mini)+(mini?list(japan.slice(0,3)):box('사건 목록',picker('카테고리 필터',names(cats),false)+'<div class="scroll-list" tabindex="0">'+list(japan)+'</div>')+box('스윔레인','<div class="lanes">'+cats.filter(c=>c.카테고리유형==='arc').map(c=>box(name(c),chipBar(events(c)))).join('')+'</div>')+foot(finish('패키지 업로드'))));
  form('studio-share','studio','공동 작업 링크','small',share,[ctl('copy','링크 복사')]);
  form('comments','studio','댓글과 답글','discussion',mini=>box('진행 중','<div data-comments>'+empty('등록된 댓글이 없습니다.')+'</div>')+(mini?'':box('해결됨','<div data-resolved>'+empty('해결된 댓글이 없습니다.')+'</div>')+box('새 댓글',field('댓글 내용','','area'))),[ctl('refresh-comments','새로고침',true),ctl('add-comment','댓글 등록')]);
  add('order-result','quiz','순서 퀴즈 배치 결과','sorting',({mini,attempt})=>{
    const a=attempt?.origin==='order'?attempt:null, own=a?.submitted.split(' → ')||[];
    const matched=order.filter((r,i)=>name(r)===own[i]).length;
    return banner('정답 순서',mini)+prose(a?order.length+'개 중 '+matched+'개 정답':'내 배치는 풀이 후 표시됩니다.')+
      '<ol class="chronology">'+order.map((r,i)=>'<li><time>'+esc(r.날짜)+'</time><div>'+jump(r)+(a&&own.indexOf(name(r))!==i?'<small>내 배치 '+(own.indexOf(name(r))+1)+'번</small>':'')+'</div></li>').join('')+'</ol>'+
      (mini?'':foot(ctl('retry','다시 풀기',true),lastButton('order','시간선에서 보기'),ctl('close','마치기')));
  });
  add('round-result','quiz','끼워넣기 라운드 결과','result',({mini,attempt})=>{
    const a=attempt?.origin==='insertion'?attempt:null;
    return banner('라운드 결과',mini)+facts([['라운드','1 / 1'],['문제',name(battle)],['정답 수',a?Number(a.correct)+' / 1':'풀이 전']])+(mini?'':foot(lastButton('insertion','다시 풀기'),lastButton('classroom-result','줄 세우기 결과'),ctl('close','마치기')));
  });
  add('journey-result','quiz','타이핑 노선 완주','result',({mini,attempt})=>{
    const a=attempt?.origin==='typing'?attempt:null;
    return banner(name(cat)+' 노선 완주',mini)+facts([['첫 입력 정답',a?Number(a.correct&&!a.assisted)+' / 1':'풀이 전']])+list([battle])+(mini?'':foot(lastButton('typing','노선 다시 고르기'),ctl('close','마치기')));
  });
  add('classroom-result','quiz','줄 세우기 결과','result',({mini,attempt})=>{
    const result=attempt?.origin==='insertion'?Number(attempt.correct)+' / 1문제 정답':'풀이 전';
    return banner('줄 세우기 결과',mini)+prose(result)+(mini?'':list(ordered([...insert,battle]))+foot(lastButton('insertion','다시 풀기'),lastButton(route(battle),'연표에서 이어 보기')));
  });
  function projectPath(id,ref){
    if(!adopted.has(id))return '';
    const defaults={event:berlin,arc:cat,actor,shape:wall,period:get('카테고리','japan_cultural_rule'),theme:get('카테고리','japan_domestic')};
    const row=ref?find(ref):defaults[id];
    if(id==='shape')return '../../sheet-schema-dashboard.html?shape='+encodeURIComponent(row?.지도참조키||ref||key(wall));
    const event=row?.tab==='사건'?row:row?.tab==='주체'?events(row)[0]:null;
    const membership=event&&rows.사건_패키지.find(link=>link.사건ID===key(event));
    const packageId=row?.패키지ID||membership?.패키지ID||(row&&relations(row)[0]?.패키지ID)||key(pkg);
    return '../../swimlane.html?package='+encodeURIComponent(packageId)+'&record='+encodeURIComponent(id==='relations'?'all':(ref||key(row)));
  }
  return {groups,items,byId,projectPath,inspection,berlin,battle,march,gov,order,insert,cat,pkg,shape,personChoices,answer,blankAnswer};
})();
