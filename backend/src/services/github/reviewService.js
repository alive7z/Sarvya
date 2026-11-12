import { randomUUID, createHash } from 'node:crypto';
import { createReviewStore } from './reviewStore.js';
import { repository, repoPath, branchHead, sourceFile, sourcePath, preparePatch, fail, sha } from './source.js';
import { getScan } from '../storageService.js';

export const publicReview = review => ({
  id: review.id, revision: review.revision, status: review.status, repository: review.repository,
  baseSha: review.baseSha, branch: review.branch, commitSha: review.commitSha, createdAt: review.createdAt, error: review.error || null, pullRequest: review.pullRequest || null,
  patches: review.patches.filter(p => !p.rejected).map(p => ({ id: p.id, path: p.path, sourceSha: p.sourceSha, diff: p.diff, approved: Boolean(p.approvedDigest), mapping: p.mapping, verification: 'unverified' })),
});
const digest = p => createHash('sha256').update(JSON.stringify([p.path, p.sourceSha, p.content, p.diff])).digest('hex');
const revisionMatches = (review, revision) => { if (!Number.isSafeInteger(revision) || revision !== review.revision) fail('The review changed. Reload it and approve the current diff.', 409); };
const editable = review => { if (review.status !== 'draft' || Date.now() - Date.parse(review.createdAt) > 86400000) fail('This review is locked or expired. Start a new review.', 409); };
const active = review => review.patches.filter(p => !p.rejected);
const prResult = (data, review) => {
  if (!Number.isSafeInteger(data.number) || data.head?.sha !== review.commitSha || data.head?.ref !== review.branch || data.base?.repo?.id !== review.repository.id) fail('GitHub returned an unexpected pull request. Check the branch on GitHub.', 502);
  return { number: data.number, url: `https://github.com/${review.repository.fullName}/pull/${data.number}`, state: data.state, draft: Boolean(data.draft) };
};

