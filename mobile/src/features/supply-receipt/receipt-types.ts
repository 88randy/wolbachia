import type { Schemas } from "@wolbachia/api-client";
import type { Evidence } from "../ovitrap-check/types.ts";
import type { OutboxEvent } from "../../outbox/outbox-event.ts";

export interface ReceiptLine {
  readonly id: string;
  readonly releaseLineId: string;
  readonly lotId: string;
  readonly pieceId: string | null;
  readonly unitVersionId: string;
  readonly expected: string;
  readonly quantity: string;
}
export interface ReceiptDraft {
  readonly eventId: string;
  readonly assignmentId: string;
  readonly releaseId: string;
  readonly planRevision: number;
  readonly expectedRevision: number;
  readonly ownerKey: string;
  readonly shiftId: string;
  readonly deviceTime: string;
  readonly manualCapture: boolean;
  readonly scannedIds: readonly string[];
  readonly catalogVersion: string;
  readonly rulesVersion: string;
  readonly lines: readonly ReceiptLine[];
  readonly discrepancy: {
    readonly kind: "missing" | "damaged" | "other";
    readonly text: string;
  } | null;
  readonly strokes: readonly string[];
  readonly signature: Evidence | null;
  /** False when the delivery is already warehouse-signed (or the rule says warehouse only). Absent = true. */
  readonly needsSignature?: boolean;
  readonly evidence: readonly Evidence[];
}
export interface ReceiptState {
  readonly review?: Schemas["ReviewHistoryEntry"] | null;
  readonly ready: boolean;
  /** The open shift, so the list only offers deliveries that can be received now. */
  readonly shiftId: string | null;
  readonly assignments: readonly Schemas["SupplyBundle"][];
  readonly drafts: readonly ReceiptDraft[];
  readonly draft: ReceiptDraft | null;
  readonly event: OutboxEvent | null;
  readonly feedback: "duplicate" | "added" | "invalid" | null;
  readonly signaturePending: boolean;
}
