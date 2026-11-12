import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
const { chromium } = createRequire(new URL('../../backend/package.json', import.meta.url))('playwright');
let server, browser, context, page, baseURL, run, posts, previewRequests;
const queued = () => ({ scanId: 'scan-ui-test', jobId: 'scan-ui-test', startUrl: 'https://example.com/', status: 'queued', stage: 'queued', revision: 1, progress: { completedPages: 0, totalPages: null }, maxAttempts: 3 });
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
  await server.listen(); baseURL = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); await server?.close(); });
beforeEach(async () => {
  run = queued(); posts = 0; previewRequests = 0;
  context = await browser.newContext(); await context.addInitScript(() => localStorage.setItem('sarvya-vision-v1', 'standard')); page = await context.newPage();
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('**/api/**', async route => {
    const request = route.request(), pathname = new URL(request.url()).pathname;
    if (pathname === '/api/preview') { previewRequests++; return route.fulfill({ contentType: 'text/html', body: '<h1>Actual target preview</h1><script>try { parent.__previewEscaped = true; } catch {}</script>' }); }
    let data = run;
    if (pathname.endsWith('/cancel')) { run = { ...run, revision: run.revision + 1, status: 'cancelling', stage: 'cancelling' }; data = run; }
    else if (request.method() === 'POST') { posts++; data = run; }
    else if (pathname === '/api/scans') data = [run];
    await route.fulfill({ status: request.method() === 'POST' ? 202 : 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
});
afterEach(async () => context?.close());
async function submit() {
  await page.goto(baseURL);
  await page.getByRole('textbox', { name: 'Website URL', exact: true }).fill('https://example.com/');
  await page.getByRole('button', { name: 'Scan website', exact: true }).click();
  await page.getByText('Scan queued', { exact: true }).waitFor();
}
const complete = () => { run = { ...run, revision: run.revision + 1, status: 'completed', stage: 'completed', progress: { completedPages: 1, totalPages: 1 }, pagesScanned: 1, score: 94, results: [{ url: run.startUrl, status: 'success', html: '<html lang="en"><title>Captured target</title><main><h1>Stored scan heading</h1></main><script>parent.__snapshotExecuted = true</script></html>' }], issues: [{ id: 'image-alt-0', rule: 'image-alt', title: 'Images must have alternate text', severity: 'serious', selector: '#photo', snippet: '<img id="photo">', explanation: 'Add alternate text.', fix: '<img id="photo" alt="Lake">', nodes: [{ id: 'node-1', selector: '#photo', snippet: '<img id="photo">', fix: '<img id="photo" alt="Lake">' }] }] }; };

test('polling renders real queued/processing/retry/completed states and only loads a completed preview', async () => {
  await context.addInitScript(() => { window.EventSource = undefined; });
  await submit();
  assert.equal(posts, 1); assert.equal(previewRequests, 0);
  assert.equal(await page.getByRole('textbox', { name: 'Website URL', exact: true }).isDisabled(), true);
  await page.getByText('The website preview will be available when the scan completes.', { exact: true }).waitFor();
  run = { ...run, revision: 2, status: 'processing', stage: 'accessibility-analysis', attempt: 1, progress: { completedPages: 0, totalPages: 1 } };
  await page.getByText('Scanning website · attempt 1 of 3', { exact: true }).waitFor();
  assert.equal(await page.getByRole('progressbar', { name: 'Pages checked' }).getAttribute('aria-valuenow'), '0');
  run = { ...run, revision: 3, status: 'retrying', stage: 'retrying', error: 'Temporary failure' };
  await page.getByText('Retry scheduled · attempt 1 of 3', { exact: true }).waitFor();
  complete();
  await page.getByRole('complementary', { name: 'Detected accessibility issues' }).getByText('Images must have alternate text', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Scan website', exact: true }).waitFor();
  assert.ok(previewRequests > 0);
});

test('cancellation stays busy until acknowledged and failed runs never report success', async () => {
  await context.addInitScript(() => { window.EventSource = undefined; });
  await submit(); await page.getByRole('button', { name: 'Cancel scan', exact: true }).click();
  await page.getByText('Stopping scan', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Cancelling…', exact: true }).isDisabled(), true);
  run = { ...run, revision: 3, status: 'cancelled', stage: 'cancelled' };
  await page.getByText('The run was cancelled.', { exact: true }).waitFor();
  assert.equal(previewRequests, 0);
  run = { ...queued(), scanId: 'scan-ui-failed', revision: 1 };
  await page.getByRole('button', { name: 'Scan website', exact: true }).click();
  await page.getByText('Scan queued', { exact: true }).waitFor();
  run = { ...run, revision: 2, status: 'failed', stage: 'failed', error: 'The target returned HTTP 404.' };
  await page.getByText('The target returned HTTP 404.', { exact: true }).waitFor();
  assert.equal(await page.getByText('Results are ready for review.', { exact: true }).count(), 0);
});

test('SSE snapshots update progress; an interrupted stream falls back to polling for final results', async () => {
  await context.addInitScript(() => {
    window.EventSource = class {
      constructor() { window.__stream = this; this.listeners = {}; }
      addEventListener(name, callback) { this.listeners[name] = callback; }
      close() { this.closed = true; }
    };
  });
  await submit(); await page.waitForFunction(() => !!window.__stream);
  run = { ...run, revision: 2, status: 'processing', stage: 'preview-capture', attempt: 1, progress: { completedPages: 0, totalPages: 1 } };
  await page.evaluate(snapshot => window.__stream.listeners.status({ data: JSON.stringify(snapshot) }), run);
  await page.getByText('Capturing preview and element metadata.', { exact: true }).waitFor();
  await page.evaluate(() => window.__stream.onerror());
  await page.getByText('Live updates interrupted. Checking scan status…', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.__stream.closed), true);
  complete();
  await page.getByText('Results are ready for review.', { exact: true }).waitFor();
  assert.ok(previewRequests > 0);
});

test('terminal SSE notification fetches the full completed findings before publishing success', async () => {
  await context.addInitScript(() => {
    window.EventSource = class {
      constructor() { window.__stream = this; this.listeners = {}; }
      addEventListener(name, callback) { this.listeners[name] = callback; }
      close() { this.closed = true; }
    };
  });
  await submit(); await page.waitForFunction(() => !!window.__stream);
  complete();
  const { results, issues, ...snapshot } = run;
  await page.evaluate(value => window.__stream.listeners.status({ data: JSON.stringify(value) }), snapshot);
  await page.getByRole('complementary', { name: 'Detected accessibility issues' }).getByText('Images must have alternate text', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.__stream.closed), true);
  assert.ok(previewRequests > 0);
});


test('remote preview is origin-isolated and the reader uses inert captured HTML', async () => {
  await context.addInitScript(() => { window.EventSource = undefined; });
  await submit(); complete();
  const frame = page.frameLocator('iframe[title="Target website preview"]');
  await frame.getByRole('heading', { name: 'Actual target preview' }).waitFor();
  assert.equal(await page.evaluate(() => document.querySelector('iframe[title="Target website preview"]').contentDocument), null);
  assert.equal(await page.evaluate(() => window.__previewEscaped), undefined);
  await page.getByRole('button', { name: 'Open screen reader', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Preview screen reader', exact: true });
  await panel.getByText('Captured scan document · reading outline', { exact: true }).waitFor();
  await panel.getByRole('list', { name: 'Reading transcript' }).getByRole('button').filter({ hasText: 'Stored scan heading' }).waitFor();
  assert.equal(await page.evaluate(() => window.__snapshotExecuted), undefined);
});

for (const crawl of [false, true]) test(`${crawl ? 'crawl' : 'single-page scan'} accepts a www address and submits HTTPS`, async () => {
  await context.addInitScript(() => { window.EventSource = undefined; });
  await page.goto(baseURL);
  await page.getByRole('textbox', { name: 'Website URL', exact: true }).fill('www.example.com');
  const request = page.waitForRequest(req => req.method() === 'POST' && new URL(req.url()).pathname === '/api/scan');
  if (crawl) {
    await page.getByRole('button', { name: 'Scan all pages', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: /Start/ }).click();
  } else await page.getByRole('button', { name: 'Scan website', exact: true }).click();
  assert.equal((await request).postDataJSON().url, 'https://www.example.com/');
  await page.getByText('Scan queued', { exact: true }).waitFor();
});
