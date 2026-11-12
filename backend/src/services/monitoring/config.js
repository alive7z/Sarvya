import { validateScanInput } from '../runService.js';
import { RunError } from '../runErrors.js';
import { scopeIdentity } from './comparison.js';

export function monitorConfig(input = {}, previous = {}) {
  const allowed = ['url', 'frequency', 'time', 'timeZone', 'weekday', 'maxPages', 'maxDepth', 'alerts', 'active', 'baselineMode', 'baselineScanId'];
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !allowed.includes(key))) throw new RunError('Unsupported monitor setting.', { status: 400 });
  const value = { frequency: 'weekly', time: '09:00', timeZone: 'UTC', weekday: 1, alerts: true, active: true, baselineMode: 'fixed', maxPages: 1, maxDepth: 1, ...previous, ...input };
  const scan = validateScanInput(value);
  if (!['daily', 'weekly'].includes(value.frequency) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.time || '') || !Number.isInteger(value.weekday) || value.weekday < 0 || value.weekday > 6 || !['fixed', 'previous'].includes(value.baselineMode) || typeof value.alerts !== 'boolean' || typeof value.active !== 'boolean') throw new RunError('Use a daily/weekly schedule, HH:mm time, weekday 0–6, fixed/previous baseline, and boolean alert/active settings.', { status: 400 });
  try { if (typeof value.timeZone !== 'string' || value.timeZone.length > 100 || !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)*$/.test(value.timeZone)) throw Error(); new Intl.DateTimeFormat('en', { timeZone: value.timeZone }).format(); } catch { throw new RunError('Choose a valid IANA time zone.', { status: 400 }); }
  return { ...scan, frequency: value.frequency, time: value.time, timeZone: value.timeZone, weekday: value.weekday, alerts: value.alerts, active: value.active, baselineMode: value.baselineMode, scope: scopeIdentity(scan) };
}
export function repeatOptions(monitor) {
  const [hours, minutes] = monitor.time.split(':').map(Number);
  return { pattern: `0 ${minutes} ${hours} * * ${monitor.frequency === 'weekly' ? monitor.weekday : '*'}`, tz: monitor.timeZone };
}
export const schedulerId = id => `audit-${id}`;
