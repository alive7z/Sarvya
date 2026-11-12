import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../backend/package.json', import.meta.url));
const { chromium } = require('playwright');
const { env } = await import('../backend/src/config/env.js');
const { createSecurity } = await import('../backend/src/middleware/security.js');
const { browserEnvironment } = await import('../backend/src/services/publicNetwork.js');
createSecurity({ production: env.nodeEnv === 'production', username: env.accessUser, password: env.accessPassword });
if (process.env.RENDER === 'true' && new URL(env.frontendOrigin).protocol !== 'https:') throw Error('Render FRONTEND_ORIGIN must use HTTPS.');
// Fail closed if this host cannot run Chromium's sandbox. Never silently disable it.
const probe = await chromium.launch({ headless: true, env: browserEnvironment(), chromiumSandbox: true, timeout: 20000 }); await probe.close();
const children = ['src/app.js', 'src/workers/scanWorker.js', 'src/workers/monitorWorker.js'].map(file => spawn(process.execPath, [file], { cwd: `${root}backend`, stdio: 'inherit', env: process.env }));
let stopping = false, timer;
function stop(code = 0) {
  if (stopping) return; stopping = true; process.exitCode = code;
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
  timer = setTimeout(() => { for (const child of children) if (child.exitCode === null) child.kill('SIGKILL'); }, 25000); timer.unref();
}
for (const child of children) {
  child.on('error', () => stop(1));
  child.on('exit', code => {
    if (!stopping) stop(code || 1);
    if (children.every(p => p.exitCode !== null || p.signalCode !== null)) clearTimeout(timer);
  });
}
process.once('SIGTERM', () => stop()); process.once('SIGINT', () => stop());
