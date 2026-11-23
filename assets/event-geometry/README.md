# 사건 지도 도형 출처

- `east-asia-borders-1945.geojson`, `korea-borders-1950.geojson`, `caribbean-borders-1962.geojson`, `europe-borders-1973.geojson`은 사건일 기준 CShapes 2.1 영토 폴리곤의 공유 경계에서 추출한 육상 국경선이다. 1945년과 1950년 한반도 내부선은 CShapes가 같은 경계를 반복해 담고 있어 제외했다. 1950년 지도에는 통일부 자료의 38선을 사건 도형으로 표시한다. CC BY-NC-SA 4.0. [CShapes](https://icr.ethz.ch/data/cshapes/beta.html) · [통일부 DMZ 평화지도](https://peacemap.universe.go.kr/main.html)
- `gyeongin-admin-1910.geojson`과 `seoul-admin-1919-1926.geojson`은 국사편찬위원회 복원 행정구역에서 추출한 부·군 사이 경계다. 서울 주변에서 1919년과 1926년의 경계선이 일치한다. 공공누리 제1유형. [역사지리정보DB](https://hgis.history.go.kr/pro_g1/dataset.do#tab05)
- `shanghai-police-1928-1934.geojson`은 Christian Henriot와 Isabelle Durand의 상하이 공동조계 경찰구역 Shapefile을 WGS84로 변환한 경계선이다. CC BY 4.0. [Virtual Shanghai 원본](https://www.virtualshanghai.net/Data/Tables?ID=224)

- `gyeongin-1899.geojson`은 국사편찬위원회 철도망 공간데이터의 첫 개통 구간 `경인선_18990918_19000707`을 옮겼다. 인천역과 노량진 가설정거장 좌표도 같은 GeoPackage의 역 레이어에서 가져왔다. 공공누리 제1유형. [역사지리정보DB 개방데이터셋](https://hgis.history.go.kr/pro_g1/dataset.do#tab14) · [국가기록원 개통 기록](https://theme.archives.go.kr/next/railroad/page2.do)
- `gyeongin-land-1910.geojson`은 1910년 5월 10일 국사편찬위원회 도 단위 복원 구역을 인천·서울 주변으로 잘라 병합한 육지 배경이다. 경계를 0.0002도 허용 오차로 단순화한 뒤 두 역과 철도 노선이 모두 육지에 들어가는 것을 확인했다. 공공누리 제1유형. [역사 행정구역 공간데이터](https://hgis.history.go.kr/pro_g1/dataset.do#tab05)
- `gyeongseong-1919.geojson`은 국사편찬위원회의 경성부 행정구역 복원 도형(`fid=683`, 1914-03-01~1936-03-31)이다. 3·1 운동 예시에서 서울의 당시 행정구역을 보여 준다. 공공누리 제1유형. [역사지리정보DB 개방데이터셋](https://hgis.history.go.kr/pro_g1/dataset.do#tab05)
- `seoul-land-1919-1926.geojson`은 1919년 3월 1일과 1926년 12월 28일의 국사편찬위원회 도 단위 복원 자료에서 서울·인천 일대 육지를 추출한 것이다. 이 범위에서 두 시점의 외곽이 같아 도형 파일을 공유한다. 나석주 의거 지도에는 같은 자료의 경성부 경계도 표시한다. 공공누리 제1유형. [역사지리정보DB 개방데이터셋](https://hgis.history.go.kr/pro_g1/dataset.do#tab05)
- `germany-1973.geojson`은 Schvitz 외 CShapes 2.1에서 1973년 서독(`gwcode=260`)과 동독(`gwcode=265`)의 국경을 추출한 파일이다. 각 코드로 피처 ID를 붙였다. CC BY-NC-SA 4.0. [CShapes 원본과 이용 조건](https://icr.ethz.ch/data/cshapes/beta.html)
- `japan-land.geojson`, `caribbean-land.geojson`, `europe-land-1973.geojson`은 각 사건일(1945-08-15, 1962-10-22, 1973-09-18)에 적용되는 CShapes 2.1 영토를 지역별로 잘라 합친 육지 배경이다. 사건 도형과 배경은 같은 원본을 사용한다. CC BY-NC-SA 4.0. [CShapes 원본과 이용 조건](https://icr.ethz.ch/data/cshapes/beta.html) · [동서독 유엔 가입일](https://digitallibrary.un.org/record/651552)
- `shanghai-land.geojson`과 `korea-land.geojson`은 Wessel·Smith의 GSHHG 2.3.7 고해상도 Shapefile에서 육지와 호수를 지역별로 추출하고 단순화한 지형 참고자료다. GNU LGPL 3 이상. [배포처와 원본 파일](https://www.soest.hawaii.edu/wessel/gshhg/) · [데이터 이용 조건](gshhg-license.txt) · [LGPL 3](gshhg-lgpl-3.txt)

- `blankmap-world.svg`는 Canuckguy와 공동 편집자들이 공개 도메인으로 배포한 SVG 원본이다. [Wikimedia Commons 원본과 이용 조건](https://commons.wikimedia.org/wiki/File:BlankMap-World.svg)
- `berlin-wall-map.svg`는 Ericmetro가 제작하고 Hohum이 수정한 SVG 원본이다. 원본 자료는 ChrisO와 Stefan-Xp의 작업에 기반한다. 원본에 명시된 CC BY-SA 3.0을 적용하며 내려받은 파일을 수정하지 않았다. [Wikimedia Commons 원본과 저작자](https://commons.wikimedia.org/wiki/File:Berlin-wall-map_en.svg) · [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)
- `berlin-wall-1989.geojson`은 베를린 공개데이터 Grenzmauer 레이어의 118개 선을 WGS84 좌표로 내려받아 하나의 MultiLineString으로 묶은 것이다. 1989년 4월 25일 항공사진 기준이다. [Berlin Open Data](https://daten.berlin.de/datensaetze/verlauf-der-berliner-mauer-1989-wfs-3dcda64c)
- 사건 지도와 베를린 재생 화면이 공유하는 `berlin-background.js`에는 현대 베를린 시 경계와 슈프레강·하펠강 등 주요 수역을 단순화해 담았다. 당시 동·서베를린 표기는 베를린 장벽 교육 지도의 구역을 참고했다. [ALKIS 도시 경계](https://daten.berlin.de/datensaetze/alkis-berlin-landesgrenze-wfs-07b1347b) · [베를린 수역](https://daten.berlin.de/datensaetze/gewasserverzeichnis-wfs-353f1716) · [동·서베를린 교육 지도](https://www.berlin.de/politische-bildung/publikationen/materialien/exkursionsmaterial_mauergedenkstaette_kursleitende.pdf)
- `cuba.geojson`은 Schvitz 외 CShapes 2.1에서 1962년 10월 22일에 해당하는 쿠바 국가 면(`gwcode=40`, 1902-05-20~2023-12-31)을 추출하고 지도 연결 ID `CUB`를 붙인 파일이다. CC BY-NC-SA 4.0. [CShapes 원본과 이용 조건](https://icr.ethz.ch/data/cshapes/beta.html)
- `japan.geojson`은 Schvitz 외 CShapes 2.1의 일본(`gwcode=740`) 도형에 연결 ID `JPN`을 붙인 파일이다. 이 판본은 1886~2023년 일본 도형을 단일 행으로 제공한다. 이 사례에서는 일본 열도의 위치를 보여 준다. CC BY-NC-SA 4.0. [CShapes 원본과 이용 조건](https://icr.ethz.ch/data/cshapes/beta.html)
- `korea-38th-parallel.geojson`은 통일부 DMZ 평화지도 WFS의 `boundary_38line.1`에서 원본 MultiLineString을 그대로 옮기고 지도 연결 ID `KR-38N`을 붙인 파일이다. 북위 38°, 동경 124.2°~129.8°의 좌표 57개를 포함한다. 이 레이어의 공개 재배포 이용 조건은 확인되지 않았다. [원본 좌표](https://peacemap.universe.go.kr/geoserver/dmz/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=dmz%3Aboundary_38line&outputFormat=application%2Fjson&srsName=EPSG%3A4326) · [1950년 유엔 지도](https://digitallibrary.un.org/record/704714/files/A_1350-EN.pdf#page=51)

- `berlin-airlift.jpg`는 템펠호프 공항에서 공수 물자를 하역하는 미 공군 사진이다. [미 국무부 역사국 사진과 설명](https://history.state.gov/milestones/1945-1952/berlin-airlift) · [비스바덴과 템펠호프 간 공수 기록](https://www.usafe.af.mil/News/Article-Display/Article/255483/wiesbaden-celebrates-berlin-airlift-anniversary/)

- `germany-zones-1945.geojson`은 André Ourednik의 1945년 역사 지도에서 미국·영국·프랑스·소련의 독일 점령구역 네 도형을 추출해 단순화한 자료다. 베를린 봉쇄 장면에서 전국 단위의 점령구역을 표시한다. [1945년 원본](https://github.com/aourednik/historical-basemaps/blob/master/geojson/world_1945.geojson) · [저장소 라이선스](https://github.com/aourednik/historical-basemaps/blob/master/LICENSE)
- `east-asia-1938.geojson`과 `pacific-1960.geojson`은 같은 역사 지도의 면을 합치고 단순화한 지형 배경이다. 동아시아 지도에는 Natural Earth 1:50m의 창장강과 황허강을 추가했다. [1938년 원본](https://github.com/aourednik/historical-basemaps/blob/master/geojson/world_1938.geojson) · [1960년 원본](https://github.com/aourednik/historical-basemaps/blob/master/geojson/world_1960.geojson) · [Natural Earth 하천](https://www.naturalearthdata.com/downloads/50m-physical-vectors/50m-rivers-lake-centerlines/)

- 지도도형 시트에 등록된 `world-연도.svg`는 시트가 지정한 Historical Basemaps의 해당 연도 국가·지역 폴리곤을 단순화한 SVG이다. [André Ourednik 원본 데이터](https://github.com/aourednik/historical-basemaps/tree/master/geojson) · [라이선스](historical-basemaps-license.txt)
- `korea-guide-1920.svg`는 지도참조키 `korea_guide_1920`의 한반도 확대 지도다. 기존 `korea-land.geojson`의 GSHHG 해안선을 잘라 단순화하고 Historical Basemaps의 1920년 인접 도형이 공유하는 경계선을 겹쳤다. [GSHHG](https://www.soest.hawaii.edu/wessel/gshhg/) · [1920년 지도](https://github.com/aourednik/historical-basemaps/blob/master/geojson/world_1920.geojson)

- `place-points.geojson`은 지도도형 시트의 점을 묶은 GeoJSON이다. 각 Feature의 `id`는 지도참조키이며 좌표 순서는 경도, 위도다. 공간 상세 지도는 지도도형의 `지도데이터URL`에 담긴 GeoJSON을 읽고, 파일로 등록된 점은 `파일경로`와 `외부도형ID`로 찾는다. 번들 지도를 갱신할 때에는 시트의 점과 이 파일을 함께 갱신한다.

- `independence-asia.svg`, `independence-europe.svg`, `independence-americas.svg`는 Schvitz 외 CShapes 2.1의 Gleditsch–Ward 판본에서 1910–1945년과 겹치는 영토 폴리곤을 권역별로 잘라 0.035도 허용오차로 단순화한 자료다. 각 경로의 `start`, `end`, `code`는 원본의 유효 시작일·종료일과 국가·지역 코드다. 전선과 점령군의 이동은 이 자료의 범위 밖이다. [CShapes 원본](https://icr.ethz.ch/data/cshapes/) · [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)
- `colonial-korea.svg`는 국사편찬위원회의 1910-05-10~1945-08-14 역사적 행정구역 GIS 자료에서 도 단위와 평양부 폴리곤을 추출했다. 지명과 적용 기간을 보존하고 도는 0.009도, 평양부는 0.0003도로 단순화했다. [역사지리정보DB · 공공누리 제1유형](https://hgis.history.go.kr/pro_g1/dataset.do#tab05)
- `east-asia-regional-rivers.geojson`은 Natural Earth 1:10m 하천을 창장강 하류·만주와 연해주·평양·간토 일대로 잘라 단순화한 지형 참고도다. `honshu-coast.geojson`은 기존 GSHHG 육지 자료에서 혼슈 일대를 추출했다. [Natural Earth 하천](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-rivers-lake-centerlines/) · [GSHHG 이용 조건](gshhg-license.txt)
- 평양 확대 화면은 같은 국사편찬위원회 자료에서 해당 날짜에 유효한 주변 군 경계도 표시한다. 광역 지도의 회색 보조 도시 중 `historical-map-landmarks.geojson`에 담긴 도시는 Natural Earth 1:10m의 대표점이다. 사건의 실제 지점은 시트에 등록된 도형을 사용한다. [Natural Earth 도시](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-populated-places/)

공간 미리보기의 `context/*.json`은 각 지역의 표시 범위로 자른 경위도 벡터다. 육지·호수·하천·주변 도시는 [Natural Earth 1:10m](https://www.naturalearthdata.com/downloads/10m-physical-vectors/)의 지형 및 도시 참고 자료다. 물길과 해안선은 지리적 위치를 설명한다. 경인 지역은 위에 기재한 국사편찬위원회 1910년 복원 육지 및 1899년 경인선 자료를 사용한다. 중동·남아시아 등 여섯 참고도에는 [CShapes 2.1](https://icr.ethz.ch/data/cshapes/)의 해당 기준일에 유효한 국가 경계를 담았다(CC BY-NC-SA 4.0). 권역 지도는 그 범위 안의 국가를 표시한다.

`context/iron-curtain.svg`와 `context/china-proper.svg`는 시트에 등록된 발췌 도형의 배경을 원래 투영에서 볼 수 있도록 원도 전체를 담았다. [철의 장막 원도 · Sémhur 외](https://commons.wikimedia.org/wiki/File:Iron_Curtain_map.svg), [1940년대 중국 관내 원도 · Milenioscuro, Soumya-8974](https://commons.wikimedia.org/wiki/File:China_Proper_1940s.svg). 이용 조건과 저작자 표기는 각 원본 설명을 따른다.

냉전 제작실의 `world-1980.geojson`은 시트가 지정한 1980년 판본의 배포 URL이 404여서 CShapes 2.1 GW에서 1980-01-01 유효 경계를 추출한 대체 배경이다. `cold-war-territories.geojson`에는 1949-04-04 NATO 창립 12개 회원국의 본국과 CShapes의 1949-12-08 대만 경계를 담았다. 두 파일은 원본을 0.09도 허용 오차로 단순화하고 좌표를 소수 셋째 자리로 반올림했다. [Schvitz 외, CShapes](https://icr.ethz.ch/data/cshapes/) · [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) · [NATO 창립 회원국](https://www.nato.int/en/about-us/organization/nato-member-countries)

지도 제작실의 시대별 배경은 시트의 세계지도 판본에 맞춘 André Ourednik의 Historical Basemaps(커밋 4b5039e50d8d2464b065bd76ad6086cd4597108d)와 위의 CShapes 1980년 판본을 사용한다. 편집기에 맞춰 경로를 단순화하고 메르카토르 좌표로 투영했다. 고대 판본에는 문화권의 범위도 포함된다. [Historical Basemaps 원본](https://github.com/aourednik/historical-basemaps) · [GPL-3.0](historical-basemaps-license.txt)

현대 국경과 시·도·주 표시는 Natural Earth 1:10m Admin 0 육상 경계 및 Admin 1 주·도 경계선(v5.1.0)을 0.018도 허용 오차로 단순화한 자료다. 한국·북한·중국·일본·몽골·대만의 내부 경계는 같은 자료의 Admin 1 폴리곤(v5.1.1)에서 인접한 두 구역이 공유하는 선만 추출하여 0.008도 허용 오차로 단순화했다. 시대별 배경을 사용할 때는 그 판본의 영역선을 국경으로 사용한다. 현대 행정경계는 별도로 켤 수 있다. [Natural Earth](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/) · [퍼블릭 도메인](https://www.naturalearthdata.com/about/terms-of-use/)

남아시아·동남아시아 백지도는 Natural Earth 1:10m 육지 v5.1.1을 사용한다. 육지와 실제 해안선을 따로 잘라 그려 지도 자료의 사각 테두리가 해안선으로 표시되지 않도록 했다. [Natural Earth 육지](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-land/)

전 지구 백지도의 대륙 윤곽은 Natural Earth 1:50m 육지 v4.1.0에서 추출했다. 날짜변경선에서 나뉜 폴리곤의 절단면과 투영 범위 끝에는 해안선을 그리지 않는다. [Natural Earth 육지](https://www.naturalearthdata.com/downloads/50m-physical-vectors/50m-land/)
