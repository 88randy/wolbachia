import { useEffect } from "react";
import { useSafety } from "../safety/SafetyProvider.tsx";
import { locationStatus } from "./location-status.ts";
import type { LocationStatus } from "./location-status.ts";
import type { CaptureProps } from "./model.ts";

const STAMPED = new Set<string>();

/** Follows the app's single location stream; the first usable fix is stamped on the draft by itself. */
export function useDraftLocation({ model, draft }: CaptureProps): LocationStatus {
  const { location } = useSafety();
  const { run, service } = model;
  const hasFix = location.kind === "granted";
  useEffect(() => {
    // The position saved when the draft started may be old: take the live one once per draft and
    // app run, so this step and the review step tell the same story.
    if (!hasFix || STAMPED.has(draft.eventId)) return;
    STAMPED.add(draft.eventId);
    void run(() => service.refreshGps(draft.eventId), { eventId: draft.eventId });
  }, [hasFix, draft.gps, draft.eventId, run, service]);
  return locationStatus(location);
}
