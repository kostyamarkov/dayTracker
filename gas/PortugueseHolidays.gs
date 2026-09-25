const PORTUGUESE_HOLIDAY_SOURCE = 'https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2009-34546475';

function getPortugueseHolidaySeed_() {
  const holidays = [];
  [2026, 2027].forEach((year) => {
    const easter = getEasterSundayDateKey_(year);
    holidays.push(
      { date: `${year}-01-01`, name: "New Year's Day" },
      { date: shiftDateKey_(easter, -2), name: 'Good Friday' },
      { date: easter, name: 'Easter Sunday' },
      { date: `${year}-04-25`, name: 'Freedom Day' },
      { date: `${year}-05-01`, name: 'Labour Day' },
      { date: shiftDateKey_(easter, 60), name: 'Corpus Christi' },
      { date: `${year}-06-10`, name: 'Portugal Day' },
      { date: `${year}-08-15`, name: 'Assumption of Mary' },
      { date: `${year}-10-05`, name: 'Republic Day' },
      { date: `${year}-11-01`, name: 'All Saints\' Day' },
      { date: `${year}-12-01`, name: 'Restoration of Independence' },
      { date: `${year}-12-08`, name: 'Immaculate Conception' },
      { date: `${year}-12-25`, name: 'Christmas Day' }
    );
  });

  return holidays.map((holiday) => ({
    date: holiday.date,
    name: holiday.name,
    scope: 'national',
    source: PORTUGUESE_HOLIDAY_SOURCE
  }));
}

function getEasterSundayDateKey_(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function shiftDateKey_(dateKey, offsetDays) {
  const parsed = parseDateKey_(dateKey);
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + offsetDays));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}