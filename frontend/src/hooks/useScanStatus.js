import { useEffect, useState } from 'react';
import { getScan, watchScan, TERMINAL_SCAN_STATES } from '../services/scanService.js';

export default function useScanStatus(scanId) {
  const [scan, setScan] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false; let unsubscribe; let timer; let finished = false; let revision = -1; let fetchingResult = false;
    setScan(null); setError('');
    if (!scanId) return undefined;
    const stop = () => { clearTimeout(timer); unsubscribe?.(); unsubscribe = null; };
    const accept = async (snapshot) => {
      if (disposed || finished || (snapshot.revision ?? 0) < revision) return;
      if (snapshot.status === 'completed' && !Object.hasOwn(snapshot, 'results')) {
        if (fetchingResult) return;
        fetchingResult = true; stop();
        try { snapshot = await getScan(scanId); }
        catch (failure) { fetchingResult = false; if (!disposed) { setError(failure.message); timer = setTimeout(poll, 1000); } return; }
      }
      if (disposed) return;
      revision = snapshot.revision ?? 0;
      setScan(snapshot); setError('');
      if (TERMINAL_SCAN_STATES.includes(snapshot.status)) { finished = true; stop(); }
    };
    const poll = async () => {
      if (disposed || finished) return;
      try { await accept(await getScan(scanId)); }
      catch (failure) { if (!disposed) setError(failure.message || 'Status connection interrupted. Retrying…'); }
      if (!disposed && !finished) timer = setTimeout(poll, 1000);
    };
    const start = async () => {
      try { await accept(await getScan(scanId)); }
      catch (failure) { if (!disposed) setError(failure.message); }
      if (disposed || finished) return;
      if (typeof EventSource === 'undefined') { timer = setTimeout(poll, 1000); return; }
      unsubscribe = watchScan(scanId, { onUpdate: (snapshot) => { accept(snapshot); }, onError: () => {
        if (disposed || finished || fetchingResult) return;
        stop(); setError('Live updates interrupted. Checking scan status…'); timer = setTimeout(poll, 500);
      } });
    };
    start();
    return () => { disposed = true; stop(); };
  }, [scanId]);
  return { scan, error };
}
