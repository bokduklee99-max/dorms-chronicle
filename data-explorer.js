import {views} from './src/workspace-model.ts';
import {renderGeographyTrace} from './src/geography-trace.js';
import './src/data-dashboard.css';
import {renderSpaceMap} from './assets/space-preview-map.js';
import {authorizeRelationSheet,loadGoogleIdentity,matchesSheetRelation,saveToGoogleRelationSheet} from './src/google-relation-sheet.js';
import {createRelation,eventActorLinks,eventPackageLinks,filterRelationDirections,findRelationEndpoint,geographyLinks,groupRelationsByDirection,parseDashboardCSV,relationConnects,relationEndpointTab,relationPackages,relationTypes,updateCategoryEvents} from './src/data-dashboard-source.js';

/* =========================================================================
   1. 시트 스키마 및 상수 정의
   ========================================================================= */
const SHEET_GROUPS = [
  { label: '기본 사전', tabs: ['패키지', '카테고리', '주체'] },
  { label: '핵심 기록', tabs: ['사건', '직위', '재임'] },
  { label: '연결 · 관계', tabs: ['사건_패키지', '사건_카테고리', '사건_주체', '관계'] },
  { label: '지리', tabs: ['공간', '사건_공간', '주체_공간', '카테고리_공간', '영토변화', '지도도형','지도뷰'] }
];
const ALL_TABS = SHEET_GROUPS.flatMap(group => group.tabs);
const STRUCTURE_SECTION_TABLES = {
  'structure-actors': ['주체', '직위', '재임'],
  'structure-catalog': ['패키지', '카테고리', '사건', '사건_카테고리', '사건_패키지'],
  'structure-geography': ['공간', '사건_공간', '주체_공간', '카테고리_공간', '영토변화', '지도도형','지도뷰'],
  'structure-relations': ['사건_주체', '관계']
};
const NEW_SCHEMA_TABS = ['공간','영토변화','사건_공간','지도도형','지도뷰','직위','사건_패키지','주체_공간','카테고리_공간'];
const GEO_TYPE_LABELS = new Map([['all','전체'], ['point','점'], ['line','선'], ['area','면']]);
const SPACE_LINKS = {사건_공간:'사건ID', 주체_공간:'주체ID', 카테고리_공간:'카테고리ID'};
const GEO_TABLES = ['공간','지도도형',...Object.keys(SPACE_LINKS)];
const DEFAULT_HEADERS = {
  '패키지': ['패키지ID', '패키지명', '학교급', '과목', '설명'],
  '카테고리': ['카테고리ID','패키지ID','카테고리명','카테고리유형','시작일','종료일','설명','지도참조키','기본뷰ID'],
  '사건': ['사건ID','날짜','종료일','사건명','사건유형','내용','이미지'],
  '사건_카테고리': ['사건ID', '카테고리ID'],
  '사건_패키지': ['사건ID','패키지ID'],
  '주체': ['주체ID', '주체명', '구분', '성향', '존속시작일', '존속종료일', '종료상태', '설명', '검토상태'],
  '사건_주체': ['사건ID', '주체ID', '역할'],
  '직위': ['직위ID','국가ID','조직ID','직위명','직위유형','직위 시작일','직위 종료일','표시순서','검토상태','직위 설명'],
  '재임': ['재임ID','주체ID','직위ID','시작일','종료일','날짜유형','재임유형','검토상태','설명'],
  '관계': ['관계ID', '패키지ID', '출발유형', '출발ID', '관계유형', '라벨', '도착유형', '도착ID', '설명', '출처', '검토상태'],
  '공간': ['공간ID', '공간명', '공간유형', '상위공간ID', '지도참조키', '시대별칭', '설명'],
  '사건_공간': ['사건ID', '공간ID'],
  '주체_공간': ['주체ID','공간ID'],
  '카테고리_공간': ['카테고리ID','공간ID'],
  '영토변화': ['영토ID', '주체ID', '영토유형', '시작일', '종료일', '지도참조키', '계기사건ID', '설명'],
  '지도도형': ['지도참조키','도형유형','파일경로','외부도형ID','원본SVG','출처','기준시점','지도데이터URL','도형 추출·사용 설명','데이터형식','좌표상태','경도','위도'],
  '지도뷰': ['뷰ID','뷰명','투영법','중심경도','중심위도','최소경도','최소위도','최대경도','최대위도','설명']
};

// 뷰어 및 편집기에서 숨길 내부 ID 열 목록
const PURE_ID_COLS = new Set([
  '기존 사건ID', '재임ID', '인물ID', '지도자ID', '관계ID'
]);

const TAB_PRIMARY_ID = {
  '패키지': '패키지ID',
  '카테고리': '카테고리ID',
  '사건': '사건ID',
  '주체': '주체ID',
  '직위': '직위ID',
  '재임': '재임ID',
  '관계': '관계ID',
  '공간': '공간ID',
  '영토변화': '영토ID',
  '지도뷰': '뷰ID'
};

// 외래키 열의 사람 친화적 한글 헤더명
const CLEAN_COL_LABELS = {
  '패키지ID': '패키지',
  '카테고리ID': '카테고리',
  '사건ID': '사건',
  '주체ID': '주체',
  '국가ID': '국가',
  '조직ID': '조직',
  '직위ID': '직위',
  '공간ID': '공간',
  '상위공간ID': '상위 공간',
  '기본뷰ID': '기본 지도 범위',
  '계기사건ID': '계기 사건',
  '출발ID': '출발',
  '도착ID': '도착',
  '존속시작일': '존속 시작일',
  '존속종료일': '존속 종료일',
  '종료상태': '종료 상태'
};

function getCleanLabel(tab, col) {
  if (tab === '재임' && col === '주체ID') return '재임자';
  if (tab === '주체' && col === '설명') return '소개';
  return CLEAN_COL_LABELS[col] || col;
}

function isHiddenInViewer(tab, col) {
  if (PURE_ID_COLS.has(col)) return true;
  if (TAB_PRIMARY_ID[tab] === col) return true;
  if (tab === '사건' && col === '카테고리명') return true;
  if (tab === '사건_카테고리' && (col === '사건명' || col === '카테고리명')) return true;
  if (tab === '사건_주체' && (col === '사건명' || col === '주체명')) return true;
  return false;
}

function isHiddenInEditor(tab, col) {
  if (PURE_ID_COLS.has(col)) return true;
  if (TAB_PRIMARY_ID[tab] === col) return true;
  if (tab === '사건' && col === '카테고리명') return true;
  return false;
}

const STORAGE_KEY = 'chronicle.dashboard.draft.v1';
const googleOAuthClientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
let savingRelationSheet = false;
const PAGE_SIZE = 50;

/* =========================================================================
   2. 풍부한 내장 샘플 데이터 (실시간 연동 실패 시 자동 폴백)
   ========================================================================= */
const SAMPLE_DATA = {
  '패키지': [
    { 패키지ID: 'japan', 패키지명: '일제강점기와 독립운동', 학교급: '중학교', 과목: '역사', 설명: '1910~1945년 일제 통치 정책과 국내외 독립운동 흐름' },
    { 패키지ID: 'coldwar', 패키지명: '냉전', 학교급: '중학교', 과목: '역사', 설명: '제2차 세계대전 이후 냉전의 형성, 데탕트, 해체 과정' }
  ],
  '카테고리': [
    { 카테고리ID: 'japan_gov', 카테고리명: '통치 정책', 패키지ID: 'japan', 카테고리유형: 'theme', 시작일: '', 종료일: '' },
    { 카테고리ID: 'japan_eco', 카테고리명: '경제 정책', 패키지ID: 'japan', 카테고리유형: 'theme', 시작일: '', 종료일: '' },
    { 카테고리ID: 'japan_dom', 카테고리명: '국내 민족 운동', 패키지ID: 'japan', 카테고리유형: 'theme', 시작일: '', 종료일: '' },
    { 카테고리ID: 'japan_chn', 카테고리명: '중국 관내 독립운동', 패키지ID: 'japan', 카테고리유형: 'theme', 시작일: '', 종료일: '' },
    { 카테고리ID: 'japan_military_rule', 카테고리명: '무단 통치', 패키지ID: 'japan', 카테고리유형: 'period', 시작일: '1910', 종료일: '1919' },
    { 카테고리ID: 'japan_cultural_rule', 카테고리명: '문화 통치', 패키지ID: 'japan', 카테고리유형: 'period', 시작일: '1919', 종료일: '1931' },
    { 카테고리ID: 'japan_assimilation_policy', 카테고리명: '민족 말살 정책', 패키지ID: 'japan', 카테고리유형: 'period', 시작일: '1931', 종료일: '1945' },
    { 카테고리ID: 'cw_start', 카테고리명: '냉전의 시작', 패키지ID: 'coldwar', 카테고리유형: 'period', 시작일: '1945', 종료일: '1953' },
    { 카테고리ID: 'cw_detente', 카테고리명: '데탕트', 패키지ID: 'coldwar', 카테고리유형: 'period', 시작일: '1969', 종료일: '1979' },
    { 카테고리ID: 'cw_korea', 카테고리명: '한국전쟁과 한반도', 패키지ID: 'coldwar', 카테고리유형: 'theme', 시작일: '', 종료일: '' },
    { 카테고리ID: 'cw_diplomacy', 카테고리명: '미·소 외교와 군축', 패키지ID: 'coldwar', 카테고리유형: 'theme', 시작일: '', 종료일: '' }
  ],
  '사건': [
    { 사건ID: 'E101', 사건명: '헌병 경찰제 실시', 카테고리ID: 'japan_gov, japan_military_rule', 카테고리명: '통치 정책, 무단 통치', 날짜: '1910', 종료일: '1919', 내용: '헌병이 일반 경찰 업무까지 담당하며 즉결 처분권과 태형 집행권을 행사함.', 사건유형: 'policy', 검토상태: '완료', 게임출제: 'Y', 출처: '' },
    { 사건ID: 'E102', 사건명: '토지 조사 사업', 카테고리ID: 'japan_eco, japan_military_rule', 카테고리명: '경제 정책, 무단 통치', 날짜: '1910', 종료일: '1918', 내용: '기한부 신고제를 통해 미신고 토지를 총독부가 몰수하고 식민지 지주제를 확립함.', 사건유형: 'policy', 검토상태: '완료', 게임출제: 'Y', 출처: '' },
    { 사건ID: 'E201', 사건명: '3·1 운동', 카테고리ID: 'japan_dom', 카테고리명: '국내 민족 운동', 날짜: '1919-03-01', 종료일: '', 내용: '민족 대표 33인과 학생·시민이 참여한 거족적 만세 시위. 대한민국 임시 정부 수립과 문화 통치 전환의 계기가 됨.', 사건유형: 'event', 검토상태: '완료', 게임출제: 'Y', 출처: '' },
    { 사건ID: 'E248', 사건명: '보통 경찰제 전환 (문화 통치 표방)', 카테고리ID: 'japan_gov, japan_cultural_rule', 카테고리명: '통치 정책, 문화 통치', 날짜: '1919-08', 종료일: '1945', 내용: '3·1 운동 이후 헌병 경찰제를 폐지하고 보통 경찰제로 전환했으나 경찰관 수와 관서는 오히려 대폭 증가함.', 사건유형: 'policy', 검토상태: '완료', 게임출제: 'Y', 출처: '' },
    { 사건ID: 'E255', 사건명: '치안 유지법 제정', 카테고리ID: 'japan_gov, japan_cultural_rule', 카테고리명: '통치 정책, 문화 통치', 날짜: '1925', 종료일: '1945', 내용: '국체 변혁과 사유 재산 제도 부정을 처벌한다는 명목으로 사회주의와 독립운동을 탄압함.', 사건유형: 'policy', 검토상태: '검토중', 게임출제: 'Y', 출처: '' },
    { 사건ID: 'E260', 사건명: '신간회 창립', 카테고리ID: 'japan_dom, japan_cultural_rule', 카테고리명: '국내 민족 운동, 문화 통치', 날짜: '1927', 종료일: '1931', 내용: '비타협적 민족주의 진영과 사회주의 진영이 연대해 결성한 최대 규모의 민족 유일당 합법 단체.', 사건유형: 'organization', 검토상태: '완료', 게임출제: 'Y', 출처: '' },
    { 사건ID: 'E301', 사건명: '윤봉길 훙커우 공원 의거', 카테고리ID: 'japan_chn', 카테고리명: '중국 관내 독립운동', 날짜: '1932-04-29', 종료일: '', 내용: '한인 애국단 소속 윤봉길이 상하이 훙커우 공원에서 일본군 수뇌부에 폭탄을 투척. 중국 국민당 정부의 임시 정부 지원 계기.', 사건유형: 'battle', 검토상태: '완료', 게임출제: 'Y', 출처: '' },
    { 사건ID: 'E320', 사건명: '국가 총동원법 제정', 카테고리ID: 'japan_eco, japan_assimilation_policy', 카테고리명: '경제 정책, 민족 말살 정책', 날짜: '1938', 종료일: '1945', 내용: '중일 전쟁 확대 이후 인적·물적 자원을 전시 체제로 강제 동원하기 위해 제정한 법령.', 사건유형: 'policy', 검토상태: '완료', 게임출제: 'Y', 출처: '' },
    { 사건ID: 'E401', 사건명: '미-소 모스크바 3국 외상 회의 합의', 카테고리ID: 'cw_korea, cw_start', 카테고리명: '한국전쟁과 한반도, 냉전의 시작', 날짜: '1945-12', 종료일: '', 내용: '한반도 임시 민주 정부 수립, 미·소 공동위원회 설치, 최고 5년간 신탁통치 방안을 합의함.', 사건유형: 'treaty', 검토상태: '완료', 게임출제: 'Y', 출처: '' },
    { 사건ID: 'E402', 사건명: '트루먼 독트린 발표', 카테고리ID: 'cw_diplomacy, cw_start', 카테고리명: '미·소 외교와 군축, 냉전의 시작', 날짜: '1947-03-12', 종료일: '', 내용: '미국 트루먼 대통령이 공산주의 세력의 팽창을 저지하기 위해 자유 진영 국가에 군사·경제 원조를 선언함.', 사건유형: 'policy', 검토상태: '검토중', 게임출제: 'Y', 출처: '' },
    { 사건ID: 'E410', 사건명: '닉슨 대통령 중국 방문', 카테고리ID: 'cw_diplomacy, cw_detente', 카테고리명: '미·소 외교와 군축, 데탕트', 날짜: '1972-02', 종료일: '', 내용: '미국 닉슨 대통령이 베이징을 방문해 마오쩌둥과 회담하고 상하이 공동 성명을 발표하며 미·중 관계 정상화의 물꼬를 틈.', 사건유형: 'event', 검토상태: '초안', 게임출제: 'N', 출처: '' }
  ],
  '사건_카테고리': [
    { 사건ID: 'E101', 카테고리ID: 'japan_gov' },
    { 사건ID: 'E101', 카테고리ID: 'japan_military_rule' },
    { 사건ID: 'E102', 카테고리ID: 'japan_eco' },
    { 사건ID: 'E102', 카테고리ID: 'japan_military_rule' },
    { 사건ID: 'E201', 카테고리ID: 'japan_dom' },
    { 사건ID: 'E248', 카테고리ID: 'japan_gov' },
    { 사건ID: 'E248', 카테고리ID: 'japan_cultural_rule' },
    { 사건ID: 'E255', 카테고리ID: 'japan_gov' },
    { 사건ID: 'E255', 카테고리ID: 'japan_cultural_rule' },
    { 사건ID: 'E260', 카테고리ID: 'japan_dom' },
    { 사건ID: 'E260', 카테고리ID: 'japan_cultural_rule' },
    { 사건ID: 'E301', 카테고리ID: 'japan_chn' },
    { 사건ID: 'E320', 카테고리ID: 'japan_eco' },
    { 사건ID: 'E320', 카테고리ID: 'japan_assimilation_policy' },
    { 사건ID: 'E401', 카테고리ID: 'cw_korea' },
    { 사건ID: 'E401', 카테고리ID: 'cw_start' },
    { 사건ID: 'E402', 카테고리ID: 'cw_diplomacy' },
    { 사건ID: 'E402', 카테고리ID: 'cw_start' },
    { 사건ID: 'E410', 카테고리ID: 'cw_diplomacy' },
    { 사건ID: 'E410', 카테고리ID: 'cw_detente' }
  ],
  '주체': [
    { 주체ID: 'org_provisional', 주체명: '대한민국 임시 정부', 구분: 'organization', 존속시작일: '1919', 존속종료일: '1945', 종료상태: '광복·환국', 성향: '우익·민족주의', 설명: '3·1 운동 이후 상하이에서 수립된 민주 공화제 임시 정부.', 검토상태: '완료' },
    { 주체ID: 'org_hanin', 주체명: '한인 애국단', 구분: 'organization', 존속시작일: '1931', 존속종료일: '1932', 종료상태: '해체', 성향: '우익·민족주의', 설명: '김구가 임시 정부의 침체를 극복하기 위해 조직한 의열 투쟁 단체.', 검토상태: '완료' },
    { 주체ID: 'org_uiyeoldan', 주체명: '의열단', 구분: 'organization', 존속시작일: '1919', 존속종료일: '1935', 종료상태: '통합 해소', 성향: '좌익·의열단 계열', 설명: '김원봉이 만주 지린성에서 조직한 항일 무장 비밀 결사.', 검토상태: '완료' },
    { 주체ID: 'org_minhyeok', 주체명: '민족 혁명당', 구분: 'organization', 존속시작일: '1935', 존속종료일: '1947', 종료상태: '해산', 성향: '좌우 합작', 설명: '김원봉 주도로 의열단과 여러 단체가 통합해 창당한 정당.', 검토상태: '완료' },
    { 주체ID: 'army_uiyongdae', 주체명: '조선 의용대', 구분: 'army', 존속시작일: '1938', 존속종료일: '1942', 종료상태: '편입·개편', 성향: '좌익·의열단 계열', 설명: '중국 관내에서 결성된 최초의 한인 무장 부대.', 검토상태: '완료' },
    { 주체ID: 'actor_usa', 주체명: '미국', 구분: 'state', 존속시작일: '', 존속종료일: '', 종료상태: '존속', 성향: '자유진영', 설명: '냉전기 자유진영을 이끈 초강대국.', 검토상태: '완료' },
    { 주체ID: 'actor_ussr', 주체명: '소련', 구분: 'state', 존속시작일: '1922', 존속종료일: '1991', 종료상태: '해체', 성향: '공산진영', 설명: '냉전기 공산진영을 이끈 초강대국.', 검토상태: '완료' },
    { 주체ID: 'actor_prc', 주체명: '중국', 구분: 'state', 존속시작일: '1949', 존속종료일: '', 종료상태: '존속', 성향: '공산진영', 설명: '1949년 중화인민공화국 수립 이후 냉전 구도의 핵심 변수.', 검토상태: '완료' }
  ],
  '사건_주체': [
    { 사건ID: 'E301', 주체ID: 'org_hanin', 역할: '주도' },
    { 사건ID: 'E301', 주체ID: 'org_provisional', 역할: '영향' },
    { 사건ID: 'E401', 주체ID: 'actor_usa', 역할: '참여' },
    { 사건ID: 'E401', 주체ID: 'actor_ussr', 역할: '참여' },
    { 사건ID: 'E402', 주체ID: 'actor_usa', 역할: '주도' },
    { 사건ID: 'E410', 주체ID: 'actor_usa', 역할: '참여' },
    { 사건ID: 'E410', 주체ID: 'actor_prc', 역할: '참여' }
  ],
  '재임': [
    { 재임ID: 'L01', 국가ID: 'org_provisional', 이름: '김구', 원어명: '金九', 직위: '주석', 직위유형: '국가원수', 시작일: '1940', 종료일: '1945', 재임유형: '정규', 검토상태: '완료', 설명: '충칭 대한민국 임시 정부 주석' },
    { 재임ID: 'L02', 국가ID: 'org_uiyeoldan', 이름: '김원봉', 원어명: '金元鳳', 직위: '단장', 직위유형: '단체장', 시작일: '1919', 종료일: '1935', 재임유형: '정규', 검토상태: '완료', 설명: '의열단 창설 및 지도' },
    { 재임ID: 'L03', 국가ID: 'actor_usa', 이름: '해리 트루먼', 원어명: 'Harry S. Truman', 직위: '대통령', 직위유형: '국가원수', 시작일: '1945', 종료일: '1953', 재임유형: '정규', 검토상태: '완료', 설명: '트루먼 독트린 및 마셜 플랜 추진' },
    { 재임ID: 'L04', 국가ID: 'actor_usa', 이름: '리처드 닉슨', 원어명: 'Richard Nixon', 직위: '대통령', 직위유형: '국가원수', 시작일: '1969', 종료일: '1974', 재임유형: '정규', 검토상태: '완료', 설명: '미·중 데탕트 주도' },
    { 재임ID: 'L05', 국가ID: 'actor_ussr', 이름: '이오시프 스탈린', 원어명: 'Joseph Stalin', 직위: '서기장', 직위유형: '최고지도자', 시작일: '1922', 종료일: '1953', 재임유형: '정규', 검토상태: '완료', 설명: '냉전 초기 소련 지도자' },
    { 재임ID: 'L06', 국가ID: 'actor_prc', 이름: '마오쩌둥', 원어명: '毛澤東', 직위: '주석', 직위유형: '최고지도자', 시작일: '1949', 종료일: '1976', 재임유형: '정규', 검토상태: '완료', 설명: '중화인민공화국 건국 지도자' }
  ],
  '관계': [
    { 관계ID: 'R01', 패키지ID: 'japan', 출발유형: 'event', 출발ID: 'E201', 도착유형: 'event', 도착ID: 'E248', 관계유형: 'shift', 라벨: '통치 방식의 전환', 설명: '3·1 운동의 충격으로 일제가 무단 통치에서 문화 통치로 전환함.', 출처: '', 검토상태: '완료' },
    { 관계ID: 'R02', 패키지ID: 'japan', 출발유형: 'organization', 출발ID: 'org_uiyeoldan', 도착유형: 'organization', 도착ID: 'org_minhyeok', 관계유형: 'integration', 라벨: '통합 창당 주도', 설명: '의열단이 중심이 되어 여러 독립운동 단체를 통합해 민족 혁명당을 결성함.', 출처: '', 검토상태: '완료' },
    { 관계ID: 'R03', 패키지ID: 'japan', 출발유형: 'organization', 출발ID: 'org_minhyeok', 도착유형: 'army', 도착ID: 'army_uiyongdae', 관계유형: 'action', 라벨: '무장 부대 창설', 설명: '민족 혁명당이 중심이 된 연맹 산하에 조선 의용대를 창설함.', 출처: '', 검토상태: '완료' },
    { 관계ID: 'R04', 패키지ID: 'japan', 출발유형: 'organization', 출발ID: 'org_hanin', 도착유형: 'event', 도착ID: 'E301', 관계유형: 'action', 라벨: '의거 실행', 설명: '한인 애국단의 윤봉길이 상하이 훙커우 공원에서 의거를 실행함.', 출처: '', 검토상태: '완료' },
    { 관계ID: 'R05', 패키지ID: 'coldwar', 출발유형: 'event', 출발ID: 'E401', 도착유형: 'event', 도착ID: 'E402', 관계유형: 'cause', 라벨: '냉전 대립 심화', 설명: '전후 처리 갈등이 깊어지며 미국의 봉쇄 정책으로 이어짐.', 출처: '', 검토상태: '완료' },
    { 관계ID: 'R06', 패키지ID: 'japan', 출발유형: 'army', 출발ID: 'army_uiyongdae', 도착유형: 'organization', 도착ID: 'org_provisional', 관계유형: 'split', 라벨: '화북 이동·충칭 편입 분화', 설명: '조선 의용대가 화북 지대와 충칭 본부(광복군 편입)로 갈라져 활동함.', 출처: '', 검토상태: '완료' },
    { 관계ID: 'R07', 패키지ID: 'coldwar', 출발유형: 'event', 출발ID: 'E402', 도착유형: 'event', 도착ID: 'E410', 관계유형: 'influence', 라벨: '냉전 구도의 변화', 설명: '장기 대립과 다극화 흐름 속에서 미·중 데탕트로 이어짐.', 출처: '', 검토상태: '완료' }
  ]
};

