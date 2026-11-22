import {createRoot} from 'react-dom/client';
import ScrollMorphHero from './components/ui/scroll-morph-hero';
import {chronicleCards} from './landing-model';
import {LessonWizard} from './LessonWizard';
import {WorkspaceSetup} from './WorkspaceSetup';
import {CreatorCredit} from './CreatorCredit';
import {clearBrowserPackages} from '../assets/studio-library.js';
import './landing.css';
import '../assets/chronicle-theme.css';

try { clearBrowserPackages(); } catch { /* Storage can be disabled. */ }
const cards=chronicleCards(window.HistorySource.data.events,window.HistorySource.media);
function LandingCredits(){
 return <><a className="wordmark" href="/">DoRms' Chronicle</a><CreatorCredit/></>;
}
function Landing(){
 return <>
 <a className="skip-link" href="#archive">사건 목록으로 건너뛰기</a>
 <header className="landing-nav"><a href="/" className="wordmark">DoRms' Chronicle<span aria-hidden="true">✳</span></a><nav aria-label="주요 메뉴"><a href="/data-explorer.html">데이터 편집</a></nav></header>
 <main><ScrollMorphHero cards={cards}/>
  <div className="landing-footer"><LandingCredits/></div>
  <section className="archive-section" id="archive" aria-labelledby="archive-title">
   <div className="archive-heading"><h2 id="archive-title">세계를 바꾼 <em>장면들.</em></h2><p>냉전의 기록 · 1945–1991</p></div>
   <div className="archive-grid">{cards.map(card=><a className="archive-card" href={card.href} key={card.id}><div className="archive-image"><img src={card.image} alt="" loading="lazy"/><span aria-hidden="true">↗</span></div><div className="archive-caption"><time dateTime={card.date}>{card.date.replaceAll('-','.')}</time><h3>{card.title}</h3></div></a>)}</div>
  </section>
 </main>
 <footer className="landing-footer"><LandingCredits/></footer>
 </>;}
const params=new URLSearchParams(location.search);
const configuring=params.get('setup')==='1';
const creating=configuring&&!params.has('workspace')&&(params.get('lesson')==='new'||params.has('view')||params.has('event'));
if(configuring)document.title="탐색 설정 · DoRms' Chronicle";
createRoot(document.getElementById('root')!).render(creating?<LessonWizard/>:configuring?<WorkspaceSetup/>:<Landing/>);
