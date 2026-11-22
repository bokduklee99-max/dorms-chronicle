import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeRelationSheet,currentSheetToken,forgetSheetToken} from '../assets/google-sheet-auth.js';

test('checking a session never opens Google, and connecting leaves account choice to the visitor',async t=>{
 let requests=0;
 globalThis.google={accounts:{oauth2:{
  initTokenClient(options){
   assert.equal('login_hint' in options,false);
   return {requestAccessToken({prompt}){
    requests++;
    assert.equal(prompt,'select_account');
    options.callback({access_token:'test-token',expires_in:3600});
   }};
  },
  hasGrantedAllScopes:()=>true
 }}};
 t.after(()=>{delete globalThis.google;forgetSheetToken();});
 const now=Date.now();
 const clock=t.mock.method(Date,'now',()=>now);
 assert.equal(currentSheetToken(),'');
 assert.equal(requests,0);
 assert.equal(await authorizeRelationSheet('client'),'test-token');
 assert.equal(currentSheetToken(),'test-token');
 assert.equal(await authorizeRelationSheet('client'),'test-token');
 clock.mock.mockImplementation(()=>now+3600000);
 assert.equal(currentSheetToken(),'');
 assert.equal(requests,1);
});
