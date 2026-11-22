import {eventMapExamples} from '../event-map-links.js';

export const storyEntries = {
  'cuba-story': {eventId:'E056', url:'./cuba-story.html?play'},
  'berlin-story': {eventId:'E018', url:'./berlin-story.html?play'},
  volunteers: {eventId:'E195', url:'./asia-stories.html?story=volunteers&play'},
  diplomacy: {eventId:'E083', url:'./asia-stories.html?story=diplomacy&play'},
};

export async function readStoryEvents() {
  const [csv,links,categories,spaces,eventSpaces] = await Promise.all([
    SheetData.eventSheetCSV(SHEET_CONFIG),
    SheetData.readCategoryLinks(SHEET_CONFIG),
    SheetData.sheetRecords(SHEET_CONFIG,'카테고리',['카테고리ID','카테고리명','카테고리유형']),
    SheetData.sheetRecords(SHEET_CONFIG,'공간',['공간ID','공간명']),
    SheetData.sheetRecords(SHEET_CONFIG,'사건_공간',['사건ID','공간ID'])
  ]);
  const rows = SheetData.parseCSV(csv,true);
  const records = eventMapExamples(rows);
  const names = new Map(categories.filter(row => row.카테고리유형 === 'arc').map(row => [row.카테고리ID,row.카테고리명]));
  const arcs = new Map();
  for (const {event_id,topic_id} of links) {
    const name = names.get(topic_id);
    if (!name) continue;
    if (!arcs.has(event_id)) arcs.set(event_id,new Set());
    arcs.get(event_id).add(name);
  }
  const places = SheetData.linkedSpaceNames(spaces,eventSpaces,'사건ID');
  return records.map(r => ({
    id:r.사건ID, title:r.사건명, date:r.날짜, end:r.종료일, body:r.내용, row:r.sheetRow,
    arcs:[...(arcs.get(r.사건ID) || [])], place:[...(places.get(r.사건ID) || [])].join(', '),
  })).sort((a,b) => a.date.localeCompare(b.date) || a.row-b.row);
}
