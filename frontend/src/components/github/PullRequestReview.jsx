import { useEffect, useState } from 'react';
import { ExternalLink, GitPullRequest } from 'lucide-react';

export default function PullRequestReview({ review, onApprove, onReject, onCreate, loading = false }) {
  const [consent, setConsent] = useState(false);
  useEffect(() => setConsent(false), [review?.revision]);
  const approved = review?.patches.filter(p => p.approved) || [];
  const editable = review?.status === 'draft';
  return <section id="github-review" className="workspace-panel space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-7 dark:border-zinc-800 dark:bg-zinc-900">
    <h2 className="flex items-center gap-2 text-lg font-bold"><GitPullRequest size={20} /> Review source changes</h2>
    {!review ? <p className="text-sm text-zinc-500">Choose a repository and start a review to prepare source patches.</p> : <>
      <p className="break-all text-xs text-zinc-500">{review.repository.fullName} · base {review.baseSha.slice(0, 12)} · {review.status}</p>
      {review.error && <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">{review.error}</p>}
      {!review.patches.length && <p className="text-sm text-zinc-500">No source patches prepared. Map a stored finding to a file above.</p>}
      {review.patches.map(patch => <article key={patch.id} className="min-w-0 space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="break-all font-mono text-sm font-semibold">{patch.path}</h3>
          <span className="text-xs text-zinc-500">Unverified proposal</span>
        </div>
        <p className="break-all text-xs text-zinc-500">{patch.mapping.rule} · {patch.mapping.selector} · {patch.mapping.scanId}</p>
        <pre tabIndex={0} aria-label={`Patch diff for ${patch.path}`} className="max-h-96 overflow-auto rounded-lg bg-zinc-950 p-4 text-xs leading-6 text-zinc-100">{patch.diff.split('\n').map((line, index) => <span key={index} className={`block whitespace-pre ${line.startsWith('+') ? 'text-emerald-300' : line.startsWith('-') ? 'text-rose-300' : ''}`}>{line || ' '}</span>)}</pre>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={patch.approved} disabled={loading || !editable} onChange={event => onApprove(patch.id, event.target.checked)} />Approve this exact diff</label>
          {editable && <button type="button" disabled={loading} onClick={() => onReject(patch.id)} className="text-sm text-red-600 hover:underline disabled:opacity-50">Remove patch</button>}
        </div>
      </article>)}
      {review.pullRequest ? <a href={review.pullRequest.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-4 py-3 text-sm font-semibold text-white">Open pull request #{review.pullRequest.number}<ExternalLink size={16} /></a> : <div className="space-y-4 border-t border-zinc-200 pt-5 dark:border-zinc-700">
        <p className="text-xs leading-6 text-zinc-500">Only approved files will be committed to a new {review.branch} branch. This creates a draft pull request. Repository tests and manual accessibility checks are still required.</p>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={consent} disabled={loading || !approved.length} onChange={event => setConsent(event.target.checked)} />I approve creating a branch, commit, and draft pull request with these {approved.length} approved patch(es).</label>
        <button type="button" disabled={loading || !consent || !approved.length} onClick={onCreate} className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-5 py-3 text-sm font-semibold text-white hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-50"><GitPullRequest size={17} />{loading ? 'Working…' : review.status === 'failed' || review.status === 'submitting' ? 'Retry approved pull request' : 'Create draft pull request'}</button>
      </div>}
    </>}
  </section>;
}
