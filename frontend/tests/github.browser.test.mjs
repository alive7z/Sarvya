import { test, before, after as afterAll, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
const { chromium } = createRequire(new URL('../../backend/package.json', import.meta.url))('playwright');
let server, browser, context, page, baseURL, authenticated, configured, review, writes, failPR;
const initialReview = () => ({ id: '11111111-1111-4111-8111-111111111111', revision: 1, status: 'draft', repository: { id: 7, fullName: 'alice/site', defaultBranch: 'main' }, baseSha: 'a'.repeat(40), branch: 'sarvya/fix-test', patches: [] });
const original = '<main><img src="photo.jpg"></main>', after = '<img src="photo.jpg" alt="Lake">';
before(async () => {
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
  await server.listen(); baseURL = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch();
});
afterAll(async () => { await browser?.close(); await server?.close(); });
beforeEach(async () => {
  authenticated = true; configured = true; writes = []; failPR = false; review = initialReview();
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); await context.addInitScript(() => localStorage.setItem('sarvya-vision-v1', 'standard')); page = await context.newPage();
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('**/api/**', async route => {
    const req = route.request(), pathname = new URL(req.url()).pathname, method = req.method();
    let data;
    if (pathname === '/api/github/oauth/start') return route.fulfill({ contentType: 'text/html', body: '<h1>OAuth navigation fixture</h1>' });
    if (pathname === '/api/github/session' && method === 'GET') data = { configured, authenticated, ...(authenticated ? { user: { id: 42, login: 'alice' }, csrfToken: 'csrf-fixture' } : {}) };
    else if (pathname === '/api/github/session' && method === 'DELETE') { assert.equal(req.headers()['x-csrf-token'], 'csrf-fixture'); authenticated = false; return route.fulfill({ status: 204 }); }
    else if (pathname === '/api/github/repos') data = { repositories: [{ id: 7, fullName: 'alice/site', defaultBranch: 'main' }], nextPage: null };
    else if (pathname === '/api/scans') data = [{ scanId: 'scan-real', status: 'completed', startUrl: 'https://example.com/', createdAt: '2026-11-07T00:00:00Z', issues: [{ id: 'image-alt-0', rule: 'image-alt', title: 'Images need alternate text', selector: 'img', explanation: 'Provide a useful text alternative.' }] }];
    else if (pathname.endsWith('/files')) data = { files: ['index.html'], truncated: false };
    else if (pathname.endsWith('/source')) data = { path: 'index.html', content: original, sha: 'c'.repeat(40) };
    else if (method === 'GET' && pathname.startsWith('/api/github/reviews/')) data = review;
    else if (method !== 'GET') {
      assert.equal(req.headers()['x-csrf-token'], 'csrf-fixture'); const body = req.postDataJSON(); writes.push({ pathname, method, body });
      if (pathname === '/api/github/reviews') data = review;
      else if (pathname.endsWith('/patches')) {
        assert.equal(body.mappingConfirmed, true); assert.equal(body.scanId, 'scan-real'); assert.equal(body.before, '<img src="photo.jpg">'); assert.equal(body.after, after);
        review = { ...review, revision: review.revision + 1, patches: [{ id: 'patch-1', path: 'index.html', approved: false, diff: `--- a/index.html\n+++ b/index.html\n-<img src="photo.jpg">\n+${after}`, mapping: { rule: 'image-alt', selector: 'img', scanId: 'scan-real' } }] }; data = review;
      } else if (method === 'PATCH') { review = { ...review, revision: review.revision + 1, patches: review.patches.map(p => ({ ...p, approved: body.approved })) }; data = review; }
      else if (pathname === '/api/github/pull-requests') {
        assert.deepEqual(body.approvedPatchIds, ['patch-1']); assert.equal(body.approval, true); assert.equal(body.patches, undefined);
        if (failPR) { review = { ...review, status: 'failed', revision: review.revision + 1, error: 'Saved branch may exist. Retry the approved review.' }; return route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'GitHub could not finish this request.' }) }); }
        review = { ...review, revision: review.revision + 1, status: 'completed', pullRequest: { number: 23, url: 'https://github.com/alice/site/pull/23', draft: true } }; data = review;
      }
    }
    if (data === undefined) throw Error(`Unexpected request ${method} ${pathname}`);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
});
afterEach(async () => context?.close());
async function open() { await page.goto(`${baseURL}/?github=connected`); }
async function prepare() {
  await open(); await page.getByRole('combobox', { name: 'GitHub repository' }).selectOption('alice/site');
  await page.getByRole('button', { name: 'Start source review', exact: true }).click();
  await page.getByRole('combobox', { name: 'Completed scan', exact: true }).selectOption('scan-real');
  await page.getByRole('combobox', { name: 'Finding', exact: true }).selectOption('image-alt-0');
  await page.getByLabel('Repository source file', { exact: true }).fill('index.html');
  await page.getByRole('button', { name: 'Load source file', exact: true }).click();
  await page.getByRole('textbox', { name: 'Exact original source block', exact: true }).fill('<img src="photo.jpg">');
  await page.getByRole('textbox', { name: 'Proposed replacement', exact: true }).fill(after);
  await page.getByRole('checkbox', { name: /I confirm this source block/ }).check();
  await page.getByRole('button', { name: 'Prepare patch preview', exact: true }).click();
  await page.getByLabel('Patch diff for index.html', { exact: true }).waitFor();
}