/* =========================================================================
   3. 전역 상태
   ========================================================================= */
const state = {
  activeView: 'overview',
  rawTable: false,
  geoType: 'all',
  searchQuery: '',
  packageFilter: 'all',
  categoryFilter: '',
  sortCol: null,
  sortDir: 'asc',
  page: 1,
  dirtyCount: 0,
  headers: {},
  data: {},
  originalData: {},
  originalHeaders: {},
  editing: null, // { tab, rowIndex (null이면 신규), draft }
  relationEdit: {from:null,to:null,type:'',packageId:''},
  relationSearch: {from:'',to:''},
  overview: {
    selectedPkgId: null,
    selectedCatId: null,
    activeGroups: Object.create(null),
    collapsedGroups: new Set(),
    expandedMore: Object.create(null),  // { '시트::그룹키': true }
    relFrom: '',
    relTo: '',
    relFilter: 'all'   // 'all' | 관계유형 코드
  }
};

/* =========================================================================
   4. 공통 유틸리티 (이스케이프, 토스트, 확인 모달, 클립보드, 다운로드)
   ========================================================================= */
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const styles = {
    success: 'bg-emerald-900 text-white border-emerald-700',
    error: 'bg-rose-900 text-white border-rose-700',
    warn: 'bg-amber-900 text-white border-amber-700',
    info: 'bg-slate-900 text-white border-slate-700'
  };
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.className = `toast-item pointer-events-auto px-4 py-2.5 rounded-xl border shadow-lg text-xs font-bold max-w-sm ${styles[type] || styles.info}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.25s ease';
    setTimeout(() => el.remove(), 260);
  }, 3200);
}

function showConfirm(title, message) {
  const modal = document.getElementById('confirm-modal');
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  modal.returnValue = '';
  modal.showModal();
  return new Promise(resolve => modal.addEventListener('close', () => resolve(modal.returnValue === 'yes'), {once:true}));
}

function copyTextToClipboard(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
}

function downloadFile(filename, content, mimeType) {
  const bom = mimeType.includes('csv') ? '\uFEFF' : '';
  const blob = new Blob([bom + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* =========================================================================
   5. CSV / TSV 파싱 및 직렬화
   ========================================================================= */
function parseCSV(text, tab) {
  return parseDashboardCSV(text, SheetData.parseCSV, tab);
}

function spreadsheetText(value) {
  const text = String(value ?? '');
  return /^\s*[=+@-]/.test(text) ? "'" + text : text;
}

function toTSV(headers, records) {
  const esc = (v) => spreadsheetText(v).replace(/[\t\r\n]/g, ' ');
  const lines = [headers.map(esc).join('\t')];
  records.forEach((rec) => {
    lines.push(headers.map((h) => esc(rec[h] ?? '')).join('\t'));
  });
  return lines.join('\n');
}

function toCSV(headers, records) {
  const esc = (v) => {
    const s = spreadsheetText(v);
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.map(esc).join(',')];
  records.forEach((rec) => {
    lines.push(headers.map((h) => esc(rec[h] ?? '')).join(','));
  });
  return lines.join('\r\n');
}

/* =========================================================================
   6. 구글 시트 실시간 연동 및 로컬 임시 저장
   ========================================================================= */
function saveToLocalStorage(data = state.data, dirtyCount = state.dirtyCount) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      headers: state.headers,
      data,
      dirtyCount
    }));
    return true;
  } catch (e) {
    showToast('이 브라우저에 저장할 공간이 부족해요. JSON 백업으로 변경 내용을 보관할 수 있습니다.', 'warn');
    return false;
  }
}

function updateDirtyControls() {
  const box = document.getElementById('dirty-controls');
  const badge = document.getElementById('dirty-badge');
  if (!box || !badge) return;
  if (state.dirtyCount > 0) {
    box.classList.remove('hidden');
    badge.textContent = `브라우저 사본 · 변경 ${state.dirtyCount}건`;
  } else {
    box.classList.add('hidden');
  }
}

/* =========================================================================
   7. 참조 해석(Lookup) 및 셀 렌더링 헬퍼
   ========================================================================= */
function getLookupMaps() {
  const pkgMap = new Map();
  (state.data['패키지'] || []).forEach((r) => {
    if (r['패키지ID']) pkgMap.set(r['패키지ID'], r['패키지명'] || r['패키지ID']);
  });

  const catMap = new Map();
  const catTypeMap = new Map();
  (state.data['카테고리'] || []).forEach((r) => {
    if (r['카테고리ID']) {
      catMap.set(r['카테고리ID'], r['카테고리명'] || r['카테고리ID']);
      catTypeMap.set(r['카테고리ID'], String(r['카테고리유형'] || '').toLowerCase());
    }
  });

  const evMap = new Map();
  (state.data['사건'] || []).forEach((r) => {
    if (r['사건ID']) evMap.set(r['사건ID'], r['사건명'] || r['사건ID']);
  });

  const actorMap = new Map();
  (state.data['주체'] || []).forEach((r) => {
    if (r['주체ID']) actorMap.set(r['주체ID'], r['주체명'] || r['주체ID']);
  });

  const spaceMap = new Map(state.data['공간'].map(row => [row['공간ID'], row['공간명']]));
  const spaceTypes = new Map(state.data['공간'].map(row => [row['공간ID'], row['공간유형']]));
  const officeMap = new Map(state.data.직위.map(row => [row.직위ID,row]));
  const viewMap = new Map(state.data.지도뷰.map(row => [row.뷰ID,row.뷰명]));
  return { pkgMap, catMap, catTypeMap, evMap, actorMap, spaceMap, spaceTypes, officeMap, viewMap };
}

function geometryKind(tab, row, maps) {
  if (Object.hasOwn(SPACE_LINKS,tab)) return maps.spaceTypes.get(row.공간ID);
  return row[tab === '지도도형' ? '도형유형' : '공간유형'];
}

function geometryMark(kind) {
  return GEO_TYPE_LABELS.has(kind) && kind !== 'all' ? `<span class="geo-kind"><i class="geo-icon-${kind}" aria-hidden="true"></i>${GEO_TYPE_LABELS.get(kind)}</span>` : escapeHtml(kind || '—');
}

function renderGeometryChoices(kinds) {
  const totals = new Map();
  for (const kind of kinds) totals.set(kind, (totals.get(kind) || 0) + 1);
  return `<div class="dashboard-type-chips" role="group" aria-label="점·선·면">
    ${[...GEO_TYPE_LABELS].map(([kind,label]) => `<button type="button" data-geo-kind="${kind}" aria-pressed="${state.geoType === kind}">
      ${label} <span>${kind === 'all' ? kinds.length : totals.get(kind) || 0}</span></button>`).join('')}
  </div>`;
}

function bindGeometryChoices(view, render) {
  for (const button of view.querySelectorAll('[data-geo-kind]')) {
    button.addEventListener('click', () => {
      if (state.geoType === button.dataset.geoKind) return;
      state.geoType = button.dataset.geoKind;
      state.page = 1;
      render();
      view.querySelector(`[data-geo-kind="${state.geoType}"]`)?.focus({preventScroll:true});
    });
  }
}

function resolveRefDisplay(col, val, maps) {
  const v = String(val ?? '').trim();
  if (!v) return '';
  if (col === '패키지ID') return maps.pkgMap.get(v) || v;
  if (col === '카테고리ID' || Object.hasOwn(SheetData.eventCategoryTypes,col)) {
    return v.split(/[,;|]/).map((s) => s.trim()).filter(Boolean)
      .map((id) => maps.catMap.get(id) || id)
      .join(', ');
  }
  if (col === '사건ID' || col === '계기사건ID') return maps.evMap.get(v) || v;
  if (['주체ID','국가ID','조직ID'].includes(col)) return maps.actorMap.get(v) || v;
  if (col === '직위ID') return maps.officeMap.get(v)?.직위명 || v;
  if (col === '공간ID' || col === '상위공간ID') return maps.spaceMap.get(v) || v;
  if (col === '기본뷰ID') return maps.viewMap.get(v) || v;
  if (col === '출발ID' || col === '도착ID') {
    return maps.evMap.get(v) || maps.actorMap.get(v) || maps.catMap.get(v) || v;
  }
  return v;
}

function renderCellHtml(tab, col, row, maps) {
  if (GEO_TABLES.includes(tab) && (col === '공간유형' || col === '도형유형')) {
    return geometryMark(geometryKind(tab, row, maps));
  }
  if (tab === '관계' && col === '관계유형') return renderRelationEdge(row);
  const raw = String(row[col] ?? '').trim();
  if (!raw) return '<span class="text-slate-300">-</span>';

  // 다중 카테고리 칩 (사건 시트)
  if (tab === '사건' && (col === '카테고리ID' || Object.hasOwn(SheetData.eventCategoryTypes,col))) {
    const ids = raw.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
    return `<div class="flex flex-wrap gap-1">${ids.map((id) => {
      const name = maps.catMap.get(id) || id;
      const type = SheetData.eventCategoryTypes[col] || maps.catTypeMap.get(id);
      const isPeriod = type === 'period';
      const cls = isPeriod
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-blue-50 text-blue-700 border-blue-200';
      return `<span class="inline-flex px-2 py-0.5 rounded-md border text-[11px] font-bold whitespace-nowrap ${cls}" data-category-type="${escapeHtml(type || '')}">${escapeHtml(name)}</span>`;
    }).join('')}</div>`;
  }

  // 카테고리 유형 배지
  if (tab === '카테고리' && col === '카테고리유형') {
    const isPeriod = raw.toLowerCase() === 'period';
    return `<span class="inline-flex px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
      isPeriod ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-700'
    }">${escapeHtml(getGroupLabel('카테고리', raw))}</span>`;
  }

  // 관계 출발/도착 대상 (숨긴 유형을 미니 배지로 함께 표기)
  if (tab === '관계' && (col === '출발ID' || col === '도착ID')) {
    const typeKey = col === '출발ID' ? '출발유형' : '도착유형';
    const type = row[typeKey];
    const tLabel = getEntityType(type);
    const name = relationEndpointName(type, raw, maps);
    return `<div class="flex items-center gap-1.5">
      ${tLabel ? `<span class="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px] font-bold shrink-0">${escapeHtml(tLabel)}</span>` : ''}
      <span class="font-bold text-slate-900 whitespace-nowrap">${escapeHtml(name)}</span>
    </div>`;
  }

  // 일반 외래키 참조
  if (['패키지ID', '카테고리ID', '사건ID', '주체ID', '국가ID', '조직ID', '직위ID', '공간ID', '상위공간ID', '계기사건ID'].includes(col)) {
    const resolved = resolveRefDisplay(col, raw, maps);
    return `<span class="inline-flex px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px] font-bold whitespace-nowrap">${escapeHtml(resolved)}</span>`;
  }

  // 검토상태 배지
  if (col === '검토상태') {
    const lower = raw.toLowerCase();
    const cls = (lower === '완료' || lower === 'verified')
      ? 'bg-emerald-50 text-emerald-700'
      : (lower === '검토중' || lower === 'review')
        ? 'bg-amber-50 text-amber-800'
        : 'bg-slate-100 text-slate-600';
    return `<span class="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${cls}">${escapeHtml(raw)}</span>`;
  }

  // URL 링크
  if (col === '출처' && /^https?:\/\//i.test(raw)) {
    return `<a href="${escapeHtml(raw)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline font-semibold">링크 열기 ↗</a>`;
  }

  // 긴 텍스트 줄임
  if (['내용', '설명', '소개'].includes(col)) {
    return `<div class="cell-truncate text-slate-600" title="${escapeHtml(raw)}">${escapeHtml(raw)}</div>`;
  }

  // 이름/제목 강조
  if (col === recordNameFields[tab]) {
    return `<span class="font-bold text-slate-900 whitespace-nowrap">${escapeHtml(raw)}</span>`;
  }

  return `<span class="whitespace-nowrap">${escapeHtml(col === recordKindFields[tab] ? getGroupLabel(tab, raw) : raw)}</span>`;
}

/* =========================================================================
   8. 좌측 사이드바 & 상단 패키지 필터 렌더링
   ========================================================================= */
function renderSidebar() {
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;

  let html = '';

  SHEET_GROUPS.forEach((grp) => {
    html += `
      <div class="space-y-1">
        <div class="px-3 text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wider">${escapeHtml(grp.label)}</div>
        ${grp.tabs.map((tab) => {
          const active = state.activeView === tab;
          const cnt = (state.data[tab] || []).length;
          return `
            <button data-nav="${escapeHtml(tab)}" aria-pressed="${active}" class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }">
              <span>${escapeHtml(tab)}</span>
              <span class="px-1.5 py-0.2 rounded-full text-[10.5px] font-extrabold ${
                active ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'
              }">${cnt}</span>
            </button>
          `;
        }).join('')}
      </div>
    `;
  });

  nav.innerHTML = html;
  nav.querySelectorAll('button[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => openTable(btn.dataset.nav));
  });
}

function renderPackageFilter() {
  const picker = document.getElementById('package-filter');
  const packages = (state.data['패키지'] || []).map(row => [row['패키지ID'], row['패키지명']]);
  if (!packages.some(([id]) => id === state.packageFilter)) state.packageFilter = 'all';
  const query = isEventWorkspace() ? document.getElementById('package-search').value.trim().toLowerCase() : '';
  const matches = packages.filter(([id,name]) => (name || id).toLowerCase().includes(query));
  document.getElementById('package-search-empty').hidden = !query || matches.length > 0;
  picker.innerHTML = [['all', '전체 패키지'], ...matches].map(([id, name]) =>
    `<button type="button" class="dashboard-button" data-package="${escapeHtml(id)}" aria-pressed="${id === state.packageFilter}">${escapeHtml(name || id)}</button>`
  ).join('');
}

/* =========================================================================
   9. 대시보드 개요 뷰 렌더링 (시트 간 관계 시각화 공간)
   ========================================================================= */
const GROUP_LABEL_MAPS = {
  '카테고리': {
    theme: '주제',
    arc: '사건군',
    period: '시기'
  },
  '사건': {
    event: '사건',
    policy: '정책 · 법령',
    organization: '단체 · 조직',
    battle: '전투 · 의거',
    treaty: '조약 · 선언',
    publication: '저술 · 발표',
    period: '시기 · 국면',
    context: '배경'
  },
  '주체': {
    state: '국가',
    organization: '단체 · 정당',
    army: '군대 · 무장조직',
    person: '인물',
    territory: '지역',
    institution: '기관'
  },
  '직위': {
    head_of_state: '국가원수',
    head_of_government: '행정부 수반',
    party_leader: '최고지도자 · 당수',
    military_leader: '군 지휘관',
    leader: '단체장 · 지도자'
  }
};

