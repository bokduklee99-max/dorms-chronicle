const sheetScope = 'https://www.googleapis.com/auth/spreadsheets';
let credentials;

export function loadGoogleIdentity() {
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  document.head.append(script);
}

async function studioSession(payload, token) {
  try {
    const response = await fetch('/api/studio-session', {
      method:'POST', credentials:'same-origin', cache:'no-store', redirect:'error',
      headers:{'Content-Type':'application/json', ...(token ? {Authorization:'Bearer ' + token} : {})},
      body:JSON.stringify(payload), signal:AbortSignal.timeout(8000)
    });
    if (response.status === 200) return await response.json();
  } catch { /* The current connection still works if the browser cannot remember it. */ }
}

export function rememberedAccount(clientId, book) {
  if (!book) return '';
  try { return localStorage.getItem('chronicle.studio.account.' + clientId + '.' + book) || ''; }
  catch { return ''; }
}

export function rememberDraftAccount(clientId, book, token) {
  if (!credentials?.subject || credentials.token !== token) return;
  try { localStorage.setItem('chronicle.studio.account.' + clientId + '.' + book, credentials.subject); }
  catch { /* Private browsing can disable storage. */ }
}

export function forgetDraftAccount(clientId, book, token) {
  try { localStorage.removeItem('chronicle.studio.account.' + clientId + '.' + book); }
  catch { /* Storage may already be unavailable. */ }
  forgetSheetToken(token);
}

export function currentSheetToken(subject = '') {
  if (subject && credentials?.subject !== subject) return '';
  return credentials?.expiresAt > Date.now() ? credentials.token : '';
}

export async function restoreDraftToken(clientId, book) {
  const subject = rememberedAccount(clientId, book);
  const token = currentSheetToken(subject);
  if (token || !subject) return token;
  const saved = await studioSession({action:'restore', subject});
  if (saved?.subject !== subject || !saved.token || !(saved.expiresAt > Date.now())) return '';
  credentials = saved;
  return saved.token;
}

export function authorizeRelationSheet(clientId, {studio=false, subject='', choose=false} = {}) {
  if (!clientId) throw new Error('Google 시트 저장을 사용하려면 앱의 OAuth 웹 클라이언트 ID를 연결해 주세요.');
  const token = currentSheetToken(subject);
  if (token && !choose) return Promise.resolve(token);
  const oauth = globalThis.google?.accounts?.oauth2;
  if (!oauth) throw new Error('Google 인증을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
  const hint = choose ? '' : subject;
  return new Promise((resolve,reject) => {
    const client = oauth.initTokenClient({
      client_id:clientId,
      scope:studio ? sheetScope + ' openid' : sheetScope,
      include_granted_scopes:false,
      ...(hint ? {login_hint:hint} : {}),
      error_callback:() => reject(new Error('Google 인증 창이 열리지 않았거나 닫혔어요. 팝업을 허용한 뒤 다시 시도해 주세요.')),
      callback:async response => {
        if (!response.access_token || !oauth.hasGrantedAllScopes(response,sheetScope)) {
          reject(new Error('Google에서 스프레드시트 편집 권한을 허용해 주세요.'));
          return;
        }
        const token = response.access_token;
        const expiresAt = Date.now() + (Number(response.expires_in) - 60) * 1000;
        const saved = studio && await studioSession({action:'remember', expiresAt}, token);
        credentials = {token, expiresAt, subject:saved?.subject || ''};
        resolve(token);
      }
    });
    client.requestAccessToken({prompt:hint ? '' : 'select_account'});
  });
}

export function forgetSheetToken(token = credentials?.token) {
  if (credentials?.token !== token) return;
  if (credentials?.subject) void studioSession({action:'forget'}, token);
  credentials = undefined;
}
