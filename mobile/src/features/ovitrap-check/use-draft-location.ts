import { useEffect, useRef } from "react";
import { useSafety } from "../safety/SafetyProvider.tsx";
import { locationStatus } from "./location-status.ts";
import type { LocationStatus } from "./location-status.ts";
import type { CaptureProps } from "./model.ts";

/** Follows the app's single location stream; the first usable fix is stamped on the draft by itself. */
export function useDraftLocation({ model, draft }: CaptureProps): LocationStatus {
  const { location } = useSafety();
  const stamped = useRef<string | null>(null);
  const { run, service } = model;
  const hasFix = location.kind === "granted";
  useEffect(() => {
    if (!hasFix || draft.gps !== null || stamped.current === draft.eventId) return;
    stamped.current = draft.eventId;
    void run(() => service.refreshGps(draft.eventId), { eventId: draft.eventId });
  }, [hasFix, draft.gps, draft.eventId, run, service]);
  return locationStatus(location);
}
