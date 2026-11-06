import type { Assignment, Evidence, Point, Rules } from "../ovitrap-check/types.ts";
import type { ChecklistItem } from "../shift-open/domain.ts";
import type { FieldEventEnvelope, OutboxEvent } from "../../outbox/outbox-event.ts";
export type LifecycleKind = "replace" | "relocate" | "remove";
export type RecoveryState = "recovered" | "unrecovered" | "unconfirmed";
export interface LifecycleCatalog {
  readonly version: string;
  readonly replace: readonly ChecklistItem[];
  readonly relocate: readonly ChecklistItem[];
  readonly remove: readonly ChecklistItem[];
  readonly voidReasons: readonly ChecklistItem[];
}
export interface LifecycleRules extends Rules {
  readonly closedHouseWeeks: number | null;
  readonly incidents: number | null;
}
export interface Configuration {
  readonly catalog: LifecycleCatalog | null;
  readonly rules: LifecycleRules | null;
}
export interface LifecycleDraft extends Configuration {
  readonly eventId: string;
  readonly deviceTime: string;
  readonly shiftId: string;
  readonly kind: LifecycleKind;
  readonly ovitrapId: string;
  readonly point: Point;
  readonly replacementId: string | null;
  readonly assignment: Assignment;
  readonly gps: FieldEventEnvelope["gps"];
  readonly proposedLocation: readonly [number, number] | null;
  readonly manualCapture: boolean;
  readonly reasonCode: string;
  readonly otherText: string;
  readonly recovery: RecoveryState | null;
  readonly evidence: readonly Evidence[];
  readonly discardedEvidence: readonly Evidence[];
  readonly reviewAcknowledged: boolean;
}
export type DraftPatch = Partial<
  Pick<LifecycleDraft, "reasonCode" | "otherText" | "recovery" | "reviewAcknowledged">
>;
/** Local-only contract until B-33 publishes its changes/bundle producer schema. */
export interface RelocationDecision {
  readonly id: string;
  readonly proposalEventId: string;
  readonly status: "approved" | "rejected";
  readonly decidedAt: string;
  readonly reason: string;
  readonly nextDayTask: {
    readonly id: string;
    readonly code: string;
    readonly dueDate: string;
  } | null;
}
export interface RelocationProposal {
  readonly eventId: string;
  readonly status: "proposed" | "approved" | "rejected";
  readonly proposedLocation: readonly [number, number];
  readonly isVoided: boolean;
  readonly decision: RelocationDecision | null;
  readonly nextDayTask: RelocationDecision["nextDayTask"];
}
export interface CorrectionItem {
  readonly event: OutboxEvent;
  readonly reason: string;
}
export interface HistoryItem {
  readonly corrections: readonly CorrectionItem[];
  readonly draft: LifecycleDraft;
  readonly event: OutboxEvent;
  readonly voidEvent: OutboxEvent | null;
  readonly voidReason: string | null;
  readonly proposal: RelocationProposal | null;
}
export interface PhysicalOvitrap {
  readonly id: string;
  readonly point: Point;
  readonly isRetired: boolean;
  readonly replacedBy: string | null;
}
export interface StoredLifecycle {
  readonly draft: LifecycleDraft | null;
  readonly event: OutboxEvent | null;
  readonly proposal: RelocationProposal | null;
  readonly history: readonly HistoryItem[];
}
