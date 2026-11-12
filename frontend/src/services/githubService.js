import api from './api.js';

let csrfToken = '';
const credentials = { withCredentials: true };
const writeOptions = () => {
  if (!csrfToken) throw new Error('Reload the GitHub page to establish a review session.');
  return { ...credentials, headers: { 'X-CSRF-Token': csrfToken } };
};
export const githubLoginUrl = `${(api.defaults.baseURL || '').replace(/\/$/, '')}/api/github/oauth/start`;
export async function getGitHubSession() { const { data } = await api.get('/api/github/session', credentials); csrfToken = data.csrfToken || ''; return data; }
export async function disconnectGitHub() { await api.delete('/api/github/session', writeOptions()); csrfToken = ''; }
export async function listRepositories(page = 1) { return (await api.get('/api/github/repos', { ...credentials, params: { page } })).data; }
export async function createReview(repository) { return (await api.post('/api/github/reviews', { repository }, writeOptions())).data; }
export async function getReview(id) { return (await api.get(`/api/github/reviews/${id}`, credentials)).data; }
export async function listSourceFiles(id) { return (await api.get(`/api/github/reviews/${id}/files`, credentials)).data; }
export async function getSourceFile(id, path) { return (await api.get(`/api/github/reviews/${id}/source`, { ...credentials, params: { path } })).data; }
export async function prepareSourcePatch(id, input) { return (await api.post(`/api/github/reviews/${id}/patches`, input, writeOptions())).data; }
export async function approveSourcePatch(review, patchId, approved) { return (await api.patch(`/api/github/reviews/${review.id}/patches/${patchId}`, { revision: review.revision, approved }, writeOptions())).data; }
export async function removeSourcePatch(review, patchId) { return (await api.delete(`/api/github/reviews/${review.id}/patches/${patchId}`, { ...writeOptions(), data: { revision: review.revision } })).data; }
export async function createPullRequest(review) {
  const approvedPatchIds = review.patches.filter(p => p.approved).map(p => p.id);
  if (!approvedPatchIds.length) throw new Error('Approve a patch before creating a pull request.');
  return (await api.post('/api/github/pull-requests', { reviewId: review.id, revision: review.revision, approvedPatchIds, approval: true }, writeOptions())).data;
}
