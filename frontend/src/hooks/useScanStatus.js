import { useEffect, useState } from 'react';
import { getScan } from '../services/scanService.js';

export default function useScanStatus(scanId) {
  const [scan, setScan] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    if (!scanId) {
      setScan(null);
      setError('');
      return undefined;
    }

    async function loadScan() {
      try {
        const result = await getScan(scanId);

        if (!cancelled) {
          setScan(result);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.userMessage ||
              err.message ||
              'Could not retrieve scan results.'
          );
        }
      }
    }

    loadScan();

    return () => {
      cancelled = true;
    };
  }, [scanId]);

  return { scan, error };
}
