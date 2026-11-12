const $ = id => document.getElementById(id);
let result;
async function request(type, extra = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...extra });
  if (!response?.ok) throw new Error(response?.error || 'Extension worker unavailable. Close and reopen the popup.');
  return response.result;
}
function error(message) { $('error').textContent = message; $('error').hidden = false; }
function render(state) {
  result = state.result;
  const busy = state.status === 'processing';
  $('scan').disabled = busy; $('clear').disabled = busy;
  $('status').textContent = busy ? 'Scanning this page… You can reopen this popup to check progress.' : state.status === 'completed' ? 'Audit completed.' : state.status === 'failed' ? 'Audit failed.' : 'Ready to scan.';
  if (state.error) error(state.error);
  $('summary').hidden = !result; $('export').disabled = !result;
  if (result) $('summary').textContent = `${result.occurrences} violation occurrences across ${result.violations.length} rules. ${result.incomplete.length} rules need manual review.`;
  renderFindings();
}
function renderFindings() {
  $('findings').replaceChildren();
  result?.violations.forEach((rule, ruleIndex) => {
    if ($('severity').value !== 'all' && $('severity').value !== rule.impact) return;
    const article = document.createElement('article');
    const title = document.createElement('h2'); title.textContent = rule.help;
    const badge = document.createElement('div'); badge.className = 'badge'; badge.textContent = `${rule.impact || 'Unspecified'} · ${rule.count} affected`;
    const link = document.createElement('a'); link.textContent = `Guidance: ${rule.id}`; try { const url = new URL(rule.helpUrl); link.href = url.protocol === 'https:' && !url.username && !url.password ? url.href : '#'; } catch { link.href = '#'; } link.target = '_blank'; link.rel = 'noopener noreferrer';
    article.append(title, badge, link);
    rule.nodes.forEach((node, nodeIndex) => {
      const row = document.createElement('div'); row.className = 'target';
      const selector = document.createElement('code'); selector.textContent = node.target.join(' > ');
      const inspect = document.createElement('button'); inspect.textContent = 'Inspect element'; inspect.type = 'button';
      inspect.onclick = () => request('inspect', { rule: ruleIndex, node: nodeIndex }).catch(err => error(err.message));
      row.append(selector, inspect); article.append(row);
    });
    if (rule.truncated) { const note = document.createElement('p'); note.textContent = 'Showing the first 100 targets; the count includes all occurrences.'; article.append(note); }
    $('findings').append(article);
  });
  if (result && !result.violations.length) { const p = document.createElement('p'); p.textContent = 'No automated violations found in this scope. Continue with manual review.'; $('findings').append(p); }
}
$('scan').onclick = async () => {
  $('error').hidden = true; render({ status: 'processing' });
  try { render(await request('scan')); } catch (err) { render({ status: 'failed' }); error(err.message); }
};
$('clear').onclick = () => request('clear').then(state => { $('error').hidden = true; render(state); }).catch(err => error(err.message));
$('severity').onchange = renderFindings;
$('export').onclick = () => {
  if (!result) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'sarvya-audit.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
request('state').then(render).catch(err => error(err.message));
const poll = setInterval(() => { if ($('scan').disabled) request('state').then(render).catch(err => { render({ status: 'failed' }); error(err.message); }); }, 2000);
window.addEventListener('unload', () => clearInterval(poll));
