const HOME_DAY_ALLOWANCE = 10;
const VALID_DAY_TYPES = ['working', 'weekend', 'holiday', 'leave'];
const VALID_WORK_MODES = ['unselected', 'office', 'home'];

function parseDateKey_(dateKey) {
  if (typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return null;
  }

  const parts = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  if (date.getUTCFullYear() !== parts[0] || date.getUTCMonth() !== parts[1] - 1 || date.getUTCDate() !== parts[2]) {
    return null;
  }

  return { year: parts[0], month: parts[1], day: parts[2], weekday: date.getUTCDay() };
}

function getMonthDateKeys_(year, month) {
  if (!Number.isInteger(year) || year < 1900 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Invalid year or month.');
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: daysInMonth }, (_, index) => {
    return `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`;
  });
}

function getEffectiveDay_(dateKey, holidaysByDate, overridesByDate) {
  const parsed = parseDateKey_(dateKey);
  if (!parsed) {
    throw new Error('Invalid date key. Expected YYYY-MM-DD.');
  }

  const override = overridesByDate[dateKey];
  if (override) {
    if (!VALID_DAY_TYPES.includes(override.dayType)) {
      throw new Error(`Invalid day type for ${dateKey}.`);
    }
    if (override.dayType === 'working' && !VALID_WORK_MODES.includes(override.workMode)) {
      throw new Error(`Invalid work mode for ${dateKey}.`);
    }
    return {
      date: dateKey,
      dayType: override.dayType,
      workMode: override.dayType === 'working' ? override.workMode : null,
      holidayName: override.dayType === 'holiday' ? (override.holidayName || '') : ''
    };
  }

  const holiday = holidaysByDate[dateKey];
  if (holiday) {
    return { date: dateKey, dayType: 'holiday', workMode: null, holidayName: holiday.name || '' };
  }

  if (parsed.weekday === 0 || parsed.weekday === 6) {
    return { date: dateKey, dayType: 'weekend', workMode: null, holidayName: '' };
  }

  return { date: dateKey, dayType: 'working', workMode: 'unselected', holidayName: '' };
}

function buildMonthView_(year, month, holidaysByDate, overridesByDate) {
  const days = getMonthDateKeys_(year, month).map((dateKey) => {
    return getEffectiveDay_(dateKey, holidaysByDate || {}, overridesByDate || {});
  });
  const homeDays = days.filter((day) => {
    return day.dayType === 'working' && day.workMode !== 'office';
  }).length;

  return {
    year,
    month,
    allowance: HOME_DAY_ALLOWANCE,
    homeDays,
    progressPercent: Math.min((homeDays / HOME_DAY_ALLOWANCE) * 100, 100),
    overLimit: homeDays > HOME_DAY_ALLOWANCE,
    days
  };
}