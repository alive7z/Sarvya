import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const required = ['Dockerfile','render.yaml','cli/package-lock.json','extension/package-lock.json','backend/package-lock.json','frontend/package-lock.json','docs/DEPLOYMENT.md','extension/PRIVACY.md'];
for (const file of required) await fs.access(path.join(root, file));
for (const pkg of ['backend','frontend','cli','extension']) {
  const manifest = JSON.parse(await fs.readFile(path.join(root, pkg, 'package.json'))), lock = JSON.parse(await fs.readFile(path.join(root, pkg, 'package-lock.json')));
  if (manifest.name !== lock.name || JSON.stringify(Object.entries(manifest.dependencies || {}).sort()) !== JSON.stringify(Object.entries(lock.packages[''].dependencies || {}).sort())) throw Error(`${pkg} lockfile does not match its manifest.`);
}
for (const file of ['backend/src/app.js','backend/src/services/publicNetwork.js','cli/bin/sarvya.js','extension/background/worker.js','extension/popup/popup.js','scripts/start-render.mjs']) execFileSync(process.execPath, ['--check', path.join(root,file)], { stdio: 'inherit' });
console.log('Release configuration, dependency locks, and executable syntax checked.');
