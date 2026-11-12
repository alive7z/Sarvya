import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runAudit, inspectTarget } from '../content/audit.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../../backend/package.json', import.meta.url));
const { chromium } = require('playwright');
test('release manifest uses explicit active-tab access with no remote code or blanket hosts', async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'dist/manifest.json')));
  assert.equal(manifest.manifest_version, 3); assert.deepEqual(manifest.permissions.sort(), ['activeTab','scripting','storage']);
  assert.equal(manifest.host_permissions, undefined); assert.match(manifest.content_security_policy.extension_pages, /script-src 'self'/);
  for (const file of [manifest.background.service_worker, manifest.action.default_popup, ...Object.values(manifest.icons), 'lib/axe.min.js', 'lib/AXE-LICENSE.txt']) await fs.access(path.join(root, 'dist', file));
});
test('real extension loads in Chromium with a working service worker', { skip: process.env.BROWSER_TESTS !== '1' }, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sarvya-extension-'));
  let context;
  try {
    context = await chromium.launchPersistentContext(directory, { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${root}dist`, `--load-extension=${root}dist`] });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 10000 });
    assert.match(worker.url(), /^chrome-extension:\/\//);
    const permissions = await worker.evaluate(() => chrome.runtime.getManifest().permissions);
    assert.ok(permissions.includes('activeTab'));
  } finally { await context?.close(); await fs.rm(directory, { recursive: true, force: true }); }
});
test('real axe content audit detects findings and inspection is removable without executing HTML', { skip: process.env.BROWSER_TESTS !== '1' }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage(); await page.setContent('<html lang="en"><title>Fixture</title><main><h1>Audit</h1><img id="target"><button></button></main></html>');
    await page.addScriptTag({ path: path.join(root, 'dist/lib/axe.min.js') });
    const result = await page.evaluate(runAudit); assert.ok(result.violations.some(v => v.id === 'image-alt')); assert.ok(result.occurrences > 0);
    await page.evaluate(inspectTarget, ['#target']); assert.equal(await page.locator('#sarvya-inspection').count(), 1);
    await assert.rejects(page.evaluate(inspectTarget, ['#missing']), /no longer/);
    await assert.rejects(page.evaluate(inspectTarget, ['#frame', '#inside']), /frame or shadow/);
  } finally { await browser.close(); }
});
test('popup renders actual data safely, exports, handles errors and remains keyboard readable', { skip: process.env.BROWSER_TESTS !== '1' }, async () => {
  const server = http.createServer(async (req, res) => {
    const file = req.url === '/' ? 'popup/index.html' : `popup/${path.basename(req.url)}`;
    try { res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html'); res.end(await fs.readFile(path.join(root, 'dist', file))); } catch { res.writeHead(404); res.end(); }
  }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
    await page.addInitScript(() => { window.chrome = { runtime: { sendMessage: async message => {
      if (message.type === 'inspect') return { ok: false, error: 'The element changed. Re-scan.' };
      if (message.type === 'clear') return { ok: true, result: { status: 'idle' } };
      return { ok: true, result: { status: 'completed', result: { occurrences: 1, incomplete: [], violations: [{ id: 'image-alt', impact: 'critical', help: '<img src=x onerror=alert(1)>', helpUrl: 'https://dequeuniversity.com/', count: 1, nodes: [{ target: ['#sample'] }] }] } } };
    } } }; });
    await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.getByRole('heading', { name: '<img src=x onerror=alert(1)>' }).waitFor();
    assert.equal(await page.locator('article img').count(), 0);
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download JSON report' }).click(); assert.equal((await download).suggestedFilename(), 'sarvya-audit.json');
    await page.getByRole('button', { name: 'Inspect element' }).click(); await page.getByRole('alert').getByText('The element changed. Re-scan.').waitFor();
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
    const checks = await page.evaluate(() => axe.run(document, { runOnly: ['color-contrast','button-name','label'] })); assert.equal(checks.violations.length, 0);
    await page.getByRole('button', { name: 'Clear results' }).click(); await page.getByText('Ready to scan.', { exact: true }).waitFor();
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