const RELATION_TYPE_META = {
  cause:       { label: '원인 · 계기', cls: 'bg-rose-50 text-rose-700 border-rose-200', arrow: '#a34838' },
  shift:       { label: '전환 · 변화', cls: 'bg-amber-50 text-amber-800 border-amber-200', arrow: '#996228' },
  background:  { label: '배경', cls: 'bg-sky-50 text-sky-700 border-sky-200', arrow: '#61776a' },
  action:      { label: '활동 · 실행', cls: 'bg-blue-50 text-blue-700 border-blue-200', arrow: '#4c6858' },
  integration: { label: '통합 · 합당', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', arrow: '#52765a' },
  split:       { label: '분리 · 개편', cls: 'bg-violet-50 text-violet-700 border-violet-200', arrow: '#9a5339' },
  succession:  { label: '계승', cls: 'bg-sky-50 text-sky-700 border-sky-200', arrow: '#61776a' },
  influence:   { label: '영향', cls: 'bg-sky-50 text-sky-700 border-sky-200', arrow: '#61776a' }
};

function getRelMeta(code) {
  const key = String(code || '').trim().toLowerCase();
  return Object.hasOwn(RELATION_TYPE_META, key) ? RELATION_TYPE_META[key] : {
    label: code || '기타 관계',
    cls: 'bg-slate-100 text-slate-700 border-slate-200',
    arrow: '#475569'
  };
}

function renderRelationEdge(row) {
  const meta = getRelMeta(row['관계유형']);
  return `<div class="dashboard-relation-edge" style="--relation-color:${meta.arrow}">
    <div class="dashboard-edge-direction">
      <span class="record-relation-type ${meta.cls}">${escapeHtml(meta.label)}</span>
    </div>
    ${row['라벨'] ? `<strong>${escapeHtml(row['라벨'])}</strong>` : ''}
  </div>`;
}

function groupRelationsByType(relations) {
  const groups = new Map();
  for (const relation of relations) {
    const code = groupKey(relation.row['관계유형']);
    if (!groups.has(code)) groups.set(code, []);
    groups.get(code).push(relation);
  }
  return groups;
}

function renderRelationFlow(groups, visibleDirections, typeCounts, activeType, total) {
  const {relFrom, relTo} = state.overview;
  const endpoints = [...groups.keys()].map(key => key.split('→'));
  const sources = [...new Set(['사건', '주체', ...endpoints.map(([from]) => from)])];
  const destinations = [...new Set(['사건', '주체', '카테고리', ...endpoints.map(([, to]) => to)])];
  const branches = new Map();
  for (const [direction, rows] of visibleDirections) {
    const [from, to] = direction.split('→');
    for (const code of groupRelationsByType(rows).keys()) {
      if (!branches.has(code)) branches.set(code, {sources: new Set(), destinations: new Set()});
      branches.get(code).sources.add(from);
      branches.get(code).destinations.add(to);
    }
  }
  const height = Math.max(sources.length * 50, destinations.length * 50, typeCounts.size * 42);
  const position = (types, type) => height * (types.indexOf(type) + 0.5) / types.length;
  const nodes = (types, side, active) => types.map(type => `
    <li><button type="button" data-flow-endpoint="${side}" data-flow-type="${escapeHtml(type)}" aria-controls="relation-flow-lanes relation-results"
      aria-label="${side === 'from' ? '출발' : '도착'} ${escapeHtml(type)}" aria-pressed="${type === active}">${escapeHtml(type)}</button></li>`).join('');

  return `<div class="dashboard-relation-flow" role="group" aria-label="출발과 도착 유형별 관계">
    <div class="dashboard-flow-head">
      <strong id="relation-flow-source">출발</strong>
      <button type="button" class="dashboard-button" data-flow-reset aria-controls="relation-results"
        aria-pressed="${!relFrom && !relTo && activeType === 'all'}">전체 ${total}건</button>
      <strong id="relation-flow-target">도착</strong>
    </div>
    <div class="dashboard-flow-body" style="--flow-height:${height}px">
      <ul class="dashboard-flow-nodes" aria-labelledby="relation-flow-source">${nodes(sources, 'from', relFrom)}</ul>
      <div id="relation-flow-lanes" class="dashboard-flow-lanes">
        ${[...typeCounts].map(([code, count], index) => {
          const meta = getRelMeta(code);
          const pressed = activeType === code;
          const lane = height * (index + 0.5) / typeCounts.size;
          const links = branches.get(code);
          const paths = [...(links?.sources ?? [])].map(type => {
            const y = position(sources, type);
            return `M0 ${y} C125 ${y} 175 ${lane} 310 ${lane}`;
          });
          const ends = [...(links?.destinations ?? [])].map(type => position(destinations, type));
          for (const y of ends) paths.push(`M310 ${lane} C445 ${lane} 495 ${y} 620 ${y}`);
          return `<div class="dashboard-flow-connection${pressed ? ' is-active' : ''}${!count || (activeType !== 'all' && !pressed) ? ' is-muted' : ''}" style="--flow-lane:${lane}px;--flow-color:${meta.arrow}">
            <svg viewBox="0 0 620 ${height}" preserveAspectRatio="none" aria-hidden="true">
              <path class="dashboard-flow-arrow" d="${paths.join(' ')}" />
              <path class="dashboard-flow-hit" d="${paths.join(' ')}" />
            </svg>
            ${ends.map(y => `<span class="dashboard-flow-tip" style="top:${y}px" aria-hidden="true"></span>`).join('')}
            <button type="button" data-flow-code="${escapeHtml(code)}" aria-controls="relation-results"
              aria-pressed="${pressed}" ${count || pressed ? '' : 'disabled'}>${escapeHtml(meta.label)} <span>${count}건</span></button>
          </div>`;
        }).join('') || '<p class="dashboard-flow-empty">연결 없음</p>'}
      </div>
      <ul class="dashboard-flow-nodes" aria-labelledby="relation-flow-target">${nodes(destinations, 'to', relTo)}</ul>
    </div>
  </div>`;
}

function getGroupLabel(tab, rawKey) {
  const k = String(rawKey || '').trim();
  if (!k) return '기타';
  const map = GROUP_LABEL_MAPS[tab] || {};
  return Object.hasOwn(map, k.toLowerCase()) ? map[k.toLowerCase()] : k;
}

function formatPeriod(start, end) {
  const s = String(start || '').trim();
  const e = String(end || '').trim();
  if (s && e) return `${s} ~ ${e}`;
  return s || e || '-';
}

function renderFoundationPeriod(start, end) {
  const [first,last] = formatPeriod(start,end).split(' ~ ');
  return `<span class="text-[11px] text-slate-600"><span class="whitespace-nowrap">${escapeHtml(first)}</span>${last ? ` <span class="whitespace-nowrap">~ ${escapeHtml(last)}</span>` : ''}</span>`;
}

function getCategoryEventMap() {
  // 카테고리ID -> Set(사건ID)
  const map = new Map();
  const add = (cid, eid) => {
    if (!cid || !eid) return;
    if (!map.has(cid)) map.set(cid, new Set());
    map.get(cid).add(eid);
  };
  (state.data['사건_카테고리'] || []).forEach((r) => add(r['카테고리ID'], r['사건ID']));
  (state.data['사건'] || []).forEach((ev) => {
    const eid = ev['사건ID'];
    String(ev['카테고리ID'] || '').split(/[,;|]/).map((s) => s.trim()).filter(Boolean).forEach((cid) => add(cid, eid));
  });
  return map;
}

function groupKey(value) {
  return String(value || '').trim().toLowerCase() || '기타';
}

function renderGroupedTable({ tab, groupField, groupLabelTab = tab, items, columns, maxPerGroup = 10, highlightIds = null, idField = null, rowAttr = null, selectedId = null, linkedCls = '' }) {
  // 그룹핑
  const groups = new Map();
  items.forEach((item) => {
    const rawKey = String(item.row[groupField] || '').trim() || '기타';
    const normKey = groupKey(rawKey);
    if (!groups.has(normKey)) {
      groups.set(normKey, { key: normKey, label: getGroupLabel(groupLabelTab, rawKey), rows: [] });
    }
    groups.get(normKey).rows.push(item);
  });

  if (!groups.size) {
    return {chips:'',table:'<div class="p-6 text-center text-xs text-slate-400">표시할 데이터가 없습니다.</div>'};
  }

  const groupArr = [...groups.values()];
  const requestedGroup = state.overview.activeGroups[tab];
  const activeGroup = groups.has(requestedGroup) ? requestedGroup : '';
  const visibleGroups = activeGroup ? [groups.get(activeGroup)] : groupArr;
  const choices = groupArr.length > 1 ? [{key:'',label:'전체'}, ...groupArr] : groupArr;
  const chips = `
    <div class="dashboard-type-chips" role="group" aria-label="${escapeHtml(tab)} 유형">
      ${choices.map(({key,label,rows}) => {
        const pressed = groupArr.length === 1 || activeGroup === key;
        return `<button type="button" data-group-tab="${escapeHtml(tab)}" data-group-choice="${escapeHtml(key)}" aria-pressed="${pressed}">${escapeHtml(label)}${rows ? ` <span>${rows.length}</span>` : ''}</button>`;
      }).join('')}
    </div>`;
  const table = `
    <table class="w-full text-left border-collapse">
      <thead class="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
        <tr>
          ${columns.map((c) => `<th class="px-3 py-2 text-[11px] font-extrabold text-slate-500 whitespace-nowrap">${escapeHtml(c.label)}</th>`).join('')}
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 text-xs">
        ${visibleGroups.map((grp) => {
          const gKey = `${tab}::${grp.key}`;
          const collapsed = state.overview.collapsedGroups.has(gKey);
          const isExpandedMore = !!state.overview.expandedMore[gKey];

          // 연결된 행을 그룹 상단으로 정렬해 시각적 연결이 바로 보이게 함
          let sortedRows = grp.rows.slice();
          if (highlightIds && idField) {
            sortedRows.sort((a, b) => {
              const ha = highlightIds.has(a.row[idField]) ? 0 : 1;
              const hb = highlightIds.has(b.row[idField]) ? 0 : 1;
              return ha - hb;
            });
          }
          const visibleRows = collapsed ? [] : isExpandedMore ? sortedRows : sortedRows.slice(0, maxPerGroup);
          const hiddenCount = sortedRows.length - visibleRows.length;
          const linkedCount = highlightIds && idField ? sortedRows.filter(({row}) => highlightIds.has(row[idField])).length : 0;
          return `
            <tr data-group-anchor="${escapeHtml(gKey)}">
              <td colspan="${columns.length}" class="dashboard-group-heading">
                <button type="button" data-group-toggle="${escapeHtml(gKey)}" aria-expanded="${!collapsed}">
                  <span aria-hidden="true">${collapsed ? '▶' : '▼'}</span>
                  <span>${escapeHtml(grp.label)}</span>
                  <span class="dashboard-group-count">${grp.rows.length}</span>
                  ${linkedCount ? `<span class="dashboard-group-linked">연결 ${linkedCount}</span>` : ''}
                </button>
              </td>
            </tr>
            ${visibleRows.map(({ row, origIdx }) => {
              const rid = idField ? (row[idField] || '') : '';
              const isSel = selectedId && rid === selectedId;
              const isLinked = highlightIds && rid && highlightIds.has(rid);
              const trCls = isSel ? 'is-selected' : (isLinked ? linkedCls : '');
              const attrStr = rowAttr ? `${rowAttr}="${escapeHtml(rid)}"` : '';
              return `
                <tr ${attrStr} data-ov-tab="${escapeHtml(tab)}" data-ov-idx="${origIdx}" class="hier-row hover:bg-slate-50 cursor-pointer ${trCls}">
                  ${columns.map((c) => `<td class="px-3 py-2 text-slate-700 align-top">${c.render(row)}</td>`).join('')}
                </tr>
              `;
            }).join('')}
            ${!collapsed && hiddenCount > 0 ? `
              <tr data-group-more="${escapeHtml(gKey)}" class="bg-white hover:bg-slate-50 cursor-pointer">
                <td colspan="${columns.length}" class="px-3 py-1.5 text-center text-[11px] font-bold text-blue-600">+ ${hiddenCount}건 더 보기</td>
              </tr>
            ` : ''}
          `;
        }).join('')}
      </tbody>
    </table>
  `;
  return {chips,table};
}

function renderOverview() {
  const view = document.getElementById('main-view');
  const maps = getLookupMaps();
  const pkgs = (state.data['패키지'] || []).map((row, origIdx) => ({ row, origIdx }));
  const cats = (state.data['카테고리'] || []).map((row, origIdx) => ({ row, origIdx }));
  const events = (state.data['사건'] || []).map((row, origIdx) => ({ row, origIdx }));
  const actors = (state.data['주체'] || []).map((row, origIdx) => ({ row, origIdx }));
  const leaders = state.data.재임.map((record, origIdx) => {
    const office = maps.officeMap.get(record.직위ID);
    return {origIdx, row:{...record, 이름:record.이름 || maps.actorMap.get(record.주체ID),
      국가ID:office?.국가ID || office?.조직ID || record.국가ID,
      직위:office?.직위명 || record.직위, 직위유형:office?.직위유형 || record.직위유형}};
  });
  const categoryPlaces = SheetData.linkedSpaceNames(state.data.공간,state.data.카테고리_공간,'카테고리ID');
  const allRelations = (state.data['관계'] || []).map((row, origIdx) => ({ row, origIdx }))
    .filter(({row}) => state.packageFilter === 'all' || row['패키지ID'] === state.packageFilter);
  const relationsByDirection = groupRelationsByDirection(allRelations);
  const {relFrom, relTo} = state.overview;
  const visibleDirections = filterRelationDirections(relationsByDirection, relFrom, relTo);
  const rels = [...visibleDirections.values()].flat().sort((a, b) => a.origIdx - b.origIdx);

  // 기본 선택 패키지/카테고리 보정
  if (state.packageFilter !== 'all') {
    state.overview.selectedPkgId = state.packageFilter;
  } else if (!state.overview.selectedPkgId || !pkgs.some((p) => p.row['패키지ID'] === state.overview.selectedPkgId)) {
    state.overview.selectedPkgId = pkgs[0]?.row['패키지ID'] || null;
  }

  const selPkgId = state.overview.selectedPkgId;
  const pkgCatIds = new Set(cats.filter((c) => c.row['패키지ID'] === selPkgId).map((c) => c.row['카테고리ID']));

  const categoryGroup = state.overview.activeGroups['카테고리'];
  const selectedCategoryGroup = cats.some(({row}) => groupKey(row['카테고리유형']) === categoryGroup) ? categoryGroup : '';
  const visiblePkgCats = cats.filter(({row}) => row['패키지ID'] === selPkgId &&
    (!selectedCategoryGroup || groupKey(row['카테고리유형']) === selectedCategoryGroup));
  if (!visiblePkgCats.some(({row}) => row['카테고리ID'] === state.overview.selectedCatId)) {
    const firstCat = visiblePkgCats[0];
    state.overview.selectedCatId = firstCat?.row['카테고리ID'] || null;
  }
  const selCatId = state.overview.selectedCatId;
  const selCatObj = cats.find((c) => c.row['카테고리ID'] === selCatId)?.row;
  const isSelCatPeriod = String(selCatObj?.['카테고리유형'] || '').toLowerCase() === 'period';

  const catEvMap = getCategoryEventMap();
  const linkedEvIds = catEvMap.get(selCatId) || new Set();

  // 패키지별 카테고리 수 & 카테고리별 사건 수 계산
  const catCountByPkg = new Map();
  cats.forEach((c) => {
    const pid = c.row['패키지ID'];
    catCountByPkg.set(pid, (catCountByPkg.get(pid) || 0) + 1);
  });

  const relationsByType = groupRelationsByType(rels);
  const typeCounts = new Map([...new Set(allRelations.map(({row}) => groupKey(row['관계유형'])))].map(
    code => [code, relationsByType.get(code)?.length ?? 0]
  ));
  const activeRelFilter = typeCounts.has(state.overview.relFilter) ? state.overview.relFilter : 'all';
  const filteredRels = activeRelFilter === 'all' ? rels : relationsByType.get(activeRelFilter) ?? [];

  // 기초정보: 주체/지도자 테이블 HTML
  const actorTableHtml = renderGroupedTable({
    tab: '주체',
    groupField: '구분',
    items: actors,
    maxPerGroup: 8,
    columns: [
      { label: '주체명', render: (r) => `<span class="font-bold text-slate-900">${escapeHtml(r['주체명'] || '-')}</span>` },
      { label: '성향', render: (r) => r['성향'] ? `<span class="foundation-tag px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10.5px] font-bold" title="${escapeHtml(r['성향'])}">${escapeHtml(r['성향'])}</span>` : '<span class="text-slate-300">-</span>' },
      { label: '존속 기간', render: (r) => renderFoundationPeriod(r['존속시작일'] || r['존속 시작일'], r['존속종료일'] || r['존속 종료일']) },
      { label: '소개', render: (r) => `<span class="block max-w-[180px] truncate text-slate-500" title="${escapeHtml(r['설명'] || r['소개'] || '')}">${escapeHtml(r['설명'] || r['소개'] || '-')}</span>` }
    ]
  });

  const leaderTableHtml = renderGroupedTable({
    tab: '재임',
    groupField: '직위유형',
    groupLabelTab: '직위',
    items: leaders,
    maxPerGroup: 8,
    columns: [
      { label: '이름', render: (r) => `<span class="font-bold text-slate-900">${escapeHtml(r['이름'] || '-')}</span>` },
      { label: '소속', render: (r) => {
        const name = escapeHtml(resolveRefDisplay('국가ID', r.국가ID, maps) || '-');
        return `<span class="foundation-tag px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[10.5px] font-bold" title="${name}">${name}</span>`;
      } },
      { label: '직위', render: (r) => `<span class="text-slate-700">${escapeHtml(r['직위'] || '-')}</span>` },
      { label: '재임 기간', render: (r) => renderFoundationPeriod(r['시작일'],r['종료일']) }
    ]
  });

  // 포함관계: 카테고리 & 사건 테이블 HTML (부모 참조열 & 그룹 기준열 제외)
  const catTableHtml = renderGroupedTable({
    tab: '카테고리',
    groupField: '카테고리유형',
    items: cats,
    maxPerGroup: 15,
    highlightIds: pkgCatIds,
    idField: '카테고리ID',
    rowAttr: 'data-hier-cat',
    selectedId: selCatId,
    linkedCls: 'is-linked-pkg',
    columns: [
      {
        label: '카테고리명',
        render: (r) => {
          const evCnt = (catEvMap.get(r['카테고리ID']) || new Set()).size;
          const places = [...(categoryPlaces.get(r.카테고리ID) || [])].join(', ') || r.주공간;
          return `<div class="flex items-center justify-between gap-1.5">
            <div class="min-w-0">
              <span class="font-bold text-slate-900">${escapeHtml(r['카테고리명'] || '-')}</span>
              ${places ? `<span class="block truncate text-slate-500" title="${escapeHtml(places)}">${escapeHtml(places)}</span>` : ''}
            </div>
            <span class="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 shrink-0">${evCnt}</span>
          </div>`;
        }
      },
      { label: '기간', render: (r) => `<span class="text-[11px] text-slate-500 whitespace-nowrap">${escapeHtml(formatPeriod(r['시작일'], r['종료일']))}</span>` }
    ]
  });

  const evTableHtml = renderGroupedTable({
    tab: '사건',
    groupField: '사건유형',
    items: events,
    maxPerGroup: 8,
    highlightIds: linkedEvIds,
    idField: '사건ID',
    rowAttr: 'data-hier-ev',
    linkedCls: isSelCatPeriod ? 'is-linked-cat-period' : 'is-linked-cat',
    columns: [
      { label: '사건명', render: (r) => `<span class="font-bold text-slate-900">${escapeHtml(r['사건명'] || '-')}</span>
        ${r['공간'] ? `<span class="block max-w-[150px] truncate text-slate-500" title="${escapeHtml(r['공간'])}">${escapeHtml(r['공간'])}</span>` : ''}` },
      { label: '날짜', render: (r) => `<span class="text-[11px] text-slate-500 whitespace-nowrap">${escapeHtml(formatPeriod(r['날짜'], r['종료일']))}</span>` },
      { label: '핵심 내용', render: (r) => `<span class="block max-w-[150px] truncate text-slate-500" title="${escapeHtml(r['내용'] || '')}">${escapeHtml(r['내용'] || '-')}</span>` }
    ]
  });

  const {spaces, shapes, roots} = geographyLinks(state.data);
  const activeRoot = roots.includes(state.overview.activeGroups['공간']) ? state.overview.activeGroups['공간'] : '';
  const spaceKinds = [];
  const territoryRows = state.data['영토변화'].map((row, origIdx) => ({row, origIdx}));
  const territory = renderGroupedTable({
    tab: '영토변화', groupField: '영토유형', items: territoryRows, maxPerGroup: 8,
    columns: [
      {label: '계기 사건', render: row => escapeHtml(resolveRefDisplay('계기사건ID', row['계기사건ID'], maps) || '—')},
      {label: '주체 · 적용 기간', render: row => `<strong>${escapeHtml(resolveRefDisplay('주체ID', row['주체ID'], maps) || '—')}</strong>
        <div>${renderFoundationPeriod(row['시작일'], row['종료일'])}</div>`}
    ]
  });

  function renderSpaceBranch(id) {
    const {row, index, children, events} = spaces.get(id);
    const kind = row['공간유형'];
    spaceKinds.push(kind);
    const branches = children.map(renderSpaceBranch).join('');
    const matches = state.geoType === 'all' || state.geoType === kind;
    if (!matches && !branches) return '';
    return `<li>
      <button type="button" class="geo-space${matches ? '' : ' is-ancestor'}" data-geo-space="${index}" aria-haspopup="dialog">
        <span class="geo-space-name">${escapeHtml(row['공간명'] || id)}
          ${row['지도참조키'] ? `<code class="geo-space-key" title="지도참조키"><span class="sr-only">지도참조키 </span>${escapeHtml(row['지도참조키'])}</code>` : ''}
          ${matches ? geometryMark(kind) : ''}</span>
        <span class="geo-space-references">${events.size ? `<span>사건 ${events.size}건</span>` : ''}
          ${shapes.has(row['지도참조키']) ? '<span>지도 도형</span>' : ''}
        </span>
      </button>
      ${branches ? `<ul>${branches}</ul>` : ''}
    </li>`;
  }
  const spaceTree = (activeRoot ? [activeRoot] : roots).map(renderSpaceBranch).join('');

  view.innerHTML = `
    <div class="dashboard-structure space-y-8 pb-8">

      <section class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <div>
              <h2 id="structure-actors" class="section-title" tabindex="-1">주체와 지도자</h2>
              <p class="structure-intro">사건에 참여한 주체와 당시 지도자의 직위·재임 기간을 확인합니다.</p>
            </div>
          </div>
        </div>

        <div class="dashboard-foundation grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

          <div class="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden flex flex-col">
            <div class="px-4 py-3 bg-emerald-50/60 border-b border-emerald-100 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-xs font-extrabold text-emerald-950">주체</span>
                <span class="text-[11px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-full border border-emerald-200">${actors.length}건</span>
              </div>
              <button data-goto-tab="주체" class="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer">전체 표 열기 →</button>
            </div>
            ${actorTableHtml.chips}
            <div class="max-h-[510px] overflow-y-auto nice-scroll">${actorTableHtml.table}</div>
          </div>

          <div class="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden flex flex-col">
            <div class="px-4 py-3 bg-teal-50/60 border-b border-teal-100 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-xs font-extrabold text-teal-950">지도자</span>
                <span class="text-[11px] font-bold text-teal-700 bg-white px-2 py-0.5 rounded-full border border-teal-200">${leaders.length}건</span>
              </div>
              <div class="dashboard-actions">
                <button data-goto-tab="직위" class="text-xs font-bold text-teal-700 hover:underline cursor-pointer">직위 표 →</button>
                <button data-goto-tab="재임" class="text-xs font-bold text-teal-700 hover:underline cursor-pointer">재임 표 →</button>
              </div>
            </div>
            ${leaderTableHtml.chips}
            <div class="max-h-[510px] overflow-y-auto nice-scroll">${leaderTableHtml.table}</div>
          </div>
        </div>
      </section>

      <section class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <div>
              <h2 id="structure-catalog" class="section-title" tabindex="-1">패키지 → 카테고리 → 사건</h2>
              <p class="structure-intro">패키지에 담긴 카테고리와 각 카테고리에 속한 사건을 확인합니다.</p>
              <div class="dashboard-actions">
                <button type="button" data-goto-tab="사건_패키지" class="geo-sheet-link">사건–패키지 표 →</button>
                <button type="button" data-goto-tab="사건_카테고리" class="geo-sheet-link">사건–카테고리 표 →</button>
              </div>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2 text-[11px] font-bold">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
              <span class="w-2.5 h-0.5 bg-blue-600 rounded"></span>패키지 → 카테고리 (${pkgCatIds.size}개)
            </span>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${isSelCatPeriod ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-violet-50 text-violet-700 border-violet-100'} border">
              <span class="w-2.5 h-0.5 ${isSelCatPeriod ? 'bg-amber-500' : 'bg-violet-600'} rounded"></span>카테고리 → 사건 (${linkedEvIds.size}건)
            </span>
          </div>
        </div>

        <div id="hierarchy-stage" class="relative">

          <svg id="hierarchy-svg" aria-hidden="true" class="hidden lg:block absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible">
            <g id="hierarchy-lines"></g>
          </svg>

          <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-10 items-start relative z-10">

            <div class="lg:col-span-3 bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden flex flex-col">
              <div class="px-4 py-3 bg-blue-50/70 border-b border-blue-100 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-extrabold text-blue-950">패키지</span>
                  <span class="text-[10.5px] font-bold text-blue-700 bg-white px-2 py-0.5 rounded-full border border-blue-200">${pkgs.length}</span>
                </div>
                <button data-goto-tab="패키지" class="text-[11px] font-bold text-blue-700 hover:underline cursor-pointer">표 →</button>
              </div>
              <div id="hier-scroll-pkg" class="max-h-[690px] overflow-y-auto nice-scroll">
                <table class="w-full text-left border-collapse">
                  <thead class="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th class="px-3 py-2 text-[11px] font-extrabold text-slate-500">패키지명</th>
                      <th class="px-3 py-2 text-[11px] font-extrabold text-slate-500 whitespace-nowrap">대상</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 text-xs">
                    ${pkgs.map(({ row, origIdx }) => {
                      const pid = row['패키지ID'] || '';
                      const isSel = pid === selPkgId;
                      const cCnt = catCountByPkg.get(pid) || 0;
                      return `
                        <tr data-hier-pkg="${escapeHtml(pid)}" data-ov-tab="패키지" data-ov-idx="${origIdx}" class="hier-row hover:bg-slate-50 cursor-pointer ${isSel ? 'is-selected' : ''}">
                          <td class="px-3 py-2.5">
                            <div class="font-extrabold text-slate-900">${escapeHtml(row['패키지명'] || '-')}</div>
                            ${row['설명'] ? `<div class="text-[11px] text-slate-500 mt-0.5 line-clamp-2">${escapeHtml(row['설명'])}</div>` : ''}
                            <div class="mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold">카테고리 ${cCnt}개 포함</div>
                          </td>
                          <td class="px-3 py-2.5 text-[11px] text-slate-500 whitespace-nowrap align-top">
                            ${escapeHtml([row['학교급'], row['과목']].filter(Boolean).join(' · ') || '-')}
                          </td>
                        </tr>
                      `;
                    }).join('') || '<tr><td colspan="2" class="p-6 text-center text-xs text-slate-400">패키지 없음</td></tr>'}
                  </tbody>
                </table>
              </div>
            </div>

            <div class="lg:col-span-4 bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden flex flex-col">
              <div class="px-4 py-3 bg-indigo-50/70 border-b border-indigo-100 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-extrabold text-indigo-950">카테고리</span>
                  <span class="text-[10.5px] font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-full border border-indigo-200">${cats.length}건</span>
                </div>
                <button data-goto-tab="카테고리" class="text-[11px] font-bold text-indigo-700 hover:underline cursor-pointer">표 →</button>
              </div>
              ${catTableHtml.chips}
              <div id="hier-scroll-cat" class="max-h-[690px] overflow-y-auto nice-scroll">${catTableHtml.table}</div>
            </div>

            <div class="lg:col-span-5 bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden flex flex-col">
              <div class="px-4 py-3 bg-violet-50/70 border-b border-violet-100 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-extrabold text-violet-950">사건</span>
                  <span class="text-[10.5px] font-bold text-violet-700 bg-white px-2 py-0.5 rounded-full border border-violet-200">${events.length}건</span>
                </div>
                <button data-goto-tab="사건" class="text-[11px] font-bold text-violet-700 hover:underline cursor-pointer">표 →</button>
              </div>
              ${evTableHtml.chips}
              <div id="hier-scroll-ev" class="max-h-[690px] overflow-y-auto nice-scroll">${evTableHtml.table}</div>
            </div>
          </div>
        </div>
      </section>

      <section class="space-y-3">
        <h2 id="structure-geography" class="section-title" tabindex="-1">공간과 영토 변화</h2>
              <p class="structure-intro">사건이 일어난 장소와 시기별 영토 변화를 확인합니다.</p>
        <div id="geo-trace" class="geo-schema"></div>
        <div class="dashboard-geography grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <section class="geo-panel">
            <header class="geo-panel-heading">
              <h3 id="geo-space-heading">공간 목차</h3>
              <button type="button" data-goto-tab="공간">공간 표 →</button>
            </header>
            <p class="geo-panel-note">공간 표의 <code>상위공간ID</code>로 각 장소를 바로 위 공간에 연결합니다.</p>
            ${roots.length ? `<div class="dashboard-type-chips" role="group" aria-label="상위 공간">
              <button type="button" data-group-tab="공간" data-group-choice="" aria-pressed="${!activeRoot}">모든 권역</button>
              ${roots.map(id => `<button type="button" data-group-tab="공간" data-group-choice="${escapeHtml(id)}"
                aria-pressed="${id === activeRoot}">${escapeHtml(spaces.get(id).row['공간명'] || id)}</button>`).join('')}
            </div>${renderGeometryChoices(spaceKinds)}
            ${spaceTree ? `<div class="geo-scroll nice-scroll" role="region" aria-labelledby="geo-space-heading" tabindex="0">
              <ul class="geo-tree">${spaceTree}</ul>
            </div>` : '<p class="geo-empty">해당 유형의 공간이 없습니다.</p>'}`
             : '<p class="geo-empty">표시할 공간이 없습니다.</p>'}
          </section>
          <section class="geo-panel">
            <header class="geo-panel-heading">
              <h3>계기 사건과 영토 변화</h3>
              <button type="button" data-goto-tab="영토변화">영토 변화 표 →</button>
            </header>
            ${territory.chips}
            <div class="max-h-[510px] nice-scroll">${territory.table}</div>
          </section>
        </div>
      </section>

      <section class="space-y-3.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div><h2 id="structure-relations" class="section-title" tabindex="-1">관계 유형별 연결</h2>
            <p class="structure-intro">사건·주체·카테고리가 어떤 관계로 이어지는지 확인합니다.</p></div>
          <button data-goto-tab="관계" class="text-xs font-bold text-orange-700 hover:underline cursor-pointer">관계 표 열기 →</button>
        </div>

        ${renderRelationFlow(relationsByDirection, visibleDirections, typeCounts, activeRelFilter, allRelations.length)}

        <div id="relation-results" class="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">

          <div class="hidden md:grid grid-cols-12 gap-3 px-5 py-2.5 bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500">
            <div class="col-span-4">출발 대상</div>
            <div class="col-span-4 text-center">관계 유형 · 라벨</div>
            <div class="col-span-4">도착 대상</div>
          </div>

          <div class="divide-y divide-slate-100">
            ${filteredRels.length ? filteredRels.map(({ row, origIdx }) => {
              const fromName = relationEndpointName(row['출발유형'], row['출발ID'], maps) || '-';
              const toName = relationEndpointName(row['도착유형'], row['도착ID'], maps) || '-';
              const fromType = getEntityType(row['출발유형']);
              const toType = getEntityType(row['도착유형']);
              const pkgName = resolveRefDisplay('패키지ID', row['패키지ID'], maps);
              return `
                <div data-ov-rel-idx="${origIdx}" class="grid grid-cols-1 md:grid-cols-12 gap-3 items-center px-5 py-3.5 hover:bg-orange-50/30 cursor-pointer transition">

                  <div class="md:col-span-4 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div class="flex items-center gap-1.5 mb-1">
                      <span class="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-white border border-slate-200 text-slate-600">${escapeHtml(fromType)}</span>
                      ${pkgName ? `<span class="text-[10px] text-slate-400 truncate">${escapeHtml(pkgName)}</span>` : ''}
                    </div>
                    <div class="text-xs font-extrabold text-slate-900 leading-snug">${escapeHtml(fromName)}</div>
                  </div>

                  <div class="md:col-span-4 flex flex-col items-center justify-center px-2 text-center">
                    ${renderRelationEdge(row)}
                    ${row['설명'] ? `<p class="mt-1 text-[11px] text-slate-500 line-clamp-2 leading-snug">${escapeHtml(row['설명'])}</p>` : ''}
                  </div>

                  <div class="md:col-span-4 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div class="flex items-center gap-1.5 mb-1">
                      <span class="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-white border border-slate-200 text-slate-600">${escapeHtml(toType)}</span>
                    </div>
                    <div class="text-xs font-extrabold text-slate-900 leading-snug">${escapeHtml(toName)}</div>
                  </div>
                </div>
              `;
            }).join('') : `
              <div class="p-8 text-center text-xs text-slate-400">표시할 관계가 없어요.</div>
            `}
          </div>
        </div>
      </section>

    </div>
  `;

  renderGeographyTrace(view.querySelector('#geo-trace'),state.data,!loadedSourceTabs.size && !state.dirtyCount,escapeHtml,
    tab => openTable(tab,'structure-geography'));
  // 이벤트 바인딩: 전체 표 열기
  view.querySelectorAll('[data-goto-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const section = btn.closest('.dashboard-structure > section').querySelector('h2');
      openTable(btn.dataset.gotoTab, section.id);
    });
  });
  view.querySelectorAll('[data-geo-space]').forEach(button => {
    button.addEventListener('click', () => openRecordPreview('공간', Number(button.dataset.geoSpace), button));
  });
  bindGeometryChoices(view, renderOverview);

  for (const button of view.querySelectorAll('[data-group-choice]')) {
    button.addEventListener('click', () => {
      const {groupTab,groupChoice} = button.dataset;
      if (button.getAttribute('aria-pressed') === 'true') return;
      state.overview.activeGroups[groupTab] = groupChoice;
      renderOverview();
      view.querySelector(`[data-group-tab="${CSS.escape(groupTab)}"][data-group-choice="${CSS.escape(groupChoice)}"]`)?.focus({preventScroll:true});
    });
  }

  for (const button of view.querySelectorAll('[data-group-toggle]')) {
    button.addEventListener('click', () => {
      const key = button.dataset.groupToggle;
      const collapsed = state.overview.collapsedGroups;
      if (!collapsed.delete(key)) collapsed.add(key);
      const scrollTop = button.closest('.nice-scroll').scrollTop;
      renderOverview();
      const replacement = view.querySelector(`[data-group-toggle="${CSS.escape(key)}"]`);
      if (replacement) {
        replacement.closest('.nice-scroll').scrollTop = scrollTop;
        replacement.focus({preventScroll:true});
      }
    });
  }

  // 이벤트 바인딩: 그룹 내 더 보기
  view.querySelectorAll('[data-group-more]').forEach((tr) => {
    tr.addEventListener('click', () => {
      const k = tr.dataset.groupMore;
      state.overview.expandedMore[k] = true;
      renderOverview();
    });
  });

  view.querySelectorAll('tr[data-ov-tab]').forEach(row => {
    row.addEventListener('click', () => {
      const {ovTab,ovIdx,hierPkg,hierCat} = row.dataset;
      const index = Number(ovIdx);
      let trigger = row;
      if (hierPkg || hierCat) {
        const packageId = hierPkg || state.data[ovTab][index]['패키지ID'];
        if (state.overview.selectedPkgId !== packageId || hierPkg) state.packageFilter = 'all';
        state.overview.selectedPkgId = packageId;
        state.overview.selectedCatId = hierCat || null;
        renderOverview();
        trigger = view.querySelector(`[data-ov-tab="${CSS.escape(ovTab)}"][data-ov-idx="${index}"]`) || view;
      }
      openRecordPreview(ovTab, index, trigger);
    });
  });

  for (const button of view.querySelectorAll('[data-flow-endpoint]')) {
    button.addEventListener('click', () => {
      const {flowEndpoint: side, flowType: type} = button.dataset;
      const field = side === 'from' ? 'relFrom' : 'relTo';
      state.overview[field] = state.overview[field] === type ? '' : type;
      renderOverview();
      view.querySelector(`[data-flow-endpoint="${side}"][data-flow-type="${CSS.escape(type)}"]`)?.focus({preventScroll:true});
    });
  }
  view.querySelector('[data-flow-reset]').addEventListener('click', () => {
    Object.assign(state.overview, {relFrom: '', relTo: '', relFilter: 'all'});
    renderOverview();
    view.querySelector('[data-flow-reset]').focus({preventScroll:true});
  });
  for (const button of view.querySelectorAll('[data-flow-code]')) {
    button.addEventListener('click', () => {
      const code = button.dataset.flowCode;
      state.overview.relFilter = button.getAttribute('aria-pressed') === 'true' ? 'all' : code;
      renderOverview();
      view.querySelector(`[data-flow-code="${CSS.escape(code)}"]`)?.focus({preventScroll:true});
    });
  }
  view.querySelector('.dashboard-flow-lanes').addEventListener('click', event => {
    if (event.target.matches('.dashboard-flow-hit')) {
      event.target.closest('.dashboard-flow-connection').querySelector('button').click();
    }
  });

  view.querySelectorAll('[data-ov-rel-idx]').forEach((el) => {
    el.addEventListener('click', () => openRecordPreview('관계', Number(el.dataset.ovRelIdx), el));
  });

  // 스크롤 시 포함관계 연결선 실시간 갱신
  ['hier-scroll-pkg', 'hier-scroll-cat', 'hier-scroll-ev'].forEach((id) => {
    const sc = document.getElementById(id);
    if (sc) sc.addEventListener('scroll', () => requestAnimationFrame(drawHierarchyLines));
  });

  bindKeyboardRows(view);
  scheduleStructureTracking();
  requestAnimationFrame(drawHierarchyLines);
}