export function createReviewService({ store = createReviewStore(), readScan = getScan } = {}) {
  const owned = (user, id) => store.get(user.id, id);
  const checkRepository = async (api, review) => {
    const repo = await repository(api, review.repository.fullName);
    if (repo.id !== review.repository.id || repo.defaultBranch !== review.repository.defaultBranch) fail('Repository identity or default branch changed. Start a new review.', 409);
    return repo;
  };
  return {
    async create(user, api, name) {
      const repo = await repository(api, name), baseSha = await branchHead(api, repo);
      const commit = await api('GET', `${repoPath(repo.fullName)}/git/commits/${baseSha}`);
      if (!sha(commit.tree?.sha)) fail('GitHub returned an invalid source tree.', 502);
      return publicReview(await store.create(user.id, { repository: repo, baseSha, baseTreeSha: commit.tree.sha, branch: `sarvya/fix-${randomUUID()}`, patches: [], status: 'draft' }));
    },
    async get(user, id) { return publicReview(await owned(user, id)); },
    async files(user, api, id) {
      const review = await owned(user, id); await checkRepository(api, review);
      const data = await api('GET', `${repoPath(review.repository.fullName)}/git/trees/${review.baseTreeSha}?recursive=1`);
      const candidates = (data.tree || []).filter(item => {
        try { sourcePath(item.path); return item.type === 'blob' && ['100644', '100755'].includes(item.mode) && item.size <= 200 * 1024; } catch { return false; }
      });
      return { files: candidates.slice(0, 2000).map(item => item.path), truncated: Boolean(data.truncated || candidates.length > 2000), baseSha: review.baseSha };
    },
    async source(user, api, id, path) { const review = await owned(user, id); await checkRepository(api, review); return sourceFile(api, review, path); },
    async add(user, api, id, input) {
      return store.edit(user.id, id, async (review, save) => {
        revisionMatches(review, input.revision); editable(review);
        if (input.mappingConfirmed !== true) fail('Confirm that the selected source block corresponds to this finding.');
        const scan = typeof input.scanId === 'string' ? readScan(input.scanId) : null;
        const issue = scan?.status === 'completed' && scan.issues?.find(item => item.id === input.issueId);
        if (!issue) fail('Choose a finding from a completed, stored scan. Sample findings cannot create source patches.');
        if (active(review).length >= 10 || active(review).some(p => p.path === input.path)) fail('Use at most ten files per review and one replacement block per file. Remove an existing patch before replacing it.');
        await checkRepository(api, review);
        const file = await sourceFile(api, review, input.path);
        const patch = preparePatch(file, input.before, input.after);
        const proposal = { id: randomUUID(), path: file.path, sourceSha: file.sha, mode: file.mode, ...patch, approvedDigest: null,
          mapping: { scanId: scan.scanId, issueId: issue.id, rule: issue.rule, selector: issue.selector, url: issue.url || scan.startUrl } };
        if (active(review).reduce((sum, p) => sum + Buffer.byteLength(p.diff), Buffer.byteLength(patch.diff)) > 250 * 1024) fail('Review diffs are limited to 250 KiB.', 413);
        return publicReview(await save({ patches: [...review.patches, proposal] }));
      });
    },
    async decide(user, id, patchId, input, remove = false) {
      return store.edit(user.id, id, async (review, save) => {
        revisionMatches(review, input.revision); editable(review);
        if (!remove && typeof input.approved !== 'boolean') fail('Approval must be true or false.');
        const patch = active(review).find(p => p.id === patchId);
        if (!patch) fail('Patch not found.', 404);
        const patches = review.patches.map(p => p.id !== patchId ? p : { ...p, approvedDigest: !remove && input.approved ? digest(p) : null, rejected: remove, reviewedAt: new Date().toISOString() });
        return publicReview(await save({ patches }));
      });
    },
    async publish(user, api, input) {
      return store.edit(user.id, input.reviewId, async (review, save) => {
        if (review.pullRequest) return publicReview(review); // Safe replay, never duplicate a PR.
        revisionMatches(review, input.revision);
        if (!['draft', 'failed', 'submitting'].includes(review.status) || Date.now() - Date.parse(review.createdAt) > 86400000) fail('Review expired or is unavailable.', 409);
        const patches = active(review).filter(p => p.approvedDigest);
        if (input.approval !== true || !Array.isArray(input.approvedPatchIds) || !patches.length || input.approvedPatchIds.length !== patches.length || new Set(input.approvedPatchIds).size !== patches.length || patches.some(p => !input.approvedPatchIds.includes(p.id) || p.approvedDigest !== digest(p))) fail('Explicitly approve the current patches before creating a pull request.');
        const repo = await checkRepository(api, review), prefix = repoPath(repo.fullName);
        if (review.branch === repo.defaultBranch || !/^sarvya\/fix-[a-f0-9-]{36}$/.test(review.branch)) fail('Unsafe pull request branch.', 409);
        // Recover a successful POST whose response was lost, without writing again.
        if (review.commitSha) {
          const prs = await api('GET', `${prefix}/pulls?state=all&head=${encodeURIComponent(`${repo.fullName.split('/')[0]}:${review.branch}`)}&base=${encodeURIComponent(repo.defaultBranch)}&per_page=100`);
          const existing = prs.find(p => p.head?.sha === review.commitSha && p.head?.ref === review.branch);
          if (existing) return publicReview(await save({ status: 'completed', pullRequest: prResult(existing, review), error: null }));
        }
        if (await branchHead(api, repo) !== review.baseSha) fail('The default branch changed since this diff was prepared. Start a fresh review; no default-branch files were overwritten.', 409);
        for (const patch of patches) { const file = await sourceFile(api, review, patch.path); if (file.sha !== patch.sourceSha) fail('A source file changed. Start a fresh review.', 409); }
        review = await save({ status: 'submitting', error: null });
        try {
          if (!review.treeSha) {
            const tree = await api('POST', `${prefix}/git/trees`, { base_tree: review.baseTreeSha, tree: patches.map(p => ({ path: p.path, mode: p.mode, type: 'blob', content: p.content })) });
            if (!sha(tree.sha)) fail('GitHub did not return a valid tree.', 502);
            review = await save({ treeSha: tree.sha });
          }
          if (!review.commitSha) {
            const commit = await api('POST', `${prefix}/git/commits`, { message: `Fix accessibility issues in ${patches.length} file(s)`, tree: review.treeSha, parents: [review.baseSha] });
            if (!sha(commit.sha)) fail('GitHub did not return a valid commit.', 502);
            review = await save({ commitSha: commit.sha });
          }
          let ref;
          try { ref = await api('GET', `${prefix}/git/ref/heads/${encodeURIComponent(review.branch)}`); } catch (error) { if (error.status !== 404) throw error; }
          if (ref && ref.object?.sha !== review.commitSha) fail('The review branch was changed elsewhere. It will not be overwritten.', 409);
          if (!ref) await api('POST', `${prefix}/git/refs`, { ref: `refs/heads/${review.branch}`, sha: review.commitSha });
          review = await save({ branchCreated: true });
          const mappings = patches.map(p => `- ${p.path}: ${p.mapping.rule} (${p.mapping.scanId}, ${p.mapping.issueId})`).join('\n');
          const pr = await api('POST', `${prefix}/pulls`, { title: `Review accessibility fixes in ${patches.length} file(s)`, head: review.branch, base: repo.defaultBranch, draft: true,
            body: `User-approved Sarvya source patches.\n\n${mappings}\n\nBase commit: ${review.baseSha}\n\nValidation: original source blocks matched uniquely and source blob SHAs were checked before writing. These patches are unverified proposals; repository tests and manual accessibility checks remain required. No automatic merge is performed.` });
          return publicReview(await save({ status: 'completed', pullRequest: prResult(pr, review), error: null }));
        } catch (error) {
          await save({ status: 'failed', error: 'GitHub submission did not finish. The saved branch/commit may exist. Retry this review to reconcile it; no branch is force-updated or deleted.' });
          throw error;
        }
      });
    },
  };
}
