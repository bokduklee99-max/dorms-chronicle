import {renderSpaceMap} from '../assets/space-preview-map.js';

// 공개 시트를 읽기 전에도 같은 네 행으로 대표 사례를 보여준다.
const treatyExample = {
  사건:[{사건ID:'E157',사건명:'독일 통일을 국제적으로 인정하는 ‘2+4조약’ 체결.',날짜:'1990-09-12'}],
  사건_공간:[{사건ID:'E157',공간ID:'geo_moscow'}],
  공간:[{공간ID:'geo_moscow',공간명:'모스크바',지도참조키:'geo_moscow'}],
  지도도형:[{지도참조키:'geo_moscow',도형유형:'point',기준시점:'모스크바 대표점',경도:'37.6173',위도:'55.7558',
    파일경로:'assets/event-geometry/place-points.geojson',외부도형ID:'geo_moscow'}]
};

export function renderGeographyTrace(container, data, useExample, escapeHtml, openSheet) {
  const source = useExample ? treatyExample : data;
  const event = source.사건.find(row => row.사건ID === 'E157');
  const link = event && source.사건_공간.find(row => row.사건ID === event.사건ID && row.공간ID === 'geo_moscow');
  const space = link && source.공간.find(row => row.공간ID === link.공간ID);
  const shape = space?.지도참조키 && source.지도도형.find(row => row.지도참조키 === space.지도참조키);
  const e = escapeHtml;
  const header = `<header class="geo-trace-heading"><h3>2+4조약의 체결 장소 찾기</h3>
    ${event?.날짜 ? `<time>${e(event.날짜)}</time>` : ''}</header>`;
  if (!shape) {
    container.innerHTML = header + '<p class="geo-empty">현재 자료에서 2+4조약과 모스크바의 지도 연결을 찾을 수 없습니다.</p>';
    return;
  }

  const steps = [
    {tab:'사건',title:event.사건명,row:event,fields:['사건ID','날짜']},
    {tab:'사건_공간',title:'체결 장소 연결',row:link,fields:['사건ID','공간ID']},
    {tab:'공간',title:space.공간명,row:space,fields:['공간ID','지도참조키']},
    {tab:'지도도형',title:shape.기준시점 || space.공간명,row:shape,fields:['지도참조키','도형유형','경도','위도','파일경로','외부도형ID']}
  ];
  const sheetButton = tab => `<button type="button" class="geo-sheet-link" data-trace-table="${tab}">${tab} ↗</button>`;
  container.innerHTML = header + `<div class="geo-trace-layout">
    <ol class="geo-trace-steps" aria-label="시트 연결 순서">${steps.map(({tab,title,row},index) =>
      `<li><div class="geo-trace-stop"><strong>${e(title)}</strong>${sheetButton(tab)}</div>
      ${index < steps.length - 1 ? `<div class="geo-trace-key"><span>${steps[index+1].fields[0]}</span><code>${e(row[steps[index+1].fields[0]])}</code></div>` : ''}</li>`).join('')}</ol>
    <figure class="geo-trace-preview"><div class="space-map"></div>
      <figcaption><div><span>체결 장소</span><strong>${e(space.공간명)}</strong></div>
        ${shape.경도 && shape.위도 ? `<p>경도 ${e(shape.경도)}<br>위도 ${e(shape.위도)}</p>` : ''}</figcaption></figure>
    </div>
    <details class="geo-trace-values"><summary>연결된 행의 열과 값</summary><div>${steps.map(({tab,row,fields}) =>
      `<section>${sheetButton(tab)}<dl>${fields.filter(field => row[field]).map(field =>
        `<div><dt>${field}</dt><dd>${e(row[field])}</dd></div>`).join('')}</dl></section>`).join('')}</div></details>`;
  void renderSpaceMap(container.querySelector('.space-map'),space,shape,{date:event.날짜,pointWidth:42});
  container.onclick = event => {
    const button = event.target.closest('[data-trace-table]');
    if (button) openSheet(button.dataset.traceTable);
  };
}
