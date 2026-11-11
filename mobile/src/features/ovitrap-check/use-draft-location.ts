import { useEffect, useRef, useState } from "react";
import { useServices } from "../../app/services-context.ts";
import type { LocationState } from "../day/location.ts";
import { LOCATION_WAIT_MS, locationStatus } from "./location-status.ts";
import type { LocationStatus } from "./location-status.ts";
import type { CaptureProps } from "./model.ts";

function useLocationState(): LocationState {
  const { day } = useServices();
  const [state, setState] = useState<LocationState>({ kind: "searching" });
  useEffect(() => {
    let stop: (() => void) | null = null;
    let isActive = true;
    void day.location.start(setState).then((cancel) => {
      if (isActive) stop = cancel;
      else cancel();
    });
    return () => {
      isActive = false;
      stop?.();
    };
  }, [day]);
  return state;
}

/** Follows the phone location; the first usable fix is stamped on the draft by itself. */
export function useDraftLocation({ model, draft }: CaptureProps): LocationStatus {
  const state = useLocationState();
  const [hasWaitedLong, setWaitedLong] = useState(false);
  const stamped = useRef<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setWaitedLong(true);
    }, LOCATION_WAIT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [draft.eventId]);
  const { run, service } = model;
  const hasFix = state.kind === "granted";
  useEffect(() => {
    if (!hasFix || draft.gps !== null || stamped.current === draft.eventId) return;
    stamped.current = draft.eventId;
    void run(() => service.refreshGps(draft.eventId), { eventId: draft.eventId });
  }, [hasFix, draft.gps, draft.eventId, run, service]);
  return locationStatus(state, hasWaitedLong);
}
