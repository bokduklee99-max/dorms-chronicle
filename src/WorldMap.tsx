import {useId,useState,type CSSProperties} from 'react';
import type {HistoryData} from './metro-model';
import {countriesAt,countryEvents,countryName,mapCountries,mapPoint,relationsAt,relationPath,type MapCountry} from './world-map-model';
import './world-map.css';

declare global {interface Window {WORLD:{id:string;name:string;d:string}[]}}
const colors={usa:'#3676b9',ussr:'#c85b43'};
const presets=[1945,1949,1955,1962,1979,1991];
export function WorldMap({data,onVisit}:{data:HistoryData;onVisit:(id:string,button:HTMLButtonElement)=>void}){
 const [year,setYear]=useState(1945),[selected,setSelected]=useState<string|null>(null),[power,setPower]=useState<'all'|'usa'|'ussr'>('all');
 const uid=useId().replaceAll(':',''),countries=countriesAt(year),country=countries.find(c=>c.id===selected)||null;
 const relations=relationsAt(year,power),connected=relations.filter(r=>!country||r.from===country.id||r.to===country.id);
 const events=countryEvents(data.events,year,country),mask=`world-land-${uid}`,dots=`world-dots-${uid}`;
 function pick(c:MapCountry){setSelected(selected===c.id?null:c.id);}
 function tone(id:string){const powers=new Set(relations.filter(r=>r.to===id||r.from===id).map(r=>r.from));return id==='usa'?colors.usa:id==='ussr'?colors.ussr:powers.size===2?'#8a6d99':powers.has('usa')?colors.usa:powers.has('ussr')?colors.ussr:'#6b7e76';}
 return <section id="panel-world" role="tabpanel" aria-labelledby="tab-world" className="world-panel">
  <header className="world-heading"><div><h2>두 강대국, 연결되는 세계</h2><p>국가를 눌러 관계와 사건을 따라가 보세요.</p></div><div className="world-power" role="group" aria-label="관계선 표시">{([{id:'all',name:'전체'},{id:'usa',name:'미국'},{id:'ussr',name:'소련'}] as const).map(p=><button key={p.id} aria-pressed={power===p.id} onClick={()=>setPower(p.id)}>{p.id!=='all'&&<i style={{background:colors[p.id]}}/>}{p.name}</button>)}</div></header>
  <div className="world-layout">
   <div className="world-atlas">
    <div className="world-chart-scroll" role="region" aria-label="평면 세계지도. 국가 버튼은 지도 아래에도 있습니다." tabIndex={0}>
     <div className="world-chart">
      <svg viewBox="0 0 954 440" aria-hidden="true" className="world-svg">
       <defs><mask id={mask}><rect width="954" height="440" fill="black"/>{window.WORLD.filter(c=>c.id!=='ATA').map(c=><path key={c.id} d={c.d} fill="white"/>)}</mask><pattern id={dots} width="5.4" height="5.4" patternUnits="userSpaceOnUse"><circle cx="2.7" cy="2.7" r="1.2" fill="#98aaa0"/></pattern></defs>
       <g className="world-graticule">{[-120,-60,0,60,120].map(lon=><path key={lon} d={`M${mapPoint([lon,0])[0]},20 V420`}/>)}{[-30,0,30,60].map(lat=><path key={lat} d={`M20,${mapPoint([0,lat])[1]} H934`}/>)}</g>
       <rect width="954" height="440" fill={`url(#${dots})`} mask={`url(#${mask})`}/>
       <g className="world-routes">{relations.map(r=>{const from=mapCountries.find(c=>c.id===r.from)!,to=mapCountries.find(c=>c.id===r.to)!,d=relationPath(from,to),dim=country&&r.from!==country.id&&r.to!==country.id;return <g key={r.id} className={dim?'world-route dim':'world-route'} style={{'--route-color':colors[r.from]} as CSSProperties}><path d={d} className={`world-route-line ${r.kind}`} pathLength="1"/><path key={`${r.id}-${year}`} d={d} className="world-route-travel" pathLength="1"/></g>;})}</g>
      </svg>
      {countries.map(c=>{const [x,y]=mapPoint(c.point),isPower=c.id==='usa'||c.id==='ussr',dim=country&&c.id!==country.id&&!connected.some(r=>r.from===c.id||r.to===c.id),label=c.label||[0,0];return <button key={c.id} className={`world-node ${isPower?'superpower':''} ${dim?'dim':''} ${c.label?'labelled':''}`} style={{left:`${x/954*100}%`,top:`${y/440*100}%`,'--node-color':tone(c.id),'--label-x':`${label[0]}px`,'--label-y':`${label[1]}px`} as CSSProperties} aria-label={`${countryName(c,year)} 관련 사건 보기`} aria-pressed={country?.id===c.id} onClick={()=>pick(c)}><i/><span>{countryName(c,year)}</span></button>;})}
      <span className="world-ocean ocean-atlantic">대서양</span><span className="world-ocean ocean-pacific">태평양</span>
      <div className="world-map-key"><span><i className="alliance"/>동맹</span><span><i className="aid"/>지원·개입</span></div>
     </div>
    </div>
    <div className="world-time"><div className="world-year-row"><div className="world-year"><output htmlFor={`${uid}-year`}>{year}</output><span>년 말</span></div><div className="world-year-arrows"><button aria-label="이전 연도" disabled={year===1945} onClick={()=>setYear(year-1)}>←</button><button aria-label="다음 연도" disabled={year===1991} onClick={()=>setYear(year+1)}>→</button></div></div><label className="sr-only" htmlFor={`${uid}-year`}>냉전 지도 연도</label><input id={`${uid}-year`} type="range" min="1945" max="1991" step="1" value={year} aria-valuetext={`${year}년 말`} onChange={e=>setYear(Number(e.target.value))}/><div className="world-year-scale"><span>1945</span><span>1960</span><span>1975</span><span>1991</span></div><div className="world-presets" role="group" aria-label="주요 연도로 이동">{presets.map(y=><button key={y} aria-pressed={year===y} onClick={()=>setYear(y)}>{y}</button>)}</div></div>
   </div>
   <aside className="world-detail" aria-label="선택한 국가와 사건"><header><div><span>{country?'선택한 국가':`${year}년의 세계`}</span><h3>{country?countryName(country,year):'이해관계가 만나는 곳'}</h3></div>{country&&<button aria-label="국가 선택 해제" onClick={()=>setSelected(null)}>×</button>}</header>
    {country&&<section className="world-relations" aria-label="선택 연도의 관계"><h4>{year}년 말의 관계</h4>{connected.map(r=>{const other=mapCountries.find(c=>c.id===(country.id===r.from?r.to:r.from))!;return <article key={r.id} style={{'--relation-color':colors[r.from]} as CSSProperties}><div><b>{countryName(other,year)}</b><span>{r.kind==='alliance'?'동맹':'지원·개입'}</span></div><a href={r.source} target="_blank" rel="noreferrer">{r.title} ↗</a><p>{r.note}</p></article>;})}{!connected.length&&<p className="world-empty">선택한 조건에 등록된 관계가 없습니다. 비동맹·중립을 뜻하지 않습니다.</p>}</section>}
    <section className="world-event-section"><h4>{country?`${year}년까지의 관련 사건`:`${year}년의 사건`}<span>{events.length}</span></h4><div className="world-events" key={`${year}-${country?.id}`} aria-live="polite">{events.map(e=><button key={e.id} onClick={ev=>onVisit(e.id,ev.currentTarget)}><time>{e.date}</time><strong>{e.shortTitle||e.title}</strong><span aria-hidden="true">↗</span></button>)}{!events.length&&<p className="world-empty">이 조건에 수록된 사건이 없습니다. 다른 국가나 연도를 선택해 보세요.</p>}</div></section>
   </aside>
  </div>
  <div className="world-country-picker" role="group" aria-label="지도에서 국가 선택"><button aria-pressed={!country} onClick={()=>setSelected(null)}>전체 국가</button>{countries.map(c=><button key={c.id} style={{'--node-color':tone(c.id)} as CSSProperties} aria-pressed={country?.id===c.id} onClick={()=>pick(c)}><i/>{countryName(c,year)}</button>)}</div>
  <div className="world-foot"><p>주요 관계를 선별한 프로토타입 · 국경을 생략한 현대 해안선 · 선은 관계이며 실제 이동 경로가 아닙니다.</p><a href="https://21st.dev/@manuarora700/components/world-map" target="_blank" rel="noreferrer">World Map 참고 ↗</a></div>
 </section>;
}
