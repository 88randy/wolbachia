import { useEffect, useState } from "react";

/** How long a loading or checking state may last before the user sees it (fast answers show none). */
export const LOADING_DELAY_MS = 300;

/** True only once `active` has been true for `delayMs` without interruption. */
export function useDelayedFlag(active: boolean, delayMs: number = LOADING_DELAY_MS): boolean {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setTimeout(() => {
      setElapsed(true);
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
      setElapsed(false);
    };
  }, [active, delayMs]);
  return active && elapsed;
}
