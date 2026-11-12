import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
const { chromium } = createRequire(new URL('../../backend/package.json', import.meta.url))('playwright');
let server, browser, context, page, baseURL, monitors, notifications, history, requests, failCreate, failLoad;
const target = 'https://example.com/';
const initial = () => ({ id: 'mon-ui', url: target, frequency: 'weekly', time: '09:00', timeZone: 'UTC', weekday: 1, maxPages: 1, maxDepth: 1, baselineMode: 'fixed', active: true, alerts: true, scope: 'scope-1', scheduleStatus: 'scheduled', nextRunAt: '2030-01-01T09:00:00Z', pendingRun: null, baselineScanId: null, historyCount: 0 });
const scanResult = id => ({ scanId: id, status: 'completed', startUrl: target, pagesScanned: 1, score: 94, results: [{ url: target, status: 'success', html: '<main>Captured page</main>' }], issues: [{ id: 'image-alt-0', title: 'Images need alternate text', rule: 'image-alt', severity: 'serious', count: 1, selector: '#logo', snippet: '<img id="logo">', explanation: 'Provide alternate text.', nodes: [{ id: 'node-1', selector: '#logo', snippet: '<img id="logo">' }], fix: '<img id="logo" alt="Logo">' }] });
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' }); await server.listen(); baseURL = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); await server?.close(); });
beforeEach(async () => {
  monitors = []; notifications = []; history = []; requests = []; failCreate = false; failLoad = false;
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); await context.addInitScript(() => localStorage.setItem('sarvya-vision-v1', 'standard')); page = await context.newPage();
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), pathname = url.pathname, method = req.method();
    let data;
    if (method !== 'GET') requests.push({ method, pathname, body: req.postData() ? req.postDataJSON() : null });
    if (failLoad && pathname === '/api/monitors') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Monitoring storage is unavailable.' }) });
    if (pathname === '/api/monitors' && method === 'GET') data = monitors;
    else if (pathname === '/api/monitors/status') data = { queueAvailable: true, workerOnline: true };
    else if (pathname === '/api/monitors/notifications') {
      const visible = url.searchParams.get('unread') === 'true' ? notifications.filter(n => !n.readAt) : notifications;
      data = { notifications: visible, total: visible.length, unreadCount: notifications.filter(n => !n.readAt).length, page: 1 };
    } else if (pathname === '/api/monitors' && method === 'POST') {
      if (failCreate) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Use a reachable public HTTP(S) website.' }) });
      const body = req.postDataJSON(); monitors = [{ ...initial(), ...body }]; data = monitors[0];
    } else if (pathname.endsWith('/history') && method === 'GET') data = { runs: history, total: history.length, page: Number(url.searchParams.get('page') || 1), baselineScanId: monitors[0]?.baselineScanId, baselineMode: 'fixed' };
    else if (pathname.endsWith('/comparison')) data = { scanId: 'scan-new', baselineScanId: 'scan-base', summary: { new: 1, resolved: 0, persistent: 1, uncertain: 0, worsened: 0 }, entries: [{ key: 'finding-new', rule: 'image-alt', change: 'new', selector: '#new-image', impact: 'serious', url: target, previousCount: 0, count: 1 }] };
    else if (pathname.includes('/notifications/') && method === 'PATCH') { const body = req.postDataJSON(); notifications = notifications.map(n => ({ ...n, readAt: body.read ? '2030-01-01T10:00:00Z' : null })); data = { read: body.read }; }
    else if (pathname.endsWith('/run') && method === 'POST') { monitors = monitors.map(m => ({ ...m, pendingRun: { scanId: 'scan-pending', status: 'queued', stage: 'queued', progress: { completedPages: 0, totalPages: null } } })); data = { scanId: 'scan-pending', status: 'queued' }; }
    else if (pathname === '/api/monitors/mon-ui' && method === 'PATCH') {
      const body = req.postDataJSON(); monitors = monitors.map(m => ({ ...m, ...body, scheduleStatus: body.active === false ? 'paused' : 'scheduled', nextRunAt: body.active === false ? null : initial().nextRunAt })); data = monitors[0];
    } else if (pathname === '/api/monitors/mon-ui' && method === 'DELETE') { monitors = []; data = { deleted: true, historyPreserved: true }; }
    else if (pathname.startsWith('/api/scans/')) data = scanResult(pathname.split('/').at(-1));
    else if (pathname === '/api/preview') return route.fulfill({ contentType: 'text/html', body: '<h1>Target preview</h1>' });
    if (data === undefined) throw Error(`Unexpected request ${method} ${pathname}`);
    return route.fulfill({ status: method === 'POST' ? pathname.endsWith('/run') ? 202 : 201 : 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
});
afterEach(async () => context?.close());
async function open(mobile = false) {
  await page.goto(baseURL);
  if (mobile) await page.getByRole('combobox', { name: 'Navigate', exact: true }).selectOption('monitoring');
  else await page.getByRole('button', { name: 'Monitoring', exact: true }).click();
  await page.getByRole('heading', { name: 'Continuous monitoring', exact: true }).waitFor();
}
const card = () => page.getByRole('article', { name: `Monitor ${target}`, exact: true });

