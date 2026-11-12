import { RunError } from '../runErrors.js';

// Fixed hosts and manual redirects keep credentials away from arbitrary destinations.
export function createGitHubClient(token, { fetchImpl = fetch } = {}) {
  return async (method, endpoint, body) => {
    if (!endpoint.startsWith('/') || endpoint.startsWith('//')) throw new RunError('Invalid GitHub endpoint.');
    let response;
    try {
      response = await fetchImpl(`https://api.github.com${endpoint}`, {
        method, redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Sarvya', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch { throw new RunError('GitHub did not respond. Check the review status before retrying.', { status: 502 }); }
    if (!response.ok) {
      await response.body?.cancel();
      const status = response.status;
      const message = status === 401 ? 'GitHub authorization expired or was revoked. Reconnect GitHub.'
        : status === 403 || status === 429 ? 'GitHub denied access or rate-limited this request. Check repository permissions, organization access, and try again later.'
        : status === 404 ? 'The GitHub repository or resource is unavailable to this account.'
        : status === 409 || status === 422 ? 'GitHub rejected this change. Refresh the source and review branch state before retrying.'
        : 'GitHub could not complete the request. Check the review status before retrying.';
      throw new RunError(message, { status: [401, 403, 404, 429].includes(status) ? status : [409, 422].includes(status) ? 409 : 502 });
    }
    if (response.status === 204) return null;
    // Bound tree/blob responses as well as error messages; never log tokens or bodies.
    const reader = response.body.getReader(); let bytes = 0; const chunks = [];
    try {
      while (true) { const { value, done } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > 12 * 1024 * 1024) { await reader.cancel(); throw new RunError('GitHub response is too large. Use a smaller repository.', { status: 413 }); } chunks.push(Buffer.from(value)); }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } finally { reader.releaseLock(); }
  };
}

export async function exchangeOAuthCode({ code, verifier, config, fetchImpl = fetch }) {
  let response;
  try {
    response = await fetchImpl('https://github.com/login/oauth/access_token', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.callbackUrl, code, code_verifier: verifier }),
    });
    const data = await response.json();
    if (!response.ok || typeof data.access_token !== 'string' || !data.access_token || data.access_token.length > 4096) throw Error();
    return { token: data.access_token, expiresIn: Number(data.expires_in) || 28800 };
  } catch { throw new RunError('GitHub sign-in could not be completed. Try connecting again.', { status: 401 }); }
}
