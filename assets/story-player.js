import {storyEntries} from './story-events.js';
const $ = selector => document.querySelector(selector);

if (window !== window.top) $('.back').href = './event-map-demo.html?embedded';

export function mountStory(key, scenes, render, paint) {
  const anchor = scenes.find(scene => scene.id === storyEntries[key].eventId);
  if (!anchor) throw Error('사건 시트에서 연결된 사건을 찾지 못했습니다.');
  const title = anchor.title;
  $('.heading h1').textContent = title;
  document.title = title+' · 사건 지도';
  $('.heading p').textContent = [...new Set([scenes[0].date.slice(0,4),scenes.at(-1).date.slice(0,4)])].join(' — ');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0;
  let timer;
  let deadline = 0;
  const sceneDuration = 6500;
  let remaining = sceneDuration;
  let progress;

  function dateLabel(date) {
    const [year, month, day] = date.split('-');
    return year + '년' + (month ? ' ' + Number(month) + '월' : '') + (day ? ' ' + Number(day) + '일' : '');
  }

  function show(i, animate = true) {
    progress?.cancel();
    remaining = sceneDuration;
    index = i;
    const scene = scenes[i];
    $('#date').dateTime = scene.date;
    $('#date').textContent = [scene.date,scene.end].filter(Boolean).map(dateLabel).join(' ~ ');
    $('footer a').href = SHEET_CONFIG.url+'&range=A'+scene.row;
    $('#scene-title').textContent = scene.title;
    $('#story-text').textContent = scene.body;
    $('#counter').textContent = (i+1) + ' / ' + scenes.length;
    $('#prev').disabled = i === 0;
    $('#next').disabled = i === scenes.length-1;
    [...$('#chapters').children].forEach((li, n) => {
      if (n === i) li.firstChild.setAttribute('aria-current', 'step');
      else li.firstChild.removeAttribute('aria-current');
    });
    if (animate && !reduceMotion.matches) {
      $('.caption').animate([{opacity:.45,transform:'translateY(5px)'},{opacity:1,transform:'none'}], {duration:360});
    }
    render(scene, animate);
    updatePlay();
  }

  function updatePlay() {
    $('#play').textContent = timer ? 'Ⅱ 일시정지' : index === scenes.length-1 ? '↻ 다시 재생' : '▶ 재생';
  }

  function stop() {
    if (timer) remaining = Math.max(0, deadline - performance.now());
    progress?.pause();
    clearTimeout(timer);
    timer = undefined;
    updatePlay();
  }

  function choose(i) {
    stop();
    show(i);
  }

  function advance() {
    if (index === scenes.length-1) return stop();
    if (!reduceMotion.matches) {
      progress?.cancel();
      progress = $('.progress i').animate([{transform:'scaleX(0)'},{transform:'scaleX(1)'}], {duration:sceneDuration, fill:'forwards'});
      progress.currentTime = sceneDuration - remaining;
    }
    deadline = performance.now() + remaining;
    timer = setTimeout(() => {
      timer = undefined;
      show(index+1);
      advance();
    }, remaining);
    updatePlay();
  }

  scenes.forEach((scene, i) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.className = 'chapter';
    const time = document.createElement('time'), name = document.createElement('strong');
    time.dateTime = scene.date;
    time.textContent = [scene.date,scene.end].filter(Boolean).join(' ~ ');
    name.textContent = scene.title;
    button.append(time, name);
    button.onclick = () => choose(i);
    item.append(button);
    $('#chapters').append(item);
  });
  $('#prev').onclick = () => choose(index-1);
  $('#next').onclick = () => choose(index+1);
  $('#play').onclick = () => {
    if (timer) return stop();
    if (index === scenes.length-1) show(0, false);
    advance();
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  $('#play').disabled = false;
  show(0, false);
  if (new URLSearchParams(location.search).has('play') && !document.hidden) advance();
  new ResizeObserver(paint).observe($('#atlas'));
}
