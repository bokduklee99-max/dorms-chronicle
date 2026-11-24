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
