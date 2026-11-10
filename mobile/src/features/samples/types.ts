import type { Schemas } from "@wolbachia/api-client";
import type { FieldEventEnvelope, OutboxEvent } from "../../outbox/outbox-event.ts";
import type { Evidence } from "../ovitrap-check/types.ts";
import type { ChecklistItem } from "../shift-open/domain.ts";

export type SampleMethod = Schemas["SampleCaptureMethod"];
export type SampleSource = Schemas["SampleCaptureSource"];
export type SampleReceipt = Schemas["SampleCaptureReceipt"];
export type SampleSnapshot = Schemas["SampleCaptureSnapshot"];
export type SampleOrigin = ChecklistItem & { readonly label: string };
export interface SampleSourceRef {
  readonly kind: "reading" | "lot" | "release";
  readonly id: string;
}
export interface SampleSelection {
  readonly sampleId: string | null;
  readonly sourceRef: SampleSourceRef | null;
  readonly manualCapture: boolean;
}
export interface SampleDraft {
  readonly sampleId: string;
  readonly eventId: string;
  readonly ownerKey: string;
  readonly shiftId: string;
  readonly startedAt: string;
  readonly deviceTime: string;
  readonly timezone: string;
  readonly manualCapture: boolean;
  readonly sourceRef: SampleSourceRef;
  readonly source: SampleSource;
  readonly captureVersion: string;
  readonly catalogVersion: string;
  readonly rulesVersion: string;
  readonly code: string;
  readonly otherText: string;
  readonly originCode: string;
  readonly methodVersion: string;
  readonly origin: SampleOrigin | null;
  readonly method: SampleMethod | null;
  readonly gps: FieldEventEnvelope["gps"];
  readonly evidence: readonly Evidence[];
}
export type SamplePatch = Partial<
  Pick<SampleDraft, "code" | "otherText" | "originCode" | "methodVersion">
>;
export interface SampleWork {
  readonly sampleId: string;
  readonly eventId: string;
  readonly code: string;
  readonly status: "draft" | OutboxEvent["status"];
  readonly receiptAt: string | null;
}
export interface SampleState {
  readonly draft: SampleDraft | null;
  readonly event: OutboxEvent | null;
  readonly ready: boolean;
  readonly canBegin: boolean;
  readonly evidencePending: boolean;
  readonly gates: readonly string[];
  readonly review: Schemas["ReviewHistoryEntry"] | null;
  readonly receipt: SampleReceipt | null;
  readonly sources: readonly SampleSource[];
  readonly origins: readonly SampleOrigin[];
  readonly methods: readonly SampleMethod[];
  readonly work: readonly SampleWork[];
}
export class SampleError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "SampleError";
    this.code = code;
  }
}
