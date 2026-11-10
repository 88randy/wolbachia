import type { MessageKey } from "@wolbachia/i18n";
import { ShiftBlockedError } from "../ovitrap-check/shift-authorization.ts";

const ERROR_KEYS: Readonly<Record<string, MessageKey>> = {
  litres_invalid: "mobile.fuel.litresInvalid",
  amount_invalid: "mobile.fuel.amountInvalid",
  currency_invalid: "mobile.fuel.unavailable",
  odometer_invalid: "mobile.fuel.odometerInvalid",
  context_unavailable: "mobile.fuel.unavailable",
  scope: "mobile.fuel.unavailable",
  shift: "mobile.fuel.shiftRequired",
  stale_draft: "mobile.fuel.staleDraft",
  camera_permission_denied: "mobile.camera.permissionDenied",
  camera_permission_blocked: "mobile.camera.permissionBlocked",
  camera_unavailable: "mobile.fuel.photoUnavailable",
  camera_result_invalid: "mobile.camera.resultInvalid",
  camera_busy: "mobile.camera.busy",
  camera_unlock_required: "mobile.camera.unlockRequired",
  owner_unproven: "mobile.camera.ownerRequired",
  owner_conflict: "mobile.camera.ownerRequired",
  stale_context: "mobile.fuel.staleDraft",
  file_type: "mobile.camera.fileType",
  file_size: "mobile.camera.fileSize",
};

export function fuelErrorKey(error: unknown): MessageKey {
  if (error instanceof ShiftBlockedError) return "mobile.fuel.shiftRequired";
  if (error instanceof Error && "code" in error && typeof error.code === "string")
    return ERROR_KEYS[error.code] ?? "mobile.storage.saveFailed";
  return "mobile.storage.saveFailed";
}