test('GitHub login button starts OAuth and an unconfigured app shows setup without fake repositories', async () => {
  authenticated = false; await open();
  const button = page.getByRole('button', { name: 'Log in with GitHub', exact: true }); await button.waitFor(); assert.equal(await button.isEnabled(), true);
  await button.click(); await page.getByRole('heading', { name: 'OAuth navigation fixture' }).waitFor();
  configured = false; await open();
  await page.getByText('Coming soon', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Log in with GitHub', exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('combobox', { name: 'GitHub repository' }).count(), 0);
});

test('source diff, per-patch approval, and final consent precede any PR request; review survives reload', async () => {
  await prepare();
  const create = page.getByRole('button', { name: 'Create draft pull request', exact: true });
  assert.equal(await create.isDisabled(), true);
  assert.equal(writes.some(w => w.pathname === '/api/github/pull-requests'), false);
  await page.getByRole('checkbox', { name: 'Approve this exact diff', exact: true }).click();
  await page.locator('label').filter({ hasText: 'Approve this exact diff' }).locator('input:checked').waitFor();
  await page.getByRole('checkbox', { name: /I approve creating a branch/ }).waitFor();
  await page.reload();
  await page.getByLabel('Patch diff for index.html', { exact: true }).waitFor();
  assert.equal(await page.getByRole('checkbox', { name: 'Approve this exact diff', exact: true }).isChecked(), true);
  assert.equal(await page.getByRole('checkbox', { name: /I approve creating a branch/ }).isChecked(), false);
  await page.getByRole('checkbox', { name: /I approve creating a branch/ }).check();
  await page.getByRole('button', { name: 'Create draft pull request', exact: true }).click();
  const link = page.getByRole('link', { name: 'Open pull request #23', exact: true }); await link.waitFor();
  assert.equal(await link.getAttribute('href'), 'https://github.com/alice/site/pull/23');
  assert.equal(writes.filter(w => w.pathname === '/api/github/pull-requests').length, 1);
});

test('provider failure shows retry state and never invents a successful PR URL', async () => {
  await prepare(); await page.getByRole('checkbox', { name: 'Approve this exact diff', exact: true }).click();
  await page.locator('label').filter({ hasText: 'Approve this exact diff' }).locator('input:checked').waitFor();
  await page.getByRole('checkbox', { name: /I approve creating a branch/ }).check(); failPR = true;
  await page.getByRole('button', { name: 'Create draft pull request', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'GitHub could not finish this request.' }).waitFor();
  assert.equal(await page.getByRole('link', { name: /Open pull request/ }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Retry approved pull request', exact: true }).isDisabled(), true);
});

test('disconnect removes repository controls and returns to GitHub login', async () => {
  await open(); await page.getByText('Connected as alice', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Disconnect GitHub', exact: true }).click();
  await page.getByRole('button', { name: 'Log in with GitHub', exact: true }).waitFor();
  assert.equal(await page.getByRole('combobox', { name: 'GitHub repository' }).count(), 0);
});
