import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { validateUrl, audit } from '../src/audit.js';
import { formatReport } from '../src/report.js';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';
const bin = fileURLToPath(new URL('../bin/sarvya.js', import.meta.url));
const fixture = { url: 'https://example.com/<script>', timestamp: '2030-01-01', tool: { version: 'test' }, occurrences: 1, incomplete: [], violations: [{ id: 'image-alt', help: '<script>alert(1)</script>', impact: 'critical', helpUrl: 'https://example.com/', nodes: [{ target: ['=SUM(A1)'], html: '<img>', failureSummary: '<unsafe>' }] }] };
test('strict CLI arguments and help produce reliable exit codes', () => {
  const run = args => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' });
  assert.equal(run(['--help']).status, 0); assert.match(run(['--version']).stdout, /^0\.1\.0/);
  const require = createRequire(import.meta.url);
  assert.equal(existsSync(path.join(path.dirname(require.resolve('playwright/package.json')), require('playwright/package.json').bin.playwright)), true);
  assert.equal(run(['--nonsense']).status, 2); assert.equal(run(['https://example.com', '--format', 'exe']).status, 2);
  assert.equal(run(['https://example.com', '--timeout', '0']).status, 2);
});
test('local HTTP is supported and unsafe URL schemes/credentials are rejected', () => {
  assert.equal(validateUrl('http://localhost:3000/#test'), 'http://localhost:3000/');
  for (const value of ['file:///etc/passwd', 'javascript:alert(1)', 'https://user:pass@example.com/', 'example.com']) assert.throws(() => validateUrl(value));
});
test('HTML and CSV encode untrusted findings without inventing compliance', () => {
  const html = formatReport(fixture, 'html'); assert.ok(!html.includes('<script>alert')); assert.match(html, /&lt;script&gt;/); assert.match(html, /do not prove WCAG compliance/);
  const unsafe = structuredClone(fixture); unsafe.violations[0].helpUrl = 'javascript:alert(1)'; unsafe.violations[0].nodes[0].html = '  =HYPERLINK(A1)';
  assert.ok(!formatReport(unsafe, 'html').includes('href="javascript:'));
  assert.match(formatReport(unsafe, 'csv'), /'  =HYPERLINK/);
  assert.match(formatReport(fixture, 'csv'), /"'=SUM/); assert.equal(JSON.parse(formatReport(fixture)).occurrences, 1);
});
test('browser resources close after a failed navigation', async () => {
  let closed = false;
  await assert.rejects(audit('https://example.com/', { launch: async () => ({ close: async () => { closed = true; }, newContext: async () => ({ newPage: async () => ({ goto: async () => { throw Error('navigation'); } }) }) }) }), /navigation/);
  assert.equal(closed, true);
});
test('real Chromium produces findings and CLI threshold codes', { skip: process.env.BROWSER_TESTS !== '1' }, async () => {
  const server = http.createServer((_req, res) => res.end('<!doctype html><html lang="en"><title>Fixture</title><main><h1>Audit</h1><img src="data:image/png;base64,AA=="><button></button></main></html>'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  try {
    const result = await audit(url); assert.ok(result.violations.some(v => v.id === 'image-alt')); assert.ok(result.occurrences > 0);
    // Use async spawn so the fixture HTTP server can keep serving the child process.
    const { spawn } = await import('node:child_process');
    for (const [threshold, expected] of [['none', 0], ['minor', 1]]) {
      const child = spawn(process.execPath, [bin, url, '--fail-on', threshold]); let output = ''; child.stdout.on('data', data => output += data); child.stderr.resume();
      const code = await new Promise(resolve => child.once('close', resolve)); assert.equal(code, expected); assert.ok(JSON.parse(output).violations.length);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
