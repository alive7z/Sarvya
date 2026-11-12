import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createRedisConnection, closeScanQueue } from '../src/queues/scanQueue.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { createGitHubRouter } from '../src/routes/githubRoutes.js';
import { createGitHubAuthStore, isConfigured, safeEqual } from '../src/services/github/auth.js';
import { createGitHubClient, exchangeOAuthCode } from '../src/services/github/client.js';
import { createReviewStore } from '../src/services/github/reviewStore.js';
import { createReviewService } from '../src/services/github/reviewService.js';
import { preparePatch, sourcePath, sourceFile } from '../src/services/github/source.js';
import { RunError } from '../src/services/runErrors.js';

const config = { clientId: 'test-client', clientSecret: 'test-secret', sessionSecret: 'test-encryption-key-at-least-32-bytes-long', callbackUrl: 'http://app.test/api/github/oauth/callback', frontendOrigin: 'http://app.test', secure: false, scope: 'public_repo' };
const base = 'a'.repeat(40), tree = 'b'.repeat(40), blob = 'c'.repeat(40), commit = 'd'.repeat(40), newTree = 'e'.repeat(40);
const original = '<main><img src="photo.jpg"></main>\n', before = '<img src="photo.jpg">', after = '<img src="photo.jpg" alt="Lake">';
const scan = { scanId: 'scan-real', status: 'completed', startUrl: 'https://example.com', issues: [{ id: 'image-alt-0', rule: 'image-alt', selector: 'img', url: 'https://example.com' }] };
const user = { id: 42, login: 'alice' };
function memoryRedis() {
  const values = new Map(), counts = new Map();
  return { values, async set(k, v) { values.set(k, v); }, async get(k) { return values.get(k) || null; }, async getdel(k) { const v = values.get(k); values.delete(k); return v || null; }, async del(k) { values.delete(k); }, async eval(_script, _keys, k) { counts.set(k, (counts.get(k) || 0) + 1); return counts.get(k); } };
}
function upstream() {
  const state = { calls: [], branch: null, pr: null, moved: false, denied: false, losePRResponse: false };
  const repo = { id: 7, full_name: 'alice/site', default_branch: 'main', permissions: { push: true }, private: false };
  const entry = { path: 'index.html', sha: blob, mode: '100644', type: 'blob', size: Buffer.byteLength(original) };
  const api = async (method, endpoint, body) => {
    state.calls.push({ method, endpoint, body });
    if (method === 'GET' && endpoint === '/user') return user;
    if (method === 'GET' && endpoint.startsWith('/user/repos?')) return [repo];
    if (method === 'GET' && endpoint === '/repos/alice/site') return { ...repo, permissions: { push: !state.denied } };
    if (method === 'GET' && endpoint.endsWith('/git/ref/heads/main')) return { object: { sha: state.moved ? 'f'.repeat(40) : base, type: 'commit' } };
    if (method === 'GET' && endpoint.endsWith(`/git/commits/${base}`)) return { tree: { sha: tree } };
    if (method === 'GET' && endpoint.includes(`/git/trees/${tree}`)) return { tree: [entry], truncated: false };
    if (method === 'GET' && endpoint.endsWith(`/git/blobs/${blob}`)) return { sha: blob, content: Buffer.from(original).toString('base64'), encoding: 'base64', size: Buffer.byteLength(original) };
    if (method === 'GET' && endpoint.includes('/pulls?')) return state.pr ? [state.pr] : [];
    if (method === 'GET' && endpoint.includes('/git/ref/heads/sarvya')) { if (!state.branch) throw new RunError('Missing', { status: 404 }); return { object: { sha: state.branch.sha, type: 'commit' } }; }
    if (method === 'POST' && endpoint.endsWith('/git/trees')) return { sha: newTree };
    if (method === 'POST' && endpoint.endsWith('/git/commits')) return { sha: commit };
    if (method === 'POST' && endpoint.endsWith('/git/refs')) { assert.notEqual(body.ref, 'refs/heads/main'); state.branch = { ref: body.ref, sha: body.sha }; return state.branch; }
    if (method === 'POST' && endpoint.endsWith('/pulls')) {
      state.pr = { number: 23, state: 'open', draft: true, head: { ref: body.head, sha: commit }, base: { repo: { id: 7 } } };
      if (state.losePRResponse) throw new RunError('GitHub timed out', { status: 502 });
      return state.pr;
    }
    throw Error(`Unexpected GitHub request: ${method} ${endpoint}`);
  };
  return { state, api };
}
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sarvya-github-')); t.after(() => rm(root, { recursive: true, force: true }));
  const store = createReviewStore(root), reviews = createReviewService({ store, readScan: id => id === scan.scanId ? scan : null });
  return { store, reviews, ...upstream() };
}
async function prepared(f) {
  let review = await f.reviews.create(user, f.api, 'alice/site');
  review = await f.reviews.add(user, f.api, review.id, { revision: review.revision, path: 'index.html', scanId: scan.scanId, issueId: scan.issues[0].id, mappingConfirmed: true, before, after });
  return review;
}
const approvedInput = review => ({ reviewId: review.id, revision: review.revision, approvedPatchIds: review.patches.filter(p => p.approved).map(p => p.id), approval: true });

