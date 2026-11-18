import type {EventRecord,HistoryData} from './metro-model';

const flags:Record<string,string>={actor_usa:'us.svg',actor_ussr:'ussr.webp',actor_prc:'cn.svg',actor_roc:'tw.svg',actor_kor:'kr.svg',actor_prk:'kp.svg',actor_uk:'gb.svg',actor_france:'fr.svg',actor_frg:'de.svg',actor_gdr:'gdr.webp',actor_japan:'jp.svg',actor_cuba:'cu.svg'};
const names:Record<string,string>={actor_prc:'중국',actor_roc:'대만·중화민국',actor_prk:'북한',actor_frg:'서독·독일'};

export function EventLeaders({event,data}:{event:EventRecord;data:HistoryData}){
 const countries=window.HistorySource.HistoryViews.eventLeaders(event,data.actors,data.tenures);
 const otherActors=data.actors.filter(actor=>actor.actor_type!=='state'&&event.actorIds.includes(actor.actor_id));
 return <section className="event-leaders">
  <h3>관련국과 지도자</h3>
  <div className="event-countries">{countries.map(({country,people})=>{
   const id=country.actor_id;
   const flag=id==='actor_gdr'&&event.date<'1959-10'?'de.svg':flags[id];
   return <section className="event-country" key={id}>
    <h4>{flag&&<img src={'/assets/flags/'+flag} alt=""/>}{names[id]||country.name}</h4>
    {people.length>0?<ul>{people.map(({person,tenures})=><li key={person}>
     <strong>{person}</strong>
     {tenures.map(tenure=><div className="event-tenure" key={tenure.id}>
      <span>{tenure.title}{tenure.source&&<a href={tenure.source} target="_blank" rel="noreferrer" aria-label={`${person} ${tenure.title} 재임 출처`}> ↗</a>}</span>
      <span><time>{tenure.startDate}</time> – <time>{tenure.endDate||'재임 중'}</time></span>
     </div>)}
    </li>)}</ul>:<p>재임 기록 없음</p>}
   </section>;
  })}</div>
  {!countries.length&&<p className="event-context-empty">연결된 국가가 없습니다.</p>}
  {otherActors.length>0&&<p className="event-other-actors"><strong>관련 주체</strong> {otherActors.map(actor=>actor.name).join(' · ')}</p>}
 </section>;
}