function drawHierarchyLines() {
  const stage = document.getElementById('hierarchy-stage');
  const g = document.getElementById('hierarchy-lines');
  if (!stage || !g) return;
  g.innerHTML = '';
  if (window.innerWidth < 740) return;

  const stageRect = stage.getBoundingClientRect();
  const pkgScroll = document.getElementById('hier-scroll-pkg')?.getBoundingClientRect();
  const catScroll = document.getElementById('hier-scroll-cat')?.getBoundingClientRect();
  const evScroll = document.getElementById('hier-scroll-ev')?.getBoundingClientRect();

  const clampY = (rect, scRect) => {
    let cy = (rect.top + rect.bottom) / 2;
    let out = false;
    if (scRect) {
      if (cy < scRect.top + 36) { cy = scRect.top + 36; out = true; }
      if (cy > scRect.bottom - 6) { cy = scRect.bottom - 6; out = true; }
    }
    return { y: cy - stageRect.top, out };
  };

  const addCurve = (x1, y1, x2, y2, color, opacity = 0.72) => {
    const dx = Math.max(24, (x2 - x1) * 0.48);
    const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
    const ns = 'http://www.w3.org/2000/svg';
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', color);
    p.setAttribute('stroke-width', '2');
    p.setAttribute('stroke-opacity', String(opacity));
    g.appendChild(p);

    [ [x1, y1], [x2, y2] ].forEach(([cx, cy]) => {
      const dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('cx', cx);
      dot.setAttribute('cy', cy);
      dot.setAttribute('r', '3.2');
      dot.setAttribute('fill', color);
      dot.setAttribute('fill-opacity', String(Math.min(1, opacity + 0.15)));
      g.appendChild(dot);
    });
  };

  const selPkgId = state.overview.selectedPkgId;
  const selCatId = state.overview.selectedCatId;

  // 1) 패키지 -> 포함된 카테고리 연결선
  if (selPkgId) {
    const pkgEl = stage.querySelector(`[data-hier-pkg="${CSS.escape(selPkgId)}"]`);
    if (pkgEl) {
      const pr = pkgEl.getBoundingClientRect();
      const pY = clampY(pr, pkgScroll);
      const x1 = (pkgScroll ? pkgScroll.right : pr.right) - stageRect.left;

      const matchedCats = (state.data['카테고리'] || []).filter((c) => c['패키지ID'] === selPkgId);
      const seenTargets = new Set();
      matchedCats.forEach((c) => {
        const cid = c['카테고리ID'];
        const normGrp = groupKey(c['카테고리유형']);
        let targetEl = stage.querySelector(`[data-hier-cat="${CSS.escape(cid)}"]`);
        if (!targetEl) {
          targetEl = stage.querySelector(`[data-group-anchor="${CSS.escape('카테고리::' + normGrp)}"]`);
        }
        if (!targetEl || seenTargets.has(targetEl)) return;
        seenTargets.add(targetEl);

        const cr = targetEl.getBoundingClientRect();
        const cY = clampY(cr, catScroll);
        const x2 = (catScroll?.left ?? cr.left) - stageRect.left;
        addCurve(x1, pY.y, x2, cY.y, '#4c6858', (pY.out || cY.out) ? 0.22 : 0.72);
      });
    }
  }

  // 2) 카테고리 -> 포함된 사건 연결선
  if (selCatId) {
    const catObj = (state.data['카테고리'] || []).find((c) => c['카테고리ID'] === selCatId);
    const normCatGrp = groupKey(catObj?.['카테고리유형']);
    let catEl = stage.querySelector(`[data-hier-cat="${CSS.escape(selCatId)}"]`);
    if (!catEl) {
      catEl = stage.querySelector(`[data-group-anchor="${CSS.escape('카테고리::' + normCatGrp)}"]`);
    }

    if (catEl) {
      const cr = catEl.getBoundingClientRect();
      const cY = clampY(cr, catScroll);
      const x1 = (catScroll?.right ?? cr.right) - stageRect.left;
      const lineColor = normCatGrp === 'period' ? '#996228' : '#9a5339';

      const catEvMap = getCategoryEventMap();
      const evIds = Array.from(catEvMap.get(selCatId) || []);
      const seenTargets = new Set();

      evIds.forEach((eid) => {
        const evObj = (state.data['사건'] || []).find((e) => e['사건ID'] === eid);
        const normEvGrp = groupKey(evObj?.['사건유형']);
        let targetEl = stage.querySelector(`[data-hier-ev="${CSS.escape(eid)}"]`);
        if (!targetEl) {
          targetEl = stage.querySelector(`[data-group-anchor="${CSS.escape('사건::' + normEvGrp)}"]`);
        }
        if (!targetEl || seenTargets.has(targetEl)) return;
        seenTargets.add(targetEl);

        const er = targetEl.getBoundingClientRect();
        const eY = clampY(er, evScroll);
        const x2 = (evScroll?.left ?? er.left) - stageRect.left;
        addCurve(x1, cY.y, x2, eY.y, lineColor, (cY.out || eY.out) ? 0.22 : 0.75);
      });
    }
  }
}

/* =========================================================================
   10. 시트 테이블 뷰 렌더링 (필터링, 정렬, 페이지네이션, 내보내기)
   ========================================================================= */
function getFilteredRows(tab, query = state.searchQuery) {
  const maps = getLookupMaps();
  const categorized = new Map();
  const categoryFields = new Map(Object.entries(SheetData.eventCategoryTypes).map(([field,type]) => [type,field]));
  const workspace = tab === '사건' && isEventWorkspace();
  const matchingEvents = workspace && state.categoryFilter ? new Set() : null;
  if (workspace) {
    for (const {사건ID,카테고리ID} of state.data.사건_카테고리) {
      if (카테고리ID === state.categoryFilter) matchingEvents?.add(사건ID);
      const field = categoryFields.get(maps.catTypeMap.get(카테고리ID));
      if (!field) continue;
      if (!categorized.has(사건ID)) categorized.set(사건ID,{시기:'',사건군:'',주제:''});
      const fields = categorized.get(사건ID);
      fields[field] = fields[field] ? `${fields[field]}, ${카테고리ID}` : 카테고리ID;
    }
  }
  const rows = (state.data[tab] || []).map((row,origIdx) => ({
    row: workspace ? {...row,...categorized.get(row.사건ID)} : row, origIdx
  }));
  const pkg = state.packageFilter;
  const q = query.trim().toLowerCase();

  // 패키지 필터용 카테고리->패키지 맵
  const catToPkg = new Map();
  (state.data['카테고리'] || []).forEach((c) => {
    if (c['카테고리ID']) catToPkg.set(c['카테고리ID'], c['패키지ID']);
  });

  const packageEventIds = new Set(state.data.사건_패키지.filter(link => link.패키지ID === pkg).map(link => link.사건ID));
  const packageActorIds = new Set(state.data['사건_주체'].filter(link => packageEventIds.has(link['사건ID'])).map(link => link['주체ID']));
  for (const row of state.data['관계']) {
    if (row['패키지ID'] !== pkg) continue;
    for (const end of ['출발','도착']) {
      const id = row[end+'ID'];
      if (relationEndpointTab(row[end+'유형']) === '주체' && maps.actorMap.has(id)) packageActorIds.add(id);
    }
  }
  let filtered = rows.filter(({ row }) => {
    if (matchingEvents && !matchingEvents.has(row.사건ID)) return false;
    if (pkg !== 'all') {
      if (tab === '패키지' && row['패키지ID'] !== pkg) return false;
      if (tab === '카테고리' && row['패키지ID'] !== pkg) return false;
      if (tab === '관계' && row['패키지ID'] && row['패키지ID'] !== pkg) return false;
      if (['사건','사건_주체','사건_공간'].includes(tab) && !packageEventIds.has(row['사건ID'])) return false;
      if (['주체','주체_공간'].includes(tab) && !packageActorIds.has(row.주체ID)) return false;
      if (['사건_카테고리','카테고리_공간'].includes(tab) && catToPkg.get(row.카테고리ID) !== pkg) return false;
      if (tab === '사건_패키지' && row.패키지ID !== pkg) return false;
      if (tab === '직위' || tab === '재임') {
        const office = tab === '직위' ? row : maps.officeMap.get(row.직위ID) || row;
        if (![office.국가ID,office.조직ID,row.주체ID].some(id => packageActorIds.has(id))) return false;
      }
    }
    if (q) {
      const text = Object.entries(row)
        .map(([k, v]) => `${v} ${resolveRefDisplay(k, v, maps)}`)
        .join(' ')
        .toLowerCase();
      if (!text.includes(q)) return false;
    }
    return true;
  });

  if (state.sortCol) {
    const col = state.sortCol;
    const dir = state.sortDir === 'asc' ? 1 : -1;
    const value = row => Object.hasOwn(SPACE_LINKS,tab) && col === '공간유형' ? geometryKind(tab, row, maps) || '' : resolveRefDisplay(col, row[col], maps);
    filtered.sort((a, b) => {
      const va = value(a.row);
      const vb = value(b.row);
      return va.localeCompare(vb, 'ko', { numeric: true }) * dir;
    });
  }

  return filtered;
}

function isEventWorkspace() {
  return state.activeView === '사건' && !state.rawTable;
}

function renderWorkspaceCategories() {
  const panel = document.getElementById('workspace-categories');
  panel.hidden = !isEventWorkspace();
  if (panel.hidden) return;
  const categories = state.data.카테고리.filter(row => state.packageFilter === 'all' || row.패키지ID === state.packageFilter);
  const selected = categories.find(row => row.카테고리ID === state.categoryFilter);
  if (!selected) state.categoryFilter = '';
  const {pkgMap} = getLookupMaps();
  const categoryTitle = (row, name) => {
    const period = formatPeriod(row.시작일,row.종료일);
    return escapeHtml(name) + (period === '-' ? '' : ` <span class="category-date-range">${escapeHtml(period)}</span>`);
  };
  panel.querySelector('h2').innerHTML = selected ? categoryTitle(selected,selected.카테고리명 || selected.카테고리ID) : '카테고리';
  document.getElementById('clear-category-filter').hidden = !selected;
  document.getElementById('edit-filtered-category').disabled = !selected;
  const query = document.getElementById('category-search').value.trim().toLowerCase();
  const matches = categories.filter(row => [row.카테고리명, row.시작일, row.종료일].join(' ').toLowerCase().includes(query));
  document.getElementById('category-search-empty').hidden = !query || matches.length > 0;
  document.getElementById('workspace-category-groups').innerHTML = Object.entries(SheetData.eventCategoryTypes).map(([field,type]) => {
      const entries = matches.filter(row => groupKey(row.카테고리유형) === type);
      if (query && !entries.length) return '';
      return `<div class="workspace-category-group" role="group" aria-label="${field}">
        <h3>${field}</h3>
        <div class="event-category-buttons">
          ${entries.map(row => {
            const name = row.카테고리명 || row.카테고리ID;
            const duplicate = entries.some(entry => entry !== row && entry.카테고리명 === name);
            const label = duplicate && row.패키지ID ? `${name} · ${pkgMap.get(row.패키지ID) || row.패키지ID}` : name;
            return `<button type="button" class="dashboard-button" data-category-type="${type}" data-category-filter="${escapeHtml(row.카테고리ID)}"
              aria-pressed="${row === selected}">${categoryTitle(row,label)}</button>`;
          }).join('') || '<span class="event-category-empty">등록된 카테고리가 없어요.</span>'}
        </div>
      </div>`;
    }).join('');
}

const relationNodeTypes = [['actor','주체'],['category','카테고리'],['event','사건']];

