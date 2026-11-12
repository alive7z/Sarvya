import { createPublicProxy } from '../src/services/publicNetwork.js';
const proxyFactory = () => createPublicProxy({ resolve: async () => [{ address: '127.0.0.1', family: 4 }] });
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { chromium } from 'playwright';
import { scanPages } from '../src/services/scannerService.js';
import { RunCancelledError } from '../src/services/runErrors.js';

const browserTests = { skip: process.env.BROWSER_TESTS !== '1' };
async function fixture(t, handler) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return `http://127.0.0.1:${server.address().port}`;
}

test('actual Chromium and axe preserve findings, fixes, HTML, bounds, screenshots and page failures', browserTests, async t => {
  const url = await fixture(t, (req, res) => {
    if (req.url === '/missing') { res.writeHead(404); res.end('Missing'); return; }
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><html lang="en"><head><title>Worker fixture</title></head><body><main><h1>Audit fixture</h1><img id="missing-alt" width="20" height="20" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"></main></body></html>');
  });
  let browser;
  const progress = [];
  const result = await scanPages([url, `${url}/missing`], {
    // Trusted loopback fixture only: production validation is never disabled through env.
    proxyFactory, validateUrl: async () => {}, onProgress: async value => progress.push(value),
    launchBrowser: async options => { browser = await chromium.launch(options); return browser; },
  });
  assert.equal(result.pagesScanned, 1); assert.equal(result.pagesFailed, 1);
  const issue = result.issues.find(issue => issue.rule === 'image-alt');
  assert.ok(issue); assert.ok(issue.fix); assert.equal(issue.nodes[0].selector, '#missing-alt'); assert.ok(issue.nodes[0].boundingBox);
  assert.match(result.results[0].html, /Worker fixture/);
  assert.match(result.primaryPreview.screenshot, /^data:image\/jpeg;base64,/);
  assert.equal(progress.at(-1).completedPages, 2); assert.equal(progress.at(-1).failedPages, 1);
  assert.equal(browser.isConnected(), false);
});

test('cancelling during real navigation closes Chromium before rejection', browserTests, async t => {
  let received;
  const request = new Promise(resolve => { received = resolve; });
  const url = await fixture(t, () => received());
  const controller = new AbortController(); let browser;
  const promise = scanPages([url], { signal: controller.signal, proxyFactory, validateUrl: async () => {}, launchBrowser: async options => { browser = await chromium.launch(options); return browser; } });
  await request; controller.abort(new RunCancelledError());
  await assert.rejects(promise, RunCancelledError);
  assert.equal(browser.isConnected(), false);
});

test('browser redirects and subresources cannot bypass destination validation', browserTests, async t => {
  const reached = [];
  let frameUrl;
  const url = await fixture(t, (req, res) => {
    reached.push(req.url);
    if (req.url === '/redirect') { res.writeHead(302, { Location: '/blocked' }); res.end(); return; }
    res.setHeader('Content-Type', 'text/html');
    if (req.url === '/frame') res.end('<html lang="en"><title>Frame</title><h1>Frame</h1><img src="/redirect" alt="Nested target"></html>');
    else res.end(`<html lang="en"><title>Safe page</title><main><h1>Safe</h1><img src="/blocked" alt="Test"><iframe title="Cross-origin fixture" src="${frameUrl}"></iframe></main><script>window.open('/redirect', '_blank')</script></html>`);
  });
  frameUrl = `http://localhost:${new URL(url).port}/frame`;
  const validateUrl = async value => { if (new URL(value).pathname === '/blocked') throw Error('Blocked destination'); };
  const result = await scanPages([url, `${url}/redirect`], { validateUrl, proxyFactory });
  assert.equal(result.pagesScanned, 1); assert.equal(result.pagesFailed, 1);
  assert.equal(reached.includes('/blocked'), false);
});
