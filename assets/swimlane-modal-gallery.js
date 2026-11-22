import {loadSwimlane} from '../swimlane-data.js';
import {setupSwimlaneModal,labels} from './swimlane-modal.js';
const examples=['E248','R002','japan_cultural_rule','japan_manchuria','japan_domestic','org_uiyeoldan','all'];
async function render(){
 const data=await loadSwimlane(SHEET_CONFIG,SheetData,'japan').catch(async()=>{
  const response=await fetch('./assets/swimlane-japan.json');
  if(!response.ok)throw Error();
  return response.json();
 });
 const {preview}=setupSwimlaneModal(data);
 for(const id of examples){
  const page=preview(id);if(!page)continue;page.id='sample-'+page.dataset.kind;
  const a=document.createElement('a');a.textContent=labels[page.dataset.kind]||'전체 관계';a.href='#'+page.id;
  document.getElementById('index').append(a);document.getElementById('gallery').append(page);
 }
 const index=document.getElementById('index');
 const entries=Array.from(index.querySelectorAll('a'),link=>({link,card:document.getElementById(link.hash.slice(1))}));
 function markSection(){
  const anchorOffset=parseFloat(getComputedStyle(entries[0].card).scrollMarginTop);
  const edge=Math.max(anchorOffset,index.getBoundingClientRect().bottom)+2;
  let current=entries[0];
  for(const entry of entries){
   if(entry.card.getBoundingClientRect().top>edge)break;
   current=entry;
  }
  for(const entry of entries){
   if(entry===current)entry.link.setAttribute('aria-current','location');
   else entry.link.removeAttribute('aria-current');
  }
 }
 document.getElementById('status').remove();
 const target=entries.find(entry=>entry.link.hash===location.hash);
 if(target)target.card.scrollIntoView();
 markSection();
 window.addEventListener('scroll',markSection,{passive:true});
 window.addEventListener('resize',markSection);
}
render().catch(()=>{document.getElementById('status').textContent='예시를 불러오지 못했습니다. 새로고침해 주세요.';});
