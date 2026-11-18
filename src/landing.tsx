import {createRoot} from 'react-dom/client';
import ScrollMorphHero from './components/ui/scroll-morph-hero';
import {chronicleCards} from './landing-model';
import {WorkspaceSetup} from './WorkspaceSetup';
import {setupHref} from './workspace-model';
import './landing.css';
import '../assets/chronicle-theme.css';

const cards=chronicleCards(window.HistorySource.data.events,window.HistorySource.media);
function Landing(){
 return <>
 <a className="skip-link" href="#archive">사건 목록으로 건너뛰기</a>
 <header className="landing-nav"><a href="/" className="wordmark">Dorms' Chronicle<span aria-hidden="true">✳</span></a><nav aria-label="주요 메뉴"><a className="landing-archive-link" href="#archive">주요 장면</a><a href="/data-explorer.html">데이터 탐색</a><a className="landing-setup-link" href={setupHref()}>탐색 설정 <span aria-hidden="true">↗</span></a></nav></header>
 <main><ScrollMorphHero cards={cards}/>
  <section className="archive-section" id="archive" aria-labelledby="archive-title">
   <div className="archive-heading"><h2 id="archive-title">세계를 바꾼 <em>장면들.</em></h2><p>냉전의 기록 · 1945–1991</p></div>
   <div className="archive-grid">{cards.map(card=><a className="archive-card" href={card.href} key={card.id}><div className="archive-image"><img src={card.image} alt="" loading="lazy"/><span aria-hidden="true">↗</span></div><div className="archive-caption"><time dateTime={card.date}>{card.date.replaceAll('-','.')}</time><h3>{card.title}</h3></div></a>)}</div>
  </section>
  <section className="explore-section" aria-labelledby="explore-title"><h2 id="explore-title">장면 너머의<br/><em>연결을 발견하세요.</em></h2><div className="explore-links"><a href={setupHref({view:'metro'})}>사건의 흐름 <span>↗</span></a><a href={setupHref({view:'strata'})}>주제와 시대 <span>↗</span></a><a href={setupHref({view:'world'})}>냉전 세계지도 <span>↗</span></a></div></section>
 </main><footer className="landing-footer"><a className="wordmark" href="/">Dorms' Chronicle</a></footer>
 </>;}
const configuring=new URLSearchParams(location.search).get('setup')==='1';
if(configuring)document.title="탐색 설정 · Dorms' Chronicle";
createRoot(document.getElementById('root')!).render(configuring?<WorkspaceSetup/>:<Landing/>);
