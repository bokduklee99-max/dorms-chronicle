let EVENTS = [];
const SOVIET = ['RUS','UKR','BLR','EST','LVA','LTU','MDA','GEO','ARM','AZE','KAZ','UZB','TKM','KGZ','TJK'];
const WEST = ['USA','CAN','GBR','FRA','ITA','BEL','NLD','LUX','DNK','NOR','ISL','PRT'];
const EAST_EUROPE = ['POL','CZE','SVK','HUN','ROU','BGR'];
function insertionIndex(placed, event) {
  const index = placed.findIndex(item => item.bounds.start > event.bounds.end);
  return index < 0 ? placed.length : index;
}
// shortcut: Modern borders and a simplified alignment, replace with dated historical polygons before classroom release.
function blocAt(id, year) {
  if (year < 1945) return 'other';
  if (SOVIET.includes(id)) return year <= 1990 ? 'east' : 'other';
  if (WEST.includes(id)) return year >= 1949 ? 'west' : 'other';
  if (id === 'DEU') return year >= 1955 ? 'west' : 'other';
  if (EAST_EUROPE.includes(id)) return year >= 1948 && year <= 1988 ? 'east' : 'other';
  if (id === 'CHN') return year >= 1949 && year <= 1959 ? 'east' : 'other';
  if (id === 'MNG') return year <= 1990 ? 'east' : 'other';
  if (id === 'CUB') return year >= 1961 && year <= 1990 ? 'east' : 'other';
  if (id === 'PRK') return year >= 1948 && year <= 1990 ? 'east' : 'other';
  if (id === 'KOR') return year >= 1953 ? 'west' : 'other';
  if (id === 'JPN') return year >= 1951 ? 'west' : 'other';
  if (['TUR','GRC'].includes(id)) return year >= 1952 ? 'west' : 'other';
  if (id === 'ESP') return year >= 1982 ? 'west' : 'other';
  if (['AUS','NZL'].includes(id)) return year >= 1951 ? 'west' : 'other';
  return 'other';
}
