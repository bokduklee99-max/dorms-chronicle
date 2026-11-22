import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/studio-session.js';
import {createServer} from 'node:http';
import {localStudioSession} from '../scripts/local-studio-session.mjs';

test('local preview remembers and restores a Google connection across HTTP requests on loopback',async t=>{
 let middleware;
 localStudioSession.configurePreviewServer({middlewares:{use(fn){middleware=fn;}}});
 const server=createServer((req,res)=>middleware(req,res,()=>res.writeHead(404).end()));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const origin='http://127.0.0.1:'+server.address().port;
 const request=globalThis.fetch;
 t.mock.method(globalThis,'fetch',async(url,{headers})=>{
  assert.equal(url,'https://openidconnect.googleapis.com/v1/userinfo');
  assert.equal(headers.Authorization,'Bearer test-token');
  return Response.json({sub:'teacher'});
 });
 const post=(body,headers={})=>request(origin+'/api/studio-session',{method:'POST',
  headers:{origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 const remember={action:'remember',expiresAt:Date.now()+300000},restore={action:'restore',subject:'teacher'};
 const login=await post(remember,{Authorization:'Bearer test-token'});
 assert.deepEqual(await login.json(),{subject:'teacher'});
 const setCookie=login.headers.get('set-cookie'),cookie=setCookie.split(';')[0];
 assert.match(setCookie,/HttpOnly; SameSite=Strict/);assert.ok(!setCookie.includes('test-token'));
 assert.equal((await post(restore)).status,204);
 assert.equal((await post(restore,{cookie,origin:'http://another.test'})).status,403);
 assert.equal((await post({...restore,subject:'another'},{cookie})).status,204);
 const restored=await post(restore,{cookie});assert.equal((await restored.json()).token,'test-token');
 await post({action:'forget'},{cookie,Authorization:'Bearer test-token'});
 assert.equal((await post(restore,{cookie})).status,204);
});

test('a studio cookie restores only the verified account until expiry, and can be cleared',async t=>{
 const now=Date.now();
 const clock=t.mock.method(Date,'now',()=>now);
 t.mock.method(globalThis,'fetch',async(url,{headers})=>{
  assert.equal(url,'https://openidconnect.googleapis.com/v1/userinfo');
  assert.equal(headers.Authorization,'Bearer test-token');
  return Response.json({sub:'account-A'});
 });
 const key='__Secure-chronicle-studio',cookies={};
 async function request(body,token,origin='https://studio.test'){
  const headers={host:'studio.test',origin,'content-type':'application/json'};
  if(token)headers.authorization='Bearer '+token;
  const result={headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.code=s;return this;},
   end(){},json(value){this.value=value;}};
  await handler({method:'POST',headers,body,cookies},result);
  assert.equal(result.headers['Cache-Control'],'private, no-store');
  return result;
 }
 const remember={action:'remember',expiresAt:now+300000};
 assert.equal((await request(remember,'test-token','https://other.test')).code,403);
 const saved=await request(remember,'test-token');
 assert.deepEqual(saved.value,{subject:'account-A'});
 const cookie=saved.headers['Set-Cookie'];
 assert.match(cookie,/Max-Age=300; Path=\/api\/studio-session; HttpOnly; Secure; SameSite=Strict$/);
 cookies[key]=cookie.split(';')[0].slice(key.length+1);
 const restore={action:'restore',subject:'account-A'};
 assert.equal((await request({...restore,subject:'account-B'})).code,204);
 assert.equal((await request(restore)).value.token,'test-token');
 assert.equal((await request({action:'forget'},'other-token')).headers['Set-Cookie'],undefined);
 assert.match((await request({action:'forget'},'test-token')).headers['Set-Cookie'],/Max-Age=0/);
 clock.mock.mockImplementation(()=>now+300001);
 assert.equal((await request(restore)).code,204);
});

test('reopening a remembered draft restores the session or hints only its account after expiry',async t=>{
 const stored=new Map(),requests=[];
 const token='test-token',subject='12345';
 globalThis.localStorage={getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)};
 globalThis.google={accounts:{oauth2:{hasGrantedAllScopes:()=>true,initTokenClient:options=>({
  requestAccessToken({prompt}){
   requests.push([options.login_hint,prompt]);
   options.callback({access_token:token,expires_in:3600});
  }})}}};
 t.after(()=>{delete globalThis.localStorage;delete globalThis.google;});
 let live;
 t.mock.method(globalThis,'fetch',async(url,init)=>{
  assert.equal(url,'/api/studio-session');
  const body=JSON.parse(init.body);
  if(body.action==='remember'){live={subject,token,expiresAt:body.expiresAt};return Response.json({subject});}
  if(body.action==='restore'&&live?.subject===body.subject)return Response.json(live);
  return new Response(null,{status:204});
 });
 const first=await import('../assets/google-sheet-auth.js?first');
 await first.authorizeRelationSheet('client',{studio:true});
 first.rememberDraftAccount('client','book',token);
 assert.deepEqual([...stored.values()],[subject]);
 const revisit=await import('../assets/google-sheet-auth.js?revisit');
 assert.equal(await revisit.restoreDraftToken('client','another'),'');
 assert.equal(await revisit.restoreDraftToken('client','book'),token);
 assert.deepEqual(requests,[[undefined,'select_account']]);
 live=undefined;
 const later=await import('../assets/google-sheet-auth.js?later');
 assert.equal(await later.restoreDraftToken('client','book'),'');
 await later.authorizeRelationSheet('client',{studio:true,subject:later.rememberedAccount('client','book')});
 await later.authorizeRelationSheet('client',{studio:true,subject,choose:true});
 assert.deepEqual(requests,[[undefined,'select_account'],[subject,''],[undefined,'select_account']]);
 later.forgetDraftAccount('client','book',token);
 assert.equal(later.rememberedAccount('client','book'),'');
});
