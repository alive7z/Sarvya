export class RunError extends Error {
  constructor(message, { retryable = false, status = 500 } = {}) {
    super(message);
    this.name = 'RunError';
    this.retryable = retryable;
    this.status = status;
  }
}
export class RunCancelledError extends RunError {
  constructor() { super('Scan cancelled.'); this.name = 'RunCancelledError'; }
}
export function isTransient(error) {
  return error?.retryable === true || error?.name === 'TimeoutError'
    || ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNREFUSED'].includes(error?.code)
    || (error?.cause && error.cause !== error && isTransient(error.cause))
    || /net::ERR_(CONNECTION_RESET|CONNECTION_CLOSED|TIMED_OUT|NETWORK_CHANGED)/.test(error?.message || '');
}
export function publicError(error) {
  if (error instanceof RunError) return error.message;
  if (/Executable doesn't exist/.test(error?.message || '')) return 'Chromium is not installed for this worker. Run playwright install chromium on the worker host.';
  if (isTransient(error)) return 'The target temporarily failed to respond. Please retry later.';
  return 'The scan could not finish. Check the worker logs for details.';
}
