import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  reload: () => void;
}

/**
 * A deliberately small data hook. Screens are short-lived and reads are cheap;
 * a full cache would be more machinery than this product needs.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    const run = latest.current + 1;
    latest.current = run;
    // The request is the external system; loading starts with it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    fn()
      .then((result) => {
        if (latest.current === run) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((cause: unknown) => {
        if (latest.current === run) {
          setError(cause instanceof Error ? cause : new Error('Something went wrong'));
          setLoading(false);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}
