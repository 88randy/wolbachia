import type { FieldEventEnvelope } from "../../outbox/outbox-event.ts";
import type { IncidentDraft, IncidentErrorCode } from "./types.ts";

export const MAX_INCIDENT_DESCRIPTION = 4000;
export const MAX_INCIDENT_EVIDENCE = 100;
// B06 requires nonblank description even for the issue's detail-free accident action.
export const ACCIDENT_WITHOUT_DETAILS = "emergency.accident";
export class IncidentError extends Error {
  readonly code: IncidentErrorCode;
  constructor(code: IncidentErrorCode) {
    super(code);
    this.name = "IncidentError";
    this.code = code;
  }
}
function incidentDescription(draft: IncidentDraft): string {
  const description = draft.description.trim();
  if (draft.kind === "report" && !draft.type) throw new IncidentError("type_required");
  if (draft.kind === "report" && !description) throw new IncidentError("description_required");
  if (description.length > MAX_INCIDENT_DESCRIPTION) throw new IncidentError("description_long");
  if (draft.evidence.length > MAX_INCIDENT_EVIDENCE) throw new IncidentError("evidence_limit");
  return description || ACCIDENT_WITHOUT_DETAILS;
}
function incidentPayload(draft: IncidentDraft): FieldEventEnvelope["payload"] {
  return {
    ...(draft.kind === "report" ? { type_id: draft.type?.current_version_id } : {}),
    description: incidentDescription(draft),
    evidence_ids: draft.evidence.map((photo) => photo.id),
    ...(draft.kind === "accident" && draft.gps
      ? { gps: { lat: draft.gps.lat, lng: draft.gps.lng } }
      : {}),
  };
}
/** Immutable original type version and clocks, never an inferred work scope or delivery receipt. */
export function incidentEvent(draft: IncidentDraft): FieldEventEnvelope {
  return {
    id: draft.eventId,
    type: draft.kind === "report" ? "incident.report" : "emergency.accident",
    schema_version: 1,
    device_time: draft.deviceTime,
    shift_id: draft.shiftId,
    gps: draft.gps,
    rules_version: draft.rulesVersion,
    catalog_version: draft.catalogVersion,
    manual_capture: true,
    voids_event_id: null,
    payload: incidentPayload(draft),
  };
}
/** Work contacts are free text upstream; only a complete telephone value can reach a URI. */
export function telephoneNumber(value: string | null): string | null {
  if (!value || !/^\+?[\d ()-]+$/.test(value.trim())) return null;
  const number = value.trim().replace(/[ ()-]/g, "");
  return /^\+?\d{3,15}$/.test(number) ? number : null;
}
export interface Dialer {
  readonly open: (uri: string) => Promise<void>;
}
export type DialOutcome = "opened" | "unavailable" | "missing";
/** Opening a dialer proves neither a completed call nor that help was dispatched. */
export async function callWorkContact(
  dialer: Dialer,
  contact: string | null,
): Promise<DialOutcome> {
  const number = telephoneNumber(contact);
  if (!number) return "missing";
  try {
    await dialer.open(`tel:${number}`);
    return "opened";
  } catch {
    return "unavailable";
  }
}