function relationsByNode(side) {
  const end = side === 'from' ? '출발' : '도착';
  const groups = new Map();
  for (const entry of getFilteredRows('관계','')) {
    const key = JSON.stringify([relationEndpointTab(entry.row[end+'유형']),entry.row[end+'ID']]);
    if (!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(entry);
  }
  return groups;
}

function renderRelationNodes(side) {
  const selected = state.relationEdit[side];
  const relations = relationsByNode(side);
  const direction = side === 'from' ? '출발' : '도착';
  const arrow = side === 'from' ? '↗️' : '↙️';
  const dateStart = row => {
    try { return SheetData.dateRange(row.날짜.trim()).start; }
    catch { return Infinity; }
  };
  return relationNodeTypes.map(([type,tab]) => {
    const nodes = getFilteredRows(tab,state.relationSearch[side]).filter(({row}) => row[TAB_PRIMARY_ID[tab]]).map(({row}) => ({
      id:row[TAB_PRIMARY_ID[tab]], title:row[recordNameFields[tab]] || row[TAB_PRIMARY_ID[tab]],
      categoryType:type === 'category' ? groupKey(row.카테고리유형) : '',
      date:type === 'event' ? row.날짜 || '날짜 미상' : '', start:type === 'event' ? dateStart(row) : 0
    }));
    nodes.sort(type === 'event' ? (a,b) => a.start - b.start : (a,b) => a.title.localeCompare(b.title,'ko'));
    let index = 0;
    const renderNode = ({id,title,date}) => {
      const tabIndex = index++ === 0 ? 0 : -1;
      const count = relations.get(JSON.stringify([tab,id]))?.length || 0;
      return `<li class="relation-node-item">
        <button type="button" class="event-relation-node" data-endpoint-type="${type}"
          data-endpoint-id="${escapeHtml(id)}" aria-pressed="${selected?.type === type && selected.id === id}" tabindex="${tabIndex}">
          ${date ? `<span class="event-relation-date">${escapeHtml(date)}</span>` : ''}
          <strong>${escapeHtml(title)}</strong>
        </button>
        ${count ? `<button type="button" class="dashboard-button event-relation-count" data-endpoint-relations
          tabindex="${tabIndex}" aria-haspopup="dialog" aria-label="${escapeHtml(title)} ${direction} 관계 ${count}건">
          <span aria-hidden="true">${arrow}</span> ${count}
        </button>` : ''}
      </li>`;
    };
    let items;
    if (type === 'category') {
      const groups = new Map(Object.values(SheetData.eventCategoryTypes).map(key=>[key,[]]));
      for (const node of nodes) {
        const key = node.categoryType;
        if (!groups.has(key)) groups.set(key,[]);
        groups.get(key).push(node);
      }
      items = [...groups].filter(([,entries])=>entries.length).map(([key,entries],i) => {
        const heading = `relation-${side}-category-type-${i}`;
        return `<li class="relation-category-group">
          <h4 id="${heading}" data-category-type="${escapeHtml(key)}">${escapeHtml(getGroupLabel(tab,key))}</h4>
          <ul aria-labelledby="${heading}">${entries.map(renderNode).join('')}</ul>
        </li>`;
      }).join('');
    } else {
      items = nodes.map(renderNode).join('');
    }
    return `<div class="relation-node-group">
      <h3 id="relation-${side}-${type}" tabindex="-1">${tab}</h3>
      <ul class="relation-node-list" aria-labelledby="relation-${side}-${type}">
        ${items || '<li class="event-relation-empty">표시할 대상이 없어요.</li>'}
      </ul>
    </div>`;
  }).join('');
}

function renderRelationEditor() {
  const view = document.getElementById('main-view');
  const edit = state.relationEdit;
  for (const side of ['from','to']) {
    const endpoint = edit[side];
    if (endpoint && !findRelationEndpoint(state.data,endpoint.type,endpoint.id).row) {
      edit[side] = null;
      edit.packageId = '';
    }
  }
  const column = (side,label) => `<section class="relation-node-column" data-relation-side="${side}" aria-label="${label}">
    <h2>${label}</h2>
    <div class="dashboard-search">
      <span class="dashboard-search-icon" aria-hidden="true"></span>
      <input data-relation-search="${side}" type="search" aria-label="${label} 검색" placeholder="대상 검색"
        autocomplete="off" value="${escapeHtml(state.relationSearch[side])}">
    </div>
    <nav class="relation-node-toc" aria-label="${label} 목차">
      ${relationNodeTypes.map(([type,tab]) => `<button type="button" class="dashboard-button" data-relation-jump="relation-${side}-${type}">${tab}</button>`).join('')}
    </nav>
    <div class="relation-node-scroll">${renderRelationNodes(side)}</div>
  </section>`;
  view.innerHTML = `<div class="event-relation-workbench">
    ${column('from','출발 대상')}
    ${column('to','도착 대상')}
    <section id="event-relation-form" aria-label="관계 유형 및 저장"></section>
  </div>`;
  renderRelationSelection();
}

function clearRelationSelection() {
  Object.assign(state.relationEdit,{from:null,to:null,type:'',packageId:''});
}

function updateRelationNodes(column, scrollTop = 0) {
  const list = column.querySelector('.relation-node-scroll');
  list.innerHTML = renderRelationNodes(column.dataset.relationSide);
  list.scrollTop = scrollTop;
}

function renderRelationSelection() {
  const form = document.getElementById('event-relation-form');
  const edit = state.relationEdit;
  const {from,to} = edit;
  const complete = Boolean(from && to);
  const sameTarget = complete && from.type === to.type && from.id === to.id;
  const canSave = complete && !sameTarget && edit.type && edit.packageId && !savingRelationSheet;
  const endpointName = endpoint => {
    if (!endpoint) return '선택 안 함';
    const {tab,row} = findRelationEndpoint(state.data,endpoint.type,endpoint.id);
    return row?.[recordNameFields[tab]] || endpoint.id;
  };
  for (const button of document.querySelectorAll('[data-endpoint-id]')) {
    const side = button.closest('[data-relation-side]').dataset.relationSide;
    const selected = edit[side];
    button.setAttribute('aria-pressed', String(selected?.type === button.dataset.endpointType && selected.id === button.dataset.endpointId));
  }
  const packages = complete ? relationPackages(state.data,from,to) : [];
  if (complete && !packages.some(row => row.패키지ID === edit.packageId)) {
    edit.packageId = packages.find(row => row.패키지ID === state.packageFilter)?.패키지ID ||
      (packages.length === 1 ? packages[0].패키지ID : '');
  }
  const existing = complete ? state.data.관계.filter(row => relationConnects(row,from,to) &&
    (!edit.packageId || !row.패키지ID || row.패키지ID === edit.packageId)) : [];
  form.innerHTML = `
    <div class="event-relation-form-heading">
      <h2 id="relation-type-heading">관계 유형</h2>
      ${from || to || edit.type ? '<button type="button" class="dashboard-button" data-relation-reset>초기화</button>' : ''}
    </div>
    <div class="event-category-buttons relation-type-buttons" role="group" aria-labelledby="relation-type-heading">${relationTypes.map(type =>
      `<button type="button" class="dashboard-button" data-relation-type="${type}" aria-pressed="${type === edit.type}">${escapeHtml(getRelMeta(type).label)}</button>`
    ).join('')}</div>
    <dl class="event-relation-pair">
      <div><dt>출발</dt><dd>${escapeHtml(endpointName(from))}</dd></div>
      <div><dt>도착</dt><dd>${escapeHtml(endpointName(to))}</dd></div>
    </dl>
    ${packages.length > 1 ? `<fieldset class="event-edit-choice">
      <legend>저장할 패키지</legend>
      <div class="event-category-buttons">${packages.map(row => `<button type="button" class="dashboard-button" data-relation-package="${escapeHtml(row.패키지ID)}"
        aria-pressed="${row.패키지ID === edit.packageId}">${escapeHtml(row.패키지명 || row.패키지ID)}</button>`).join('')}</div>
    </fieldset>` : ''}
    ${existing.length ? `<p class="event-relation-existing">저장된 유형 · ${escapeHtml([...new Set(existing.map(row => getRelMeta(row.관계유형).label))].join(', '))}</p>` : ''}
    <p class="event-edit-error" data-relation-error role="alert" ${sameTarget ? '' : 'hidden'}>${sameTarget ? '서로 다른 대상을 선택해 주세요.' : ''}</p>
    <button type="button" class="dashboard-button dashboard-primary" data-save-relation-sheet ${canSave ? '' : 'disabled'}>
      ${savingRelationSheet ? 'Google 시트에 저장 중…' : 'Google 시트에 저장'}</button>
    <button type="button" class="dashboard-button" data-relation-save ${canSave ? '' : 'disabled'}>브라우저 사본에 저장</button>`;
}

function saveRelation() {
  try {
    if (document.getElementById('btn-load-sheet').disabled) throw new Error('시트를 불러온 뒤 저장해 주세요.');
    const row = createRelation(state.data,state.headers.관계,state.relationEdit,generateInternalId('관계'));
    const nextData = {...state.data, 관계:[...state.data.관계,row]};
    if (!saveToLocalStorage(nextData,state.dirtyCount + 1)) return;
    state.data = nextData;
    state.dirtyCount++;
    state.relationEdit.type = '';
    updateDirtyControls();
    for (const column of document.querySelectorAll('[data-relation-side]')) {
      updateRelationNodes(column,column.querySelector('.relation-node-scroll').scrollTop);
    }
    renderRelationSelection();
    document.querySelector('[data-relation-reset]').focus({preventScroll:true});
    showToast('관계를 브라우저 사본에 저장했습니다.', 'success');
  } catch (error) {
    const message = document.querySelector('[data-relation-error]');
    message.textContent = error.message;
    message.hidden = false;
  }
}

async function saveRelationToSheet() {
  if (savingRelationSheet) return;
  const selection = {...state.relationEdit};
  try {
    if (document.getElementById('btn-load-sheet').disabled) throw new Error('시트를 불러온 뒤 저장해 주세요.');
    const row = createRelation({...state.data,관계:[]},state.headers.관계,selection,generateInternalId('관계'));
    const local = state.data.관계.find(item => matchesSheetRelation(item,selection));
    const pending = authorizeRelationSheet(googleOAuthClientId);
    savingRelationSheet = true;
    renderRelationSelection();
    const saved = await saveToGoogleRelationSheet(SHEET_CONFIG,await pending,local || row,selection);

    const merge = rows => rows.some(item => item.관계ID === saved.row.관계ID) ? rows : [...rows,saved.row];
    state.originalData.관계 = merge(state.originalData.관계);
    const rows = state.data.관계;
    state.data.관계 = saved.created || !local ? merge(rows) : rows;
    if (state.dirtyCount) saveToLocalStorage();
    if (Object.entries(selection).every(([key,value]) => state.relationEdit[key] === value)) state.relationEdit.type = '';
    showToast(saved.created ? '원본 Google 시트에 관계를 저장했습니다.' : '이미 원본 Google 시트에 저장된 관계예요.', 'success');
  } catch (error) {
    if (savingRelationSheet && state.activeView === 'event-relations') {
      savingRelationSheet = false;
      renderRelationSelection();
    }
    const message = document.querySelector('[data-relation-error]');
    if (message) {
      message.textContent = error.message;
      message.hidden = false;
    } else showToast(error.message,'error');
    return;
  } finally {
    savingRelationSheet = false;
  }
  if (state.activeView === 'event-relations') {
    for (const column of document.querySelectorAll('[data-relation-side]')) {
      updateRelationNodes(column,column.querySelector('.relation-node-scroll').scrollTop);
    }
    renderRelationSelection();
    document.querySelector('[data-relation-reset]')?.focus({preventScroll:true});
  }
}

function renderSheetTable(tab) {
  const view = document.getElementById('main-view');
  const allHeaders = state.headers[tab] || DEFAULT_HEADERS[tab] || [];
  const isRelation = tab === '관계';
  const isGeo = GEO_TABLES.includes(tab);
  const workspace = isEventWorkspace();
  const showIndex = !isRelation && !workspace;
  const visibleHeaders = workspace ? ['날짜','사건명',...Object.keys(SheetData.eventCategoryTypes)] :
    isRelation ? ['출발ID', '관계유형', '도착ID'] : allHeaders.filter((h) => !isHiddenInViewer(tab, h));
  if (Object.hasOwn(SPACE_LINKS,tab) && !visibleHeaders.includes('공간유형')) visibleHeaders.push('공간유형');
  const relationHeaders = {'출발ID':'출발 대상', '관계유형':'관계 유형 · 라벨', '도착ID':'도착 대상'};
  const maps = getLookupMaps();
  const rows = getFilteredRows(tab);
  const filtered = isGeo && state.geoType !== 'all' ? rows.filter(({row}) => geometryKind(tab, row, maps) === state.geoType) : rows;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (state.page > totalPages) state.page = totalPages;

  const startIdx = (state.page - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  if (workspace) document.getElementById('workspace-event-count').textContent = total+'건';
  view.innerHTML = `
    <div class="space-y-4">

      ${workspace ? '' : `<div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-extrabold text-slate-900">${escapeHtml(tab)} <span class="text-xs font-bold text-slate-400 ml-1">${total}건</span></h2>
          <p class="text-xs text-slate-500">행을 열어 세부 내용을 확인하거나 브라우저 사본을 편집할 수 있습니다.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button id="btn-add-row" type="button" class="dashboard-button dashboard-primary">+ 새 항목 추가</button>
          <button id="btn-copy-tsv" type="button" class="dashboard-button">TSV 복사</button>
          <button id="btn-export-csv" type="button" class="dashboard-button">CSV 다운로드</button>
        </div>
      </div>`}

      ${isGeo ? renderGeometryChoices(rows.map(({row}) => geometryKind(tab, row, maps))) : ''}
      <div class="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        <div class="overflow-x-auto nice-scroll">
          <table class="w-full text-left border-collapse ${isRelation ? 'dashboard-relation-table' : workspace ? 'event-workspace-table' : ''}">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200">
                ${showIndex ? '<th class="px-3 py-2.5 text-[11px] font-extrabold text-slate-400 w-10 text-center">#</th>' : ''}
                ${visibleHeaders.map((h) => {
                  const isSorted = state.sortCol === h;
                  const arrow = isSorted ? (state.sortDir === 'asc' ? ' ▲' : ' ▼') : '';
                  return `<th data-sort="${escapeHtml(h)}" class="px-3.5 py-2.5 text-xs font-extrabold text-slate-700 whitespace-nowrap cursor-pointer hover:bg-slate-100 select-none transition">${escapeHtml(isRelation ? relationHeaders[h] : getCleanLabel(tab, h))}${arrow}</th>`;
                }).join('')}
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-xs">
              ${pageItems.length ? pageItems.map(({ row, origIdx }, idx) => `
                <tr data-orig-idx="${origIdx}" class="hover:bg-blue-50/50 cursor-pointer transition">
                  ${showIndex ? `<td class="px-3 py-2.5 text-[11px] text-slate-400 text-center font-mono">${startIdx + idx + 1}</td>` : ''}
                  ${visibleHeaders.map((h) => `<td class="px-3.5 py-2.5 text-slate-700">${renderCellHtml(tab, h, row, maps)}</td>`).join('')}
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="${visibleHeaders.length + Number(showIndex)}" class="px-6 py-12 text-center text-xs text-slate-400">
                    표시할 데이터가 없습니다.
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>

        <div class="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <span>${total ? `${startIdx + 1} ~ ${Math.min(startIdx + PAGE_SIZE, total)} / 총 ${total}건` : '0건'}</span>
          <div class="flex items-center gap-1.5">
            <button id="btn-prev-page" class="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer" ${state.page <= 1 ? 'disabled' : ''}>이전</button>
            <span class="px-2 font-bold">${state.page} / ${totalPages}</span>
            <button id="btn-next-page" class="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer" ${state.page >= totalPages ? 'disabled' : ''}>다음</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // 이벤트 바인딩
  bindGeometryChoices(view, () => renderSheetTable(tab));
  view.querySelectorAll('th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (state.sortCol === col) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortCol = col;
        state.sortDir = 'asc';
      }
      renderSheetTable(tab);
    });
  });

  view.querySelectorAll('tbody tr[data-orig-idx]').forEach((tr) => {
    tr.addEventListener('click', (event) => {
      if (event.target.closest('a')) return;
      const index = Number(tr.dataset.origIdx);
      if (workspace) openEditDrawer(tab, index, true);
      else openRecordPreview(tab, index, tr);
    });
  });

  document.getElementById('btn-add-row')?.addEventListener('click', () => openEditDrawer(tab, null));

  document.getElementById('btn-copy-tsv')?.addEventListener('click', () => {
    const tsv = toTSV(allHeaders, state.data[tab] || []);
    if (copyTextToClipboard(tsv)) {
      showToast(`[${tab}] 전체 ${state.data[tab].length}건을 TSV로 복사했습니다. 구글 시트에 Ctrl+V로 붙여넣으세요.`, 'success');
    } else {
      showToast('클립보드 복사에 실패했습니다.', 'error');
    }
  });

  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    const csv = toCSV(allHeaders, state.data[tab] || []);
    downloadFile(`${tab}.csv`, csv, 'text/csv;charset=utf-8;');
    showToast(`[${tab}.csv] 파일을 다운로드했습니다.`, 'success');
  });

  document.getElementById('btn-prev-page').addEventListener('click', () => {
    if (state.page > 1) { state.page--; renderSheetTable(tab); }
  });
  document.getElementById('btn-next-page').addEventListener('click', () => {
    if (state.page < totalPages) { state.page++; renderSheetTable(tab); }
  });
  bindKeyboardRows(view);
}

/* =========================================================================
   11. 우측 슬라이드 스마트 참조 편집 드로어
   ========================================================================= */
const recordNameFields = {패키지:'패키지명', 카테고리:'카테고리명', 사건:'사건명', 주체:'주체명', 직위:'직위명', 관계:'라벨', 공간:'공간명', 지도도형:'지도참조키', 지도뷰:'뷰명'};
const recordKindFields = {카테고리:'카테고리유형', 사건:'사건유형', 주체:'구분', 직위:'직위유형', 재임:'재임유형', 공간:'공간유형', 영토변화:'영토유형'};
const recordNarrativeFields = new Set(['내용','설명','소개','기간 설명','직위 설명','직위 비고','이미지','출처']);

function recordName(tab, row, maps) {
  const fields = Object.hasOwn(SPACE_LINKS,tab) ? [SPACE_LINKS[tab],'공간ID'] :
    {사건_카테고리:['사건ID','카테고리ID'],사건_주체:['사건ID','주체ID'],사건_패키지:['사건ID','패키지ID']}[tab];
  if (fields) return fields.map(key => resolveRefDisplay(key, row[key], maps)).filter(Boolean).join(' · ') || tab;
  if (tab === '재임') return [maps.actorMap.get(row.주체ID) || row.이름,maps.officeMap.get(row.직위ID)?.직위명 || row.직위].filter(Boolean).join(' · ') || row.재임ID;
  if (tab === '영토변화') return resolveRefDisplay('주체ID', row['주체ID'], maps) || row['영토ID'] || '영토 변화';
  return row[recordNameFields[tab]] || row[TAB_PRIMARY_ID[tab]] || tab;
}

function relationEndpointName(type, id, maps) {
  const {tab, row} = findRelationEndpoint(state.data, type, id);
  return row ? recordName(tab, row, maps) : id;
}

function recordLink(value) {
  try {
    const {protocol, username, password, href} = new URL(value);
    if (['https:', 'http:'].includes(protocol) && !username && !password) return href;
  } catch { /* Non-URL values are displayed as text. */ }
  return '';
}

