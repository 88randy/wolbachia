import type { Assignment, Evidence, Point, Rules } from "../ovitrap-check/types.ts";
import type { ChecklistItem } from "../shift-open/domain.ts";
import type { FieldEventEnvelope, OutboxEvent } from "../../outbox/outbox-event.ts";
import type { Schemas } from "@wolbachia/api-client";
import type { EvidenceFence } from "../../attachments/types.ts";
import type { CaptureTransportHandle } from "./capture-context-contract.ts";
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
  readonly relocationParameters?: {
    readonly closedHouseWeeks: Pick<
      Schemas["SnapshotParameter"],
      "version_id" | "value" | "effective_from"
    > | null;
    readonly incidents: Pick<
      Schemas["SnapshotParameter"],
      "version_id" | "value" | "effective_from"
    > | null;
  };
}
export interface Configuration {
  readonly catalog: LifecycleCatalog | null;
  readonly rules: LifecycleRules | null;
  readonly limits?: Schemas["MeLimits"] | null;
}
export interface LegacyLifecycleDraft extends Configuration {
  readonly schemaVersion?: undefined;
  readonly source?: undefined;
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
/** Server publication and owned local evidence are different provenance, never interchangeable floors. */
export type LifecyclePhysicalSource =
  | {
      readonly kind: "downloaded";
      readonly id: string;
      readonly version: string;
      readonly sequence: number;
    }
  | {
      readonly kind: "owned-local";
      readonly id: string;
      readonly sourceEventId: string;
      readonly relation: "replacement" | "capture";
      readonly status: OutboxEvent["status"];
      readonly receipt: {
        readonly projectionSequence: number;
        readonly isReconciled: boolean;
      } | null;
    };
export interface LifecycleSource extends Configuration {
  readonly context: Schemas["CaptureContext"];
  readonly physical: LifecyclePhysicalSource;
  readonly isRetired: boolean;
  readonly point: Point & {
    readonly version: number;
    readonly blockId: string;
    readonly quadrantId: string;
    readonly centerId: string;
  };
  readonly epoch: Pick<Schemas["QuadrantReference"], "revision" | "is_closed" | "closure_id">;
  readonly organization: Pick<Schemas["MeOrganization"], "id" | "timezone" | "epi_week">;
}
export interface CurrentLifecycleDraft extends Omit<
  LegacyLifecycleDraft,
  "assignment" | "schemaVersion" | "source"
> {
  readonly schemaVersion: 2;
  readonly source: Omit<LifecycleSource, "catalog" | "rules">;
  readonly assignment?: never;
}
export type LifecycleDraft = LegacyLifecycleDraft | CurrentLifecycleDraft;
export type LifecycleSourceRequest =
  | { readonly kind: "new"; readonly ovitrapId: string }
  | { readonly kind: "correction"; readonly sourceEventId: string };
export interface LifecycleSourceTurn {
  readonly assertCurrent: () => Promise<void>;
  readonly source: LifecycleSource | null;
  readonly handle: CaptureTransportHandle;
  readonly ownerFence: EvidenceFence;
  readonly canCapture: boolean;
  readonly resolve: (request: LifecycleSourceRequest) => Promise<LifecycleSource>;
  readonly write: <T>(commit: () => Promise<T>) => Promise<T>;
}
export interface LifecycleAdmission {
  readonly assertCurrent: () => void;
  readonly commit: <T>(sqlOnly: () => Promise<T>) => Promise<T>;
}
export interface LifecycleCompletion {
  normalize(beforeRevision: number, observedEventId: string | null): void;
  complete(isViewCurrent: () => boolean, onSuccess?: () => void): Promise<boolean>;
}
export interface LifecycleSourceOperation {
  readonly expectedEventId: string | null;
  readonly isCurrent: () => boolean;
  readonly isInteractiveCurrent: () => boolean;
  read<T>(
    request: LifecycleSourceRequest | null,
    use: (turn: LifecycleSourceTurn) => Promise<T>,
  ): Promise<T>;
  admit<T>(turn: LifecycleSourceTurn, sqlOnly: () => Promise<T>): Promise<T>;
}
export interface LifecycleSourcePort {
  capture(
    expectedEventId: string | null,
    isDraftCurrent: () => boolean,
    isInteractionCurrent?: () => boolean,
  ): LifecycleSourceOperation;
  read<T>(
    request: LifecycleSourceRequest | null,
    use: (turn: LifecycleSourceTurn) => Promise<T>,
  ): Promise<T>;
}
export type DraftPatch = Partial<
  Pick<LifecycleDraft, "reasonCode" | "otherText" | "recovery" | "reviewAcknowledged">
>;
/** Local decision audit/read model. Actual wire authority uses decoded history3, never this stored seam. */
export interface RelocationDecision {
  readonly id: string;
  readonly proposalEventId: string;
  readonly status: "approved" | "rejected";
  readonly decidedAt: string | null;
  readonly reason: string | null;
  readonly nextDayTask: {
    readonly id: string;
    readonly code: string;
    readonly dueDate: string;
  } | null;
}
export interface RelocationProposal {
  readonly eventId: string;
  readonly status: "proposed" | "approved" | "rejected";
  readonly proposedLocation: readonly number[];
  readonly isVoided: boolean;
  readonly decision: RelocationDecision | null;
  readonly nextDayTask: RelocationDecision["nextDayTask"];
  readonly serverProposalId?: string | null;
  readonly sourceVoidedAt?: string | null;
  readonly provenance?: "downloaded" | "retained" | "legacy-local" | "local";
  readonly legacyDecision?: RelocationDecision | null;
  readonly isTaskActionable?: boolean;
}
export interface CorrectionItem {
  readonly event: OutboxEvent;
  readonly reason: string;
}
export interface HistoryItem {
  readonly reviews?: readonly Schemas["ReviewHistoryEntry"][];
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
  /** Exact bytes read for whole-draft CAS; never part of the persisted draft or envelope. */
  readonly draftVersion?: string | null;
  readonly reviews?: readonly Schemas["ReviewHistoryEntry"][];
  readonly remoteProposals?: readonly Schemas["RelocationHistoryEntry"][];
  readonly recovery?: "blocked_ownership" | "unsupported_draft";
  readonly draft: LifecycleDraft | null;
  readonly event: OutboxEvent | null;
  readonly proposal: RelocationProposal | null;
  readonly history: readonly HistoryItem[];
}
