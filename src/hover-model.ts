import type {EventRecord} from './metro-model';
export function previewNeighbours(events:EventRecord[],id:string){
 const index=events.findIndex(e=>e.id===id);
 return {previous:index>0?events[index-1]:null,next:index>=0&&index+1<events.length?events[index+1]:null};
}
export function previewPosition(anchor:{left:number;top:number;bottom:number},card:{width:number;height:number},viewport:{width:number;height:number}){
 const gap=14;
 const y=anchor.top>=card.height+gap?anchor.top-card.height-gap:anchor.bottom+card.height+gap<=viewport.height?anchor.bottom+gap:anchor.top-card.height/2;
 return {left:Math.max(12,Math.min(viewport.width-card.width-12,anchor.left+19-card.width/2)),top:Math.max(12,Math.min(viewport.height-card.height-12,y))};
}
