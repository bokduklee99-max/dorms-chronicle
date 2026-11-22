import {geoEquirectangular,geoMercator,geoNaturalEarth1} from 'd3-geo';

const projections = {geoEquirectangular,geoMercator,geoNaturalEarth1};
const fields = ['중심경도','중심위도','최소경도','최소위도','최대경도','최대위도'];

/** @param {string[][]} rows */
export function readMapViews([headers=[],...rows]) {
  const views = new Map();
  if (!headers.length) return views;
  const columns = ['뷰ID','뷰명','투영법',...fields].map(key=>headers.indexOf(key));
  if (columns.includes(-1)) throw Error('지도뷰 탭의 열을 확인해 주세요.');
  for (const row of rows) {
    const [id,name,projection,...values] = columns.map(i=>row[i]?.trim());
    if (!id || !name || !Object.hasOwn(projections,projection) || values.some(value=>!value)) continue;
    const [lon,lat,west,south,east,north] = values.map(Number);
    if (![lon,lat,west,south,east,north].every(Number.isFinite) || west < -180 || east > 180 ||
      south < -90 || north > 90 || west >= east || south >= north ||
      lon < west || lon > east || lat < south || lat > north ||
      (projection === 'geoMercator' && (south === -90 || north === 90))) continue;
    views.set(id,{name,projection,lon,lat,west,south,east,north});
  }
  return views;
}

export function mapCamera(view, focus) {
  const {west,south,east,north,lon,lat} = focus ?? view;
  const projection = projections[view.projection]().center([lon,lat]).translate([0,0]).scale(1);
  function project(x,y) {
    return projection([x,view.projection === 'geoMercator' ? Math.max(-89.99,Math.min(89.99,y)) : y]);
  }
  const edges = [];
  for (let i=0;i<=24;i++) {
    const x=west+(east-west)*i/24, y=south+(north-south)*i/24;
    edges.push(project(x,south),project(x,north),project(west,y),project(east,y));
  }
  const width=2.06*Math.max(...edges.map(([x])=>Math.abs(x)));
  const height=2.06*Math.max(...edges.map(([,y])=>Math.abs(y)));
  projection.scale(1000/width);
  return {project,box:[-500,-500*height/width,1000,1000*height/width]};
}

// shortcut: only the absolute M/L/Z paths emitted by the geographic SVG assets are reprojected. Convert other SVGs to GeoJSON when their coordinates are verified.
export function geographicSvgLines(path) {
  if (!path || !/^[MLZ0-9.,\s-]+$/.test(path) || !path.startsWith('M')) return [];
  const lines=[];
  for (const line of path.slice(1).split('M')) {
    const values=line.replace(/Z$/,'').trim().split(/[L,\s]+/).map(Number);
    if (values.length<4 || values.length%2) return [];
    const coordinates=[];
    for (let i=0;i<values.length;i+=2) {
      const [lon,y]=[values[i],values[i+1]];
      if (!Number.isFinite(lon) || !Number.isFinite(y) || Math.abs(lon)>180 || Math.abs(y)>90) return [];
      coordinates.push([lon,-y]);
    }
    lines.push(coordinates);
  }
  return lines;
}

export function projectedPath(lines,project,closed) {
  return lines.map(line=>'M'+line.map(([x,y])=>project(x,y).map(value=>Number(value.toFixed(3))).join(',')).join('L')+(closed?'Z':'')).join('');
}
