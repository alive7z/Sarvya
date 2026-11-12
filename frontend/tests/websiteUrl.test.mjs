import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWebsiteUrl } from '../src/utils/websiteUrl.js';
test('website entry adds HTTPS to bare domains and www addresses while preserving the host, path, query, and explicit HTTP', () => {
  for (const [input, expected] of [
    ['www.example.com', 'https://www.example.com/'],
    [' example.com/about?lang=en#section ', 'https://example.com/about?lang=en'],
    ['HTTPS://WWW.Example.COM/path', 'https://www.example.com/path'],
    ['https:www.example.com', 'https://www.example.com/'],
    ['https:/www.example.com', 'https://www.example.com/'],
    ['//www.example.com', 'https://www.example.com/'],
    ['http://example.com:8080/path', 'http://example.com:8080/path'],
  ]) assert.equal(normalizeWebsiteUrl(input), expected);
});
test('website entry rejects unsupported protocols, credentials and malformed or excessive addresses', () => {
  for (const input of ['', 'www.', 'not a website', 'ftp://example.com/', 'file:///etc/passwd', 'javascript:alert(1)', 'https://user:pass@example.com', 'a'.repeat(2050)]) assert.throws(() => normalizeWebsiteUrl(input));
});
