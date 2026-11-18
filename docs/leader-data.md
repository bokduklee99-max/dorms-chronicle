# 관련국의 재임자

2026-11-18: 기존 16건에 출처를 확인한 재임 75건을 추가했다. 현재 12개국 80명, 91개 재임이다. Google Sheets `재임기간` A18:T92에 추가했고 공개 `web_feed`에서 91건을 다시 읽어 로컬 스냅샷에 반영했다. 기존 사건·국가·원본 지도자 태그는 바꾸지 않았다.

## 표시 규칙

- 사건의 `actorIds`와 국가 `actor_id`가 연결되고 `actor_type=state`인 국가만 조회한다. 미국·소련도 사건에 연결되지 않으면 나오지 않는다. 국제기구와 정당은 제외한다.
- 기존 `leadersDuring` 날짜 겹침 조회를 사용한다. 국가에 속하고 검증된 재임만 표시하며, 같은 국가·같은 인물의 동시 직위는 블록 하나에 모은다.
- 연·월 단위 날짜를 일자로 확정하지 않는다. 사건 또는 재임이 부분 날짜이면 교체 전후 인물이 함께 나올 수 있다. 이는 동시 집권을 단정하는 표시가 아니다.
- 주석·대통령, 총리, 당수, 중앙군사위원회 주석을 직위명으로 구분한다. 비공식 최고지도자를 일괄 대통령으로 바꾸지 않는다.
- 재임 데이터가 없는 관련국은 미등록으로 표시한다. 인물을 추측하거나 다른 나라의 재임자로 대체하지 않는다.
- 국기는 국가 식별용이다. 소련·동독의 역사적 국기를 별도로 사용하되, 미국의 별 개수 같은 모든 시기별 변형을 복원하는 자료는 아니다. 자산 출처는 `assets/flags/README.md`.

## 조사 범위와 출처

재임 정보는 미국·소련·중국·중화민국·대한민국·북한·영국·프랑스·서독·동독·일본·쿠바를 보강했다. 냉전 시기의 주요 직위를 중심으로 했으며, 각 국가의 모든 권한대행과 모든 직위를 망라한 데이터베이스는 아니다. 중국의 1987년 자오쯔양 대행 기간은 정식 재임과 분리했다. 장제스의 1949년 사임~1950년 복귀 간 공백도 보존했다.

각 행의 설명에 출처 URL을 보존하고 앱의 직위 옆 링크로 연결한다. 주요 출처:

- 일본 총리관저: https://www.kantei.go.jp/jp/rekidainaikaku/index.html — 연속된 동일인 내각은 합치고 비연속 재임은 분리.
- 영국 정부: https://www.gov.uk/government/history/past-prime-ministers — 출처 목록의 연도 정밀도 유지. 선거일과 취임일을 혼동하지 않음.
- 독일 연방총리실: https://www.bundeskanzler.de/resource/blob/1832978/1850152/db090779213d936d31dd70276f402384/kanzler-pdf-data.pdf?download=1
- 한국 대통령기록관: https://dams.pa.go.kr/dams/DOCUMENT/2011/07/08/DOC/SRC/0104201107085549100055491017524.PDF — 월 단위 재임.
- 북한 김일성 연보: https://world.kbs.co.kr/special/northkorea/contents/archives/supreme_leader/kim_il_sung.htm?lang=e — 수상·국가주석을 별개 직위로 구분.
- 중국공산당 역대 책임자: https://cpc.people.com.cn/GB/64162/4507434.html
- 중국 정협 자오쯔양: https://www.cppcc.gov.cn/2011/09/28/ARTI1317197350703283.shtml
- 중국 정협 덩샤오핑: https://www.cppcc.gov.cn/zxww/2012/07/03/ARTI1341300716750109.shtml
- 중화민국 총통부: https://english.president.gov.tw/Page/81 및 개별 인물 연보.
- 프랑스 엘리제궁: https://www.elysee.fr/la-presidence/les-presidents-de-la-republique 및 개별 인물 연보.
- 독일 외무부: https://www.auswaertiges-amt.de/resource/blob/216876/966ea5026673b669432fead668a0eb31/dashausamwerderschenmarkt-data.pdf — SED 지도자와 국가평의회 의장을 구분.
- 상파울루대학 카스트로 전기: https://sites.usp.br/portalatinoamericano/en/fidel-castro — 총리·국가평의회 의장 구분.
- FDR 대통령도서관: https://www.fdrlibrary.org/fdr-biography
- 스탈린: https://www.pbs.org/wgbh/commandingheights/shared/minitext/prof_josephstalin.html 및 https://wwws.loc.gov/exhibits/archives/intn.html
