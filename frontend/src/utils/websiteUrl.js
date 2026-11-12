// Match the API's HTTPS default without changing a site's www/non-www hostname.
export function normalizeWebsiteUrl(value) {
  const message = 'Enter a website address such as example.com, www.example.com, or https://example.com.';
  if (typeof value !== 'string' || !value.trim() || value.length > 2048) throw new Error(message);
  let input = value.trim();
  if (/^https?:/i.test(input)) input = input.replace(/^(https?):\/*/i, '$1://');
  else if (input.startsWith('//')) input = `https:${input}`;
  else if (!/^[a-z][a-z\d+.-]*:\/\//i.test(input)) input = `https://${input}`;
  let url;
  try { url = new URL(input); } catch { throw new Error(message); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.hostname === 'www.' || url.hostname === 'www') throw new Error(message);
  url.hash = '';
  if (url.href.length > 2048) throw new Error('The website address must be at most 2048 characters.');
  return url.href;
}
