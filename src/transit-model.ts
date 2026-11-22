import type {HistoryData} from './metro-model';
function smoothRoute(nodes:{x:number;y:number}[]){
 let d=`M${nodes[0].x},${nodes[0].y}`;
 for(let i=1;i<nodes.length;i++){const a=nodes[i-1],b=nodes[i],bend=(b.x-a.x)/2;d+=a.y===b.y?` L${b.x},${b.y}`:` C${a.x+bend},${a.y} ${b.x-bend},${b.y} ${b.x},${b.y}`;}
 return d;
}
export function makeTransit(data:HistoryData){
 const events=[...data.events].sort((a,b)=>a.bounds.start-b.bounds.start||a.id.localeCompare(b.id));
 const eventYears=new Set(events.map(event=>event.year));
 const topics=data.topics.filter(t=>events.some(e=>e.directTopicIds.includes(t.topic_id)));
 const years=[] as {year:number;x:number;width:number}[];let cursor=185;
 for(const year of [...eventYears].sort((a,b)=>a-b)){const n=events.filter(e=>e.year===year).length,width=Math.max(270,n*230+180);years.push({year,x:cursor,width});cursor+=width;}
 const height=Math.max(460,topics.length*95+145),baselines=topics.map((_,i)=>90+i*95);
 const points=events.map(e=>{const year=years.find(y=>y.year===e.year)!,siblings=events.filter(o=>o.year===e.year),index=siblings.findIndex(o=>o.id===e.id);const lines=topics.flatMap((t,i)=>e.directTopicIds.includes(t.topic_id)?[i]:[]);return{event:e,x:year.x+150+index*230,y:lines.reduce((n,i)=>n+baselines[i],0)/Math.max(1,lines.length),lines};});
 const width=cursor+165;
 const routes=topics.map((t,i)=>{const stations=points.filter(p=>p.lines.includes(i));const own=[{x:95,y:baselines[i]},...stations.map(p=>({x:p.x,y:p.y})),{x:width-100,y:baselines[i]}];
 // Route unrelated lines around a station so a crossing cannot look like a transfer.
 const middle=points.map(p=>{if(p.lines.includes(i))return{x:p.x,y:p.y};const after=own.findIndex(n=>n.x>p.x),a=own[Math.max(0,after-1)],b=own[after<0?own.length-1:after];let y=a.y+(b.y-a.y)*(p.x-a.x)/Math.max(1,b.x-a.x);if(Math.abs(y-p.y)<43)y=p.y+(y>=p.y?46:-46);return{x:p.x,y};});
 const nodes=[own[0],...middle,own.at(-1)!];const d=smoothRoute(nodes);return{...t,y:baselines[i],stations,nodes,d};});
 const separated=routes.map((route,index)=>{
  const offsets=route.nodes.slice(1).map((b,j)=>{const a=route.nodes[j],mid=(a.y+b.y)/2,together=routes.flatMap((r,i)=>Math.abs((r.nodes[j].y+r.nodes[j+1].y)/2-mid)<2?[i]:[]);return(together.indexOf(index)-(together.length-1)/2)*18;});
  // Keep parallel lanes apart through unrelated events; only actual transfers need to meet.
  const anchors=route.nodes.map((node,j)=>{
   const station=points[j-1];if(!station||station.lines.includes(index)||offsets[j-1]!==offsets[j])return node;
   let y=node.y+offsets[j];if(Math.abs(y-station.y)<43)y=station.y+(node.y>=station.y?46:-46);
   return{...node,y};
  });
  const nodes=[anchors[0]];
  for(let j=1;j<anchors.length;j++){const a=route.nodes[j-1],b=route.nodes[j],offset=offsets[j-1];if(offset&&(anchors[j-1].y!==a.y+offset||anchors[j].y!==b.y+offset)){for(const t of [.35,.65])nodes.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t+offset});}nodes.push(anchors[j]);}
  return{...route,nodes,d:smoothRoute(nodes)};
 });
 return{events,years,points,routes:separated,width,height};
}
export function countryMatches(event:{actorIds:string[]},country:string){return !country||event.actorIds.includes(country);}

export function placeRouteLabels(paths:{getTotalLength:()=>number;getPointAtLength:(length:number)=>{x:number;y:number}}[],x:number,height:number){
 const labels=paths.map(path=>{let low=0,high=path.getTotalLength();for(let n=0;n<18;n++){const mid=(low+high)/2;if(path.getPointAtLength(mid).x<x)low=mid;else high=mid;}const length=(low+high)/2,point=path.getPointAtLength(length),before=path.getPointAtLength(Math.max(0,length-1)),after=path.getPointAtLength(Math.min(path.getTotalLength(),length+1));const slope=(after.y-before.y)/(after.x-before.x||1);return{y:point.y,lineY:point.y,slope};});
 const ordered=[...labels].sort((a,b)=>a.y-b.y);
 for(let i=0;i<ordered.length;i++)ordered[i].y=Math.max(30,ordered[i].y,i?ordered[i-1].y+60:0);
 for(let i=ordered.length-1;i>=0;i--)ordered[i].y=Math.min(height-30,ordered[i].y,i<ordered.length-1?ordered[i+1].y-60:height);
 return labels;
}

export function topicMatches(event:{directTopicIds:string[]},topic:string){return !topic||event.directTopicIds.includes(topic);}
