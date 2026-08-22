import { useCallback, useEffect, useState } from 'react';

/**
 * Minimal data-fetching hook: run an async function, expose
 * data/error/loading, and allow a manual reload after a mutation.
 *
 * Deliberately not TanStack Query — with no styling work in this codebase and
 * a small, fixed set of screens, a caching layer would be more machinery than
 * the app needs. Swap it in later if the screen count grows.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  const run = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fn()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e as Error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const [nonce, setNonce] = useState(0);
  useEffect(() => run(), [run, nonce]);

  return { data, error, loading, reload: () => setNonce((n) => n + 1) };
}
