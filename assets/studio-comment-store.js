import {googleSheet} from './studio-cloud.js';

// Sheets owns the author, timestamp, replies and permissions. The final line
// identifies the corresponding target in the editor, even after a grid redraw.
const marker='\n\n제작실 위치 · ';
const utf8=new TextEncoder();
function checkText(value){
 if(utf8.encode(value).length>2048)throw Error('Google 시트의 댓글 길이 제한을 넘었습니다. 내용을 조금 줄여 주세요.');
 return value;
}
export function commentContent(book,anchor,text){
 const body=text.trim();
 if(!body)throw Error('댓글을 입력해 주세요.');
 return checkText(body+marker+JSON.stringify([book,anchor.key,anchor.x,anchor.y,anchor.label]));
}
export function studioThreads(comments,book){
 return comments.flatMap(thread=>{
  const content=thread.headPost?.content||'',idx=content.lastIndexOf(marker);
  if(idx<0||thread.headPost.deleted)return [];
  try{
   const [draft,key,x,y,label]=JSON.parse(content.slice(idx+marker.length));
   if(draft!==book||typeof key!=='string'||!key||typeof label!=='string'||![x,y].every(n=>Number.isFinite(n)&&n>=0&&n<=1))return [];
   return [{id:thread.commentId,anchor:{key,x,y,label},resolved:thread.status==='RESOLVED',
    post:{...thread.headPost,content:content.slice(0,idx)},replies:(thread.replies||[]).filter(p=>!p.deleted).sort((a,b)=>(a.createTime||'').localeCompare(b.createTime||''))}];
  }catch{return [];}
 }).sort((a,b)=>(a.post.createTime||'').localeCompare(b.post.createTime||'')||a.id.localeCompare(b.id));
}
async function packageCell(token,config,book){
 const table=await googleSheet(token,'/'+config.id+'/values/'+encodeURIComponent("'패키지'"));
 const [header=[],...rows]=table.values||[];
 const columnIndex=header.indexOf('패키지ID'),status=header.indexOf('작성상태');
 const row=rows.findIndex(r=>r[columnIndex]==='draft:'+book+':'+book&&r[status]==='작성 중');
 if(row<0)throw Error('작성 중인 공동 초안을 찾지 못했습니다. 초안 목록을 확인해 주세요.');
 return {sheetId:config.packageSheetId,rowIndex:row+1,columnIndex};
}
export async function readThreads(token,config,book){
 const {sheetId,rowIndex,columnIndex}=await packageCell(token,config,book);
 const result=await googleSheet(token,'/'+config.id+':getByDataFilter?fields=comments',{
  commentsViewMode:'COMMENTS_VIEW_MODE_INCLUDED',dataFilters:[{gridRange:{sheetId,startRowIndex:rowIndex,endRowIndex:rowIndex+1,startColumnIndex:columnIndex,endColumnIndex:columnIndex+1}}]
 });
 return studioThreads(result.comments||[],book);
}
export async function postComment(token,config,book,{anchor,thread,text='',action}){
 let request;
 if(anchor){
  const content=commentContent(book,anchor,text);
  request={insertComment:{coordinate:await packageCell(token,config,book),content}};
 }else{
  if(!thread||(!action&&!text.trim()))throw Error('답글을 입력해 주세요.');
  request={addCommentReply:{commentId:thread,post:action?{commentAction:action}:{content:checkText(text.trim())}}};
 }
 const result=await googleSheet(token,'/'+config.id+':batchUpdate',{requests:[request]});
 const reply=result.replies?.[0];
 const id=anchor?reply?.insertComment?.commentThread?.commentId:thread;
 if(result.commentUpdateState==='ALL_SAVED'&&id)return id;
 // Some API clients omit the batch status. Verify the returned post before acknowledging it.
 if(id&&(!result.commentUpdateState||result.commentUpdateState==='COMMENT_UPDATE_STATE_UNSPECIFIED')){
  const posts=await readThreads(token,config,book);
  const saved=posts.find(t=>t.id===id);
  if(saved&&(anchor||saved.replies.some(p=>p.postId&&p.postId===reply?.addCommentReply?.post?.postId)))return id;
 }
 throw Error('Google 시트에서 댓글 저장을 확인하지 못했습니다. 댓글 목록을 새로고침해 주세요.');
}
