import type {EventRecord} from './metro-model';

export type MapCountry={id:string;name:string;point:[number,number];actors:string[];first:number;last:number;label?:[number,number]};
export type MapRelation={id:string;from:'usa'|'ussr';to:string;kind:'alliance'|'aid';start:number;end:number;title:string;note:string;source:string};
export const mapCountries:MapCountry[]=[
 {id:'usa',name:'미국',point:[-77.04,38.91],actors:['actor_usa'],first:1945,last:1991,label:[-30,26]},
 {id:'ussr',name:'소련',point:[37.62,55.75],actors:['actor_ussr'],first:1945,last:1990,label:[20,-18]},
 {id:'uk',name:'영국',point:[-.13,51.51],actors:['actor_uk'],first:1945,last:1991,label:[-24,-24]},
 {id:'france',name:'프랑스',point:[2.35,48.86],actors:['actor_france'],first:1945,last:1991,label:[-36,30]},
 {id:'italy',name:'이탈리아',point:[12.5,41.9],actors:['actor_italy'],first:1945,last:1991},
 {id:'germany',name:'서독',point:[7.1,50.73],actors:['actor_frg'],first:1949,last:1991},
 {id:'gdr',name:'동독',point:[13.4,52.52],actors:['actor_gdr'],first:1949,last:1989},
 {id:'poland',name:'폴란드',point:[21.01,52.23],actors:['actor_poland'],first:1945,last:1991},
 {id:'hungary',name:'헝가리',point:[19.04,47.5],actors:['actor_hungary'],first:1945,last:1991},
 {id:'czechoslovakia',name:'체코슬로바키아',point:[14.42,50.08],actors:['actor_czechoslovakia'],first:1945,last:1991},
 {id:'greece',name:'그리스',point:[23.73,37.98],actors:['actor_greece'],first:1945,last:1991},
 {id:'turkey',name:'터키',point:[32.86,39.93],actors:['actor_turkey'],first:1945,last:1991},
 {id:'spain',name:'스페인',point:[-3.7,40.42],actors:['actor_spain'],first:1945,last:1991},
 {id:'china',name:'중국',point:[116.4,39.9],actors:['actor_prc','actor_cpc'],first:1949,last:1991,label:[-35,-22]},
 {id:'japan',name:'일본',point:[139.69,35.68],actors:['actor_japan'],first:1945,last:1991,label:[35,15]},
 {id:'korea',name:'대한민국',point:[126.98,37.57],actors:['actor_kor'],first:1948,last:1991,label:[3,35]},
 {id:'cuba',name:'쿠바',point:[-82.37,23.11],actors:['actor_cuba'],first:1959,last:1991,label:[-30,24]},
 {id:'afghanistan',name:'아프가니스탄',point:[69.21,34.56],actors:['actor_afghanistan'],first:1945,last:1991,label:[0,29]},
];
const nato='https://www.nato.int/en/about-us/organization/nato-member-countries';
const warsaw='https://history.state.gov/milestones/1953-1960/warsaw-treaty';
const cuba='https://history.state.gov/historicaldocuments/frus1961-63v10/d181';
const china='https://www.wilsoncenter.org/sites/default/files/media/documents/publication/ACF197.pdf';
const afghanistan='https://history.state.gov/countries/afghanistan';
export const mapRelations:MapRelation[]=[
 ...(['uk','france','italy'] as const).map(to=>({id:`nato-${to}`,from:'usa' as const,to,kind:'alliance' as const,start:1949,end:1991,title:'NATO 공동 방위',note:'미국과 같은 집단방위조약의 회원국입니다. 미국의 일방적 지원을 뜻하지 않습니다. 프랑스의 1966년 통합군사조직 이탈은 NATO 탈퇴와 구별합니다.',source:nato})),
 ...(['greece','turkey'] as const).map(to=>({id:`nato-${to}`,from:'usa' as const,to,kind:'alliance' as const,start:1952,end:1991,title:'NATO 가입',note:'1952년 NATO에 가입했습니다.',source:nato})),
 {id:'nato-germany',from:'usa',to:'germany',kind:'alliance',start:1955,end:1991,title:'NATO 공동 방위',note:'서독은 1955년 가입했습니다. 1990년 통일 이후에는 독일로 표시합니다.',source:nato},
 {id:'nato-spain',from:'usa',to:'spain',kind:'alliance',start:1982,end:1991,title:'NATO 가입',note:'스페인은 1982년 NATO에 가입했습니다.',source:nato},
 ...(['poland','hungary','czechoslovakia'] as const).map(to=>({id:`warsaw-${to}`,from:'ussr' as const,to,kind:'alliance' as const,start:1955,end:1990,title:'바르샤바 조약',note:'1955년 창설된 집단방위조약의 회원국입니다. 조약은 1991년에 해체되어 연말 지도에서는 표시하지 않습니다.',source:warsaw})),
 {id:'warsaw-gdr',from:'ussr',to:'gdr',kind:'alliance',start:1955,end:1989,title:'바르샤바 조약',note:'동독은 1955년 창설 서명국입니다. 1990년 통일을 앞두고 탈퇴했으므로 그해 말에는 별도 국가로 표시하지 않습니다.',source:warsaw},
 {id:'japan-security',from:'usa',to:'japan',kind:'alliance',start:1952,end:1991,title:'미일 안보 체제',note:'1951년 서명된 안보조약의 1952년 발효부터 표시합니다. 1960년 상호협력 및 안전보장조약으로 개정되었습니다.',source:'https://www.mofa.go.jp/region/n-america/us/q%26a/ref/1.html'},
 {id:'korea-defense',from:'usa',to:'korea',kind:'alliance',start:1954,end:1991,title:'한미 상호방위조약',note:'1953년 서명과 1954년 11월 발효를 구별해, 발효 연도부터 표시합니다.',source:'https://history.state.gov/historicaldocuments/frus1955-57v23p2/d2'},
 {id:'china-experts',from:'ussr',to:'china',kind:'aid',start:1950,end:1959,title:'중국에 대한 기술·경제 지원',note:'1950년대의 소련 지원을 표시합니다. 1960년 전문가 철수로 이 기술지원 선을 닫습니다. 중소 조약의 법적 존속 기간과는 다릅니다.',source:china},
 {id:'cuba-aid',from:'ussr',to:'cuba',kind:'aid',start:1960,end:1990,title:'쿠바에 대한 경제·군사 지원',note:'1960년 무역·원조 협정을 계기로 확대된 지원 관계입니다. 1991년 말 소련 소멸로 소련의 선을 닫습니다.',source:cuba},
 {id:'afghan-government',from:'ussr',to:'afghanistan',kind:'aid',start:1979,end:1990,title:'아프간 정부 지원·군사 개입',note:'소련은 아프간 정부를 지원했습니다. 소련군은 1989년 철수했지만 정부에 대한 지원과는 구별합니다. 미국이 지원한 저항 세력과 다른 대상입니다.',source:'https://history.state.gov/historicaldocuments/frus1981-88v06/d110'},
 {id:'afghan-resistance',from:'usa',to:'afghanistan',kind:'aid',start:1979,end:1991,title:'아프간 저항 세력 지원',note:'아프간 정부에 대한 동맹 관계가 아니라, 정부와 소련군에 맞선 저항 세력에 대한 지원입니다. 이 지도에서는 국가 위치에 선을 모아 표시합니다.',source:afghanistan},
];
export function countryName(country:MapCountry,year:number){return country.id==='germany'&&year>=1990?'독일':country.name;}
export function countriesAt(year:number){return mapCountries.filter(c=>c.first<=year&&year<=c.last);}
// shortcut: Representative relationships at year end, extend dated records before treating this as an exhaustive alliance atlas.
export function relationsAt(year:number,power:'all'|'usa'|'ussr'='all'){
 const ids=new Set(countriesAt(year).map(c=>c.id));
 return mapRelations.filter(r=>r.start<=year&&year<=r.end&&ids.has(r.from)&&ids.has(r.to)&&(power==='all'||r.from===power));
}
export function countryEvents(events:EventRecord[],year:number,country:MapCountry|null){
 return events.filter(e=>country?e.year<=year&&e.actorIds.some(id=>country.actors.includes(id)):e.year===year)
  .sort((a,b)=>b.bounds.start-a.bounds.start||a.id.localeCompare(b.id));
}
export function mapPoint([longitude,latitude]:[number,number]):[number,number]{return [(longitude+180)*2.65,(85-latitude)*2.65];}
export function relationPath(from:MapCountry,to:MapCountry){
 const [x1,y1]=mapPoint(from.point),[x2,y2]=mapPoint(to.point);
 return `M${x1},${y1} Q${(x1+x2)/2},${Math.max(8,Math.min(y1,y2)-Math.abs(x2-x1)*.28-24)} ${x2},${y2}`;
}
