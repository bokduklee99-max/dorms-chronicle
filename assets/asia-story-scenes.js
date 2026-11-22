const china = {lon:111.9,lat:33.7,width:24,height:13};
const eastAsia = {lon:127.2,lat:36.7,width:38,height:14};
const beijing = {lon:116.4,lat:38.2,width:20,height:12};
const shanghai = {lon:118.8,lat:35.2,width:26,height:16};
const pacific = {lon:199.8,lat:39.8,width:220,height:67};

// Huabei is a region. Its label anchors a soft area on the map.
const wuhan = [114.305,30.593], north = [113.7,37.2], chongqing = [106.9123,29.4316];
const nagoya = [136.907,35.181], capital = [116.4074,39.9042], port = [121.4737,31.2304];
const washington = [360-77.0369,38.9072];
const origin = {name:'우한',point:wuhan,ink:'origin'};
const base = {name:'충칭',point:chongqing,ink:'west'};
const huabei = {name:'화북 일대',point:north,ink:'north',region:true};
const beijingPin = {name:'베이징',point:capital,ink:'west'};
const washingtonPin = {name:'워싱턴 D.C.',point:washington,ink:'north'};
const westBranch = {from:wuhan,to:chongqing,ink:'west',bend:.19};
const northBranch = {from:wuhan,to:north,ink:'north',bend:-.13};
const diplomaticLink = {from:capital,to:washington,ink:'west',bend:-.17};

export const stories = {
  volunteers:{
    year:1938, dataset:'japan', map:'east-asia-1938',
    source:'https://contents.history.go.kr/front/tg/view.do?levelId=tg_004_2760',
    scenes:[
      {id:'E195',
        view:china,pins:[{...origin,detail:'조선의용대 창설'}]},
      {id:'E197',
        view:china,pins:[origin,{...base,detail:'본부'},{...huabei,detail:'이동한 대원들'}],links:[westBranch,northBranch]},
      {id:'E198',
        view:china,pins:[origin,{...base,detail:'한국광복군 제1지대'},huabei],links:[{...northBranch,muted:true},westBranch]},
      {id:'E200',
        view:china,pins:[origin,{...base,detail:'한국광복군 제1지대'},{...huabei,detail:'조선의용군'}],links:[westBranch,northBranch]},
    ],
  },
  diplomacy:{
    year:1960,dataset:'cold-war',map:'pacific-1960',
    source:'https://history.state.gov/milestones/1969-1976/rapprochement-china',
    scenes:[
      {id:'E083',
        view:eastAsia,pins:[{name:'나고야',point:nagoya,ink:'north',detail:'세계탁구선수권'},{...beijingPin,detail:'대표팀 방중'}],links:[{from:nagoya,to:capital,ink:'west',bend:.18}]},
      {id:'E088',
        view:beijing,pins:[{...beijingPin,detail:'키신저 · 저우언라이'}]},
      {id:'E091',
        view:shanghai,pins:[{...beijingPin,detail:'닉슨 대통령 방문'},{name:'상하이',point:port,ink:'north',detail:'공동성명 발표'}]},
      {id:'E095',
        view:pacific,pins:[{...beijingPin,detail:'미국 연락사무소'},{...washingtonPin,detail:'중국 연락사무소'}],links:[{...diplomaticLink,muted:true}]},
      {id:'E110',
        view:pacific,pins:[{...beijingPin,detail:'미국 대사관 · 3월'},{...washingtonPin,detail:'중국 대사관 · 3월'}],links:[diplomaticLink]},
    ],
  },
};