function recordFields(tab, row, maps, omit = []) {
  const facts = [];
  const narrative = [];
  const identifiers = [];
  for (const field of state.headers[tab]) {
    const raw = row[field];
    if (!raw?.trim() || field === recordNameFields[tab] || omit.includes(field)) continue;
    const primaryId = TAB_PRIMARY_ID[tab] === field;
    const label = primaryId ? field : getCleanLabel(tab, field);
    let value = escapeHtml(primaryId ? raw : resolveRefDisplay(field, raw, maps));
    if ((tab === '사건' && (field === '카테고리ID' || Object.hasOwn(SheetData.eventCategoryTypes,field))) || field === '검토상태') value = renderCellHtml(tab, field, row, maps);
    if (field === recordKindFields[tab]) value = escapeHtml(getGroupLabel(tab, raw));
    if (field === '출처' || field === '이미지') {
      value = raw.split(/\r?\n/).filter(item => item.trim()).map(item => {
        const href = recordLink(item.trim());
        if (!href) return escapeHtml(item);
        const media = field === '이미지' && Object.hasOwn(SHEET_MEDIA, href) ? TimelineImage.src(href) : '';
        const credit = TimelineImage.credit(media);
        const content = media ? `<img src="${escapeHtml(media)}" alt="${escapeHtml(recordName(tab,row,maps))}" loading="lazy">${credit ? escapeHtml(credit.by) : ''}` : '원본 열기 ↗';
        return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${content}</a>${credit ? ` · <a href="${escapeHtml(credit.licenseUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(credit.license)}</a> · 화면용 WebP 변환` : ''}`;
      }).join('<br>');
    }
    const entry = `<div><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`;
    if (primaryId || PURE_ID_COLS.has(field)) identifiers.push(entry);
    else if (recordNarrativeFields.has(field)) narrative.push(entry);
    else facts.push(entry);
  }
  return [
    facts.length ? `<dl class="record-preview-facts">${facts.join('')}</dl>` : '',
    narrative.length ? `<dl class="record-preview-narrative">${narrative.join('')}</dl>` : '',
    identifiers.length ? `<details class="record-preview-identifiers">
      <summary>시트 식별자</summary><dl>${identifiers.join('')}</dl>
    </details>` : ''
  ].join('');
}

function relationPreview(row, maps) {
  const meta = getRelMeta(row['관계유형']);
  const node = (end) => {
    const type = row[end+'유형'];
    const id = row[end+'ID'];
    const {tab, row: record} = findRelationEndpoint(state.data, type, id);
    const kindField = recordKindFields[tab];
    const kind = kindField && record?.[kindField] ? getGroupLabel(tab, record[kindField]) : getEntityType(type);
    return `<section class="record-relation-node">
      <p>${end} · ${escapeHtml(kind)}</p>
      <h3>${escapeHtml(record ? recordName(tab,record,maps) : id || '대상 미지정')}</h3>
      ${record ? recordFields(tab,record,maps,[kindField]) : '<p>연결된 기록을 찾을 수 없어요.</p>'}
    </section>`;
  };
  return `<div class="record-relation-diagram">
    ${node('출발')}
    <section class="record-relation-edge" aria-label="관계">
      <strong class="record-relation-type ${meta.cls}">${escapeHtml(meta.label)}</strong>
      <div class="record-relation-arrow" style="--relation-color:${meta.arrow}" aria-hidden="true"></div>
      ${row['라벨'] ? `<h3>${escapeHtml(row['라벨'])}</h3>` : ''}
      ${row['설명'] ? `<p>${escapeHtml(row['설명'])}</p>` : ''}
    </section>
    ${node('도착')}
  </div>
  ${recordFields('관계',row,maps,['출발유형','출발ID','도착유형','도착ID','관계유형','설명'])}`;
}

function spacePreview(body, row, maps, event, recordDetails = '') {
  const shape = row.지도참조키 && state.data['지도도형'].find(item => item.지도참조키 === row.지도참조키);
  const source = shape && recordLink(shape.출처);
  const fields = [
    ['상위 공간',resolveRefDisplay('상위공간ID',row.상위공간ID,maps)], ['시대별칭',row.시대별칭],
    ['지도참조키',row.지도참조키], ['공간 ID',row.공간ID !== row.지도참조키 ? row.공간ID : ''],
  ];
  body.innerHTML = `
    ${recordDetails}
    ${row.설명 ? `<p class="space-description">${escapeHtml(row.설명)}</p>` : ''}
    <figure class="space-figure">
      <div class="space-map" role="status">지도를 읽고 있습니다.</div>
      ${shape && (shape.기준시점 || source) ? `<figcaption><span>${escapeHtml(shape.기준시점 || '')}</span>${source ? `<a href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">도형 출처 ↗</a>` : ''}</figcaption>` : ''}
    </figure>
    <dl class="space-fields">${fields.filter(([,v])=>v).map(([k,v])=>`<div><dt>${k}</dt><dd>${escapeHtml(v)}</dd></div>`).join('')}</dl>`;
  const nearbyKeys = event ? state.data.사건_공간.filter(link=>link.사건ID === event.사건ID)
    .map(link=>state.data.공간.find(place=>place.공간ID === link.공간ID)?.지도참조키) : [];
  void renderSpaceMap(body.querySelector('.space-map'),row,shape,{date:event?.날짜,nearbyKeys});
}

function openRecordPreview(tab, index, trigger) {
  const row = state.data[tab][index];
  const dialog = document.getElementById('record-preview');
  if (!row || dialog.open) return;
  const maps = getLookupMaps();
  const relation = tab === '관계';
  const kindField = recordKindFields[tab];
  const kind = document.getElementById('record-preview-kind');
  kind.textContent = relation ? '' : kindField && row[kindField]?.trim() ? getGroupLabel(tab,row[kindField]) : tab.replaceAll('_',' · ');
  kind.hidden = !kind.textContent;
  dialog.classList.toggle('is-relation', relation);
  dialog.querySelector('.record-preview-footer').hidden = false;
  document.getElementById('record-preview-title').textContent = relation ? row['라벨'] || getRelMeta(row['관계유형']).label : recordName(tab,row,maps);
  const body = document.getElementById('record-preview-body');
  const linkedSpace = Object.hasOwn(SPACE_LINKS,tab) && state.data.공간.find(space=>space.공간ID === row.공간ID);
  if (linkedSpace) {
    const event = state.data.사건.find(item=>item.사건ID === row.사건ID);
    spacePreview(body,linkedSpace,maps,event,recordFields(tab,row,maps));
  } else if (tab === '공간') spacePreview(body,row,maps);
  else body.innerHTML = (relation ? relationPreview(row,maps) : recordFields(tab,row,maps,[kindField])) || '<p>입력된 값이 없어요.</p>';
  document.getElementById('btn-preview-edit').onclick = () => {
    const primaryId = TAB_PRIMARY_ID[tab];
    const rows = state.data[tab];
    const currentIndex = rows.findIndex(record => record === row || (primaryId && row[primaryId] && record[primaryId] === row[primaryId]));
    if (currentIndex < 0) {
      dialog.close();
      showToast('기록이 바뀌었어요. 목록에서 다시 열어 주세요.', 'warn');
      return;
    }
    dialog.close();
    openEditDrawer(tab,currentIndex);
  };
  trigger.focus({preventScroll:true});
  dialog.showModal();
  body.scrollTop = 0;
}

function openEndpointRelations(trigger) {
  const node = trigger.previousElementSibling;
  const side = node.closest('[data-relation-side]').dataset.relationSide;
  const direction = side === 'from' ? '출발' : '도착';
  const opposite = side === 'from' ? '도착' : '출발';
  const {tab} = findRelationEndpoint(state.data,node.dataset.endpointType,node.dataset.endpointId);
  const entries = relationsByNode(side).get(JSON.stringify([tab,node.dataset.endpointId]));
  const dialog = document.getElementById('record-preview');
  if (!entries?.length || dialog.open) return;
  dialog.classList.remove('is-relation');
  dialog.querySelector('.record-preview-footer').hidden = true;
  const kind = document.getElementById('record-preview-kind');
  kind.textContent = `${direction} 관계 ${entries.length}건`;
  kind.hidden = false;
  document.getElementById('record-preview-title').textContent = node.querySelector('strong').textContent;
  const maps = getLookupMaps();
  const body = document.getElementById('record-preview-body');
  body.innerHTML = `<ul class="endpoint-relations-list">${entries.map(({row,origIdx}) => {
    const meta = getRelMeta(row.관계유형);
    const name = relationEndpointName(row[opposite+'유형'],row[opposite+'ID'],maps) || '대상 미지정';
    return `<li><button type="button" class="dashboard-button" data-preview-relation="${origIdx}">
      <strong>${escapeHtml(name)}</strong>
      <span class="record-relation-type ${meta.cls}">${escapeHtml(meta.label)}</span>
      ${row.라벨 ? `<span class="endpoint-relation-label">${escapeHtml(row.라벨)}</span>` : ''}
    </button></li>`;
  }).join('')}</ul>`;
  for (const button of body.querySelectorAll('[data-preview-relation]')) {
    const original = state.data.관계[Number(button.dataset.previewRelation)];
    button.addEventListener('click', () => {
      const index = state.data.관계.findIndex(row => row === original || (original.관계ID && row.관계ID === original.관계ID));
      if (index === -1) {
        showToast('기록이 바뀌었어요. 목록에서 다시 열어 주세요.', 'warn');
        return;
      }
      dialog.close();
      openRecordPreview('관계',index,trigger);
    });
  }
  trigger.focus({preventScroll:true});
  dialog.showModal();
  body.scrollTop = 0;
}

function getReferenceOptions(colName, tab, draft) {
  if (colName === '기본뷰ID') return state.data.지도뷰.map(row=>({id:row.뷰ID,label:row.뷰명||row.뷰ID}));
  const categories = state.data['카테고리'];
  const packageId = state.editing?.workspace?.packageId;
  const eligibleCategories = tab === '사건' && packageId ? categories.filter(row => row.패키지ID === packageId) : categories;
  if (tab === '사건' && Object.hasOwn(SheetData.eventCategoryTypes,colName)) {
    const typed = categories.filter(row => row.카테고리유형 === SheetData.eventCategoryTypes[colName]);
    return eligibleCategories.filter(row => typed.includes(row)).map(row => {
      const name = row.카테고리명;
      const categoryId = row.카테고리ID;
      const workspace = state.editing?.workspace;
      const duplicate = workspace && typed.filter(item => item.카테고리명 === name).length > 1;
      const label = duplicate ? `${name} · ${getLookupMaps().pkgMap.get(row.패키지ID) || row.패키지ID}` : name;
      return {id:workspace?.linked || duplicate ? categoryId : name,label,categoryId};
    });
  }
  if (colName === '패키지ID') {
    return (state.data['패키지'] || []).map((r) => ({ id: r['패키지ID'], label: r['패키지명'] || r['패키지ID'] }));
  }
  if (colName === '카테고리ID') {
    return eligibleCategories.map((r) => ({
      id: r['카테고리ID'],
      label: `${r['카테고리명'] || r['카테고리ID']} (${getGroupLabel('카테고리', r['카테고리유형'])})`
    }));
  }
  if (colName === '사건ID' || colName === '계기사건ID') {
    return (state.data['사건'] || []).map((r) => ({
      id: r['사건ID'],
      label: `${r['사건명'] || r['사건ID']}${r['날짜'] ? ' · ' + r['날짜'] : ''}`
    }));
  }
  if (colName === '상위공간ID' || (Object.hasOwn(SPACE_LINKS,tab) && colName === '공간ID')) {
    return state.data['공간'].filter(row => colName === '공간ID' || row['공간ID'] !== draft['공간ID'])
      .map(row => ({id: row['공간ID'], label: row['공간명'] || row['공간ID']}));
  }
  if (colName === '직위ID' && tab === '재임') {
    return state.data.직위.map(row => ({id:row.직위ID,label:row.직위명 || row.직위ID}));
  }
  if (['주체ID','국가ID','조직ID'].includes(colName)) {
    return state.data.주체.filter(row => tab !== '재임' || colName !== '주체ID' || row.구분 === 'person').map((r) => ({
      id: r['주체ID'],
      label: `${r['주체명'] || r['주체ID']}${r['구분'] ? ' (' + (state.editing?.workspace ? getGroupLabel('주체',r['구분']) : r['구분']) + ')' : ''}`
    }));
  }
  if (colName === '출발ID' || colName === '도착ID') {
    const typeKey = colName === '출발ID' ? '출발유형' : '도착유형';
    const typeVal = String(draft[typeKey] || '').toLowerCase();
    const evOpts = (state.data['사건'] || []).map((r) => ({ id: r['사건ID'], label: `[사건] ${r['사건명'] || r['사건ID']}` }));
    const acOpts = (state.data['주체'] || []).map((r) => ({ id: r['주체ID'], label: `[주체] ${r['주체명'] || r['주체ID']}` }));
    const catOpts = (state.data['카테고리'] || []).map((r) => ({ id: r['카테고리ID'], label: `[카테고리] ${r['카테고리명'] || r['카테고리ID']}` }));
    if (typeVal === 'event') return evOpts;
    if (typeVal === 'organization' || typeVal === 'army' || typeVal === 'state' || typeVal === 'actor') return acOpts;
    if (typeVal === 'category') return catOpts;
    return [...evOpts, ...acOpts, ...catOpts];
  }
  return null;
}

const actorRoles = {
  initiator:'주도', participant:'참여', leader:'지도', executor:'실행', author:'저술',
  founder:'창립', counterparty:'상대', mediator:'중재', affected:'영향을 받음', related:'관련'
};

function editChoiceButtons(label, options, value, field) {
  const choices = [
    {id:'',label:'선택 안 함'},
    ...options,
    ...(value && !options.some(option => option.id === value) ? [{id:value,label:value}] : [])
  ];
  return `<fieldset class="event-edit-choice">
    <legend>${escapeHtml(label)}</legend>
    <input type="hidden" ${field} value="${escapeHtml(value || '')}">
    <div class="event-category-buttons">
      ${choices.map(({id,label}) => `<button type="button" class="dashboard-button" data-edit-choice="${escapeHtml(id)}"
        aria-pressed="${id === (value || '')}" tabindex="${id === (value || '') ? 0 : -1}">${escapeHtml(label)}</button>`).join('')}
    </div>
  </fieldset>`;
}

function bindEditChoices(container) {
  for (const group of container.querySelectorAll('.event-edit-choice')) {
    const value = group.querySelector('input[type=hidden]');
    const buttons = [...group.querySelectorAll('[data-edit-choice]')];
    const setTabStop = active => { for (const button of buttons) button.tabIndex = button === active ? 0 : -1; };
    group.addEventListener('click', event => {
      const button = event.target.closest('[data-edit-choice]');
      if (!button) return;
      setTabStop(button);
      if (button.dataset.editChoice === value.value) return;
      value.value = button.dataset.editChoice;
      for (const option of buttons) option.setAttribute('aria-pressed', String(button === option));
      value.dispatchEvent(new Event('input', {bubbles:true}));
      value.dispatchEvent(new Event('change', {bubbles:true}));
    });
    group.addEventListener('keydown', event => {
      const button = event.target.closest('[data-edit-choice]');
      if (!button) return;
      const index = buttons.indexOf(button);
      const offset = {ArrowLeft:-1,ArrowUp:-1,ArrowRight:1,ArrowDown:1}[event.key];
      if (!offset && event.key !== 'Home' && event.key !== 'End') return;
      event.preventDefault();
      const next = event.key === 'Home' ? buttons[0] : event.key === 'End' ? buttons.at(-1) :
        buttons[(index + offset + buttons.length) % buttons.length];
      setTabStop(next);
      next.focus();
    });
  }
}

function renderEventActors() {
  const container = document.getElementById('event-edit-actors');
  const {draft,workspace} = state.editing;
  const maps = getLookupMaps();
  const roleOptions = Object.entries(actorRoles).map(([id,label]) => ({id,label}));
  const roleLabel = role => roleOptions.find(option => option.id === role)?.label || role || '역할 선택';
  container.innerHTML = `
    <h4>참여 주체</h4>
    ${workspace.actors.length ? `<ul class="event-actor-list">${workspace.actors.map((row,index) => {
      const name = escapeHtml(maps.actorMap.get(row.주체ID) || row.주체ID);
      return `<li><strong id="event-actor-name-${index}" title="${name}">${name}</strong>
        <button type="button" class="dashboard-button event-actor-role" data-edit-actor-role aria-expanded="false"
          aria-controls="event-actor-role-${index}" aria-describedby="event-actor-name-${index}">${escapeHtml(roleLabel(row.역할))}</button>
        <div class="event-actor-edit" id="event-actor-role-${index}" hidden>
          ${editChoiceButtons('역할',roleOptions,row.역할,`data-actor-role="${index}"`)}
          <button type="button" class="dashboard-button" data-remove-actor="${index}">연결 해제</button>
        </div>
      </li>`;
    }).join('')}</ul>` : ''}
    <button type="button" class="dashboard-button" data-open-actor-picker aria-haspopup="dialog">+ 주체 추가</button>
    <dialog id="event-actor-picker" aria-labelledby="event-actor-picker-title">
      <header class="event-actor-picker-header">
        <h5 id="event-actor-picker-title">참여 주체 추가</h5>
        <form method="dialog"><button class="dashboard-button">취소</button></form>
      </header>
      <div class="event-actor-lookup">
        <input type="search" aria-label="주체 검색" placeholder="주체 이름 검색" autocomplete="off" autofocus>
        <div class="event-category-buttons" role="group" aria-label="주체 유형"></div>
        <ul class="event-actor-results" aria-label="주체 검색 결과"></ul>
        <p class="event-category-empty" role="status" hidden>검색 결과가 없어요.</p>
      </div>
      <div class="event-actor-selection" hidden></div>
    </dialog>
  `;

  const refreshActors = () => {
    const picker = container.querySelector('#event-actor-picker');
    if (picker.open) picker.close();
    document.getElementById('event-edit-error').hidden = true;
    renderEventActors();
    container.querySelector('[data-open-actor-picker]').focus({preventScroll:true});
  };
  bindEditChoices(container);
  bindEventActorPicker(container,roleOptions,(id,role) => {
    if (workspace.actors.some(row => row.주체ID === id && row.역할 === role)) return false;
    workspace.actors.push({사건ID:draft.사건ID,주체ID:id,역할:role});
    refreshActors();
    return true;
  });
  for (const button of container.querySelectorAll('[data-edit-actor-role]')) {
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    button.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      button.setAttribute('aria-expanded',String(!panel.hidden));
    });
    const input = panel.querySelector('[data-actor-role]');
    input.addEventListener('change', () => {
      workspace.actors[input.dataset.actorRole].역할 = input.value;
      button.textContent = roleLabel(input.value);
    });
  }
  for (const button of container.querySelectorAll('[data-remove-actor]')) {
    button.addEventListener('click', () => {
      workspace.actors.splice(Number(button.dataset.removeActor),1);
      refreshActors();
    });
  }
}

function bindEventActorPicker(container, roleOptions, addActor) {
  const picker = container.querySelector('#event-actor-picker');
  const lookup = picker.querySelector('.event-actor-lookup');
  const selection = picker.querySelector('.event-actor-selection');
  const search = lookup.querySelector('input');
  const filters = lookup.querySelector('[role=group]');
  const results = lookup.querySelector('ul');
  const empty = lookup.querySelector('[role=status]');
  const actors = state.data.주체.filter(row => row.주체ID).map(row => ({
    id:row.주체ID, name:row.주체명 || row.주체ID, type:groupKey(row.구분)
  })).sort((a,b) => a.name.localeCompare(b.name,'ko'));
  const types = [...new Set(actors.map(actor => actor.type))].map(type => [type,getGroupLabel('주체',type)]);
  types.sort((a,b) => a[1].localeCompare(b[1],'ko'));
  const typeLabels = new Map(types);
  filters.innerHTML = [['','전체'], ...types].map(([type,label]) =>
    `<button type="button" class="dashboard-button" data-actor-type="${escapeHtml(type)}" aria-pressed="false">${escapeHtml(label)}</button>`
  ).join('');

  let type = '';
  function renderResults() {
    const query = search.value.trim().toLowerCase();
    const matches = actors.filter(actor => (!type || actor.type === type) && actor.name.toLowerCase().includes(query));
    results.innerHTML = matches.map(actor => `<li><button type="button" class="dashboard-button" data-pick-actor="${escapeHtml(actor.id)}">
      <strong>${escapeHtml(actor.name)}</strong><span>${escapeHtml(typeLabels.get(actor.type))}</span></button></li>`).join('');
    results.hidden = !matches.length;
    results.scrollTop = 0;
    empty.hidden = Boolean(matches.length);
    for (const option of filters.children) option.setAttribute('aria-pressed',String(option.dataset.actorType === type));
  }

  container.querySelector('[data-open-actor-picker]').addEventListener('click', () => {
    search.value = '';
    type = '';
    lookup.hidden = false;
    selection.hidden = true;
    selection.replaceChildren();
    renderResults();
    picker.showModal();
  });
  search.addEventListener('input', renderResults);
  search.addEventListener('keydown', event => {
    const first = results.querySelector('button');
    if (event.key !== 'ArrowDown' || !first) return;
    event.preventDefault();
    first.focus();
  });
  filters.addEventListener('click', event => {
    const option = event.target.closest('[data-actor-type]');
    if (!option) return;
    type = option.dataset.actorType;
    renderResults();
  });
  results.addEventListener('click', event => {
    const button = event.target.closest('[data-pick-actor]');
    if (!button) return;
    const actor = actors.find(item => item.id === button.dataset.pickActor);
    selection.innerHTML = `<div class="event-actor-picker-header"><strong>${escapeHtml(actor.name)}</strong>
      <button type="button" class="dashboard-button" data-reselect-actor>다시 선택</button></div>
      ${editChoiceButtons('역할',roleOptions,'','data-new-actor-role')}
      <p class="event-edit-error" role="alert" hidden>이미 연결된 주체와 역할이에요.</p>
      <button type="button" class="dashboard-button dashboard-primary" data-add-actor disabled>추가</button>`;
    lookup.hidden = true;
    selection.hidden = false;
    bindEditChoices(selection);
    const role = selection.querySelector('[data-new-actor-role]');
    const submit = selection.querySelector('[data-add-actor]');
    const error = selection.querySelector('[role=alert]');
    role.addEventListener('change', () => {
      submit.disabled = !role.value;
      error.hidden = true;
    });
    selection.querySelector('[data-reselect-actor]').addEventListener('click', () => {
      selection.hidden = true;
      lookup.hidden = false;
      button.focus();
    });
    submit.addEventListener('click', () => {
      if (!addActor(actor.id,role.value)) error.hidden = false;
    });
    selection.querySelector('[data-edit-choice][tabindex="0"]').focus();
  });
}

function openEditDrawer(tab, rowIndex, eventWorkspace = false) {
  const categoryWorkspace = tab === '카테고리' && isEventWorkspace();
  if ((eventWorkspace || categoryWorkspace) && document.getElementById('btn-load-sheet').disabled) {
    showToast('시트를 불러오는 중이에요. 잠시 후 다시 열어 주세요.', 'info');
    return;
  }
  const headers = state.headers[tab] || DEFAULT_HEADERS[tab] || [];
  const isNew = rowIndex === null;
  const draft = isNew
    ? Object.fromEntries(headers.map((h) => [h, '']))
    : { ...(state.data[tab][rowIndex] || {}) };

  state.editing = {tab,rowIndex,draft,categoryWorkspace};
  if (eventWorkspace) {
    if (isNew) draft.사건ID = generateInternalId('사건');
    const eventId = draft.사건ID;
    const categoryIds = new Set(state.data.사건_카테고리.filter(link => link.사건ID === eventId).map(link => link.카테고리ID));
    const packages = state.data.사건_패키지.filter(row => row.사건ID === eventId).map(row => row.패키지ID);
    const linked = !hasEmbeddedCategories(headers);
    state.editing.workspace = {
      linked,
      packageId: linked ? '' : state.packageFilter !== 'all' ? state.packageFilter : packages.length === 1 ? packages[0] : '',
      actors: state.data.사건_주체.filter(row => row.사건ID === eventId).map(row => ({...row}))
    };
    if (linked) {
      draft.패키지ID = (isNew && state.packageFilter !== 'all' ? [state.packageFilter] : packages).join(', ');
      const types = new Map(state.data.카테고리.map(row => [row.카테고리ID,row.카테고리유형]));
      for (const [field,type] of Object.entries(SheetData.eventCategoryTypes)) {
        draft[field] = [...categoryIds].filter(id => types.get(id) === type).join(', ');
      }
    }
  }
  const dialog = document.getElementById('edit-drawer');
  dialog.classList.toggle('event-workspace-drawer',eventWorkspace || categoryWorkspace);
  renderEditDrawer();
  dialog.showModal();
  if (eventWorkspace || categoryWorkspace) {
    dialog.querySelector(`[data-field="${eventWorkspace ? '사건명' : '카테고리명'}"]`)?.focus({preventScroll:true});
  }
}

function closeEditDrawer() {
  document.getElementById('edit-drawer').close();
  state.editing = null;
}

function splitSelection(value) {
  return (value || '').split(/[,;|]/).map(item => item.trim()).filter(Boolean);
}

function renderCategoryButtons(field, label, value, options) {
  const selected = splitSelection(value);
  const missing = selected.filter(id => !options.some(option => id === option.id || id === option.categoryId));
  const labels = getLookupMaps().catMap;
  const choices = [
    ...(field === '시기' && !state.editing.workspace?.linked ? [{id:'',label:'선택 안 함'}] : []),
    ...options,
    ...missing.map(id => ({id,label:labels.get(id) || id}))
  ];
  return `<fieldset data-category-field="${escapeHtml(field)}">
    <legend>${escapeHtml(label)}</legend>
    <div class="event-category-buttons">
      ${choices.map(({id,label,categoryId}) => {
        const pressed = id ? selected.includes(id) || selected.includes(categoryId) : !selected.length;
        return `<button type="button" class="dashboard-button" data-category-option="${escapeHtml(id)}"
          data-category-id="${escapeHtml(categoryId || '')}" aria-pressed="${pressed}">${escapeHtml(label)}</button>`;
      }).join('') || '<p class="event-category-empty">선택 가능한 항목이 없어요.</p>'}
    </div>
  </fieldset>`;
}

function renderEditDrawer() {
  if (!state.editing) return;
  const { tab, rowIndex, draft, workspace, categoryWorkspace } = state.editing;
  const guided = workspace || categoryWorkspace;
  const headers = (state.headers[tab] || DEFAULT_HEADERS[tab] || []).filter((h) => !isHiddenInEditor(tab, h));
  const isNew = rowIndex === null;

  document.getElementById('drawer-header').innerHTML = `
    <div>
      ${guided ? '' : `<span class="text-[11px] font-bold text-blue-600">${escapeHtml(tab)} 시트</span>`}
      <h3 id="drawer-title" class="text-base font-extrabold text-slate-900">${workspace ? escapeHtml(isNew ? '새 사건' : draft.사건명 || '사건 편집') :
        categoryWorkspace ? escapeHtml(draft.카테고리명 || '카테고리 편집') : isNew ? '새 항목 추가' : `항목 편집 (#${rowIndex + 1})`}</h3>
    </div>
    <button id="btn-drawer-close" aria-label="닫기" class="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 cursor-pointer">✕</button>
    ${workspace ? `<nav class="event-section-links" aria-label="사건 편집 항목">
      <button type="button" data-edit-section="basic">기본 정보</button>
      <button type="button" data-edit-section="categories">연표 분류</button>
      <button type="button" data-edit-section="actors">참여 주체</button>
    </nav>` : ''}
  `;

  const body = document.getElementById('drawer-body');
  const renderField = col => {
    const val = draft[col] || '';
    const cleanLabel = workspace && col === '공간' ? '장소' : getCleanLabel(tab, col);
    const refOpts = categoryWorkspace && col === '카테고리유형' ?
      Object.entries(SheetData.eventCategoryTypes).map(([label,id]) => ({id,label})) :
      getReferenceOptions(col, tab, draft) ?? (workspace && col === '사건유형' ?
      ['event','policy','publication','context'].map(id => ({id,label:getGroupLabel(tab,id)})) : null);
    const isCategory = tab === '사건' && (col === '카테고리ID' || Object.hasOwn(SheetData.eventCategoryTypes,col));
    const isLongText = col === '내용' || col === '설명';

    if (workspace && isCategory && refOpts) return renderCategoryButtons(col, cleanLabel, val, refOpts);
    if (guided && refOpts) return editChoiceButtons(cleanLabel,refOpts,val,`data-field="${escapeHtml(col)}"`);

    if (isCategory && refOpts) {
      const selectedIds = val.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
      const optMap = new Map(refOpts.map((o) => [o.id, o.label]));
      return `
        <div class="space-y-1.5">
          <label class="text-xs font-extrabold text-slate-700">${escapeHtml(cleanLabel)}</label>
          <div class="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200 min-h-[42px]" data-multi-chips="${escapeHtml(col)}">
            ${selectedIds.length ? selectedIds.map((id) => `
              <span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-100 text-blue-900 text-xs font-bold">
                ${escapeHtml(optMap.get(id) || id)}
                <button type="button" data-remove-chip="${escapeHtml(id)}" class="text-blue-600 hover:text-blue-950 font-extrabold cursor-pointer">✕</button>
              </span>
            `).join('') : '<span class="text-xs text-slate-400">선택된 카테고리 없음</span>'}
          </div>
          <select aria-label="${escapeHtml(cleanLabel)} 추가" data-add-chip="${escapeHtml(col)}" class="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 focus:border-blue-500 focus:outline-none">
            <option value="">+ ${escapeHtml(cleanLabel)} 추가</option>
            ${refOpts.filter((o) => !selectedIds.includes(o.id)).map((o) => `<option value="${escapeHtml(o.id)}">${escapeHtml(o.label)}</option>`).join('')}
          </select>
        </div>
      `;
    }

    if (refOpts) {
      return `
        <div class="space-y-1.5">
          <label class="text-xs font-extrabold text-slate-700">${escapeHtml(cleanLabel)}</label>
          <select aria-label="${escapeHtml(cleanLabel)}" data-field="${escapeHtml(col)}" class="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:border-blue-500 focus:outline-none">
            <option value="">-- 선택 안 함 --</option>
            ${refOpts.map((o) => `<option value="${escapeHtml(o.id)}" ${o.id === val ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}
            ${val && !refOpts.some((o) => o.id === val) ? `<option value="${escapeHtml(val)}" selected>${escapeHtml(val)}</option>` : ''}
          </select>
        </div>
      `;
    }

    if (isLongText) {
      return `
        <div class="space-y-1.5">
          <label class="text-xs font-extrabold text-slate-700">${escapeHtml(cleanLabel)}</label>
          <textarea aria-label="${escapeHtml(cleanLabel)}" data-field="${escapeHtml(col)}" rows="4" class="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none">${escapeHtml(val)}</textarea>
        </div>
      `;
    }

    return `
      <div class="space-y-1.5">
        <label class="text-xs font-extrabold text-slate-700">${escapeHtml(cleanLabel)}</label>
        <input type="text" aria-label="${escapeHtml(cleanLabel)}" data-field="${escapeHtml(col)}" value="${escapeHtml(val)}" ${workspace && col === '날짜' ? 'placeholder="예: 1919, 1919-03, 1919-03-01"' : ''} class="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none" />
      </div>
    `;
  };
  if (workspace) {
    const basics = ['사건명','날짜','종료일','사건유형','내용','공간','이미지','출처'];
    const categories = ['시기','사건군','주제','카테고리ID'];
    const fieldGroup = names => names.filter(name => headers.includes(name)).map(renderField).join('');
    const categoryGroup = workspace.linked ? [
      renderCategoryButtons('패키지ID','패키지',draft.패키지ID,getReferenceOptions('패키지ID',tab,draft)),
      ...Object.keys(SheetData.eventCategoryTypes).map(renderField)
    ].join('') : fieldGroup(categories);
    const extra = headers.filter(name => !basics.includes(name) && !categories.includes(name));
    body.innerHTML = `
      <section class="event-edit-section" id="event-edit-basic" tabindex="-1"><h4>기본 정보</h4><div class="event-edit-fields">${fieldGroup(basics)}</div></section>
      <section class="event-edit-section" id="event-edit-categories" tabindex="-1"><h4>연표에서의 분류</h4><div class="event-category-fields">${categoryGroup}</div></section>
      <section class="event-edit-section" id="event-edit-actors" tabindex="-1"></section>
      ${extra.length ? `<details class="event-edit-section"><summary>추가 정보</summary><div class="event-edit-fields">${extra.map(renderField).join('')}</div></details>` : ''}
    `;
    bindEditChoices(body);
    renderEventActors();
  } else if (categoryWorkspace) {
    body.innerHTML = `<section class="event-edit-section"><div class="event-edit-fields">${headers.map(renderField).join('')}</div></section>`;
    bindEditChoices(body);
  } else {
    body.innerHTML = headers.map(renderField).join('');
  }

  document.getElementById('drawer-footer').innerHTML = `
    ${guided ? '<p id="event-edit-error" class="event-edit-error" role="alert" hidden></p>' : ''}
    <div>
      ${!isNew && !guided ? '<button id="btn-delete-row" class="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold cursor-pointer">행 삭제</button>' : ''}
    </div>
    <div class="flex items-center gap-2">
      <button id="btn-cancel-edit" class="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer">취소</button>
      <button id="btn-save-edit" class="dashboard-button dashboard-primary">${guided ? '브라우저 사본 저장' : '사본에 저장'}</button>
    </div>
  `;

  // 드로어 내부 이벤트 바인딩
  document.getElementById('btn-drawer-close').addEventListener('click', closeEditDrawer);
  document.getElementById('btn-cancel-edit').addEventListener('click', closeEditDrawer);
  for (const button of document.querySelectorAll('[data-edit-section]')) {
    button.addEventListener('click', () => {
      const section = document.getElementById('event-edit-'+button.dataset.editSection);
      section.scrollIntoView({block:'start'});
      section.focus({preventScroll:true});
    });
  }

  body.querySelectorAll('[data-field]').forEach((el) => {
    el.addEventListener('input', () => {
      state.editing.draft[el.dataset.field] = el.value;
      // 출발유형/도착유형 변경 시 출발ID/도착ID 드롭다운 갱신
      if (el.dataset.field === '출발유형' || el.dataset.field === '도착유형') {
        renderEditDrawer();
      }
    });
  });

  for (const group of body.querySelectorAll('[data-category-field]')) {
    group.addEventListener('click', event => {
      const button = event.target.closest('[data-category-option]');
      if (!button) return;
      const {categoryOption:value, categoryId} = button.dataset;
      const field = group.dataset.categoryField;
      if (field === '시기' && !workspace.linked) {
        draft[field] = value;
        for (const option of group.querySelectorAll('button')) option.setAttribute('aria-pressed', String(button === option));
        return;
      }
      const selected = splitSelection(draft[field]);
      const pressed = button.getAttribute('aria-pressed') === 'true';
      draft[field] = (pressed ? selected.filter(item => item !== value && item !== categoryId) : [...selected,value]).join(', ');
      button.setAttribute('aria-pressed', String(!pressed));
    });
  }

  // 다중 카테고리 칩 제거/추가
  body.querySelectorAll('[data-remove-chip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idToRemove = btn.dataset.removeChip;
      const field = btn.closest('[data-multi-chips]').dataset.multiChips;
      const cur = String(state.editing.draft[field] || '').split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
      state.editing.draft[field] = cur.filter((id) => id !== idToRemove).join(', ');
      renderEditDrawer();
    });
  });
  body.querySelectorAll('[data-add-chip]').forEach((sel) => {
    sel.addEventListener('change', () => {
      if (!sel.value) return;
      const field = sel.dataset.addChip;
      const cur = String(state.editing.draft[field] || '').split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
      if (!cur.includes(sel.value)) cur.push(sel.value);
      state.editing.draft[field] = cur.join(', ');
      renderEditDrawer();
    });
  });

  // 저장
  document.getElementById('btn-save-edit').addEventListener('click', saveEditingRow);

  // 삭제
  const delBtn = document.getElementById('btn-delete-row');
  if (delBtn) {
    delBtn.addEventListener('click', async () => {
      const ok = await showConfirm('항목 삭제 확인', `[${tab}] 브라우저 사본에서 이 항목을 삭제할까요?`);
      if (!ok) return;
      const [deleted] = state.data[tab].splice(rowIndex, 1);
      if (tab === '사건') {
        for (const linkTab of ['사건_패키지','사건_카테고리','사건_주체','사건_공간']) {
          state.data[linkTab] = state.data[linkTab].filter(row => row.사건ID !== deleted.사건ID);
        }
      }

      state.dirtyCount++;

      saveToLocalStorage();
      closeEditDrawer();
      renderAll();
      showToast('브라우저 사본에서 삭제했습니다.', 'warn');
    });
  }
}

function generateInternalId(tab) {
  const prefixMap = { '패키지': 'pkg_', '카테고리': 'cat_', '사건': 'E', '주체': 'actor_', '직위':'office_', '재임':'tenure_', '관계': 'R' };
  const prefix = prefixMap[tab] || 'ID_';
  return prefix + crypto.randomUUID();
}

function showEventEditError(message) {
  const error = document.getElementById('event-edit-error');
  error.textContent = message;
  error.hidden = false;
}

function saveEditingRow() {
  const { tab, rowIndex, draft, workspace, categoryWorkspace } = state.editing;
  const isNew = rowIndex === null;
  const maps = getLookupMaps();
  const nextData = {...state.data};

  // 신규 항목 추가 시 내부 Primary ID 자동 생성 (UI에 노출하지 않음)
  const pkCol = TAB_PRIMARY_ID[tab];
  if (isNew && pkCol && !draft[pkCol]) {
    draft[pkCol] = generateInternalId(tab);
  }

  if (tab === '카테고리') {
    try {
      draft.카테고리명 = (draft.카테고리명 || '').trim();
      draft.카테고리유형 = groupKey(draft.카테고리유형);
      if (!draft.카테고리명) throw new Error('카테고리명을 입력해 주세요.');
      if (!Object.values(SheetData.eventCategoryTypes).includes(draft.카테고리유형)) throw new Error('카테고리 유형을 선택해 주세요.');
      if (!maps.pkgMap.has(draft.패키지ID)) throw new Error('패키지를 선택해 주세요.');
      if (hasEmbeddedCategories(state.headers.사건)) {
        nextData.사건 = updateCategoryEvents(state.data.사건,state.data.카테고리,state.data.카테고리[rowIndex],draft,SheetData);
      }
    } catch (error) {
      if (categoryWorkspace) showEventEditError(error.message);
      else showToast(error.message,'error');
      return;
    }
  }

  let record = draft;
  if (tab === '사건') {
    try {
      const eventId = draft.사건ID;
      draft.사건명 = (draft.사건명 || '').trim();
      draft.날짜 = (draft.날짜 || '').trim();
      if (!draft.사건명) throw new Error('사건명을 입력해 주세요.');
      const original = state.data.사건[rowIndex];
      if (isNew || original.날짜 !== draft.날짜 || original.종료일 !== draft.종료일) {
        const start = SheetData.dateRange(draft.날짜);
        if (draft.종료일 && start.start > SheetData.dateRange(draft.종료일).end) {
          throw new Error('종료일은 시작일보다 빠를 수 없어요.');
        }
      }
      if (workspace) {
        nextData.사건_주체 = eventActorLinks(state.data,draft.사건ID,workspace.actors);
      }
      if (workspace?.linked || hasEmbeddedCategories(state.headers.사건)) {
        const links = deriveCategoryLinks([draft],state.data.카테고리).records;
        if (isNew && workspace?.packageId && !links.some(link => state.data.카테고리.some(row =>
          row.카테고리ID === link.카테고리ID && row.패키지ID === workspace.packageId))) {
          throw new Error('현재 패키지의 시기, 사건군, 주제 중 하나를 선택해 주세요.');
        }
        const currentTypes = new Set(Object.values(SheetData.eventCategoryTypes));
        nextData.사건_카테고리 = [
          ...state.data.사건_카테고리.filter(row => row.사건ID !== eventId ||
            (workspace?.linked && !currentTypes.has(maps.catTypeMap.get(row.카테고리ID)))), ...links
        ];
        if ('카테고리명' in draft) draft.카테고리명 = links.map(link => maps.catMap.get(link.카테고리ID) || link.카테고리ID).join(', ');
        if (workspace?.linked) {
          const packages = [...new Set(splitSelection(draft.패키지ID))];
          if (packages.some(id => !maps.pkgMap.has(id))) throw new Error('패키지를 확인해 주세요.');
          nextData.사건_패키지 = [...state.data.사건_패키지.filter(row => row.사건ID !== eventId),
            ...packages.map(패키지ID => ({사건ID:eventId,패키지ID}))];
          record = Object.fromEntries(state.headers.사건.map(field => [field,draft[field] ?? '']));
        } else {
          nextData.사건_패키지 = eventPackageLinks({카테고리:nextData.카테고리,사건_카테고리:nextData.사건_카테고리});
        }
      }
    } catch (error) {
      if (workspace) showEventEditError(error.message);
      else showToast(error.message, 'error');
      return;
    }
  }

  nextData[tab] = isNew ? [...state.data[tab],record] : state.data[tab].map((row,index) => index === rowIndex ? record : row);
  if (!saveToLocalStorage(nextData,state.dirtyCount + 1)) {
    if (workspace || categoryWorkspace) showEventEditError('브라우저 사본을 저장하지 못했어요. 편집 화면을 열어뒀습니다.');
    return;
  }
  state.data = nextData;
  state.dirtyCount++;
  closeEditDrawer();
  renderAll();
  if (categoryWorkspace) {
    const editButton = document.getElementById('edit-filtered-category');
    (editButton?.disabled ? searchInput : editButton)?.focus({preventScroll:true});
  }
  showToast(isNew ? '새 항목이 추가되었습니다.' : '변경사항이 저장되었습니다.', 'success');
}

function getEntityType(raw) {
  const labels = {event:'사건', organization:'단체', army:'군대', state:'국가', actor:'주체', category:'카테고리'};
  const key = String(raw || '').trim().toLowerCase();
  return Object.hasOwn(labels, key) ? labels[key] : raw || '대상';
}

function bindKeyboardRows(view) {
  const selectors = '[data-group-more], [data-ov-tab], [data-ov-rel-idx], [data-sort], [data-orig-idx]';
  for (const item of view.querySelectorAll(selectors)) {
    item.tabIndex = 0;
    if (item.matches('[data-ov-tab],[data-ov-rel-idx],[data-orig-idx]')) item.setAttribute('aria-haspopup','dialog');
    if (item.matches('[data-hier-pkg],[data-hier-cat]')) item.setAttribute('aria-selected', String(item.classList.contains('is-selected')));
    item.addEventListener('keydown', event => {
      if (event.target !== item || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      item.click();
      const key = Object.keys(item.dataset)[0];
      if (key && !item.isConnected) {
        const attr = key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase());
        const replacement = [...view.querySelectorAll(`[data-${attr}]`)].find(node => node.dataset[key] === item.dataset[key]);
        (replacement || view).focus({preventScroll:true});
      }
    });
  }
}

const requiredFields = {
  '패키지': ['패키지ID','패키지명'], '카테고리': ['카테고리ID','카테고리명','패키지ID'],
  '사건': ['사건ID','사건명','날짜'], '사건_카테고리': ['사건ID','카테고리ID'], '사건_패키지': ['사건ID','패키지ID'],
  '주체': ['주체ID','주체명'], '사건_주체': ['사건ID','주체ID','역할'],
  '직위': ['직위ID','직위명'], '재임': ['재임ID','시작일'], '관계': ['관계ID','출발ID','도착ID','관계유형'],
  '공간': ['공간ID','공간명','공간유형'], '영토변화': ['영토ID','주체ID','영토유형'],
  '사건_공간': ['사건ID','공간ID'], '지도도형': ['지도참조키','도형유형'], '지도뷰': ['뷰ID','뷰명','투영법'],
  '주체_공간': ['주체ID','공간ID'], '카테고리_공간': ['카테고리ID','공간ID']
};

function validateTable(tab, headers, records) {
  if (!Array.isArray(headers) || !headers.every(header => typeof header === 'string' && header && header !== '__proto__') ||
      new Set(headers).size !== headers.length || !requiredFields[tab].every(field => headers.includes(field)) ||
      (tab === '재임' && !(['주체ID','직위ID'].every(field => headers.includes(field)) || ['이름','직위','국가ID'].every(field => headers.includes(field)))) ||
      !Array.isArray(records) || !records.every(row => row && typeof row === 'object' && !Array.isArray(row) &&
        Object.values(row).every(value => typeof value === 'string'))) {
    throw new Error(`${tab} 시트의 열이나 셀 값을 확인해 주세요.`);
  }
}

function hasEmbeddedCategories(headers) {
  return headers.includes('카테고리ID') || Object.keys(SheetData.eventCategoryTypes).some(field => headers.includes(field));
}

function deriveCategoryLinks(events, categories) {
  const registry = categories.map(row => ({topic_id:row['카테고리ID'],name:row['카테고리명'],category_type:row['카테고리유형']}));
  const links = SheetData.categoryLinks(events,registry);
  return {headers:['사건ID','카테고리ID'],records:links.map(({event_id,topic_id}) => ({사건ID:event_id,카테고리ID:topic_id}))};
}

const loadedSourceTabs = new Set();
let missingDraftTabs = [];
async function refreshSource() {
  const button = document.getElementById('btn-load-sheet');
  if (button.disabled) return;
  button.disabled = true;
  const status = document.getElementById('sync-badge');
  const banner = document.getElementById('fallback-banner');
  status.textContent = '시트를 불러오는 중이에요.';
  try {
    const results = await Promise.allSettled(ALL_TABS.map(async tab => {
      const table = parseCSV(await SheetData.sheetCSV(SHEET_CONFIG,tab), tab);
      validateTable(tab, table.headers, table.records);
      return [tab,table];
    }));
    const entries = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
    const unavailable = ALL_TABS.filter((_,index) => results[index].status === 'rejected');
    if (!entries.length) throw new Error('공개 시트를 읽지 못했습니다.');
    const tables = Object.fromEntries(entries);
    const firstLoad = !loadedSourceTabs.size;
    const hasStaleTabs = unavailable.some(tab => loadedSourceTabs.has(tab));
    for (const tab of unavailable) {
      if (loadedSourceTabs.has(tab)) continue;
      state.originalHeaders[tab] = [...DEFAULT_HEADERS[tab]];
      state.originalData[tab] = [];
    }
    for (const [tab,table] of entries) {
      state.originalHeaders[tab] = table.headers;
      state.originalData[tab] = table.records;
      loadedSourceTabs.add(tab);
    }
    if (!state.dirtyCount && !state.editing) {
      state.headers = structuredClone(state.originalHeaders);
      state.data = structuredClone(state.originalData);
    } else if (!state.editing && missingDraftTabs.length) {
      for (const tab of missingDraftTabs) {
        if (!tables[tab]) continue;
        state.headers[tab] = [...new Set([...state.headers[tab], ...state.originalHeaders[tab]])];
        if (!state.data[tab].length) state.data[tab] = structuredClone(state.originalData[tab]);
      }
      missingDraftTabs = missingDraftTabs.filter(tab => !tables[tab]);
    }
    banner.hidden = !unavailable.length;
    status.textContent = unavailable.length ? `공개 시트 ${entries.length}/${ALL_TABS.length}개 연결됨` : '공개 시트 연결됨';
    if (unavailable.length) {
      document.getElementById('source-message').textContent =
        `불러오지 못한 시트는 ${unavailable.join(', ')}입니다.${hasStaleTabs ? ' 이전에 읽은 자료가 있는 표는 그 자료를 표시합니다.' : ''}`;
    }
    if (!state.editing) {
      renderAll();
      const section = firstLoad && structureSectionId(location.hash);
      if (section) jumpToStructureSection(section);
    }
  } catch (error) {
    banner.hidden = false;
    status.textContent = loadedSourceTabs.size ? '마지막으로 읽은 데이터' : '시트 연결 확인 필요';
    console.warn('공개 시트를 불러오지 못했습니다.', error);
    document.getElementById('source-message').textContent = loadedSourceTabs.size ? '시트를 읽지 못해 마지막으로 읽은 데이터를 표시합니다.' :
      state.dirtyCount ? '시트를 읽지 못해 이 브라우저에 저장된 사본을 표시합니다.' : '시트를 읽지 못해 예시 데이터를 표시합니다.';
  } finally {
    button.disabled = false;
  }
}

function restoreDraft(data, headers) {
  if (!data?.재임 && data?.지도자) {
    data = {...data,재임:data.지도자};
    headers = {...headers,재임:headers.지도자};
  }
  if (data?.카테고리 && data?.사건_카테고리 && !data.사건_패키지 && !headers?.사건_패키지) {
    data = {...data,사건_패키지:eventPackageLinks(data)};
    headers = {...headers,사건_패키지:DEFAULT_HEADERS.사건_패키지};
  }
  const missing = NEW_SCHEMA_TABS.filter(tab => !Object.hasOwn(data || {}, tab) && !Object.hasOwn(headers || {}, tab));
  for (const tab of ALL_TABS) {
    if (!missing.includes(tab)) validateTable(tab, headers?.[tab], data?.[tab]);
  }
  state.headers = Object.fromEntries(ALL_TABS.map(tab => [tab, missing.includes(tab) ? [...state.originalHeaders[tab]] : headers[tab]]));
  state.data = Object.fromEntries(ALL_TABS.map(tab => [tab, missing.includes(tab) ? structuredClone(state.originalData[tab]) : data[tab]]));
  missingDraftTabs = missing.filter(tab => !loadedSourceTabs.has(tab));
}

function openTable(tab, section) {
  if (!ALL_TABS.includes(tab)) return;
  if (!section && state.rawTable && state.activeView === tab) {
    closeMobileSidebar();
    return;
  }
  const params = new URLSearchParams({table:tab});
  if (section) params.set('from',section);
  const hash = '#structure?' + params;
  if (location.hash !== hash) location.hash = hash;
  else if (state.activeView !== tab) applyRoute();
  closeMobileSidebar();
}

const structureToc = document.getElementById('structure-toc');
const structureLinks = [...structureToc.querySelectorAll('a')];
const guideHeader = document.querySelector('.guide-nav');
let trackingFrame = 0;

function scheduleStructureTracking() {
  if (state.activeView !== 'overview' || trackingFrame) return;
  trackingFrame = requestAnimationFrame(() => {
    trackingFrame = 0;
    if (state.activeView !== 'overview') return;
    const first = document.getElementById(structureLinks[0].hash.slice(1));
    if (!first) return;
    const threshold = parseFloat(getComputedStyle(first).scrollMarginTop) + 1;
    let current = structureLinks[0];
    for (const link of structureLinks.slice(1)) {
      const heading = document.getElementById(link.hash.slice(1));
      if (heading && heading.getBoundingClientRect().top <= threshold) current = link;
    }
    if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 1) {
      current = structureLinks.at(-1);
    }
    if (current.getAttribute('aria-current') === 'location') return;
    for (const link of structureLinks) link.removeAttribute('aria-current');
    current.setAttribute('aria-current','location');
    const rect = current.getBoundingClientRect(), nav = structureToc.getBoundingClientRect();
    if (rect.left < nav.left) structureToc.scrollLeft += rect.left - nav.left;
    else if (rect.right > nav.right) structureToc.scrollLeft += rect.right - nav.right;
  });
}

const structureSize = new ResizeObserver(() => {
  const main = document.getElementById('main-content');
  main.style.setProperty('--guide-height', guideHeader.offsetHeight + 'px');
  main.style.setProperty('--toc-height', structureToc.offsetHeight + 'px');
  scheduleStructureTracking();
});
structureSize.observe(guideHeader);
structureSize.observe(structureToc);
structureSize.observe(document.getElementById('main-view'));
window.addEventListener('scroll', scheduleStructureTracking, {passive:true});

const exampleView = document.getElementById('example-view');
const showroomViews = document.getElementById('showroom-views');
const showroomTabs = [...document.querySelectorAll('#showroom-tabs [role="tab"]')];
document.getElementById('showroom-tabs').addEventListener('keydown', event => {
  const index = showroomTabs.indexOf(event.target);
  if (index < 0) return;
  const next = {ArrowLeft:(index + showroomTabs.length - 1) % showroomTabs.length,
    ArrowRight:(index + 1) % showroomTabs.length, Home:0, End:showroomTabs.length - 1, ' ':index}[event.key];
  if (next === undefined) return;
  event.preventDefault();
  showroomTabs[next].focus();
  showroomTabs[next].click();
});
const exhibit = document.getElementById('showroom-exhibit');
const stage = document.getElementById('showroom-stage');
const descriptions = {
  swimlane:'시기와 사건군을 나란히 놓고, 같은 시점의 사건과 그 사이의 관계를 읽습니다.',
  timeline:'사건을 날짜순으로 읽고, 사건명을 눌러 원래 기록을 확인합니다.',
  radar:'부채꼴은 권역, 중심에서의 거리는 시간입니다. 연도를 움직여 사건의 분포를 살펴봅니다.',
};
for (const view of views) {
  const link = document.createElement('a');
  link.href = '#examples?example=' + view.id;
  link.dataset.view = view.id;
  const image = document.createElement('img');
  image.src = '/assets/showroom/' + view.id + '.jpg';
  image.alt = '';
  image.loading = 'lazy';
  const title = document.createElement('strong');
  title.textContent = view.name;
  const description = document.createElement('p');
  description.textContent = descriptions[view.id];
  const arrow = document.createElement('span');
  arrow.textContent = '↓';
  arrow.setAttribute('aria-hidden','true');
  title.append(arrow);
  link.append(image,title,description);
  showroomViews.append(link);
  link.addEventListener('click', () => {
    if (location.hash === link.hash) document.getElementById('exhibit-title').focus();
  });
}

function showExhibit(requested) {
  const view = views.find(item => item.id === requested);
  for (const link of showroomViews.children) {
    if (link.dataset.view === view?.id) link.setAttribute('aria-current','true');
    else link.removeAttribute('aria-current');
  }
  exhibit.hidden = !view;
  if (!view) { stage.replaceChildren(); return; }
  const title = document.getElementById('exhibit-title');
  title.textContent = '냉전 · ' + view.name;
  const href = '/metro/?package=cold-war&view=' + view.id;
  document.getElementById('showroom-open').href = href;
  if (stage.firstElementChild?.dataset.view !== view.id) {
    const frame = document.createElement('iframe');
    frame.title = title.textContent;
    frame.dataset.view = view.id;
    frame.src = href + '&showroom=1';
    stage.replaceChildren(frame);
  }
}

function structureSectionId(hash) {
  const link = structureLinks.find(item => item.hash === hash);
  return link?.hash.slice(1);
}

function jumpToStructureSection(id) {
  const heading = document.getElementById(id);
  if (!heading) return;
  heading.scrollIntoView({block:'start'});
  heading.focus({preventScroll:true});
}

function renderTableBreadcrumb(tab, title) {
  const nav = document.getElementById('table-breadcrumb');
  nav.hidden = !state.rawTable;
  if (nav.hidden) return;

  const from = new URLSearchParams(location.hash.split('?')[1]).get('from');
  const section = structureSectionId('#' + from) || Object.keys(STRUCTURE_SECTION_TABLES)
    .find(id => STRUCTURE_SECTION_TABLES[id].includes(tab));
  const sectionLink = document.getElementById('table-section-link');
  const tocLink = structureToc.querySelector(`a[href="#${section}"]`);
  sectionLink.href = tocLink.hash;
  sectionLink.textContent = tocLink.textContent;
  document.getElementById('table-current-page').textContent = title;
}

function applyRoute() {
  const [view,query] = location.hash.split('?');
  const section = structureSectionId(view);
  if (section && state.activeView === 'overview' && document.getElementById(section)) {
    jumpToStructureSection(section);
    return;
  }
  if (view && !section && !['#structure','#overview','#records','#examples','#event-relations','#package-studio'].includes(view)) return;
  const params = new URLSearchParams(query);
  const requestedTable = params.get('table');
  const table = requestedTable === '지도자' ? '재임' : requestedTable;
  state.rawTable = ['#structure','#overview','#records'].includes(view) && ALL_TABS.includes(table);
  if (state.rawTable && (view !== '#structure' || requestedTable !== table)) {
    params.set('table',table);
    history.replaceState(null,'','#structure?' + params);
  }
  state.activeView = 'overview';
  if (view === '#examples') {
    state.activeView = 'examples';
    const catalogOpen = params.get('tab') === 'modals';
    for (const tab of showroomTabs) {
      const selected = tab.id === (catalogOpen ? 'modals-tab' : 'lessons-tab');
      tab.setAttribute('aria-selected',String(selected));
      tab.tabIndex = selected ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !selected;
    }
    const catalogFrame = document.getElementById('modal-catalog-frame');
    if (catalogOpen && !catalogFrame.hasAttribute('src')) catalogFrame.src = catalogFrame.dataset.src;
    let requested = catalogOpen ? null : params.get('example');
    if (requested && !views.some(v => v.id === requested)) {
      requested = requested === 'cold-war' ? 'swimlane' : null;
      history.replaceState(null,'',requested ? '#examples?example='+requested : '#examples');
    }
    showExhibit(requested);
  } else if (stage.childElementCount) {
    showExhibit(null);
  }
  if (state.rawTable) state.activeView = table;
  else if (view === '#overview' || view === '#records') state.activeView = '사건';
  if (view === '#event-relations') state.activeView = 'event-relations';
  if (view === '#package-studio') state.activeView = 'package-studio';
  clearRelationSelection();
  state.relationSearch = {from:'',to:''};
  state.page = 1;
  state.sortCol = null;
  state.searchQuery = '';
  state.categoryFilter = '';
  searchInput.value = '';
  document.getElementById('package-search').value = '';
  document.getElementById('category-search').value = '';
  clearSearchBtn.hidden = true;
  closeMobileSidebar();
  renderAll();
  if (view === '#examples' && !exhibit.hidden) document.getElementById('exhibit-title').focus();
  else if (section) jumpToStructureSection(section);
  else if (state.rawTable || view === '#structure') {
    window.scrollTo(0,0);
    document.getElementById('page-title').focus({preventScroll:true});
  }
}

function renderFilteredView() {
  if (state.activeView === 'event-relations') renderRelationEditor();
  else if (ALL_TABS.includes(state.activeView)) renderSheetTable(state.activeView);
}

function renderAll() {
  const isStructure = state.activeView === 'overview';
  const isExamples = state.activeView === 'examples';
  const workspace = isEventWorkspace();
  const relationEditor = state.activeView === 'event-relations';
  const studioActive = state.activeView === 'package-studio';
  const frame = document.getElementById('studio-frame');
  const studioLink = document.getElementById('studio-link');
  const main = document.getElementById('main-content');
  main.classList.toggle('structure-active', isStructure);
  main.classList.toggle('studio-active',studioActive);
  main.classList.toggle('examples-active', isExamples);
  main.classList.toggle('event-workspace-active', workspace || relationEditor);
  main.classList.toggle('event-relation-active', relationEditor);
  studioLink.setAttribute('aria-current', studioActive ? 'page' : 'false');
  frame.hidden = !studioActive;
  if (studioActive) {
    studioLink.hash = location.hash;
    const params = new URLSearchParams(location.hash.split('?')[1]);
    const draft = params.get('draft') || '';
    const view = params.get('view') === 'core' ? 'core' : '';
    if (!frame.hasAttribute('src') || frame.dataset.draft !== draft || frame.dataset.view !== view) {
      const url = new URL('./package-studio.html', location.href);
      if (draft) url.searchParams.set('draft', draft);
      if (view) url.searchParams.set('view', view);
      frame.dataset.draft = draft;
      frame.dataset.view = view;
      frame.src = url.href;
    }
    document.title = "패키지 제작실 · Dorms' Chronicle";
    for (const id of ['structure-link','records-link','relation-editor-link','examples-link']) {
      document.getElementById(id).setAttribute('aria-current','false');
    }
    return;
  }
  const title = isStructure ? '데이터 구조' : isExamples ? '시각화 쇼룸' : relationEditor ? '관계 편집' : workspace ? '연표 편집' : state.activeView+' 표';
  document.title = title + " · Dorms' Chronicle";
  exampleView.hidden = !isExamples;
  document.getElementById('structure-link').setAttribute('aria-current', isStructure || state.rawTable ? 'page' : 'false');
  document.getElementById('records-link').setAttribute('aria-current', workspace ? 'page' : 'false');
  document.getElementById('relation-editor-link').setAttribute('aria-current', relationEditor ? 'page' : 'false');
  document.getElementById('examples-link').setAttribute('aria-current', isExamples ? 'page' : 'false');
  if (isExamples) return;
  structureToc.hidden = !isStructure;
  document.getElementById('sidebar').hidden = isStructure || workspace || relationEditor;
  document.getElementById('btn-mobile-sidebar').hidden = isStructure || workspace || relationEditor;
  document.getElementById('btn-new-workspace-event').hidden = !workspace;
  mediaSidebar();
  document.getElementById('page-title').textContent = title;
  renderTableBreadcrumb(state.activeView, title);
  document.getElementById('table-tools').hidden = isStructure;
  const eventHeading = document.getElementById('workspace-events-heading');
  const search = document.getElementById('table-search');
  eventHeading.hidden = !workspace;
  document.getElementById('workspace-package-heading').hidden = !workspace;
  if (workspace && search.parentElement !== eventHeading) eventHeading.append(search);
  if (!workspace && search.parentElement === eventHeading) document.getElementById('table-tools').prepend(search);
  search.hidden = relationEditor;
  searchInput.placeholder = workspace ? '사건 검색' : '현재 시트 검색';
  searchInput.labels[0].textContent = searchInput.placeholder;
  if (!isStructure && !workspace && !relationEditor) renderSidebar();
  renderPackageFilter();
  renderWorkspaceCategories();
  updateDirtyControls();
  if (state.activeView === 'overview') {
    renderOverview();
  } else {
    renderFilteredView();
  }
}

const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('btn-mobile-sidebar');
const backdrop = document.getElementById('sidebar-backdrop');
const tabletLayout = matchMedia('(min-width: 1024px)');

function mediaSidebar() {
  sidebar.inert = !tabletLayout.matches && sidebarToggle.getAttribute('aria-expanded') !== 'true';
}
function closeMobileSidebar() {
  const wasOpen = sidebarToggle.getAttribute('aria-expanded') === 'true';
  sidebar.classList.add('-translate-x-full');
  backdrop.classList.add('hidden');
  sidebarToggle.setAttribute('aria-expanded','false');
  mediaSidebar();
  if (wasOpen) sidebarToggle.focus();
}
sidebarToggle.addEventListener('click', () => {
  sidebar.classList.remove('-translate-x-full');
  backdrop.classList.remove('hidden');
  sidebarToggle.setAttribute('aria-expanded','true');
  mediaSidebar();
  document.getElementById('btn-close-sidebar').focus();
});
tabletLayout.addEventListener('change', closeMobileSidebar);
document.getElementById('btn-close-sidebar').addEventListener('click', closeMobileSidebar);
backdrop.addEventListener('click', closeMobileSidebar);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && sidebarToggle.getAttribute('aria-expanded') === 'true' && !document.querySelector('dialog[open]')) closeMobileSidebar();
});

