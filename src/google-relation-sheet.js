import {relationConnects} from './data-dashboard-source.js';

import {forgetSheetToken} from '../assets/google-sheet-auth.js';
export {authorizeRelationSheet,loadGoogleIdentity} from '../assets/google-sheet-auth.js';

export function matchesSheetRelation(row, selection) {
  return relationConnects(row,selection.from,selection.to) &&
    String(row.관계유형 ?? '').trim().toLowerCase() === selection.type &&
    (!row.패키지ID || row.패키지ID === selection.packageId);
}

export async function saveToGoogleRelationSheet(config, token, row, selection, request = fetch) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.id)}`;
  async function post(method, body) {
    const unverifiable = () => new Error('Google 시트의 저장 여부를 확인하지 못했어요. 다시 시도하면 원본에서 먼저 확인합니다.');
    let response;
    try {
      response = await request(url + method,{
        method:'POST',
        headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
        body:JSON.stringify(body),
        signal:AbortSignal.timeout(15000)
      });
    } catch { throw unverifiable(); }
    if (response.status === 401) {
      forgetSheetToken();
      throw new Error('Google 인증이 만료됐어요. 저장을 다시 눌러 인증해 주세요.');
    }
    if (response.status === 403) throw new Error('Google 계정의 시트 편집 권한과 프로젝트의 Google Sheets API 사용 설정을 확인해 주세요.');
    if (!response.ok) throw unverifiable();
    return response.json();
  }
  const dataFilter = {gridRange:{sheetId:config.relationSheetId}};
  const result = await post('/values:batchGetByDataFilter',{dataFilters:[dataFilter],valueRenderOption:'UNFORMATTED_VALUE'});
  const values = result.valueRanges?.[0]?.valueRange?.values;
  const headers = values?.[0]?.map(value => String(value).trim()) || [];
  const namedHeaders = headers.filter(Boolean);
  if (new Set(namedHeaders).size !== namedHeaders.length ||
      ['관계ID','패키지ID','출발유형','출발ID','도착유형','도착ID','관계유형','검토상태'].some(field => !headers.includes(field))) {
    throw new Error('원본 관계 탭의 열 이름을 확인해 주세요.');
  }
  const existing = values.slice(1).map(cells => Object.fromEntries(headers.flatMap((field,index) =>
    field ? [[field,String(cells[index] ?? '')]] : []))).find(entry => matchesSheetRelation(entry,selection));
  if (existing) return {row:existing,created:false};

  await post(':batchUpdate',{requests:[{appendCells:{
    sheetId:config.relationSheetId,
    fields:'userEnteredValue',
    rows:[{values:headers.map(field => ({userEnteredValue:{stringValue:field && Object.hasOwn(row,field) ? row[field] : ''}}))}]
  }}]});
  return {row,created:true};
}
