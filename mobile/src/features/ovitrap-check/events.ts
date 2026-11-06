import type { FieldEventEnvelope } from "../../outbox/outbox-event.ts";
import { checkPayload, placePayload } from "./domain.ts";
import type { Draft } from "./types.ts";
/** Preserve the capture UUID/time and exact snapshot tokens across retries and restarts. */
export function captureEvent(draft: Draft): FieldEventEnvelope {
  return {
    id: draft.eventId,
    type: draft.mode === "place" ? "ovitrap.place" : "ovitrap.check",
    schema_version: 1,
    device_time: draft.deviceTime,
    shift_id: draft.shiftId,
    gps: draft.gps,
    manual_capture: draft.manualCapture,
    rules_version: draft.rules?.version ?? "",
    catalog_version: draft.catalog?.version ?? "",
    voids_event_id: null,
    payload: draft.mode === "place" ? placePayload(draft) : checkPayload(draft),
  };
}
export function voidEvent(draft: Draft): FieldEventEnvelope {
  if (!draft.voidEventId || !draft.replacesEventId)
    throw new Error("Correction lineage is missing.");
  return {
    ...captureEvent(draft),
    id: draft.voidEventId,
    type: "record.void",
    device_time: new Date(Date.parse(draft.deviceTime) - 1).toISOString(),
    voids_event_id: draft.replacesEventId,
    payload: {
      reason_code: draft.reasonCode,
      reason: draft.reason.normalize("NFC").replaceAll("\r\n", "\n").trim(),
    },
  };
}