// 시트 불러오기
document.getElementById('btn-load-sheet').addEventListener('click', refreshSource);
document.getElementById('btn-retry-sync').addEventListener('click', refreshSource);

// CSV 다중 업로드
document.getElementById('csv-upload-input').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  try {
    const imported = await Promise.all(files.map(async file => {
      const tab = [...ALL_TABS].sort((a,b) => b.length-a.length).find(name => file.name.includes(name)) ||
        (ALL_TABS.includes(state.activeView) ? state.activeView : '');
      if (!tab) throw new Error('시트 이름이 들어간 CSV를 선택해 주세요.');
      const table = parseCSV(await file.text(), tab);
      validateTable(tab, table.headers, table.records);
      return [tab,table];
    }));
    if (new Set(imported.map(([tab]) => tab)).size !== imported.length) throw new Error('같은 시트의 CSV는 하나만 선택해 주세요.');
    const changedTables = new Map(imported);
    if (changedTables.has('사건') && hasEmbeddedCategories(changedTables.get('사건').headers) && !changedTables.has('사건_카테고리')) {
      const categories = changedTables.get('카테고리')?.records ?? state.data.카테고리;
      const links = deriveCategoryLinks(changedTables.get('사건').records,categories);
      imported.push(['사건_카테고리',links]);
      if (!changedTables.has('사건_패키지')) imported.push(['사건_패키지',{headers:DEFAULT_HEADERS.사건_패키지,
        records:eventPackageLinks({카테고리:categories,사건_카테고리:links.records})}]);
    }
    for (const [tab, table] of imported) {
      state.headers[tab] = table.headers;
      state.data[tab] = table.records;
    }
    state.dirtyCount++;
    saveToLocalStorage();
    renderAll();
    showToast(`${files.length}개 CSV를 브라우저 사본에 반영했습니다.`, 'success');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    e.target.value = '';
  }
});

