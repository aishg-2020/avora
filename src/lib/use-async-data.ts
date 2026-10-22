"use client";

// Small helper shared by every page: call one or more service methods on
// mount, track loading/error state, and expose a `reload()` so pages can
// refetch after a mutation without manipulating any store directly — they
// just call the service again.

import { useCallback, useEffect, useState } from "react";

export function useAsyncData<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  // `loading` is derived from comparing these two rather than set directly
  // inside the effect, so the effect body never calls setState
  // synchronously (only from the async loader's callbacks).
  const [requestToken, setRequestToken] = useState(0);
  const [resolvedToken, setResolvedToken] = useState(-1);

  useEffect(() => {
    let cancelled = false;
    loader()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
        setResolvedToken(requestToken);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
        setResolvedToken(requestToken);
      });
    return () => {
      cancelled = true;
    };
    // `loader` is intentionally excluded: callers pass a fresh closure every
    // render, and `deps` is the explicit, caller-controlled refetch trigger
    // (mirrors the dependency array pages used to pass to useEffect before
    // this hook existed).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, requestToken]);

  // Stable identity so callers can safely use it in effect dependencies
  // (e.g. re-fetching from a service subscription).
  const reload = useCallback(() => setRequestToken((t) => t + 1), []);

  return { data, loading: requestToken !== resolvedToken, error, reload };
}