test('OAuth uses PKCE, encrypted expiring sessions, single-use state, cookie binding, and setup validation', async () => {
  const redis = memoryRedis(), auth = createGitHubAuthStore({ config, redisProvider: async () => redis });
  assert.equal(isConfigured(config), true); assert.equal(isConfigured({ ...config, sessionSecret: '' }), false);
  assert.equal(isConfigured({ ...config, callbackUrl: 'http://other.test/callback' }), false);
  assert.equal(isConfigured({ ...config, secure: true }), false);
  assert.equal(safeEqual('é', 'a'), false);
  const flow = await auth.start(), url = new URL(flow.url), state = url.searchParams.get('state');
  assert.equal(url.origin, 'https://github.com'); assert.equal(url.searchParams.get('code_challenge_method'), 'S256'); assert.equal(url.searchParams.get('scope'), 'public_repo');
  assert.ok(!url.href.includes(config.clientSecret));
  const verifier = await auth.consume(state, flow.binder); assert.equal(verifier.length, 43);
  await assert.rejects(auth.consume(state, flow.binder), error => error.status === 401);
  const other = await auth.start(); await assert.rejects(auth.consume(new URL(other.url).searchParams.get('state'), 'x'.repeat(43)), error => error.status === 401);
  const session = await auth.create('private-github-token', user);
  assert.ok([...redis.values.values()].every(value => !value.includes('private-github-token')));
  assert.equal((await auth.get(session.id)).user.id, user.id);
  await auth.destroy(session.id); assert.equal(await auth.get(session.id), null);
});

test('GitHub client keeps tokens on a fixed host, uses timeouts, and sanitizes provider errors', async () => {
  let called;
  const api = createGitHubClient('private-token', { fetchImpl: async (url, options) => { called = { url, options }; return new Response(JSON.stringify({ login: 'alice' }), { status: 200 }); } });
  assert.equal((await api('GET', '/user')).login, 'alice'); assert.equal(called.url, 'https://api.github.com/user'); assert.equal(called.options.redirect, 'error'); assert.equal(called.options.headers.Authorization, 'Bearer private-token');
  await assert.rejects(api('GET', '//evil.test'), /Invalid/);
  const denied = createGitHubClient('private-token', { fetchImpl: async () => new Response('private-token backend stack', { status: 401 }) });
  await assert.rejects(denied('GET', '/user'), error => error.status === 401 && !error.message.includes('private-token'));
  let tokenBody;
  await exchangeOAuthCode({ code: 'code', verifier: 'verifier', config, fetchImpl: async (_url, options) => { tokenBody = JSON.parse(options.body); return new Response(JSON.stringify({ access_token: 'token' })); } });
  assert.equal(tokenBody.code_verifier, 'verifier'); assert.equal(tokenBody.client_secret, config.clientSecret);
});

