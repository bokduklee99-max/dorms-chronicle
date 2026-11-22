const sheetScope = 'https://www.googleapis.com/auth/spreadsheets';
let credentials;

export function loadGoogleIdentity() {
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  document.head.append(script);
}

export function authorizeRelationSheet(clientId, loginHint='noamchomsky1571@gmail.com') {
  if (!clientId) throw new Error('Google 시트 저장을 사용하려면 앱의 OAuth 웹 클라이언트 ID를 연결해 주세요.');
  if (credentials?.expiresAt > Date.now()) return Promise.resolve(credentials.token);
  const oauth = globalThis.google?.accounts?.oauth2;
  if (!oauth) throw new Error('Google 인증을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
  return new Promise((resolve,reject) => {
    const client = oauth.initTokenClient({
      client_id:clientId,
      scope:sheetScope,
      include_granted_scopes:false,
      ...(loginHint ? {login_hint:loginHint} : {}),
      error_callback:() => reject(new Error('Google 인증 창이 열리지 않았거나 닫혔어요. 팝업을 허용한 뒤 다시 시도해 주세요.')),
      callback:response => {
        if (!response.access_token || !oauth.hasGrantedAllScopes(response,sheetScope)) {
          reject(new Error('Google에서 스프레드시트 편집 권한을 허용해 주세요.'));
          return;
        }
        credentials = {token:response.access_token,expiresAt:Date.now() + (Number(response.expires_in) - 60) * 1000};
        resolve(credentials.token);
      }
    });
    client.requestAccessToken({prompt:''});
  });
}

export function forgetSheetToken(){credentials=undefined;}
