#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { audit } from '../src/audit.js';
import { formatReport } from '../src/report.js';
const require = createRequire(import.meta.url);
const help = `Sarvya — local accessibility auditor
Usage: sarvya <http(s)://url> [options]
  --format json|html|csv     Report format (default: json)
  --output <file>            Write a report atomically; otherwise print to stdout
  --fail-on <impact>         CI threshold: minor, moderate, serious, critical, none (default: serious)
  --timeout <milliseconds>  Total audit time after launch (default: 45000)
  --install-browser         Install the matching Chromium browser, then exit
  --version                 Print version
  --help                    Show help
Exit codes: 0 below threshold, 1 findings at threshold, 2 usage/runtime error, 130 interrupted.
Only audit sites you are authorised to test. Automated findings do not prove WCAG conformance.
`;
const controller = new AbortController();
const interrupted = () => controller.abort(new Error('Audit interrupted.'));
process.once('SIGINT', interrupted); process.once('SIGTERM', interrupted);
let temporary;
try {
  const { values, positionals } = parseArgs({ allowPositionals: true, strict: true, options: {
    format: { type: 'string', default: 'json' }, output: { type: 'string' }, 'fail-on': { type: 'string', default: 'serious' }, timeout: { type: 'string', default: '45000' },
    'install-browser': { type: 'boolean' }, version: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) process.stdout.write(help);
  else if (values.version) process.stdout.write(`${require('../package.json').version}\n`);
  else if (values['install-browser']) {
    const command = path.join(path.dirname(require.resolve('playwright/package.json')), require('playwright/package.json').bin.playwright);
    const result = spawnSync(process.execPath, [command, 'install', 'chromium'], { stdio: 'inherit' });
    process.exitCode = result.status === 0 ? 0 : 2;
  } else {
    const ranks = { minor: 1, moderate: 2, serious: 3, critical: 4, none: 5 };
    if (positionals.length !== 1 || !['json', 'html', 'csv'].includes(values.format) || !(values['fail-on'] in ranks)) throw new Error('Invalid options. Run sarvya --help.');
    const result = await audit(positionals[0], { timeout: Number(values.timeout), signal: controller.signal });
    const report = formatReport(result, values.format);
    if (values.output) {
      const destination = path.resolve(values.output); temporary = `${destination}.${randomUUID()}.tmp`;
      await fs.writeFile(temporary, report, { flag: 'wx', mode: 0o600 }); await fs.rename(temporary, destination); temporary = null;
      process.stderr.write(`Report written. ${result.occurrences} violation occurrences.\n`);
    } else process.stdout.write(report);
    process.exitCode = result.violations.some(v => (ranks[v.impact] || 0) >= ranks[values['fail-on']]) ? 1 : 0;
  }
} catch (error) { process.stderr.write(`Sarvya: ${controller.signal.aborted ? 'Audit interrupted.' : error.message}\n`); process.exitCode = controller.signal.aborted ? 130 : 2; }
finally { if (temporary) await fs.rm(temporary, { force: true }).catch(() => {}); }