test('source mapping requires real findings and an unambiguous safe source replacement', async t => {
  const f = await fixture(t); let review = await f.reviews.create(user, f.api, 'alice/site');
  const input = { revision: review.revision, path: 'index.html', scanId: 'demo', issueId: 'image-alt-0', before, after, mappingConfirmed: true };
  await assert.rejects(f.reviews.add(user, f.api, review.id, input), /stored scan/);
  for (const file of ['../index.html', '.github/workflows/ci.js', 'src/.env.js', '/index.html', 'src\\index.html', 'node_modules/a.js', 'key.pem']) assert.throws(() => sourcePath(file));
  assert.throws(() => preparePatch({ path: 'index.html', sha: blob, content: before + before }, before, after), /exactly once/);
  assert.throws(() => preparePatch({ path: 'index.html', sha: blob, content: before }, before, before), /does not change/);
  review = await f.reviews.add(user, f.api, review.id, { ...input, scanId: scan.scanId });
  assert.match(review.patches[0].diff, /\+.*alt="Lake"/); assert.equal(review.patches[0].approved, false); assert.equal(review.patches[0].verification, 'unverified');
  await assert.rejects(f.reviews.get({ id: 99 }, review.id), error => error.status === 404);
  assert.equal(f.state.calls.filter(c => c.method !== 'GET').length, 0);
});

test('only explicitly approved current patches produce a separate commit, branch, and real PR response', async t => {
  const f = await fixture(t); let review = await prepared(f);
  await assert.rejects(f.reviews.publish(user, f.api, approvedInput(review)), /Explicitly approve/);
  await assert.rejects(f.reviews.decide(user, review.id, review.patches[0].id, { revision: 1, approved: true }), error => error.status === 409);
  review = await f.reviews.decide(user, review.id, review.patches[0].id, { revision: review.revision, approved: true });
  await assert.rejects(f.reviews.publish(user, f.api, { ...approvedInput(review), approval: false }), /Explicitly approve/);
  assert.equal(f.state.calls.filter(c => c.method === 'POST').length, 0);
  const input = approvedInput(review); const complete = await f.reviews.publish(user, f.api, input);
  assert.equal(complete.status, 'completed'); assert.equal(complete.pullRequest.url, 'https://github.com/alice/site/pull/23');
  const writeTree = f.state.calls.find(c => c.endpoint.endsWith('/git/trees') && c.method === 'POST');
  assert.equal(writeTree.body.base_tree, tree); assert.equal(writeTree.body.tree[0].content, original.replace(before, after));
  assert.deepEqual(f.state.calls.find(c => c.method === 'POST' && c.endpoint.endsWith('/git/commits')).body.parents, [base]);
  assert.equal(f.state.calls.some(c => c.method === 'PATCH' || c.method === 'DELETE'), false);
  await f.reviews.publish(user, f.api, input);
  assert.equal(f.state.calls.filter(c => c.method === 'POST' && c.endpoint.endsWith('/pulls')).length, 1);
});

test('stale branches, lost permissions, and tampered approved content block all GitHub writes', async t => {
  const f = await fixture(t); let review = await prepared(f);
  review = await f.reviews.decide(user, review.id, review.patches[0].id, { revision: review.revision, approved: true });
  f.state.moved = true; await assert.rejects(f.reviews.publish(user, f.api, approvedInput(review)), error => error.status === 409);
  f.state.moved = false; f.state.denied = true; await assert.rejects(f.reviews.publish(user, f.api, approvedInput(review)), error => error.status === 403);
  f.state.denied = false;
  await f.store.edit(user.id, review.id, async (record, save) => save({ patches: record.patches.map(p => ({ ...p, content: 'tampered' })) }));
  review = await f.reviews.get(user, review.id); await assert.rejects(f.reviews.publish(user, f.api, approvedInput(review)), /Explicitly approve/);
  assert.equal(f.state.calls.filter(c => c.method === 'POST').length, 0);
});

