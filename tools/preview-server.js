const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const gasRoot = path.join(root, 'gas');
const context = vm.createContext({ Date, Math, Number, Object, Array, String, Error, Set });
for (const filename of ['DayRules.gs', 'PortugueseHolidays.gs']) {
  const source = fs.readFileSync(path.join(gasRoot, filename), 'utf8');
  vm.runInContext(source, context, { filename });
}

const holidays = context.getPortugueseHolidaySeed_().reduce((map, holiday) => {
  map[holiday.date] = { name: holiday.name };
  return map;
}, {});
const overrides = {};

function createPreviewBridge() {
  return `<script>
    window.DAY_TRACKER_PREVIEW = true;
    window.google = { script: { run: makeRunner() } };
    function makeRunner(successHandler, failureHandler) {
      return {
        withSuccessHandler(handler) { return makeRunner(handler, failureHandler); },
        withFailureHandler(handler) { return makeRunner(successHandler, handler); },
        getMonthData(year, month) { invoke('getMonthData', { year, month }, successHandler, failureHandler); },
        saveDayStatus(dateKey, dayType, workMode) { invoke('saveDayStatus', { dateKey, dayType, workMode }, successHandler, failureHandler); }
      };
    }
    function invoke(method, payload, successHandler, failureHandler) {
      fetch('/api/' + method, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Preview request failed.');
        if (successHandler) successHandler(result);
      }).catch((error) => {
        if (failureHandler) failureHandler(error);
      });
    }
  </script>`;
}

function renderPage() {
  let page = fs.readFileSync(path.join(gasRoot, 'Index.html'), 'utf8');
  page = page.replace("<?!= include_('Styles'); ?>", fs.readFileSync(path.join(gasRoot, 'Styles.html'), 'utf8'));
  page = page.replace("<?!= include_('Version'); ?>", fs.readFileSync(path.join(gasRoot, 'Version.html'), 'utf8'));
  page = page.replace("<?!= include_('Client'); ?>", `${createPreviewBridge()}\n${fs.readFileSync(path.join(gasRoot, 'Client.html'), 'utf8')}`);
  return page;
}

function monthView(year, month) {
  const view = context.buildMonthView_(Number(year), Number(month), holidays, overrides);
  view.firstWeekday = context.parseDateKey_(view.days[0].date).weekday;
  return view;
}

function respond(response, status, body, contentType = 'application/json; charset=utf-8') {
  response.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
  response.end(contentType.startsWith('application/json') ? JSON.stringify(body) : body);
}

const server = http.createServer((request, response) => {
  if (request.method === 'GET' && (request.url === '/' || request.url === '/index.html')) {
    return respond(response, 200, renderPage(), 'text/html; charset=utf-8');
  }
  if (request.method !== 'POST' || !request.url.startsWith('/api/')) {
    return respond(response, 404, { message: 'Not found.' });
  }

  let body = '';
  request.on('data', (chunk) => { body += chunk; });
  request.on('end', () => {
    try {
      const payload = JSON.parse(body || '{}');
      if (request.url === '/api/getMonthData') {
        return respond(response, 200, monthView(payload.year, payload.month));
      }
      if (request.url === '/api/saveDayStatus') {
        const parsed = context.parseDateKey_(payload.dateKey);
        if (!parsed) throw new Error('Invalid date. Expected YYYY-MM-DD.');
        if (!['working', 'weekend', 'holiday', 'leave'].includes(payload.dayType)) throw new Error('Invalid day type.');
        if (payload.dayType === 'working' && !['unselected', 'office', 'home'].includes(payload.workMode)) throw new Error('Invalid work mode.');
        if (payload.dayType !== 'working' && payload.workMode !== '') throw new Error('Non-working statuses cannot have a work mode.');
        overrides[payload.dateKey] = { dayType: payload.dayType, workMode: payload.workMode };
        return respond(response, 200, monthView(parsed.year, parsed.month));
      }
      return respond(response, 404, { message: 'Unknown preview method.' });
    } catch (error) {
      return respond(response, 400, { message: error.message || 'Invalid request.' });
    }
  });
});

const port = Number(process.env.PORT || 4173);
server.listen(port, '127.0.0.1', () => {
  console.log(`Day Tracker preview: http://127.0.0.1:${port}`);
  console.log('Preview data is held in memory and is cleared when the server stops.');
});