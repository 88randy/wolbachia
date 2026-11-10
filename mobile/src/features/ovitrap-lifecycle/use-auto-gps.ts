import { useEffect, useRef } from "react";
import type { LifecycleProps } from "./model.ts";

/** Looks for the location by itself the first time the last page opens; a button retries. */
export function useAutoGps({ model, draft }: LifecycleProps): void {
  const hasTried = useRef(false);
  const { run, service } = model;
  const hasGps = draft.gps !== null;
  useEffect(() => {
    if (hasTried.current || hasGps) return;
    hasTried.current = true;
    void run(() => service.refreshGps(draft.eventId), draft.eventId);
  }, [hasGps, run, service, draft.eventId]);
}
