import type { MessageKey } from "@wolbachia/i18n";
import { ShiftBlockedError } from "../ovitrap-check/shift-authorization.ts";

const ERROR_KEYS: Readonly<Record<string, MessageKey>> = {
  scope: "mobile.release.detail.scopeUnavailable",
  context_unavailable: "mobile.release.detail.configurationUnavailable",
  stale_draft: "mobile.release.staleDraft",
  shift: "mobile.release.shiftRequired",
  quantity_invalid: "mobile.release.detail.quantityInvalid",
  evidence_required: "mobile.release.detail.evidenceRequired",
  gps_unusable: "mobile.release.detail.gpsUnavailable",
  safety_blocked: "mobile.release.safetyBlocked",
  camera_permission_denied: "mobile.camera.permissionDenied",
  camera_permission_blocked: "mobile.camera.permissionBlocked",
  camera_unavailable: "mobile.release.photoUnavailable",
  camera_result_invalid: "mobile.camera.resultInvalid",
  camera_busy: "mobile.camera.busy",
  camera_unlock_required: "mobile.camera.unlockRequired",
  owner_unproven: "mobile.camera.ownerRequired",
  owner_conflict: "mobile.camera.ownerRequired",
  stale_context: "mobile.release.staleDraft",
  file_type: "mobile.camera.fileType",
  file_size: "mobile.camera.fileSize",
};
export function releaseErrorKey(error: unknown): MessageKey {
  if (error instanceof ShiftBlockedError) return "mobile.release.shiftRequired";
  if (error instanceof Error && "code" in error && typeof error.code === "string")
    return ERROR_KEYS[error.code] ?? "mobile.storage.saveFailed";
  return "mobile.storage.saveFailed";
}
