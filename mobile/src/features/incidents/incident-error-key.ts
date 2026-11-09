import type { MessageKey } from "@wolbachia/i18n";

const ERROR_KEYS: Readonly<Record<string, MessageKey>> = {
  scope: "mobile.incidents.unavailable",
  shift: "mobile.incidents.shiftRequired",
  stale_draft: "mobile.incidents.staleDraft",
  type_required: "mobile.incidents.typeRequired",
  description_required: "mobile.incidents.descriptionRequired",
  description_long: "mobile.incidents.descriptionLong",
  evidence_limit: "mobile.incidents.evidenceLimit",
  camera_permission_denied: "mobile.camera.permissionDenied",
  camera_permission_blocked: "mobile.camera.permissionBlocked",
  camera_unavailable: "mobile.incidents.photoUnavailable",
  camera_result_invalid: "mobile.camera.resultInvalid",
  camera_busy: "mobile.camera.busy",
  camera_unlock_required: "mobile.camera.unlockRequired",
  owner_unproven: "mobile.camera.ownerRequired",
  owner_conflict: "mobile.camera.ownerRequired",
  stale_context: "mobile.incidents.staleDraft",
  file_type: "mobile.camera.fileType",
  file_size: "mobile.camera.fileSize",
};

export function incidentErrorKey(error: unknown): MessageKey {
  if (error instanceof Error && "code" in error && typeof error.code === "string")
    return ERROR_KEYS[error.code] ?? "mobile.storage.saveFailed";
  return "mobile.storage.saveFailed";
}
