import type {Actor, EventRecord, HistoryData} from './metro-model';

const modern = 'https://contents.history.go.kr/front/ta/print.do?levelId=ta_h62_0030';
const contemporary = 'https://contents.history.go.kr/front/ta/view.do?levelId=ta_h71_0040_0050_0040_0040';
const archives = 'https://theme.archives.go.kr/next/';
const topics = {
 opening: '개항과 개혁',
 independence: '식민 지배와 독립운동',
 division: '분단과 남북 관계',
 democracy: '정부 수립과 민주화',
 economy: '경제 개발',
};
const actors: Actor[] = [
 {actor_id:'joseon', name:'조선', actor_type:'state'},
 {actor_id:'empire', name:'대한제국', actor_type:'state'},
 {actor_id:'japan', name:'일본 제국', actor_type:'state'},
 {actor_id:'provisional', name:'대한민국 임시정부', actor_type:'organization'},
 {actor_id:'actor_kor', name:'대한민국', actor_type:'state'},
 {actor_id:'actor_prk', name:'조선민주주의인민공화국', actor_type:'state'},
];
const records: [id:string,date:string,title:string,topics:(keyof typeof topics)[],actors:string[],source:string,summary:string][] = [
 ['ganghwa','1876','강화도 조약 체결',['opening'],['joseon','japan'],modern,'조선과 일본이 조약을 맺었다. 조선은 항구를 열었고 일본은 조선에서 영사재판권을 인정받았다.'],
 ['donghak','1894','동학 농민 운동',['opening'],['joseon'],modern,'동학 농민군이 탐관오리의 횡포를 비판하고 사회 개혁을 요구하며 봉기했다.'],
 ['gabo','1894','갑오개혁 시작',['opening'],['joseon'],modern,'군국기무처를 중심으로 신분제와 과거제 폐지 등 제도 개혁을 추진했다.'],
 ['empire','1897','대한제국 수립',['opening'],['empire'],'https://contents.history.go.kr/front/ta/print.do?levelId=ta_h71_0040','고종이 황제에 즉위하고 국호를 대한제국으로 정했다.'],
 ['annexation','1910','한일 강제 병합',['independence'],['empire','japan'],modern,'일본이 대한제국을 강제로 병합하면서 식민 지배가 시작되었다.'],
 ['march-first','1919-03-01','3·1 운동',['independence'],[],archives+'koreaOfRecord/3_1.do','독립선언과 만세 시위가 시작되어 전국과 국외로 퍼졌다.'],
 ['provisional','1919-04','대한민국 임시정부 수립',['independence'],['provisional'],archives+'koreaOfRecord/koreaGovernment.do','3·1 운동 이후 상하이에서 대한민국 임시정부가 출범했다. 같은 해 9월 여러 임시정부가 통합되었다.'],
 ['liberation','1945-08-15','8·15 광복',['independence','division'],[],archives+'foundation/Gallery01_intro.do','일본의 항복으로 식민 지배가 끝났다. 이후 38도선을 경계로 미군과 소련군이 진주했다.'],
 ['republic','1948-08-15','대한민국 정부 수립',['democracy','division'],['actor_kor'],archives+'daily/viewMain.do?selectDay=20120815','제헌 국회의 헌법 제정과 대통령 선출을 거쳐 대한민국 정부가 출범했다.'],
 ['korean-war','1950-06-25','6·25 전쟁 발발',['division'],['actor_kor','actor_prk'],archives+'625/records/recordDetail.do?flag=0&page=76&searchKey=&searchTxt=&seq=1705','북한군이 38도선을 넘어 남침하면서 전쟁이 시작되었다.'],
 ['armistice','1953-07-27','정전협정 체결',['division'],['actor_prk'],archives+'chronology/archiveDetail.do?evntId=0049272219&flag=2&page=24&sort=year','유엔군사령부와 북한군·중국인민지원군 측이 정전협정에 서명했다.'],
 ['april','1960-04-19','4·19 혁명',['democracy'],['actor_kor'],archives+'koreaOfRecord/4_19.do','3·15 부정선거에 항의하는 시위가 확산되었고, 이승만 대통령이 물러났다.'],
 ['five-year','1962','제1차 경제개발 5개년 계획',['economy'],['actor_kor'],archives+'economicDevelopment/primary.do','정부가 전력·석탄 등 에너지원 확충과 기간산업 육성에 중점을 둔 경제개발 계획을 시행했다.'],
 ['gwangju','1980-05-18','5·18 민주화운동',['democracy'],['actor_kor'],contemporary,'광주에서 시민과 학생이 계엄 확대와 신군부에 맞서 민주화를 요구했다.'],
 ['june','1987-06','6월 민주항쟁',['democracy'],['actor_kor'],contemporary,'대통령 직선제 개헌을 요구하는 시위가 전국에서 벌어졌다. 6·29 선언 이후 직선제 개헌이 이루어졌다.'],
 ['joint-declaration','2000-06-15','6·15 남북 공동선언',['division'],['actor_kor','actor_prk'],'https://contents.history.go.kr/front/hm/print.do?levelId=hm_153_0090','평양에서 열린 첫 남북 정상회담에서 남북 정상이 교류와 협력에 합의했다.'],
];

export function koreanHistory(tenures: HistoryData['tenures']): HistoryData {
 return {
  actors,
  tenures:tenures.filter(tenure=>actors.some(actor=>actor.actor_id===tenure.actorId)),
  topics:Object.entries(topics).map(([topic_id,name])=>({topic_id,name})),
  events:records.map(([id,date,title,directTopicIds,actorIds,source,description]):EventRecord=>{
   const [year,month,day]=date.split('-').map(Number);
   const start=Date.UTC(year,(month??1)-1,day??1);
   const end=day?start:month?Date.UTC(year,month,0):Date.UTC(year,11,31);
   return {id:`kr-${id}`,date,title,shortTitle:title,year,directTopicIds,actorIds,source,description,bounds:{start,end},media:[],reviewStatus:'summary'};
  }),
 };
}
