function onEdit(e) {
  if (!e || !e.range) return;
  const edited = e.range;
  const sheet = edited.getSheet();
  if (sheet.getSheetId() !== 201117001 || edited.getLastRow() < 2) return;

  const lock = LockService.getDocumentLock();
  lock.waitLock(5000);
  try {
    const first = Math.max(2, edited.getRow());
    const width = sheet.getLastColumn();
    const [headers] = sheet.getRange(1, 1, 1, width).getValues();
    const idColumn = headers.indexOf('사건ID');
    const titleColumn = headers.indexOf('사건명');
    if (idColumn < 0 || titleColumn < 0 || edited.getColumn() > titleColumn + 1 || edited.getLastColumn() < titleColumn + 1) return;
    const dateQualifier = headers.indexOf('날짜유형');
    const gameEligible = headers.indexOf('게임출제');
    const reviewStatus = headers.indexOf('검토상태');
    const pending = sheet.getRange(first, 1, edited.getLastRow() - first + 1, width).getValues()
      .map((values, index) => ({values, row: first + index}))
      .filter(({values}) => !values[idColumn] && String(values[titleColumn] ?? '').trim());
    if (!pending.length) return;

    const properties = PropertiesService.getDocumentProperties();
    let number = Math.max(183, Number(properties.getProperty('lastEventNumber')) || 0);
    for (const [id] of sheet.getRange(2, idColumn + 1, Math.max(1, sheet.getLastRow() - 1)).getValues()) {
      if (/^E\d+$/.test(id)) number = Math.max(number, Number(id.slice(1)));
    }
    properties.setProperty('lastEventNumber', String(number + pending.length));
    for (const {values, row} of pending) {
      if (dateQualifier >= 0 && !values[dateQualifier]) sheet.getRange(row, dateQualifier + 1).setValue('stated');
      if (gameEligible >= 0 && values[gameEligible] === '') sheet.getRange(row, gameEligible + 1).setValue(false);
      if (reviewStatus >= 0 && !values[reviewStatus]) sheet.getRange(row, reviewStatus + 1).setValue('draft');
      sheet.getRange(row, idColumn + 1).setValue('E' + String(++number).padStart(3, '0'));
    }
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}
