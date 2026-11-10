import { useEffect, useState } from "react";
const MAX_TIMER_MS = 2_147_483_647;
/** This timer observes server validity boundaries; it never computes qualification locally. */
export function useEligibilityBoundary(options: {
  nextChange: string | null | undefined;
  isFixedInstant: boolean;
  refetch: () => Promise<unknown>;
}) {
  const { nextChange, isFixedInstant, refetch } = options;
  const [tick, setTick] = useState(0);
  const boundary = nextChange ? Date.parse(nextChange) : 0;
  useEffect(() => {
    if (isFixedInstant || !Number.isFinite(boundary) || boundary <= Date.now()) return;
    const timer = setTimeout(
      () => {
        setTick((previous) => previous + 1);
        void refetch();
      },
      Math.min(boundary - Date.now(), MAX_TIMER_MS),
    );
    return () => {
      clearTimeout(timer);
    };
  }, [boundary, isFixedInstant, refetch, tick]);
  return !isFixedInstant && boundary > 0 && Date.now() >= boundary;
}
