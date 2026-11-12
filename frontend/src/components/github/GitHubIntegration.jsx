import { useEffect, useRef, useState } from 'react';
import { Github, LogOut, RefreshCw } from 'lucide-react';
import PageHeader, { PageSections } from '../layout/PageHeader.jsx';
import PullRequestReview from './PullRequestReview.jsx';
import { getGitHubSession, githubLoginUrl, disconnectGitHub, listRepositories, createReview, getReview, listSourceFiles, getSourceFile, prepareSourcePatch, approveSourcePatch, removeSourcePatch, createPullRequest } from '../../services/githubService.js';
import { listScans } from '../../services/scanService.js';

const inputStyle = 'w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100';
const buttonStyle = 'inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800';
const panelStyle = 'workspace-panel space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-7 dark:border-zinc-800 dark:bg-zinc-900';
export default function GitHubIntegration({ onNavigate }) {
  const [session, setSession] = useState(null), [repositories, setRepositories] = useState([]), [selected, setSelected] = useState('');
  const [nextPage, setNextPage] = useState(null), [review, setReview] = useState(null), [files, setFiles] = useState([]), [truncated, setTruncated] = useState(false);
  const [path, setPath] = useState(''), [source, setSource] = useState(null), [scans, setScans] = useState([]), [scanId, setScanId] = useState(''), [issueId, setIssueId] = useState('');
  const [before, setBefore] = useState(''), [after, setAfter] = useState(''), [mapped, setMapped] = useState(false), [busy, setBusy] = useState('Loading GitHub connection'), [error, setError] = useState('');
  const live = useRef(true);
  const comingSoon = session?.configured === false;
  const issue = scans.find(s => s.scanId === scanId)?.issues?.find(i => i.id === issueId);
  const setSavedReview = value => {
    setReview(value);
    if (session?.user) localStorage.setItem(`sarvya:github-review:${session.user.id}`, value.id);
  };
  async function action(label, work) {
    setBusy(label); setError('');
    try { await work(); }
    catch (failure) {
      setError(failure.userMessage || failure.message || 'GitHub request failed.');
      if (failure.response?.status === 401) setSession(previous => ({ ...previous, authenticated: false }));
      // A request may have succeeded before its response was lost. Reload the saved review.
      if (review?.id) { try { setReview(await getReview(review.id)); } catch { /* original error remains visible */ } }
    } finally { if (live.current) setBusy(''); }
  }
  useEffect(() => {
    live.current = true;
    (async () => {
      try {
        const value = await getGitHubSession(); if (!live.current) return;
        setSession(value);
        const outcome = new URLSearchParams(location.search).get('github');
        if (outcome) { const url = new URL(location.href); url.searchParams.delete('github'); history.replaceState(null, '', url); }
        if (outcome === 'failed') setError('GitHub sign-in was declined, expired, or could not be completed. Try again; use the same hostname as the configured callback.');
        if (value.authenticated) {
          const [repos, storedScans] = await Promise.all([listRepositories(), listScans()]);
          if (!live.current) return;
          setRepositories(repos.repositories); setNextPage(repos.nextPage);
          setScans(storedScans.filter(s => s.status === 'completed' && s.issues?.length));
          const saved = localStorage.getItem(`sarvya:github-review:${value.user.id}`);
          if (saved) {
            try {
              const current = await getReview(saved); if (!live.current) return;
              setReview(current); setSelected(current.repository.fullName);
              const listing = await listSourceFiles(current.id); if (live.current) { setFiles(listing.files); setTruncated(listing.truncated); }
            } catch { if (live.current) setError('The saved review could not be loaded. Start a new review or reconnect GitHub.'); }
          }
        }
      } catch (failure) { if (live.current) { setError(failure.userMessage || failure.message); if (failure.response?.status === 401) setSession(previous => ({ ...previous, authenticated: false })); } }
      finally { if (live.current) setBusy(''); }
    })();
    return () => { live.current = false; };
  }, []);
  function resetSource() { setSource(null); setPath(''); setBefore(''); setAfter(''); setMapped(false); }
  async function startReview() {
    const current = await createReview(selected); setSavedReview(current); resetSource();
    const listing = await listSourceFiles(current.id); setFiles(listing.files); setTruncated(listing.truncated);
  }
  return <div className="page-stack text-zinc-900 dark:text-zinc-100">
    <PageHeader title="GitHub integration" description={comingSoon ? "Repository access and reviewed pull requests are on the way." : "Connect GitHub, map findings to source, and approve changes before opening a pull request."} category="Integrations" icon={Github} onNavigate={onNavigate} />
    <PageSections items={[["github-connection", "GitHub login"], ...(session?.authenticated && review?.status === 'draft' ? [["github-source", "Source mapping"]] : []), ...(session?.authenticated ? [["github-review", "Review changes"]] : [])]} />
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
    {busy && <p role="status" className="text-sm text-zinc-500">{busy}…</p>}
    <section id="github-connection" className={panelStyle}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="text-lg font-bold">{session?.authenticated ? `Connected as ${session.user.login}` : comingSoon ? 'Connect your repositories' : 'Log in to access your repositories'}</h2><p className="mt-2 text-sm text-zinc-500">{session?.authenticated ? 'Choose an authorized repository where you have push access.' : comingSoon ? 'Review accessibility fixes and prepare pull requests from one place.' : 'Authorize Sarvya on GitHub. Your access token stays on the server.'}</p></div>
        {session?.authenticated ? <button className={buttonStyle} type="button" disabled={Boolean(busy)} onClick={() => action('Disconnecting GitHub', async () => { await disconnectGitHub(); setSession({ configured: true, authenticated: false }); setRepositories([]); setReview(null); resetSource(); })}><LogOut size={16} />Disconnect GitHub</button>
          : <button type="button" title={comingSoon ? 'GitHub login is coming soon' : undefined} aria-describedby={comingSoon ? 'github-availability' : undefined} disabled={Boolean(busy) || !session?.configured} onClick={() => { window.location.assign(githubLoginUrl); }} className="inline-flex items-center gap-2 rounded-xl bg-accent-600 px-5 py-3 text-sm font-semibold text-white hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-50"><Github size={18} />Log in with GitHub</button>}
      </div>
      {comingSoon && <div id="github-availability" className="rounded-xl border border-accent-100 bg-accent-50/60 p-4 dark:border-accent-900/50 dark:bg-accent-500/10"><span className="inline-flex rounded-full bg-accent-100 px-3 py-1 text-xs font-semibold text-accent-700 dark:bg-accent-500/20 dark:text-accent-300">Coming soon</span><p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">We're getting GitHub integration ready. You'll be able to connect repositories, review source changes, and open approved pull requests here.</p></div>}
      {session?.authenticated && <div className="space-y-3">
        <label className="block space-y-2 text-sm font-medium"><span>Repository</span><select aria-label="GitHub repository" value={selected} disabled={Boolean(busy)} onChange={event => setSelected(event.target.value)} className={inputStyle}><option value="">Select a repository</option>{repositories.map(repo => <option key={repo.id} value={repo.fullName}>{repo.fullName}{repo.isPrivate ? ' (private)' : ''}</option>)}{selected && !repositories.some(r => r.fullName === selected) && <option value={selected}>{selected}</option>}</select></label>
        {!repositories.length && <p className="text-sm text-zinc-500">No writable repositories on this page. Check OAuth scope, organization approval, or load the next page.</p>}
        <div className="flex flex-wrap gap-3"><button type="button" disabled={Boolean(busy) || !selected} className={buttonStyle} onClick={() => action('Loading repository source', startReview)}>{review ? 'Start a new review' : 'Start source review'}</button>{nextPage && <button type="button" disabled={Boolean(busy)} className={buttonStyle} onClick={() => action('Loading repositories', async () => { const data = await listRepositories(nextPage); setRepositories(previous => [...new Map([...previous, ...data.repositories].map(r => [r.id, r])).values()]); setNextPage(data.nextPage); })}>Load more repositories</button>}<button type="button" disabled={Boolean(busy)} className={buttonStyle} onClick={() => action('Refreshing GitHub', async () => { const data = await listRepositories(); setRepositories(data.repositories); setNextPage(data.nextPage); if (review) setSavedReview(await getReview(review.id)); })}><RefreshCw size={15} />Refresh</button></div>
        {review && selected !== review.repository.fullName && <p className="text-sm text-amber-700 dark:text-amber-300">Start a new review to use the selected repository. The current review still belongs to {review.repository.fullName}.</p>}
      </div>}
    </section>
    {session?.authenticated && review?.status === 'draft' && <section id="github-source" className={panelStyle}>
      <h2 className="text-lg font-bold">Map a finding to source</h2>
      <p className="text-sm leading-6 text-zinc-500">A website scan does not identify its original source automatically. Select a stored finding, choose the matching file, and enter the exact block to replace. One replacement block per file, up to ten files.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm"><span>Completed scan</span><select aria-label="Completed scan" className={inputStyle} value={scanId} disabled={Boolean(busy)} onChange={event => { setScanId(event.target.value); setIssueId(''); setMapped(false); }}><option value="">Choose a scan with findings</option>{scans.map(scan => <option key={scan.scanId} value={scan.scanId}>{scan.startUrl} · {new Date(scan.createdAt).toLocaleString()}</option>)}</select></label>
        <label className="space-y-2 text-sm"><span>Finding</span><select aria-label="Finding" className={inputStyle} value={issueId} disabled={Boolean(busy) || !scanId} onChange={event => { setIssueId(event.target.value); setMapped(false); }}><option value="">Choose an accessibility finding</option>{scans.find(s => s.scanId === scanId)?.issues.map(finding => <option key={finding.id} value={finding.id}>{finding.rule} · {finding.selector}</option>)}</select></label>
      </div>
      {!scans.length && <p className="text-sm text-zinc-500">Run a real website audit with findings first. Sample findings cannot create repository patches.</p>}
      {issue && <div className="break-words rounded-xl bg-zinc-50 p-3 text-xs leading-6 dark:bg-zinc-950"><p>{issue.title} · {issue.selector}</p><p>{issue.explanation}</p></div>}
      <div className="flex flex-col gap-3 sm:flex-row"><label className="min-w-0 flex-1 space-y-2 text-sm"><span>Repository source file</span><input aria-label="Repository source file" list="github-source-files" className={inputStyle} placeholder="src/components/Header.jsx" value={path} disabled={Boolean(busy)} onChange={event => { setPath(event.target.value); setSource(null); setMapped(false); }} /><datalist id="github-source-files">{files.map(file => <option key={file} value={file} />)}</datalist></label><button type="button" className={`${buttonStyle} sm:self-end`} disabled={Boolean(busy) || !path} onClick={() => action('Loading source file', async () => { const file = await getSourceFile(review.id, path); setSource(file); setBefore(''); setAfter(''); setMapped(false); })}>Load source file</button></div>
      {truncated && <p className="text-xs text-zinc-500">The file listing is partial. Enter a relative source path directly to load another file.</p>}
      {source && <>
        <pre tabIndex={0} aria-label="Original repository source" className="max-h-80 overflow-auto rounded-xl bg-zinc-950 p-4 text-xs leading-6 text-zinc-100">{source.content}</pre>
        <div className="grid gap-4 lg:grid-cols-2"><label className="space-y-2 text-sm"><span>Exact original source block</span><textarea aria-label="Exact original source block" rows={7} className={`${inputStyle} font-mono text-xs`} value={before} disabled={Boolean(busy)} onChange={event => { setBefore(event.target.value); setMapped(false); }} /></label><label className="space-y-2 text-sm"><span>Proposed replacement</span><textarea aria-label="Proposed replacement" rows={7} className={`${inputStyle} font-mono text-xs`} value={after} disabled={Boolean(busy)} onChange={event => { setAfter(event.target.value); setMapped(false); }} /></label></div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={mapped} disabled={Boolean(busy) || !issue} onChange={event => setMapped(event.target.checked)} />I confirm this source block corresponds to the selected finding.</label>
        <button type="button" disabled={Boolean(busy) || !mapped || !before.trim() || !after.trim() || !issue} className={buttonStyle} onClick={() => action('Preparing patch preview', async () => { const current = await prepareSourcePatch(review.id, { revision: review.revision, path: source.path, scanId, issueId, before, after, mappingConfirmed: mapped }); setSavedReview(current); setMapped(false); })}>Prepare patch preview</button>
      </>}
    </section>}
    {session?.authenticated && <PullRequestReview review={review} loading={Boolean(busy)} onApprove={(id, approved) => action('Saving patch decision', async () => setSavedReview(await approveSourcePatch(review, id, approved)))} onReject={id => action('Removing patch', async () => setSavedReview(await removeSourcePatch(review, id)))} onCreate={() => action('Creating approved pull request', async () => setSavedReview(await createPullRequest(review)))} />}
  </div>;
}