// 전역 검색 & 패키지 필터 & 원본 ID 토글
const searchInput = document.getElementById('global-search');
const clearSearchBtn = document.getElementById('btn-clear-search');
document.getElementById('btn-new-workspace-event').addEventListener('click', () => openEditDrawer('사건', null, true));
document.getElementById('package-search').addEventListener('input',renderPackageFilter);
document.getElementById('category-search').addEventListener('input',renderWorkspaceCategories);
document.getElementById('workspace-categories').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.id === 'edit-filtered-category') {
    const index = state.data.카테고리.findIndex(row => row.카테고리ID === state.categoryFilter);
    if (index !== -1) openEditDrawer('카테고리',index);
    return;
  }
  const id = button.dataset.categoryFilter;
  if (!id && button.id !== 'clear-category-filter') return;
  const focusId = id || state.categoryFilter;
  state.categoryFilter = id || '';
  state.page = 1;
  renderWorkspaceCategories();
  renderFilteredView();
  document.querySelector(`[data-category-filter="${CSS.escape(focusId)}"]`)?.focus({preventScroll:true});
});
searchInput.addEventListener('input', (e) => {
  state.searchQuery = e.target.value.trim();
  state.page = 1;
  clearSearchBtn.hidden = !state.searchQuery;
  renderFilteredView();
});
clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  state.searchQuery = '';
  state.page = 1;
  clearSearchBtn.hidden = true;
  searchInput.focus();
  renderFilteredView();
});

document.getElementById('package-filter').addEventListener('click', event => {
  const button = event.target.closest('[data-package]');
  if (!button) return;
  state.packageFilter = button.dataset.package;
  state.page = 1;
  for (const option of button.parentElement.children) option.setAttribute('aria-pressed', String(option === button));
  renderWorkspaceCategories();
  renderFilteredView();
});

const mainView = document.getElementById('main-view');
mainView.addEventListener('input', event => {
  const input = event.target;
  const side = input.dataset.relationSearch;
  if (!side) return;
  state.relationSearch[side] = input.value;
  updateRelationNodes(input.closest('.relation-node-column'));
});

mainView.addEventListener('click', event => {
  if (state.activeView !== 'event-relations') return;
  const button = event.target.closest('button');
  if (!button) return;
  const edit = state.relationEdit;
  const {endpointId,endpointType,relationType,relationPackage,relationJump} = button.dataset;
  if (relationJump) {
    const heading = document.getElementById(relationJump);
    heading.closest('.relation-node-scroll').scrollTop = heading.parentElement.offsetTop;
    heading.focus({preventScroll:true});
  } else if (button.matches('[data-endpoint-relations]')) {
    openEndpointRelations(button);
  } else if (endpointId) {
    const side = button.closest('[data-relation-side]').dataset.relationSide;
    edit[side] = {type:endpointType,id:endpointId};
    edit.packageId = '';
    setRelationNodeFocus(button);
    renderRelationSelection();
  } else if (relationType || relationPackage) {
    if (relationType) edit.type = relationType;
    else edit.packageId = relationPackage;
    renderRelationSelection();
    document.querySelector(`[data-relation-${relationType ? 'type' : 'package'}="${CSS.escape(relationType || relationPackage)}"]`).focus({preventScroll:true});
  } else if (button.matches('[data-save-relation-sheet]')) {
    void saveRelationToSheet();
  } else if (button.matches('[data-relation-save]')) {
    saveRelation();
  } else if (button.matches('[data-relation-reset]')) {
    clearRelationSelection();
    renderRelationSelection();
    document.querySelector('[data-relation-type]').focus({preventScroll:true});
  }
});

function setRelationNodeFocus(button) {
  const list = button.closest('.relation-node-list');
  const previous = list.querySelector('[data-endpoint-id][tabindex="0"]');
  previous.tabIndex = -1;
  if (previous.nextElementSibling) previous.nextElementSibling.tabIndex = -1;
  button.tabIndex = 0;
  if (button.nextElementSibling) button.nextElementSibling.tabIndex = 0;
}

mainView.addEventListener('keydown', event => {
  const button = event.target.closest('[data-endpoint-id]');
  if (!button || !['ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
  event.preventDefault();
  const buttons = [...button.closest('.relation-node-list').querySelectorAll('[data-endpoint-id]')];
  const index = buttons.indexOf(button);
  const next = event.key === 'Home' ? buttons[0] : event.key === 'End' ? buttons.at(-1) :
    buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length];
  setRelationNodeFocus(next);
  next.focus();
});

// 변경사항 되돌리기
document.getElementById('btn-revert-changes').addEventListener('click', async () => {
  const ok = await showConfirm('변경사항 되돌리기', '임시 저장된 모든 수정 내역을 취소하고 원본 데이터로 되돌리시겠습니까?');
  if (!ok) return;
  state.data = structuredClone(state.originalData);
  state.headers = structuredClone(state.originalHeaders);
  state.dirtyCount = 0;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* 현재 사본은 이미 초기화됨 */ }
  renderAll();
  showToast('원본 데이터로 되돌렸습니다.', 'info');
});

// JSON 백업 & 복원
document.getElementById('btn-json-export').addEventListener('click', () => {
  const payload = { exportedAt: new Date().toISOString(), headers: state.headers, data: state.data };
  downloadFile('timeline-db-backup.json', JSON.stringify(payload, null, 2), 'application/json');
  showToast('전체 표를 JSON으로 내려받았습니다.', 'success');
});
document.getElementById('json-import-input').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    restoreDraft(parsed.data, parsed.headers);
    state.dirtyCount++;

    saveToLocalStorage();
    renderAll();
    showToast('JSON 백업을 성공적으로 복원했습니다.', 'success');
  } catch (err) {
    showToast('JSON 복원 실패: ' + err.message, 'error');
  }
  e.target.value = '';
});

window.addEventListener('resize', () => {
  if (state.activeView === 'overview') requestAnimationFrame(drawHierarchyLines);
});

state.originalData = Object.fromEntries(ALL_TABS.map(tab => [tab, structuredClone(SAMPLE_DATA[tab] || [])]));
state.originalData.사건_패키지 = eventPackageLinks(SAMPLE_DATA);
state.originalHeaders = Object.fromEntries(ALL_TABS.map(tab => [tab,[...new Set([...DEFAULT_HEADERS[tab], ...state.originalData[tab].flatMap(Object.keys)])]]));
state.data = structuredClone(state.originalData);
state.headers = structuredClone(state.originalHeaders);
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (Number.isSafeInteger(saved?.dirtyCount) && saved.dirtyCount > 0) {
    restoreDraft(saved.data, saved.headers);
    state.dirtyCount = saved.dirtyCount;
  }
} catch { /* The sheet reloads when a local draft is unavailable. */ }
document.getElementById('open-sheet').href = SHEET_CONFIG.url;
document.getElementById('edit-drawer').addEventListener('close', () => { state.editing = null; });
window.addEventListener('hashchange', applyRoute);
applyRoute();
if (googleOAuthClientId) loadGoogleIdentity();
void refreshSource();