test('lost PR response is reconciled without duplicate branches or pull requests', async t => {
  const f = await fixture(t); let review = await prepared(f);
  review = await f.reviews.decide(user, review.id, review.patches[0].id, { revision: review.revision, approved: true });
  f.state.losePRResponse = true; await assert.rejects(f.reviews.publish(user, f.api, approvedInput(review)), error => error.status === 502);
  review = await f.reviews.get(user, review.id); assert.equal(review.status, 'failed'); assert.ok(review.commitSha);
  review = await f.reviews.publish(user, f.api, approvedInput(review));
  assert.equal(review.status, 'completed'); assert.equal(review.pullRequest.number, 23);
  assert.equal(f.state.calls.filter(c => c.method === 'POST' && c.endpoint.endsWith('/pulls')).length, 1);
});

async function serverFixture(t, configOverride = config) {
  const f = await fixture(t), redis = memoryRedis();
  const auth = createGitHubAuthStore({ config: configOverride, redisProvider: async () => redis });
  const app = express(); app.use(express.json());
  app.use('/api/github', createGitHubRouter({ config: configOverride, auth, reviews: f.reviews, clientFactory: () => f.api, exchange: async () => ({ token: 'test-token', expiresIn: 3600 }) }));
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.message }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return { ...f, auth, baseURL: `http://127.0.0.1:${server.address().port}/api/github` };
}

test('HTTP login/callback sets protected cookies; repos require auth and review writes require CSRF', async t => {
  const f = await serverFixture(t);
  assert.equal((await fetch(`${f.baseURL}/repos`)).status, 401);
  const start = await fetch(`${f.baseURL}/oauth/start`, { redirect: 'manual' });
  const location = new URL(start.headers.get('location')); const state = location.searchParams.get('state');
  const flowCookie = start.headers.getSetCookie()[0].split(';')[0];
  assert.match(start.headers.getSetCookie()[0], /HttpOnly/); assert.match(start.headers.getSetCookie()[0], /SameSite=Lax/);
  const callback = await fetch(`${f.baseURL}/oauth/callback?state=${state}&code=code`, { redirect: 'manual', headers: { Cookie: flowCookie } });
  assert.equal(callback.headers.get('location'), 'http://app.test/?github=connected');
  const cookie = callback.headers.getSetCookie().find(c => c.startsWith('sarvya_github=')).split(';')[0];
  const session = await (await fetch(`${f.baseURL}/session`, { headers: { Cookie: cookie } })).json();
  assert.equal(session.authenticated, true); assert.equal(session.token, undefined);
  const repos = await (await fetch(`${f.baseURL}/repos`, { headers: { Cookie: cookie } })).json(); assert.equal(repos.repositories[0].fullName, 'alice/site');
  const request = body => ({ method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await fetch(`${f.baseURL}/reviews`, request({ repository: 'alice/site' }))).status, 403);
  const invalidOrigin = request({ repository: 'alice/site' }); invalidOrigin.headers.Origin = 'null'; invalidOrigin.headers['X-CSRF-Token'] = session.csrfToken;
  assert.equal((await fetch(`${f.baseURL}/reviews`, invalidOrigin)).status, 403);
  const options = request({ repository: 'alice/site' }); options.headers.Origin = config.frontendOrigin; options.headers['X-CSRF-Token'] = session.csrfToken;
  assert.equal((await fetch(`${f.baseURL}/reviews`, options)).status, 201);
  const replay = await fetch(`${f.baseURL}/oauth/callback?state=${state}&code=code`, { redirect: 'manual', headers: { Cookie: flowCookie } }); assert.match(replay.headers.get('location'), /github=failed/);
  const logout = await fetch(`${f.baseURL}/session`, { method: 'DELETE', headers: { Cookie: cookie, Origin: config.frontendOrigin, 'X-CSRF-Token': session.csrfToken } }); assert.equal(logout.status, 204);
  assert.equal((await fetch(`${f.baseURL}/repos`, { headers: { Cookie: cookie } })).status, 401);
});

