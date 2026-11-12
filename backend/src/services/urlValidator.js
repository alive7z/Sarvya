import dns from 'node:dns/promises';
import net from 'node:net';
import ipaddr from 'ipaddr.js';

export function normalizeUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new Error('A valid URL is required.');
  }

  const trimmed = rawUrl.trim();
  if ((/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) || /^(file|data|javascript|ftp):/i.test(trimmed)) && !/^https?:\/\//i.test(trimmed)) throw new Error('Only HTTP and HTTPS URLs are allowed.');
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error('Invalid URL format. Please include http:// or https://');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only HTTP and HTTPS URLs are allowed.');
  }

  if (url.username || url.password) {
    throw new Error('URLs containing credentials are not allowed.');
  }

  // Remove fragment
  url.hash = '';
  return url.href;
}

export async function assertPublicUrl(rawUrl) {
  const url = new URL(normalizeUrl(rawUrl));
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();

  // Reject localhost and local domains
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan')
  ) {
    throw new Error('Local or internal destinations are blocked.');
  }

  if (net.isIP(hostname)) {
    const parsed = ipaddr.parse(hostname);
    if (parsed.range() !== 'unicast') {
      throw new Error('Private or reserved IP addresses are blocked.');
    }
    return;
  }

  let records;
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch (err) {
    throw new Error(`Unable to resolve hostname "${hostname}": ${err.message}`);
  }

  if (!records || records.length === 0) {
    throw new Error(`No DNS records found for "${hostname}".`);
  }

  for (const record of records) {
    try {
      const parsed = ipaddr.parse(record.address);
      if (parsed.range() !== 'unicast') {
        throw new Error(`Destination resolves to a non-public IP (${record.address}). Access blocked.`);
      }
    } catch (e) {
      throw new Error(`Invalid IP address resolved for "${hostname}": ${e.message}`);
    }
  }
}
