import { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Check,
  Copy,
  Code2,
  Sparkles,
  LoaderCircle,
  ExternalLink,
} from 'lucide-react';
import { verifyFixApi } from '../../services/scanService.js';

export default function VerificationModal({
  open,
  issue,
  onClose,
  onFixVerified,
}) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  async function runVerification(codeToTest) {
    const target = codeToTest !== undefined ? codeToTest : code;
    setLoading(true);
    setResult(null);
    try {
      const data = await verifyFixApi(issue.rule, target);
      setResult(data);
      if (data.verified) {
        onFixVerified?.(issue.id, target);
      }
    } catch (err) {
      setResult({
        verified: false,
        message: err.userMessage || err.message || 'Verification failed to execute.',
        remainingViolations: [],
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && issue) {
      const initialCode = issue.fix || issue.snippet || '';
      setCode(initialCode);
      setResult(null);
      setCopied(false);
      // Automatically run verification in background against warm Chromium pool
      runVerification(initialCode);
    }
  }, [open, issue?.id]);

  if (!open || !issue) return null;

  async function handleRunVerification() {
    await runVerification(code);
  }

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleReset() {
    setCode(issue.fix || '');
    setResult(null);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="verify-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-5 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              <ShieldCheck size={22} strokeWidth={2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="verify-modal-title"
                  className="text-[17px] font-extrabold text-zinc-900 dark:text-zinc-100"
                >
                  Live Chromium + axe-core Sandbox Verification
                </h2>
                <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-400">
                  ISOLATED
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                Tests your proposed code snippet inside a real headless browser session against official WCAG rules.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close verification modal"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Issue Details Strip */}
        <div className="border-b border-zinc-100 bg-zinc-50/70 px-6 py-3 dark:border-zinc-800 dark:bg-zinc-800/40">
          <div className="flex flex-wrap items-center justify-between gap-3 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                Testing Rule:
              </span>
              <code className="rounded bg-white px-2 py-0.5 font-mono text-[11px] font-bold text-orange-600 shadow-sm dark:bg-zinc-800 dark:text-orange-400">
                {issue.rule}
              </code>
              <span className="text-zinc-400">·</span>
              <span className="font-medium text-zinc-500 dark:text-zinc-400">
                WCAG {issue.wcag || '2.1'}
              </span>
            </div>

            <span className="text-zinc-400 font-mono text-[10px] truncate max-w-[240px]">
              {issue.selector}
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Editable Code Editor */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label
                htmlFor="sandbox-code-input"
                className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
              >
                <Code2 size={14} />
                Proposed Remediation Code (Editable Sandbox)
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  <RotateCcw size={12} />
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-[10px] font-semibold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-900 shadow-inner dark:border-zinc-700">
              <textarea
                id="sandbox-code-input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                rows={6}
                spellCheck={false}
                className="w-full resize-y bg-transparent p-4 font-mono text-[12px] leading-relaxed text-emerald-400 outline-none"
                placeholder="Enter HTML / CSS fix snippet to verify..."
              />
            </div>
            <p className="mt-1.5 text-[10px] text-zinc-400">
              You can tweak the HTML tags, attributes (e.g. <code>alt="..."</code>, <code>aria-label="..."</code>), or styles directly above and re-verify.
            </p>
          </div>

          {/* Action Button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={loading || !code.trim()}
              onClick={handleRunVerification}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 text-[12px] font-bold text-white shadow-md transition-all hover:bg-zinc-800 active:scale-[0.99] disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {loading ? (
                <>
                  <LoaderCircle size={16} className="animate-spin text-white" />
                  <span>Analyzing with axe-core in Chromium…</span>
                </>
              ) : (
                <>
                  <Play size={15} fill="currentColor" />
                  <span>Run Live Verification</span>
                </>
              )}
            </button>
          </div>

          {/* Results Display */}
          {result && (
            <div
              className={`rounded-xl border p-4.5 animate-in fade-in slide-in-from-top-1 duration-200 ${
                result.verified
                  ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/20'
                  : 'border-red-200 bg-red-50/60 dark:border-red-900/50 dark:bg-red-950/20'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    result.verified
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300'
                  }`}
                >
                  {result.verified ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    <AlertTriangle size={18} />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[13px] font-extrabold ${
                        result.verified
                          ? 'text-emerald-800 dark:text-emerald-300'
                          : 'text-red-800 dark:text-red-300'
                      }`}
                    >
                      {result.verified
                        ? 'VERIFICATION PASSED — WCAG COMPLIANT'
                        : 'VERIFICATION FAILED — BARRIER STILL PRESENT'}
                    </span>
                    <span className="rounded bg-white px-2 py-0.5 text-[9px] font-bold text-zinc-600 shadow-sm dark:bg-zinc-800 dark:text-zinc-300">
                      axe-core 4.x
                    </span>
                  </div>

                  <p
                    className={`mt-1 text-[11px] leading-relaxed ${
                      result.verified
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-red-700 dark:text-red-400'
                    }`}
                  >
                    {result.message}
                  </p>

                  {result.verified && (
                    <div className="mt-3 flex items-center gap-2 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">
                      <Sparkles size={13} />
                      <span>This fix is ready for production. Status updated to "Verified" in your audit.</span>
                    </div>
                  )}

                  {!result.verified && result.remainingViolations?.length > 0 && (
                    <div className="mt-3 rounded-lg border border-red-200 bg-white p-3 dark:border-red-900 dark:bg-zinc-900">
                      <span className="text-[10px] font-bold uppercase text-red-700 dark:text-red-400">
                        Remaining Violations:
                      </span>
                      <ul className="mt-1 space-y-1 text-[11px] text-zinc-600 dark:text-zinc-300">
                        {result.remainingViolations.map((v, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            <span>{v.help || v.id}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-800/60">
          <span className="text-[11px] text-zinc-400">
            Powered by Playwright Headless Chromium & AxeBuilder
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-200 bg-white px-5 py-2 text-[12px] font-bold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
