export const svg = (name, attrs) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
};

export function pathData(lines, closed = true) {
  return lines.map(line => 'M' + line.map(([lon, lat]) => lon + ',' + (-lat)).join('L') + (closed ? 'Z' : '')).join('');
}

export function storyCamera(atlas, onFrame) {
  const geography = atlas.querySelector('#geography');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let camera, flight;
  function paint() {
    if (!camera) return;
    const {width, height} = atlas.getBoundingClientRect();
    if (!width || !height) return;
    const cosine = Math.cos(camera.lat * Math.PI / 180);
    const k = Math.min(width / camera.width, height * cosine / camera.height);
    const ky = k / cosine;
    const x = width/2 - camera.lon*k, y = height/2 + camera.lat*ky;
    geography.setAttribute('transform', 'translate('+x+' '+y+') scale('+k+' '+ky+')');
    onFrame((lon,lat) => [x+lon*k, y-lat*ky], camera, width, height);
  }

  function move(to, animate) {
    cancelAnimationFrame(flight);
    const from = camera;
    if (!from || !animate || reduceMotion.matches || from === to) {
      camera = to;
      paint();
      return;
    }
    const start = performance.now();
    function step(now) {
      const t = Math.min(1,(now-start)/1900);
      const ease = t*t*(3-2*t);
      const width = from.width * (to.width/from.width)**ease;
      const pan = from.width === to.width ? ease : (width-from.width)/(to.width-from.width);
      camera = {lon:from.lon+(to.lon-from.lon)*pan, lat:from.lat+(to.lat-from.lat)*pan,
        width, height:from.height*(to.height/from.height)**ease};
      if (t === 1) camera = to;
      paint();
      if (t < 1) flight = requestAnimationFrame(step);
    }
    flight = requestAnimationFrame(step);
  }

  return {move,paint};
}
