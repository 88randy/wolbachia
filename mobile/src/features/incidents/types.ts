import type { Schemas } from "@wolbachia/api-client";
import type { FieldEventEnvelope, OutboxEvent } from "../../outbox/outbox-event.ts";
import type { Evidence } from "../ovitrap-check/types.ts";

export type IncidentKind = "report" | "accident";
export interface IncidentGps {
  readonly fix: FieldEventEnvelope["gps"];
  readonly fixedAt: number;
}
export interface IncidentDraft {
  readonly eventId: string;
  readonly ownerKey: string;
  readonly kind: IncidentKind;
  readonly shiftId: string | null;
  readonly deviceTime: string;
  readonly catalogVersion: string;
  readonly rulesVersion: string;
  readonly description: string;
  readonly type: Schemas["IncidentType"] | null;
  readonly evidence: readonly Evidence[];
  readonly gps: FieldEventEnvelope["gps"];
}
export interface IncidentCache {
  readonly signature: string;
  readonly types: readonly Schemas["IncidentType"][];
  readonly incidents: readonly Schemas["ReportedIncident"][];
  readonly supportContact: string | null;
}
export interface IncidentState {
  readonly ready: boolean;
  readonly canBegin: boolean;
  readonly canUpload: boolean;
  readonly canRead: boolean;
  readonly draft: IncidentDraft | null;
  readonly drafts: readonly IncidentDraft[];
  readonly event: OutboxEvent | null;
  readonly evidencePending: boolean;
  readonly types: readonly Schemas["IncidentType"][];
  readonly incidents: readonly Schemas["ReportedIncident"][];
  readonly supportContact: string | null;
}
export type IncidentErrorCode =
  | "scope"
  | "shift"
  | "stale_draft"
  | "type_required"
  | "description_required"
  | "description_long"
  | "evidence_limit";
