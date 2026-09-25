const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const context = vm.createContext({ Date, Math, Number, Object, Array, String, Error });
const rulesPath = path.join(__dirname, '..', 'gas', 'DayRules.gs');
vm.runInContext(fs.readFileSync(rulesPath, 'utf8'), context, { filename: rulesPath });
const holidayPath = path.join(__dirname, '..', 'gas', 'PortugueseHolidays.gs');
vm.runInContext(fs.readFileSync(holidayPath, 'utf8'), context, { filename: holidayPath });

test('default weekdays count as home while weekends do not', () => {
  const view = context.buildMonthView_(2026, 1, {}, {});

  assert.equal(view.homeDays, 22);
  assert.equal(view.days.find((day) => day.date === '2026-01-03').dayType, 'weekend');
  assert.equal(view.days.find((day) => day.date === '2026-01-05').workMode, 'unselected');
});

test('office, holiday, and leave overrides are excluded from the count', () => {
  const view = context.buildMonthView_(2026, 1, {
    '2026-01-01': { name: 'New Year\'s Day' }
  }, {
    '2026-01-02': { dayType: 'working', workMode: 'office' },
    '2026-01-05': { dayType: 'leave' }
  });

  assert.equal(view.homeDays, 19);
  assert.equal(view.days.find((day) => day.date === '2026-01-01').holidayName, 'New Year\'s Day');
});

test('a converted weekend counts according to its work mode', () => {
  const view = context.buildMonthView_(2026, 1, {}, {
    '2026-01-03': { dayType: 'working', workMode: 'unselected' }
  });

  assert.equal(view.homeDays, 23);
  assert.equal(view.days.find((day) => day.date === '2026-01-03').dayType, 'working');
});

test('home-day count may exceed the allowance while progress stays capped', () => {
  const overrides = {};
  for (const date of context.getMonthDateKeys_(2026, 1).slice(0, 12)) {
    overrides[date] = { dayType: 'working', workMode: 'unselected' };
  }
  const view = context.buildMonthView_(2026, 1, {}, overrides);

  assert.equal(view.homeDays, 26);
  assert.equal(view.progressPercent, 100);
  assert.equal(view.overLimit, true);
});

test('invalid calendar dates and months are rejected', () => {
  assert.equal(context.parseDateKey_('2026-02-29'), null);
  assert.throws(() => context.getMonthDateKeys_(2026, 13), /Invalid year or month/);
  assert.throws(() => context.getEffectiveDay_('2026-01-01', {}, {
    '2026-01-01': { dayType: 'working', workMode: 'unknown' }
  }), /Invalid work mode/);
});

test('Portuguese national holiday seed contains only 2026 and 2027 dates', () => {
  const holidays = context.getPortugueseHolidaySeed_();
  const years = new Set(holidays.map((holiday) => holiday.date.slice(0, 4)));

  assert.equal(holidays.length, 26);
  assert.deepEqual(Array.from(years).sort(), ['2026', '2027']);
  assert.equal(holidays.find((holiday) => holiday.name === 'Good Friday' && holiday.date.startsWith('2026')).date, '2026-04-03');
  assert.equal(holidays.find((holiday) => holiday.name === 'Corpus Christi' && holiday.date.startsWith('2027')).date, '2027-05-27');
  assert.ok(holidays.every((holiday) => holiday.scope === 'national'));
});