import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
const root = fileURLToPath(new URL('../../', import.meta.url));
test('production supervisor serves protected frontend/downloads, has healthy workers and shuts down cleanly', { skip: process.env.BROWSER_TESTS !== '1' || !process.env.REDIS_TEST_URL, timeout: 60000 }, async t => {
  await fs.access(path.join(root, 'frontend/dist/index.html'));
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sarvya-deploy-'));
  const listener = net.createServer(); await new Promise(resolve => listener.listen(0,'127.0.0.1',resolve)); const port = listener.address().port; await new Promise(resolve => listener.close(resolve));
  const queueName = `deploy-test-${randomUUID()}`, password = randomUUID();
  const base = `http://127.0.0.1:${port}`, headers = { authorization: `Basic ${Buffer.from(`operator:${password}`).toString('base64')}` };
  const child = spawn(process.execPath, ['scripts/start-render.mjs'], { cwd: root, stdio: ['ignore','pipe','pipe'], env: { ...process.env, NODE_ENV: 'production', PORT: String(port), ACCESS_USER: 'operator', ACCESS_PASSWORD: password, FRONTEND_ORIGIN: base, STATIC_DIR: path.join(root, 'frontend/dist'), DATA_DIR: dataDir, REDIS_URL: process.env.REDIS_TEST_URL, SCAN_QUEUE_NAME: queueName } });
  let output = ''; child.stdout.on('data', data => output += data); child.stderr.on('data', data => output += data);
  t.after(async () => {
    if (child.exitCode === null) { child.kill('SIGTERM'); await new Promise(resolve => { child.once('close', resolve); setTimeout(() => child.kill('SIGKILL'), 28000).unref(); }); }
    for (const name of [queueName, `${queueName}-monitors`]) {
      const connection = new IORedis(process.env.REDIS_TEST_URL, { maxRetriesPerRequest: 1 }); const queue = new Queue(name, { connection });
      await queue.obliterate({ force: true }); await queue.close(); connection.disconnect();
    }
    const redis = new IORedis(process.env.REDIS_TEST_URL, { maxRetriesPerRequest: 1 });
    const keys = await redis.keys(`${queueName}*`); if (keys.length) await redis.del(...keys); redis.disconnect();
    await fs.rm(dataDir, { recursive: true, force: true });
  });
  const until = Date.now() + 25000;
  let ready = false;
  while (Date.now() < until) {
    if (child.exitCode !== null) throw Error(`Supervisor exited early: ${output.slice(-2000)}`);
    try { const response = await fetch(`${base}/api/monitors/status`, { headers }); if (response.ok && (await response.json()).workerOnline) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.equal(ready, true, output.slice(-1500));
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
  assert.equal((await fetch(`${base}/`)).status, 401);
  const html = await fetch(`${base}/`, { headers }); assert.equal(html.status, 200); assert.match(await html.text(), /<div id="root">/);
  const status = await fetch(`${base}/api/ready`, { headers }); assert.equal(status.status, 200); assert.equal((await status.json()).status, 'ready');
  const archive = await fetch(`${base}/downloads/sarvya-extension.zip`, { headers }); assert.equal(archive.status, 200); assert.equal(Buffer.from(await archive.arrayBuffer()).subarray(0,2).toString(), 'PK');
  child.kill('SIGTERM'); const code = await new Promise(resolve => child.once('close', resolve)); assert.equal(code, 0);
});
