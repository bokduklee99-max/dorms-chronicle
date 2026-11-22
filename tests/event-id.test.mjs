import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

for (const defaults of [10, 13, null]) test(defaults ? `editing titles allocates stable IDs with defaults from column ${defaults}` : 'normalized events allocate IDs from the title in D without review columns', () => {
  const offset = defaults ? defaults - 1 : 0;
  const titleColumn = defaults ? 2 : 4;
  const rows = Array.from({length: 7}, () => Array(defaults ? offset + 5 : 7).fill(''));
  if (defaults) {
    rows[0].splice(0, 2, '사건ID', '사건명');
    rows[0].splice(offset, 5, '날짜유형', '게임출제', '검토상태', '종료일', '출처');
  } else rows[0] = ['사건ID','날짜','종료일','사건명','사건유형','내용','이미지'];
  rows[1][0] = 'E199';
  rows[2][titleColumn-1] = '새 사건 1';
  rows[3][titleColumn-1] = '새 사건 2';
  if (defaults) {
    rows[2][offset + 2] = 'summary';
    rows[3][offset + 3] = '1990';
  } else rows[2][1] = '1923';
  const properties = new Map();
  const sheet = {
    getSheetId: () => 201117001,
    getLastRow: () => rows.length,
    getLastColumn: () => rows[0].length,
    getRange: (row, col, count = 1, width = 1) => ({
      getValues: () => rows.slice(row - 1, row - 1 + count).map(values => values.slice(col - 1, col - 1 + width)),
      setValue: value => { rows[row - 1][col - 1] = value; },
    }),
  };
  const context = vm.createContext({
    LockService: {getDocumentLock: () => ({waitLock() {}, releaseLock() {}})},
    PropertiesService: {getDocumentProperties: () => ({getProperty: key => properties.get(key), setProperty: (key, value) => properties.set(key, value)})},
    SpreadsheetApp: {flush() {}},
  });
  vm.runInContext(readFileSync(new URL('../scripts/apps-script/Code.gs', import.meta.url), 'utf8'), context);
  const edit = (start, end, column = titleColumn, last = column) => context.onEdit({range: {
    getSheet: () => sheet, getRow: () => start, getLastRow: () => end,
    getColumn: () => column, getLastColumn: () => last,
  }});
  edit(3, 4, 3);
  assert.equal(rows[2][0], '');
  edit(3, 5, 2, titleColumn);
  assert.deepEqual(rows.slice(2, 5).map(row => row[0]), ['E200', 'E201', '']);
  if (defaults) {
    assert.deepEqual(rows[2].slice(offset, offset + 3), ['stated', false, 'summary']);
    assert.deepEqual(rows[3].slice(offset, offset + 4), ['stated', false, 'draft', '1990']);
  } else assert.deepEqual(rows[2], ['E200','1923','','새 사건 1','','','']);
  rows[2][titleColumn-1] = '바꾼 제목';
  edit(3, 3);
  assert.equal(rows[2][0], 'E200');
  rows[3].fill('');
  rows[4][titleColumn-1] = '삭제 후 추가';
  edit(5, 5);
  assert.equal(rows[4][0], 'E202');
});