test('monitoring starts empty, creates a time-zone-aware schedule, and supports pause, edit, resume, and deletion', async () => {
  await open(); await page.getByText('No monitors configured. Add a website to schedule its first accessibility audit.', { exact: true }).waitFor();
  await page.getByRole('textbox', { name: 'Monitor website URL', exact: true }).fill(target);
  await page.getByRole('combobox', { name: 'Scan frequency', exact: true }).selectOption('daily');
  await page.getByLabel('Local scan time', { exact: true }).fill('14:30');
  await page.getByRole('textbox', { name: 'Schedule time zone', exact: true }).fill('Asia/Kolkata');
  await page.getByRole('button', { name: 'Add monitor', exact: true }).click();
  await card().getByText('Scheduled', { exact: true }).waitFor();
  const created = requests.find(r => r.pathname === '/api/monitors' && r.method === 'POST').body;
  assert.equal(created.timeZone, 'Asia/Kolkata'); assert.equal(created.time, '14:30'); assert.equal(created.frequency, 'daily');
  assert.equal(await card().getByText(/Last completed scan:/).count(), 0);
  await card().getByRole('button', { name: 'Pause', exact: true }).click(); await card().getByText('Paused', { exact: true }).waitFor();
  await card().getByRole('button', { name: 'Resume', exact: true }).click(); await card().getByText('Scheduled', { exact: true }).waitFor();
  await card().getByRole('button', { name: 'Edit schedule', exact: true }).click();
  await page.getByRole('combobox', { name: 'Scan frequency', exact: true }).selectOption('weekly');
  await page.getByRole('button', { name: 'Save monitor', exact: true }).click();
  await card().getByText(/weekly at 14:30/).waitFor();
  await card().getByRole('button', { name: 'Delete monitor', exact: true }).click(); await card().waitFor({ state: 'detached' });
});

test('history exposes real comparisons and baseline selection; notifications can be read and their scans opened', async () => {
  monitors = [{ ...initial(), baselineScanId: 'scan-base', lastSuccessfulScanId: 'scan-new', lastRunAt: '2030-01-01T09:01:00Z', score: 88, openIssues: 2 }];
  history = [{ scanId: 'scan-new', status: 'completed', scope: 'scope-1', pagesScanned: 1, pagesFailed: 0, score: 88, baselineEligible: true, finishedAt: '2030-01-01T09:01:00Z', comparison: { new: 1, worsened: 0, resolved: 0, persistent: 1, uncertain: 0 } }];
  notifications = [{ id: 'notice-1', monitorId: 'mon-ui', scanId: 'scan-new', type: 'regression', message: '1 new accessibility finding since the previous run.', url: target, createdAt: '2030-01-01T09:01:00Z', readAt: null }];
  await open(); await card().getByRole('button', { name: 'View history', exact: true }).click();
  const region = page.getByRole('region', { name: 'Monitor scan history', exact: true });
  await region.getByRole('button', { name: 'View comparison', exact: true }).click();
  await region.getByText(`${target} · #new-image`, { exact: true }).waitFor();
  await region.getByRole('button', { name: 'Use as fixed baseline', exact: true }).click();
  await region.getByText('Baseline: scan-new · fixed', { exact: true }).waitFor();
  assert.ok(requests.some(r => r.body?.baselineScanId === 'scan-new' && r.body?.baselineMode === 'fixed'));
  await page.getByRole('button', { name: 'Mark read', exact: true }).click();
  await page.getByRole('button', { name: 'Mark unread', exact: true }).waitFor();
  await page.getByRole('button', { name: 'View notified scan', exact: true }).click();
  await page.getByRole('heading', { name: 'Audit workspace', exact: true }).waitFor();
  await page.getByRole('complementary', { name: 'Detected accessibility issues' }).getByText('Images need alternate text', { exact: true }).waitFor();
});

