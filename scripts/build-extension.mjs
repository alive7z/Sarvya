import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { deflateSync } from 'node:zlib';
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = path.join(root, 'extension'), output = path.join(directory, 'dist');
const require = createRequire(path.join(directory, 'package.json'));
const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
if (manifest.manifest_version !== 3 || manifest.host_permissions || manifest.permissions.some(p => !['activeTab', 'scripting', 'storage'].includes(p))) throw new Error('Unexpected extension privileges.');
await fs.rm(output, { recursive: true, force: true }); await fs.mkdir(output, { recursive: true });
for (const file of ['manifest.json', 'background/worker.js', 'content/audit.js', 'popup/index.html', 'popup/popup.js', 'popup/popup.css', 'PRIVACY.md']) {
  await fs.mkdir(path.dirname(path.join(output, file)), { recursive: true }); await fs.copyFile(path.join(directory, file), path.join(output, file));
}
await fs.mkdir(path.join(output, 'lib'), { recursive: true });
await fs.copyFile(require.resolve('axe-core/axe.min.js'), path.join(output, 'lib/axe.min.js'));
await fs.copyFile(require.resolve('axe-core/LICENSE'), path.join(output, 'lib/AXE-LICENSE.txt'));
// Rasterise the existing pulse-mark geometry into store-compatible PNG icons.
const crc = bytes => { let c = 0xffffffff; for (const b of bytes) { c ^= b; for (let n = 0; n < 8; n++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); } return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const name = Buffer.from(type), size = Buffer.alloc(4), checksum = Buffer.alloc(4); size.writeUInt32BE(data.length); checksum.writeUInt32BE(crc(Buffer.concat([name, data]))); return Buffer.concat([size, name, data, checksum]); };
for (const size of [16, 32, 48, 128]) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const points = [[.16,.5],[.34,.5],[.43,.24],[.57,.77],[.66,.5],[.84,.5]];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = (x + .5) / size, py = (y + .5) / size;
    let white = false;
    for (let i = 1; i < points.length; i++) { const [ax,ay] = points[i-1], [bx,by] = points[i]; const t = Math.max(0, Math.min(1, ((px-ax)*(bx-ax)+(py-ay)*(by-ay))/((bx-ax)**2+(by-ay)**2))); if (Math.hypot(px-ax-t*(bx-ax),py-ay-t*(by-ay)) < .033) white = true; }
    const offset = y * (size * 4 + 1) + 1 + x * 4; raw.set(white ? [255,255,255,255] : [7,85,245,255], offset);
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size); ihdr.writeUInt32BE(size,4); ihdr[8] = 8; ihdr[9] = 6;
  await fs.mkdir(path.join(output, 'icons'), { recursive: true });
  await fs.writeFile(path.join(output, `icons/icon${size}.png`), Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
}
console.log(`Built Sarvya extension ${manifest.version} with locally bundled axe-core.`);
