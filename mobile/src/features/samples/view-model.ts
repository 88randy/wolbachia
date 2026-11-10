import type { MessageKey } from "@wolbachia/i18n";

export interface SampleChoice {
  readonly id: string;
  readonly label: string;
}
export type SampleViewStatus =
  "draft" | "phone_saved" | "server_received" | "in_review" | "critical_rejected";
export interface SampleViewModel {
  readonly isLoading: boolean;
  readonly isBusy: boolean;
  readonly errorKey: MessageKey | null;
  readonly hasDraft: boolean;
  readonly canBegin: boolean;
  readonly canEdit: boolean;
  readonly canSave: boolean;
  readonly hasPendingEdits: boolean;
  readonly sources: readonly SampleChoice[];
  readonly origins: readonly SampleChoice[];
  readonly methods: readonly SampleChoice[];
  readonly drafts: readonly SampleChoice[];
  readonly selectedSource: string | null;
  readonly selectedOrigin: string | null;
  readonly selectedMethod: string | null;
  readonly sampleId: string | null;
  readonly sourceId: string | null;
  readonly sourceLabel: string | null;
  readonly sourceKindKey: MessageKey | null;
  readonly methodLabel: string | null;
  readonly originLabel: string | null;
  readonly code: string;
  readonly otherText: string;
  readonly isOther: boolean;
  readonly codeErrorKey: MessageKey | null;
  readonly otherErrorKey: MessageKey | null;
  readonly blockers: readonly MessageKey[];
  readonly gpsAccuracy: number | null;
  readonly requiresPhoto: boolean | null;
  readonly evidenceCount: number;
  readonly photoUri: string | null;
  readonly evidencePending: boolean;
  readonly receiptAt: string | null;
  readonly status: SampleViewStatus;
  readonly resultKey: MessageKey | null;
  readonly reviewedKey: MessageKey | null;
  readonly selectSource: (key: string) => void;
  readonly selectOrigin: (code: string) => void;
  readonly selectMethod: (id: string) => void;
  readonly openDraft: (id: string) => void;
  readonly changeCode: (value: string) => void;
  readonly changeOtherText: (value: string) => void;
  readonly blurFields: () => void;
  readonly begin: () => void;
  readonly acquireGps: () => void;
  readonly capturePhoto: () => void;
  readonly undoPhoto: () => void;
  readonly save: () => void;
  readonly retry: () => void;
  readonly openInbox: () => void;
  readonly backToDay: () => void;
}
