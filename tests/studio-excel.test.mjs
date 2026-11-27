import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTemplate,buildWorkbook,readWorkbook,parseImport,excelDate} from '../assets/studio-excel.js';

const labels={importance:{core:'핵심·전환점',major:'주요 사건',detail:'심화·보충'},types:{event:'사건',policy:'정책·조치'},cats:{period:'시기',arc:'사건군',theme:'주제'},
 roles:{initiator:'주도자',participant:'참여자'},rels:{cause:'원인·계기',shift:'전환·변화'},actors:{state:'국가·정부'},places:{point:'지점·도시'}};
const bytes=async blob=>await blob.arrayBuffer();
let n=0;
const ctx=(extra={})=>({labels,categories:[],events:[],relations:[],uid:()=>'id'+(++n),validDate:v=>/^\d{4}(-\d{2}(-\d{2})?)?$/.test(v),
 actors:name=>({미국:['a-us'],'국제연합(UN)':['a-un'],소련:['a-su']})[name]||[],places:name=>({한반도:['p-kr']})[name]||[],...extra});

test('템플릿을 다시 읽으면 시트와 제목 줄이 그대로 나온다', async()=>{
 const book=await readWorkbook(await bytes(buildTemplate(labels,{actor:{a:{name:'미국',kind:'state'}},place:{p:{name:'한반도',kind:'point'}}})));
 assert.deepEqual(Object.keys(book),['안내','사건','카테고리','관계','주체목록','공간목록']);
 assert.equal(book['사건'][0][0],'사건명');
 assert.equal(book['사건'][1][0].startsWith('(예시)'),true);
 assert.deepEqual(book['주체목록'][1],['미국','국가·정부']);
});

test('특수문자와 줄바꿈이 있는 값도 왕복한다', async()=>{
 const blob=buildWorkbook([{name:'사건',columns:[{title:'사건명'},{title:'내용'}],rows:[['A & B <c> "d"','첫 줄\n둘째 줄']]}]);
 const book=await readWorkbook(await bytes(blob));
 assert.deepEqual(book['사건'][1],['A & B <c> "d"','첫 줄\n둘째 줄']);
});

test('엑셀 날짜 숫자와 붙은 숫자를 날짜 글자로 바꾼다', () => {
 assert.equal(excelDate('16664'),'1945-08-15');
 assert.equal(excelDate('1950'),'1950');
 assert.equal(excelDate('195006'),'1950-06');
 assert.equal(excelDate('19500625'),'1950-06-25');
});

const sample={
 사건:[['사건명','날짜','종료일','내용','중요도','유형','카테고리','행위주체','공간','이미지 주소','출처'],
  ['(예시) 무시됨','1950'],
  ['6·25 전쟁 발발','1950-06-25','1953-07-27','남침','핵심·전환점','사건','냉전의 군사화, 없는분류','미국(주도자), 국제연합(UN), 없는나라','한반도, 없는곳'],
  ['정전 협정','1953-07-27','','','주요 사건','','냉전의 군사화'],
  ['날짜 없는 사건','','','','이상한값']],
 카테고리:[['카테고리명','종류','시작일','종료일','설명'],['냉전의 군사화','사건군','1947','1953','설명'],['종류없음','']],
 관계:[['출발 사건명','도착 사건명','관계유형','설명','출처'],['6·25 전쟁 발발','정전 협정','원인·계기'],['6·25 전쟁 발발','없는 사건','원인·계기'],['6·25 전쟁 발발','정전 협정','엉뚱한유형']]
};

test('가져오기는 이름을 ID로 연결하고 문제는 경고로 알린다', () => {
 const plan=parseImport(sample,ctx());
 assert.equal(plan.categories.length,1);
 assert.equal(plan.categories[0].kind,'arc');
 assert.equal(plan.events.length,3);
 const [war,truce,nodate]=plan.events;
 assert.deepEqual(war.actor,[{id:'a-us',role:'initiator'},{id:'a-un',role:''}]);
 assert.deepEqual(war.place,['p-kr']);
 assert.deepEqual(war.categoryIds,[plan.categories[0].id]);
 assert.equal(war.importance,'core');
 assert.equal(truce.type,'');
 assert.equal(nodate.importance,'');
 assert.equal(plan.relations.length,1);
 assert.equal(plan.relations[0].kind,'cause');
 const text=plan.warnings.join('\n');
 for(const expected of ['없는분류','없는나라','없는곳','종류','날짜가 없습니다','이상한값','없는 사건','관계유형'])assert.match(text,new RegExp(expected));
});

test('이미 있는 사건·카테고리·관계는 더하지 않는다', () => {
 const existing=ctx({categories:[{id:'c1',name:'냉전의 군사화',kind:'arc'}],events:[{id:'e1',title:'정전 협정',date:'1953-07-27'}],
  relations:[]});
 const plan=parseImport(sample,existing);
 assert.equal(plan.categories.length,0);
 assert.equal(plan.events.length,2);
 assert.deepEqual(plan.events[0].categoryIds,['c1']);
 assert.equal(plan.relations[0].toId,'e1');
});

test('제목 줄이 다르면 이유를 알려 준다', () => {
 assert.throws(()=>parseImport({사건:[['제목','날짜'],['a','1950']]},ctx()),/사건명/);
 assert.throws(()=>parseImport({기타:[['a']]},ctx()),/찾지 못/);
});
