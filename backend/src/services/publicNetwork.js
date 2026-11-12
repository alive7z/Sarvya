import dns from 'node:dns/promises';
import net from 'node:net';
import http from 'node:http';
import ipaddr from 'ipaddr.js';
export async function resolvePublicHost(hostname, lookup = dns.lookup) {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || /\.(localhost|local|internal|lan)$/.test(host)) throw new Error('Private destination blocked.');
  const records = net.isIP(host) ? [{ address: host, family: net.isIP(host) }] : await lookup(host, { all: true });
  if (!records.length || records.some(r => ipaddr.parse(r.address).range() !== 'unicast')) throw new Error('Private destination blocked.');
  return records;
}
export function publicLookup(hostname, options, callback) {
  resolvePublicHost(hostname).then(records => {
    const family = typeof options === 'number' ? options : options?.family;
    const selected = records.filter(r => !family || r.family === family);
    if (!selected.length) throw new Error('No public destination for this address family.');
    if (options?.all) callback(null, selected); else callback(null, selected[0].address, selected[0].family);
  }).catch(error => callback(error));
}
// Chromium connects only through this loopback proxy. DNS validation and the TCP
// connection use the same resolved IP, closing the preflight/re-resolution gap.
export async function createPublicProxy({ resolve = resolvePublicHost } = {}) {
  const sockets = new Set();
  const track = socket => { sockets.add(socket); socket.setTimeout(20000, () => socket.destroy()); socket.on('error', () => {}); socket.on('close', () => sockets.delete(socket)); return socket; };
  const destination = async value => {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw Error('Unsupported destination.');
    const records = await resolve(url.hostname); return { url, record: records[0], port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)) };
  };
  const server = http.createServer(async (req, res) => {
    let outgoing;
    try {
      if (sockets.size > 128) throw Error('Connection limit exceeded.');
      const { url, record, port } = await destination(req.url);
      if (url.protocol !== 'http:') throw Error('Use CONNECT for TLS.');
      const headers = { ...req.headers, host: url.host }; delete headers['proxy-authorization']; delete headers['proxy-connection'];
      outgoing = http.request({ hostname: record.address, family: record.family, port, method: req.method, path: url.pathname + url.search, headers, agent: false }, response => {
        res.writeHead(response.statusCode, response.headers); response.pipe(res);
      });
      outgoing.on('socket', track); outgoing.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
      res.on('close', () => outgoing.destroy()); req.pipe(outgoing);
    } catch { outgoing?.destroy(); res.writeHead(403); res.end('Destination blocked.'); }
  });
  server.on('connection', track);
  server.on('connect', async (req, client, head) => {
    try {
      if (sockets.size > 128) throw Error('Connection limit exceeded.');
      const { record, port } = await destination(`https://${req.url}`);
      const upstream = track(net.connect({ host: record.address, family: record.family, port }));
      client.on('close', () => upstream.destroy()); upstream.on('close', () => client.destroy());
      upstream.once('error', () => client.destroy());
      upstream.once('connect', () => { if (client.destroyed) return upstream.destroy(); client.write('HTTP/1.1 200 Connection Established\r\n\r\n'); if (head.length) upstream.write(head); upstream.pipe(client); client.pipe(upstream); });
    } catch { client.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { server: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => { for (const socket of sockets) socket.destroy(); server.close(resolve); }) };
}

export const browserEnvironment = () => Object.fromEntries(['PATH','HOME','LANG','LC_ALL','TZ','TMPDIR','XDG_CACHE_HOME','XDG_CONFIG_HOME','LD_LIBRARY_PATH','FONTCONFIG_PATH','FONTCONFIG_FILE','DISPLAY','WAYLAND_DISPLAY'].filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
