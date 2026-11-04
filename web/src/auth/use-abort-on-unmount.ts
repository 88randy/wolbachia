import { useCallback, useEffect, useRef } from "react";

/**
 * Returns `start()`, which makes an `AbortController` for one request. The latest one is aborted
 * when the component unmounts, so a late answer can be recognized (`signal.aborted`) and ignored.
 */
export function useAbortOnUnmount(): () => AbortController {
  const latest = useRef<AbortController | undefined>(undefined);
  useEffect(
    () => () => {
      latest.current?.abort();
    },
    [],
  );
  return useCallback(() => {
    latest.current = new AbortController();
    return latest.current;
  }, []);
}