test('unconfigured OAuth never returns mock repositories or a simulated connection', async t => {
  const f = await serverFixture(t, { ...config, clientSecret: '' });
  assert.deepEqual(await (await fetch(`${f.baseURL}/session`)).json(), { configured: false, authenticated: false });
  assert.equal((await fetch(`${f.baseURL}/repos`)).status, 503);
  assert.equal((await fetch(`${f.baseURL}/oauth/start`, { redirect: 'manual' })).status, 503);
});

test('remote preview responses retain an origin-isolating sandbox policy', async t => {
  const { default: app } = await import('../src/app.js');
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/preview`);
  const policy = response.headers.get('content-security-policy');
  assert.match(policy, /sandbox allow-scripts/); assert.doesNotMatch(policy, /allow-same-origin/);
});


test('UTF-8 BOM and CRLF are preserved; symlinks and binary blobs are rejected', async () => {
  let mode = '100644', content = '\uFEFF<main>\r\n<img src="photo.jpg">\r\n</main>\r\n';
  const api = async (_method, endpoint) => endpoint.includes('/git/trees/')
    ? { tree: [{ path: 'index.html', sha: blob, type: 'blob', mode, size: Buffer.byteLength(content) }] }
    : { content: Buffer.from(content).toString('base64'), encoding: 'base64', size: Buffer.byteLength(content) };
  const review = { repository: { fullName: 'alice/site' }, baseTreeSha: tree };
  const file = await sourceFile(api, review, 'index.html');
  assert.equal(file.content, content);
  const patch = preparePatch(file, before, after);
  assert.equal(patch.content, content.replace(before, after));
  mode = '120000'; await assert.rejects(sourceFile(api, review, 'index.html'), /Symlinks/);
  mode = '100644'; content = 'binary\0data'; await assert.rejects(sourceFile(api, review, 'index.html'), /Binary/);
});

test('real Redis encrypts OAuth sessions, expires them, and consumes OAuth state atomically', { skip: !process.env.REDIS_TEST_URL }, async t => {
  const redis = createRedisConnection({ url: process.env.REDIS_TEST_URL });
  t.after(() => redis.disconnect()); await redis.connect();
  const auth = createGitHubAuthStore({ config, redisProvider: async () => redis });
  const flow = await auth.start();
  const state = new URL(flow.url).searchParams.get('state');
  await auth.consume(state, flow.binder);
  await assert.rejects(auth.consume(state, flow.binder), error => error.status === 401);
  const session = await auth.create('test-only-token', user, 1);
  const sessionKey = `sarvya:github:session:${createHash('sha256').update(session.id).digest('hex')}`;
  assert.ok(!(await redis.get(sessionKey)).includes('test-only-token'));
  assert.ok(await redis.ttl(sessionKey) <= 1);
  assert.equal((await auth.get(session.id)).user.id, user.id);
  await delay(1100); assert.equal(await auth.get(session.id), null);
  const identity = `test-${randomUUID()}`, limitKey = `sarvya:github:limit:${createHash('sha256').update(identity).digest('hex')}`;
  await auth.limit(identity, 1, 60);
  await assert.rejects(auth.limit(identity, 1, 60), error => error.status === 429);
  await redis.del(limitKey);
});


test('default OAuth Redis provider works with the installed BullMQ backend', { skip: process.env.REDIS_TEST_URL !== 'redis://127.0.0.1:6379' }, async t => {
  t.after(() => closeScanQueue());
  const auth = createGitHubAuthStore({ config });
  const session = await auth.create('test-default-provider', user, 10);
  try { assert.equal((await auth.get(session.id)).user.id, user.id); }
  finally { await auth.destroy(session.id); }
});
