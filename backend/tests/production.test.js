import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createSecurity, limitAsync } from '../src/middleware/security.js';
import { resolvePublicHost, createPublicProxy } from '../src/services/publicNetwork.js';
import { createRunService } from '../src/services/runService.js';
import { verifyFix } from '../src/services/fixService.js';
import http from 'node:http';
const password = 'test-only-password-long-enough';
test('production rejects missing access credentials and protects APIs, static files and cross-origin writes', async t => {
  assert.throws(() => createSecurity({ production: true }), /ACCESS_USER/);
  const app = express(); app.use(createSecurity({ production: true, username: 'operator', password, origin: 'https://app.example', limit: 10 }));
  app.all('*', (_req, res) => res.json({ ok: true })); const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
  assert.equal((await fetch(`${base}/downloads/package.tgz`)).status, 401);
  const authorization = `Basic ${Buffer.from(`operator:${password}`).toString('base64')}`;
  assert.equal((await fetch(`${base}/api/scans`, { headers: { authorization } })).status, 200);
  assert.equal((await fetch(`${base}/api/scans`, { method: 'POST', headers: { authorization, origin: 'null' } })).status, 403);
  assert.equal((await fetch(`${base}/api/scans`, { method: 'POST', headers: { authorization, origin: 'https://app.example' } })).status, 200);
});
test('DNS pins only public records; mixed and rebinding responses are rejected before connecting', async () => {
  const lookup = async (_host, options) => { assert.equal(options.all, true); return [{ address: '93.184.216.34', family: 4 }]; };
  assert.equal((await resolvePublicHost('example.com', lookup))[0].address, '93.184.216.34');
  for (const address of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '::1', '::ffff:127.0.0.1']) await assert.rejects(resolvePublicHost(address));
  await assert.rejects(resolvePublicHost('rebound.example', async () => [{ address: '93.184.216.34', family: 4 }, { address: '127.0.0.1', family: 4 }]));
});
test('browser egress proxy refuses internal HTTP and CONNECT requests', async () => {
  const proxy = await createPublicProxy();
  try {
    for (const method of ['GET', 'CONNECT']) {
      const status = await new Promise((resolve, reject) => {
        const endpoint = new URL(proxy.server);
        const req = http.request({ hostname: endpoint.hostname, port: endpoint.port, method, path: method === 'CONNECT' ? '127.0.0.1:6379' : 'http://127.0.0.1:6379/' }, res => { res.resume(); resolve(res.statusCode); });
        req.on('connect', (res, socket) => { socket.destroy(); resolve(res.statusCode); }); req.on('error', reject); req.end();
      });
      assert.equal(status, 403);
    }
  } finally { await proxy.close(); }
});
test('queue capacity blocks submissions before writing another run', async () => {
  const service = createRunService({ validateUrl: async () => {}, store: { update: () => { throw Error('must not write'); } }, queueProvider: async () => ({ getJobCounts: async () => ({ waiting: 100 }) }) });
  await assert.rejects(service.submit('scan', { url: 'https://example.com' }), error => error.status === 429);
});
test('verification blocks scripts/network and never verifies an inapplicable or fabricated fix', { skip: process.env.BROWSER_TESTS !== '1' }, async () => {
  const good = await verifyFix('image-alt', '<img src="data:image/png;base64,AA==" alt="Sample">'); assert.equal(good.verified, true);
  const absent = await verifyFix('image-alt', '<p>No image exists here</p>'); assert.equal(absent.verified, false);
  const fabricated = await verifyFix('html-has-lang', '<p>No language supplied</p>'); assert.equal(fabricated.verified, false);
  const bad = await verifyFix('image-alt', '<script>while(true){}</script><img src="http://127.0.0.1:6379/x">'); assert.equal(bad.verified, false);
});

test('rate limits also cover failed logins and concurrency is held until the actual work ends', async t => {
  const app = express(); app.use(createSecurity({ production: true, username: 'operator', password, limit: 2 }));
  app.get('/', (_req,res) => res.end('ok'));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}/`;
  assert.equal((await fetch(url)).status, 401); assert.equal((await fetch(url)).status, 401); assert.equal((await fetch(url)).status, 429);
  let release; const pending = new Promise(resolve => { release = resolve; });
  const limited = limitAsync(1, async () => pending);
  const first = limited({}, {}, () => {});
  const busy = { status(code) { this.code = code; return this; }, set() { return this; }, json() { return this; } };
  await limited({}, busy, () => {}); assert.equal(busy.code, 429);
  release(); await first;
  let called = false; await limitAsync(1, async () => { called = true; })({}, {}, () => {}); assert.equal(called, true);
});

test('development accepts configured localhost aliases, but production and other origins remain strict', async t => {
  for (const production of [false, true]) {
    const app = express(); app.use(createSecurity({ production, username: 'operator', password, origin: 'http://localhost:5173' }));
    app.post('/api/test', (_req,res) => res.json({ saved: true }));
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    t.after(() => { server.closeAllConnections(); server.close(); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const authorization = `Basic ${Buffer.from(`operator:${password}`).toString('base64')}`;
    for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://[::1]:5173', 'http://127.0.0.1:9999', 'https://evil.example', 'null']) {
      const response = await fetch(`${base}/api/test`, { method: 'POST', headers: { authorization, origin } });
      const valid = origin === 'http://localhost:5173' || (!production && ['http://127.0.0.1:5173', 'http://[::1]:5173'].includes(origin));
      assert.equal(response.status, valid ? 200 : 403, `${production ? 'production' : 'development'} ${origin}`);
    }
  }
});
