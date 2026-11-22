import test from 'node:test';
import assert from 'node:assert/strict';
import {commentContent,postComment,readThreads,studioThreads} from '../assets/studio-comment-store.js';

const anchor={key:'cell|event-a|body',x:.25,y:.8,label:'독립운동 · 내용'};
const book='lesson-a',cfg={id:'example',packageSheetId:17};
const head=content=>({commentId:'thread',status:'OPEN',headPost:{content,author:{displayName:'교사'},createTime:'2026-01-02T03:04:05Z'}});
test('threads retain their logical target, author and replies and exclude other drafts and unrelated Sheets comments',()=>{
 const text='<b>확인</b>\n원문',t=head(commentContent(book,anchor,text));
 t.replies=[{content:'확인했습니다.'},{deleted:true}];
 const result=studioThreads([head('일반 댓글'),head(commentContent('other',anchor,'다른 초안')),t],book);
 assert.equal(result.length,1);assert.deepEqual(result[0].anchor,anchor);assert.equal(result[0].post.content,text);
 assert.equal(result[0].post.author.displayName,'교사');assert.equal(result[0].replies.length,1);
 assert.throws(()=>commentContent(book,anchor,'  '));assert.throws(()=>commentContent(book,anchor,'가'.repeat(690)));
});
test('Sheets comments respect moved package rows, access failures and partial write failures',async t=>{
 const calls=[];let second=false,state='ALL_SAVED',deny=false;
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  assert.equal(options.headers.Authorization,'Bearer my-token');
  if(deny)return Response.json({},{status:403});
  if(url.includes('/values/'))return Response.json({values:[['작성상태','패키지ID'],['작성 중','draft:b:b'],...(second?[[]]:[]),['작성 중','draft:lesson-a:lesson-a']]});
  const payload=JSON.parse(options.body);calls.push(payload);
  return Response.json(url.includes('getByDataFilter')?{comments:[head(commentContent(book,anchor,'원문'))]}:{commentUpdateState:state,replies:[{insertComment:{commentThread:{commentId:'thread'}}}]});
 });
 assert.equal((await readThreads('my-token',cfg,book)).length,1);
 assert.deepEqual(calls[0].dataFilters[0].gridRange,{sheetId:17,startRowIndex:2,endRowIndex:3,startColumnIndex:1,endColumnIndex:2});
 second=true;
 assert.equal(await postComment('my-token',cfg,book,{anchor,text:'첫 댓글'}),'thread');
 assert.deepEqual(calls.at(-1).requests[0].insertComment.coordinate,{sheetId:17,rowIndex:3,columnIndex:1});
 for(const payload of [{text:'답글'},{action:'RESOLVE'},{action:'REOPEN'}]){
  await postComment('my-token',cfg,book,{thread:'thread',...payload});
  assert.deepEqual(calls.at(-1).requests[0].addCommentReply,{commentId:'thread',post:payload.action?{commentAction:payload.action}:{content:payload.text}});
 }
 state=undefined;
 assert.equal(await postComment('my-token',cfg,book,{anchor,text:'원문'}),'thread');
 state='ALL_FAILED_UNKNOWN_REASON';
 await assert.rejects(postComment('my-token',cfg,book,{anchor,text:'실패'}),/저장/);
 await assert.rejects(postComment('my-token',cfg,'missing',{anchor,text:'다른 초안'}),/공동 초안/);
 deny=true;await assert.rejects(readThreads('my-token',cfg,book),e=>e.status===403);
});
