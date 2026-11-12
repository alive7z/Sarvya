import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sarvya-package-'));
const run = (command, args) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd: directory, env: process.env }); let stdout = '', stderr = '';
  child.stdout.on('data', data => stdout += data); child.stderr.on('data', data => stderr += data);
  child.on('error', reject); child.on('close', code => code === 0 ? resolve(stdout) : reject(Error(`Packaged command failed (${code}): ${stderr.slice(-1000)}`)));
});
const server = http.createServer((_req, res) => res.end('<!doctype html><html lang="en"><title>Package test</title><main><h1>Fixture</h1><img id="missing-alt"><button></button></main></html>'));
try {
  const pkg = JSON.parse(await fs.readFile(path.join(root, 'cli/package.json')));
  const archive = path.join(root, 'release', `${pkg.name.replace('@','').replace('/','-')}-${pkg.version}.tgz`);
  await run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', archive]);
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const report = JSON.parse(await run(process.execPath, [path.join(directory, 'node_modules', pkg.name, 'bin/sarvya.js'), `http://127.0.0.1:${server.address().port}/`, '--fail-on', 'none']));
  assert.ok(report.violations.some(v => v.id === 'image-alt'));
  console.log('Clean tarball install and real packaged Chromium audit passed.');
} finally { await new Promise(resolve => server.close(resolve)); await fs.rm(directory, { recursive: true, force: true }); }
