import type { MessageKey } from "@wolbachia/i18n";

export type ReleaseGateName =
  "permit" | "zone" | "lot" | "training" | "schedule" | "gps" | "device" | "configuration";
export const RELEASE_GATE_NAMES: readonly ReleaseGateName[] = [
  "permit",
  "zone",
  "lot",
  "training",
  "schedule",
  "gps",
  "device",
  "configuration",
];
export interface ReleaseGateView {
  readonly name: ReleaseGateName;
  readonly state: "pass" | "fail" | "unavailable";
  readonly detailKey?: MessageKey;
  readonly contact: "supervisor" | "admin" | "courier";
}
export type ReleaseViewStatus =
  "draft" | "phone_saved" | "server_received" | "in_review" | "critical_rejected";
export interface ReleaseViewModel {
  readonly isLoading: boolean;
  readonly isBusy: boolean;
  readonly errorKey: MessageKey | null;
  readonly refs: Readonly<Record<"deviceId" | "taskId" | "permitId" | "lotId", string | null>>;
  readonly taskOptions: readonly { readonly id: string; readonly code: string }[];
  readonly deviceOptions: readonly { readonly id: string; readonly code: string }[];
  readonly selectedTaskId: string | null;
  readonly selectedDeviceId: string | null;
  readonly hasDraft: boolean;
  readonly canBegin: boolean;
  readonly canRestart: boolean;
  readonly hasPendingEdits: boolean;
  readonly selectTask: (id: string) => void;
  readonly selectDevice: (id: string) => void;
  readonly begin: () => void;
  readonly restart: () => void;
  readonly quantity: string;
  readonly quantityErrorKey: MessageKey | null;
  readonly gates: readonly ReleaseGateView[];
  readonly canEdit: boolean;
  readonly canSave: boolean;
  readonly status: ReleaseViewStatus;
  readonly resultKey: MessageKey | null;
  readonly reviewedKey: MessageKey | null;
  readonly evidenceCount: number;
  readonly photoUri: string | null;
  readonly requiresEvidence: boolean | null;
  readonly evidencePending: boolean;
  readonly gpsAccuracy: number | null;
  readonly changeQuantity: (value: string) => void;
  readonly blurQuantity: () => void;
  readonly acquireGps: () => void;
  readonly capturePhoto: () => void;
  readonly undoPhoto: () => void;
  readonly save: () => void;
  readonly retry: () => void;
  readonly reportSupervisor: () => void;
  readonly reportDevice: () => void;
  readonly openInbox: () => void;
  readonly goBackToDay: () => void;
}

/** Missing rows are unavailable, including for an inconsistent or stale UI model. */
export function hasBlockedReleaseGate(gates: readonly ReleaseGateView[]): boolean {
  return (
    gates.length !== RELEASE_GATE_NAMES.length ||
    RELEASE_GATE_NAMES.some((name) => gates.find((gate) => gate.name === name)?.state !== "pass")
  );
}
