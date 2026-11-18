import type {EventRecord, Topic} from './metro-model';

export function buildStarTimeline(events: EventRecord[], topics: Topic[]) {
 const ordered = [...events].sort((a,b) => a.bounds.start-b.bounds.start || a.id.localeCompare(b.id));
 const start = ordered[0]?.bounds.start ?? 0;
 const end = ordered.at(-1)?.bounds.start ?? start;
 const categories = topics.filter(topic => ordered.some(event => event.directTopicIds.includes(topic.topic_id)));
 const topicIds = new Set(categories.map(topic => topic.topic_id));
 const lanePositions = Array<number>(8).fill(-1);
 const stars = ordered.map(event => {
  const along = (event.bounds.start-start) / Math.max(1,end-start);
  const seed = [...event.id].reduce((hash,char) => Math.imul(hash,31)+char.charCodeAt(0),0) >>> 0;
  let lane = seed % lanePositions.length;
  for (let offset=1; offset<lanePositions.length && along-lanePositions[lane]<.018; offset++) {
   const candidate = (seed+offset) % lanePositions.length;
   if (lanePositions[candidate]<lanePositions[lane]) lane = candidate;
  }
  lanePositions[lane] = along;
  return {
   event,
   along,
   height: .14 + lane*.078 + (seed % 61)/2400,
   categoryIds: [...new Set(event.directTopicIds.filter(id => topicIds.has(id)))],
  };
 });
 const groups = categories.map(category => {
  const members = stars.filter(star => star.categoryIds.includes(category.topic_id));
  return {category,members};
 });
 const ranges = groups.map(({category,members}) => ({
  category,
  first:members[0],
  last:members[members.length-1],
 }));
 const links = groups.flatMap(({category,members}) =>
  members.slice(1).map((to,index) => ({categoryId: category.topic_id, from: members[index], to})));
 return {start,end,ranges,stars,links};
}

export function placeCategoryRanges(ranges: ReturnType<typeof buildStarTimeline>['ranges'], width: number) {
 const ordered = ranges.map(range => {
  const start = range.first.along*width;
  const end = range.last.along*width;
  const label = range.category.name === '페레스트로이카와 냉전 종식' ? '냉전 종식' : range.category.name;
  const labelWidth = Math.min(width,[...label].reduce((size,char) => size+(char===' ' ? 5 : 16),16));
  const labelX = Math.max(0,Math.min(start,end-labelWidth));
  return {...range,start,end,label,labelX,left:Math.min(start,labelX),right:Math.max(end,labelX+labelWidth)};
 }).sort((a,b) => a.left-b.left || b.end-a.end);
 const laneEnds: number[] = [];
 return ordered.map(range => {
  const available = laneEnds.findIndex(end => end+2<=range.left);
  const row = available<0 ? laneEnds.length : available;
  laneEnds[row] = range.right;
  return {...range,row};
 });
}

const categoryLanes = [.43,.14,.66,.3,.82,.48,.91,.35,.71,.09,.56,.23,.78];

export function placeCategoryStars(stars: ReturnType<typeof buildStarTimeline>['stars'], topicId: string, width: number, height: number) {
 const members = stars.filter(star => star.categoryIds.includes(topicId));
 const vertical = width<height;
 const padX = Math.min(64,width*.12), padY = Math.min(52,height*.12);
 return members.map((star,index) => {
  const along = members.length>1 ? index/(members.length-1) : .5;
  const lane = members.length>2 ? categoryLanes[index%categoryLanes.length] : .5;
  return {...star,
   x:padX+(width-2*padX)*(vertical ? lane : along),
   y:padY+(height-2*padY)*(vertical ? along : lane),
  };
 });
}

export function dateAtProgress(start: number, end: number, progress: number) {
 const date = new Date(start+(end-start)*Math.min(1,Math.max(0,progress)));
 return {year: date.getUTCFullYear(), month: date.getUTCMonth()+1};
}
