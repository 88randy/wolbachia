import { useLayoutEffect, useRef } from "react";
import type { SessionGuard } from "../session/use-session-guard";

/** Leaving and returning to a view retires old receipts, even within one identity. */
export function useCatalogAvailabilityContext(
  key: string,
  ready: boolean,
  options: { begin: () => SessionGuard; setOptimisticAvailability: (value: null) => void },
) {
  const { begin, setOptimisticAvailability } = options;
  const current = useRef({ key, ready, generation: 0 });
  useLayoutEffect(() => {
    const changed = current.current.key !== key;
    const generation = current.current.generation + Number(changed);
    current.current = { key, ready, generation };
    if (changed) setOptimisticAvailability(null);
  }, [key, ready, setOptimisticAvailability]);
  return {
    isAvailabilityReady: () => current.current.key === key && current.current.ready,
    beginAvailability: () => {
      const guard = begin();
      const generation = ++current.current.generation;
      return {
        signal: guard.signal,
        isStale: () => guard.isStale() || generation !== current.current.generation,
      };
    },
  };
}
