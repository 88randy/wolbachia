import type { FieldEventEnvelope } from "../../outbox/outbox-event.ts";
import { needsOther } from "./domain.ts";
import type { LifecycleDraft } from "./types.ts";
export function lifecycleEvent(draft: LifecycleDraft): FieldEventEnvelope {
  return {
    id: draft.eventId,
    type: `ovitrap.${draft.kind}`,
    schema_version: 1,
    device_time: draft.deviceTime,
    shift_id: draft.shiftId,
    gps: draft.gps,
    manual_capture: draft.manualCapture,
    rules_version: draft.rules?.version ?? "",
    catalog_version: draft.catalog?.version ?? "",
    voids_event_id: null,
    payload: {
      ovitrap_id: draft.ovitrapId,
      reason_code: draft.reasonCode,
      evidence_ids: draft.evidence.map((item) => item.id),
      ...(needsOther(draft) ? { other_text: draft.otherText.normalize("NFC").trim() } : {}),
      ...(draft.kind === "replace" ? { replacement_id: draft.replacementId } : {}),
      ...(draft.kind === "relocate" ? { proposed_location: draft.proposedLocation } : {}),
      ...(draft.kind === "remove" ? { is_recovered: draft.recovery === "recovered" } : {}),
    },
  };
}
export interface Correction {
  readonly reasonCode: string;
  readonly reason: string;
}
export function correctionEvent(input: {
  draft: LifecycleDraft;
  id: string;
  time: string;
  correction: Correction;
}): FieldEventEnvelope {
  return {
    ...lifecycleEvent(input.draft),
    id: input.id,
    type: "record.void",
    device_time: input.time,
    voids_event_id: input.draft.eventId,
    payload: {
      reason_code: input.correction.reasonCode,
      reason: input.correction.reason.normalize("NFC").replaceAll("\r\n", "\n").trim(),
    },
  };
}
