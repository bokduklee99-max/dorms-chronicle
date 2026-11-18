import React from 'react';
import type {EventRecord,HistoryData} from './metro-model';
export function RelationGraph({event:e,data}:{event:EventRecord;data:HistoryData}){
 const topics=e.directTopicIds.map(id=>data.topics.find(t=>t.topic_id===id)).filter(t=>t!==undefined);
 const actors=e.actorIds.map(id=>data.actors.find(a=>a.actor_id===id)).filter(a=>a!==undefined);
 const h=Math.max(310,actors.length*68+70,topics.length*74+70),middle=h/2;
 const nodes=[...topics.map((t,i)=>({id:t.topic_id,label:t.name,x:122,y:35+((h-70)/(topics.length+1))*(i+1),kind:'topic'})),...actors.map((a,i)=>({id:a.actor_id,label:a.name,x:718,y:35+((h-70)/(actors.length+1))*(i+1),kind:'actor'}))];
 return <svg className="relation-graph" viewBox={`0 0 840 ${h}`} role="img" aria-label={`${e.title}와 주제 ${topics.map(t=>t.name).join(', ')}, 국가·참여 주체 ${actors.map(a=>a.name).join(', ')}의 관계`}><text x="122" y="24" textAnchor="middle" className="graph-heading">카테고리</text><text x="718" y="24" textAnchor="middle" className="graph-heading">국가·참여 주체</text>{nodes.map((n,i)=><g key={n.id} style={{'--delay':`${i*55}ms`} as React.CSSProperties}><path className={`graph-edge ${n.kind}`} d={`M420 ${middle} C${n.x<420?265:575} ${middle},${n.x<420?265:575} ${n.y},${n.x} ${n.y}`}/><circle cx={n.x<420?222:618} cy={n.y} r="5" className={`graph-junction ${n.kind}`}/><foreignObject className="graph-node" x={n.x-103} y={n.y-26} width="206" height="52"><div className={`graph-node-label ${n.kind}`}>{n.label}</div></foreignObject></g>)}<rect className="graph-core" x="294" y={middle-77} width="252" height="154" rx="25"/><foreignObject x="305" y={middle-69} width="230" height="138"><div className="graph-core-label"><time>{e.date}</time><strong>{e.shortTitle||e.title}</strong></div></foreignObject></svg>;

}
