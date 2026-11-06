import { useEffect, useState } from "react";
const CLOCK_TICK_MS = 30_000;
/** Refresh relative labels on a quiet cadence; previews and tests can inject a fixed clock. */
export function useRelativeClock(now?: number): number {
  const [clock, setClock] = useState(Date.now);
  useEffect(() => {
    if (now !== undefined) return;
    const timer = window.setInterval(() => {
      setClock(Date.now());
    }, CLOCK_TICK_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [now]);
  return now ?? clock;
}
