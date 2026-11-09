import type { MessageKey } from "@wolbachia/i18n";

const ERROR_KEYS: Readonly<Record<string, MessageKey>> = {
  signature_required: "mobile.supplyReceipt.signatureRequired",
  quantity_invalid: "mobile.supplyReceipt.quantityInvalid",
  discrepancy_required: "mobile.supplyReceipt.discrepancyRequired",
  other_required: "mobile.supplyReceipt.otherRequired",
  evidence_required: "mobile.supplyReceipt.evidenceRequired",
  scope: "mobile.supplyReceipt.unavailable",
  stale_draft: "mobile.supplyReceipt.staleDraft",
  shift: "mobile.supplyReceipt.shiftRequired",
  configuration: "mobile.supplyReceipt.configurationRequired",
};

export function receiptErrorKey(error: unknown): MessageKey {
  if (error instanceof Error && "code" in error && typeof error.code === "string")
    return ERROR_KEYS[error.code] ?? "mobile.storage.saveFailed";
  return "mobile.storage.saveFailed";
}
