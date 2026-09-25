const HOLIDAYS_TAB = 'Holidays';
const DAYS_TAB = 'Days';
const HOLIDAY_HEADERS = ['date', 'name', 'scope', 'source'];
const DAY_HEADERS = ['date', 'dayType', 'workMode', 'updatedAt'];

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Day Tracker')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include_(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function initializeDayTracker() {
  return initializeDayTracker_();
}

function initializeDayTracker_() {
  const spreadsheet = getSpreadsheet_();
  const holidaysSheet = ensureSheet_(spreadsheet, HOLIDAYS_TAB, HOLIDAY_HEADERS);
  const daysSheet = ensureSheet_(spreadsheet, DAYS_TAB, DAY_HEADERS);

  seedHolidays_(holidaysSheet);
  holidaysSheet.setFrozenRows(1);
  daysSheet.setFrozenRows(1);
  holidaysSheet.autoResizeColumns(1, HOLIDAY_HEADERS.length);
  daysSheet.autoResizeColumns(1, DAY_HEADERS.length);

  return 'Day Tracker sheets are ready. The Holidays tab includes national holidays for 2026 and 2027.';
}

function getMonthData(year, month) {
  const dateKeys = getMonthDateKeys_(Number(year), Number(month));
  const spreadsheet = getSpreadsheet_();
  const holidaysByDate = readHolidayMap_(spreadsheet.getSheetByName(HOLIDAYS_TAB));
  const overridesByDate = readDayOverrides_(spreadsheet.getSheetByName(DAYS_TAB));
  const view = buildMonthView_(Number(year), Number(month), holidaysByDate, overridesByDate);

  view.firstWeekday = parseDateKey_(dateKeys[0]).weekday;
  return view;
}

function saveDayStatus(dateKey, dayType, workMode) {
  const parsed = parseDateKey_(dateKey);
  if (!parsed) {
    throw new Error('Invalid date. Expected YYYY-MM-DD.');
  }
  validateDayStatus_(dayType, workMode);

  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const sheet = getSpreadsheet_().getSheetByName(DAYS_TAB);
    if (!sheet) {
      throw new Error('The Days tab is missing. Run initializeDayTracker_() in the Apps Script editor first.');
    }

    const lastRow = sheet.getLastRow();
    const rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, DAY_HEADERS.length).getDisplayValues() : [];
    const existingIndex = rows.findIndex((row) => row[0] === dateKey);
    const targetRow = existingIndex >= 0 ? existingIndex + 2 : lastRow + 1;
    const workModeValue = dayType === 'working' ? workMode : '';

    sheet.getRange(targetRow, 1, 1, DAY_HEADERS.length)
      .setNumberFormat('@')
      .setValues([[dateKey, dayType, workModeValue, new Date().toISOString()]]);

    return getMonthData(parsed.year, parsed.month);
  } finally {
    lock.releaseLock();
  }
}

function getSpreadsheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) {
    throw new Error('Set the SPREADSHEET_ID script property, then run initializeDayTracker_() from the Apps Script editor.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function ensureSheet_(spreadsheet, sheetName, headers) {
  const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat('@');
  return sheet;
}

function seedHolidays_(sheet) {
  const seed = getPortugueseHolidaySeed_();
  const lastRow = sheet.getLastRow();
  const existingDates = new Set(lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues().flat()
    : []);
  const missing = seed.filter((holiday) => !existingDates.has(holiday.date));

  if (missing.length) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, missing.length, HOLIDAY_HEADERS.length)
      .setNumberFormat('@')
      .setValues(missing.map((holiday) => [holiday.date, holiday.name, holiday.scope, holiday.source]));
  }
}

function readHolidayMap_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) {
    throw new Error('The Holidays tab is missing or empty. Run initializeDayTracker_() in the Apps Script editor first.');
  }
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, HOLIDAY_HEADERS.length).getDisplayValues();
  return rows.reduce((map, row) => {
    if (parseDateKey_(row[0])) {
      map[row[0]] = { name: row[1] };
    }
    return map;
  }, {});
}

function readDayOverrides_(sheet) {
  if (!sheet) {
    throw new Error('The Days tab is missing. Run initializeDayTracker_() in the Apps Script editor first.');
  }
  if (sheet.getLastRow() < 2) {
    return {};
  }
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, DAY_HEADERS.length).getDisplayValues();
  return rows.reduce((map, row) => {
    if (parseDateKey_(row[0])) {
      map[row[0]] = { dayType: row[1], workMode: row[2] };
    }
    return map;
  }, {});
}

function validateDayStatus_(dayType, workMode) {
  if (!VALID_DAY_TYPES.includes(dayType)) {
    throw new Error('Invalid day type.');
  }
  if (dayType === 'working' && !VALID_WORK_MODES.includes(workMode)) {
    throw new Error('Invalid work mode.');
  }
  if (dayType !== 'working' && workMode !== '') {
    throw new Error('Non-working statuses cannot have a work mode.');
  }
}