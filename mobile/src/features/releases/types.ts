import type { Schemas } from "@wolbachia/api-client";
import type { FieldEventEnvelope, OutboxEvent } from "../../outbox/outbox-event.ts";
import type { Evidence } from "../ovitrap-check/types.ts";
import type { ReleaseGate } from "./domain.ts";

export type ReleaseDevice = Schemas["ReleaseCaptureDevice"];
export type ReleaseTask = Schemas["ReleaseCaptureTask"];
export type ReleaseCustody = Schemas["ReleaseCaptureCustody"];
export interface ReleasePins {
  readonly permit: Schemas["PermitBundle"];
  readonly device: ReleaseDevice;
  readonly task: ReleaseTask;
  readonly custody: ReleaseCustody;
  readonly eligibility: Schemas["EligibilityBundle"];
  readonly captureVersion: string;
}
export interface ReleaseDraft {
  readonly eventId: string;
  readonly ownerKey: string;
  readonly shiftId: string;
  readonly deviceTime: string;
  readonly catalogVersion: string;
  readonly rulesVersion: string;
  readonly trainingVersionId: string;
  readonly timezone: string;
  readonly manualCapture: boolean;
  readonly pins: ReleasePins;
  readonly quantity: string;
  readonly gps: FieldEventEnvelope["gps"];
  readonly evidence: readonly Evidence[];
  readonly assessment?: {
    readonly receiptLineId: string;
    readonly captureVersion: string;
    readonly assessedAt: string;
    readonly rulesVersion: string;
    readonly gates: readonly {
      readonly name: ReleaseGate["name"];
      readonly state: ReleaseGate["state"];
    }[];
  };
}
export interface ReleaseSelection {
  readonly taskId: string | null;
  readonly deviceId: string | null;
  readonly manualCapture: boolean;
}
export interface ReleaseState {
  readonly draft: ReleaseDraft | null;
  readonly event: OutboxEvent | null;
  readonly gates: readonly ReleaseGate[];
  readonly ready: boolean;
  readonly evidencePending: boolean;
  readonly review: Schemas["ReviewHistoryEntry"] | null;
  readonly tasks: readonly { readonly id: string; readonly code: string }[];
  readonly devices: readonly { readonly id: string; readonly code: string }[];
}
export class ReleaseError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "ReleaseError";
    this.code = code;
  }
}