test('run now shows actual queued progress and then persisted completion on refresh', async () => {
  monitors = [initial()]; await open(); await card().getByRole('button', { name: 'Run now', exact: true }).click();
  await card().getByText('queued · queued', { exact: true }).waitFor();
  assert.equal(await card().getByRole('button', { name: 'Run now', exact: true }).isDisabled(), true);
  assert.equal(await card().getByText(/Last completed scan:/).count(), 0);
  monitors = [{ ...monitors[0], pendingRun: null, lastSuccessfulScanId: 'scan-pending', score: 94, openIssues: 1, lastRunAt: '2030-01-01T09:01:00Z', baselineScanId: 'scan-pending' }];
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await card().getByText('Last completed scan: 94/100 project estimate · 1 occurrence(s)', { exact: true }).waitFor();
});

test('API failures do not create fake monitors or claim an empty loaded history', async () => {
  failLoad = true; await open(); await page.getByRole('alert').filter({ hasText: 'Monitoring storage is unavailable.' }).waitFor();
  assert.equal(await page.getByText('No monitors configured. Add a website to schedule its first accessibility audit.', { exact: true }).count(), 0);
  failLoad = false; await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('textbox', { name: 'Monitor website URL', exact: true }).fill('https://invalid.example/'); failCreate = true;
  await page.getByRole('button', { name: 'Add monitor', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Use a reachable public HTTP(S) website.' }).waitFor();
  assert.equal(await page.getByRole('article', { name: /Monitor https:/ }).count(), 0);
});

test('monitoring form and controls fit narrow screens', async () => {
  await page.setViewportSize({ width: 390, height: 844 }); monitors = [initial()]; await open(true); await card().waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.getByRole('textbox', { name: 'Monitor website URL', exact: true }).focus();
  assert.equal(await page.getByRole('textbox', { name: 'Monitor website URL', exact: true }).evaluate(element => element === document.activeElement), true);
});

test('scheduling accepts a www address without a scheme and submits an HTTPS URL', async () => {
  await open();
  await page.getByRole('textbox', { name: 'Monitor website URL' }).fill('www.example.com');
  await page.getByRole('button', { name: 'Add monitor', exact: true }).click();
  await page.getByRole('article', { name: 'Monitor https://www.example.com/', exact: true }).waitFor();
  assert.equal(requests.find(request => request.method === 'POST' && request.pathname === '/api/monitors')?.body?.url, 'https://www.example.com/');
});

test('an invalid monitor URL shows a clear inline error without sending a request', async () => {
  await open();
  const input = page.getByRole('textbox', { name: 'Monitor website URL', exact: true });
  await input.fill('ftp://example.com/');
  await page.getByRole('button', { name: 'Add monitor', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Enter a website address' }).waitFor();
  assert.equal(await input.getAttribute('aria-invalid'), 'true');
  assert.equal(requests.filter(request => request.method === 'POST').length, 0);
  await input.fill('example.com'); await input.press('Enter');
  await card().waitFor();
  assert.equal(requests.find(request => request.method === 'POST')?.body?.url, 'https://example.com/');
});
