const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createContext(email) {
  const context = vm.createContext({
    Session: { getActiveUser: () => ({ getEmail: () => email }) }
  });
  for (const filename of ['DayRules.gs', 'Code.gs']) {
    const sourcePath = path.join(__dirname, '..', 'gas', filename);
    vm.runInContext(fs.readFileSync(sourcePath, 'utf8'), context, { filename });
  }
  return context;
}

for (const email of ['kostyamarkov@me.com', 'viktoriakostina842@gmail.com', ' KOSTYAMARKOV@ME.COM ']) {
  test(`allowed account can open, initialize, read and save: ${email}`, () => {
    const context = createContext(email);
    const page = {
      setTitle: () => page,
      addMetaTag: () => page
    };
    context.HtmlService = {
      createTemplateFromFile: () => ({ evaluate: () => page })
    };
    assert.equal(context.doGet(), page);

    context.initializeDayTracker_ = () => 'initialized';
    assert.equal(context.initializeDayTracker(), 'initialized');

    let savedValues;
    let released = false;
    const daysSheet = {
      getLastRow: () => 1,
      getRange: () => ({
        setNumberFormat: () => ({
          setValues: (values) => { savedValues = values; }
        })
      })
    };
    const holidaysSheet = {
      getLastRow: () => 2,
      getRange: () => ({
        getDisplayValues: () => [['2026-01-01', 'New Year', 'national', 'test']]
      })
    };
    context.getSpreadsheet_ = () => ({
      getSheetByName: (name) => name === 'Days' ? daysSheet : holidaysSheet
    });
    context.LockService = {
      getScriptLock: () => ({
        waitLock: () => {},
        releaseLock: () => { released = true; }
      })
    };

    const view = context.getMonthData(2026, 1);
    assert.equal(view.days.length, 31);
    assert.equal(view.days[0].holidayName, 'New Year');
    const savedView = context.saveDayStatus('2026-01-02', 'working', 'office');
    assert.equal(savedView.days.length, 31);
    assert.deepEqual(Array.from(savedValues[0].slice(0, 3)), ['2026-01-02', 'working', 'office']);
    assert.equal(released, true);
  });
}

const publicCalls = [
  ['doGet', []],
  ['initializeDayTracker', []],
  ['getMonthData', [2026, 1]],
  ['saveDayStatus', ['2026-01-02', 'working', 'office']]
];

for (const email of ['', '   ', 'other@gmail.com', 'kostyamarkov@me.com.attacker.example']) {
  for (const [name, args] of publicCalls) {
    test(`${name} rejects ${JSON.stringify(email)} before accessing services`, () => {
      const context = createContext(email);
      assert.throws(() => context[name](...args), /Access denied/);
    });
  }
}

test('all public server entry points are covered by access tests', () => {
  const context = createContext('');
  const publicFunctions = Object.keys(context)
    .filter((name) => typeof context[name] === 'function' && !name.endsWith('_'));
  assert.deepEqual(publicFunctions.sort(), publicCalls.map(([name]) => name).sort());
});
