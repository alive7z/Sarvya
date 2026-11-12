import { createHash } from 'node:crypto';
import { RunError } from '../runErrors.js';

export const MAX_FILE_BYTES = 200 * 1024;
export const fail = (message, status = 400) => { throw new RunError(message, { status }); };
export const sha = value => /^[a-f0-9]{40,64}$/.test(value || '');
export function repoPath(name) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(name) || name.split('/').some(s => s === '.' || s === '..')) fail('Choose a valid repository.');
  return `/repos/${name.split('/').map(encodeURIComponent).join('/')}`;
}
export function sourcePath(value) {
  if (typeof value !== 'string' || value.length > 500 || value.split('/').length > 12 || !/\.(html?|jsx?|tsx?|vue|svelte|css|scss|mdx|astro)$/i.test(value)
    || value.split('/').some(part => !part || part.startsWith('.') || ['node_modules', 'vendor', 'dist', 'build'].includes(part)) || /[\\\x00-\x1f\x7f]/.test(value)) fail('Choose a source file with a safe relative path (HTML, JS/TS, CSS, Vue, Svelte, MDX, or Astro).');
  return value;
}
export async function repository(api, name) {
  const data = await api('GET', repoPath(name));
  if (!Number.isSafeInteger(data.id) || !data.default_branch || !data.permissions?.push || data.archived || data.disabled) fail('This repository is unavailable for writes. Choose an active repository where you have push access.', 403);
  repoPath(data.full_name);
  return { id: data.id, fullName: data.full_name, defaultBranch: data.default_branch, private: Boolean(data.private) };
}
export async function branchHead(api, repo) {
  const ref = await api('GET', `${repoPath(repo.fullName)}/git/ref/heads/${encodeURIComponent(repo.defaultBranch)}`);
  if (!sha(ref.object?.sha) || ref.object?.type !== 'commit') fail('Repository has no usable default branch.', 409);
  return ref.object.sha;
}
export async function sourceFile(api, review, requestedPath) {
  const filePath = sourcePath(requestedPath), parts = filePath.split('/');
  const prefix = repoPath(review.repository.fullName); let treeSha = review.baseTreeSha, entry;
  for (let index = 0; index < parts.length; index++) {
    const tree = await api('GET', `${prefix}/git/trees/${treeSha}`);
    entry = tree.tree?.find(item => item.path === parts[index]);
    if (!entry || !sha(entry.sha)) fail('Source file was not found in the reviewed commit.', 404);
    if (index < parts.length - 1) { if (entry.type !== 'tree') fail('Source path is not a directory.'); treeSha = entry.sha; }
  }
  if (entry.type !== 'blob' || !['100644', '100755'].includes(entry.mode)) fail('Symlinks, submodules, and non-regular files cannot be patched.');
  if (entry.size > MAX_FILE_BYTES) fail('Source files are limited to 200 KiB.', 413);
  const blob = await api('GET', `${prefix}/git/blobs/${entry.sha}`);
  if (blob.encoding !== 'base64' || blob.size > MAX_FILE_BYTES || typeof blob.content !== 'string') fail('Source file is not supported.', 413);
  const bytes = Buffer.from(blob.content, 'base64');
  if (bytes.length > MAX_FILE_BYTES || bytes.includes(0)) fail('Binary or oversized files cannot be patched.', 413);
  let content;
  try { content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); } catch { fail('Only UTF-8 source files can be patched.'); }
  return { path: filePath, sha: entry.sha, mode: entry.mode, content };
}
export function preparePatch(file, before, after) {
  if (typeof before !== 'string' || typeof after !== 'string' || !before.trim() || !after.trim() || before.includes('\0') || after.includes('\0') || Buffer.byteLength(before) + Buffer.byteLength(after) > 50 * 1024) fail('Provide a nonempty original block and replacement, limited to 50 KiB combined.');
  const eol = file.content.includes('\r\n') ? '\r\n' : '\n';
  before = before.replace(/\r?\n/g, eol); after = after.replace(/\r?\n/g, eol);
  const offset = file.content.indexOf(before);
  if (offset < 0 || file.content.indexOf(before, offset + 1) >= 0) fail('The original block must match exactly once in this source file. Include more surrounding context.');
  if (before === after) fail('The replacement does not change the source.');
  const content = file.content.slice(0, offset) + after + file.content.slice(offset + before.length);
  if (Buffer.byteLength(content) > MAX_FILE_BYTES) fail('The resulting source file exceeds 200 KiB.', 413);
  const original = file.content.replace(/\r\n/g, '\n').split('\n'), replacement = content.replace(/\r\n/g, '\n').split('\n');
  let start = 0, tail = 0;
  while (start < original.length && start < replacement.length && original[start] === replacement[start]) start++;
  while (tail < original.length - start && tail < replacement.length - start && original.at(-tail - 1) === replacement.at(-tail - 1)) tail++;
  const from = Math.max(0, start - 3), oldEnd = Math.min(original.length, original.length - tail + 3), newEnd = Math.min(replacement.length, replacement.length - tail + 3);
  const lines = original.slice(from, start).map(line => ` ${line}`)
    .concat(original.slice(start, original.length - tail).map(line => `-${line}`), replacement.slice(start, replacement.length - tail).map(line => `+${line}`), original.slice(original.length - tail, oldEnd).map(line => ` ${line}`));
  const diff = `--- a/${file.path}\n+++ b/${file.path}\n@@ -${from + 1},${oldEnd - from} +${from + 1},${newEnd - from} @@\n${lines.join('\n')}`;
  return { content, diff, digest: createHash('sha256').update(JSON.stringify([file.path, file.sha, content, diff])).digest('hex') };
}
