import { StaleCaptureError, ConcurrentCaptureError } from "./capture-identity.ts";
import type { MessageKey } from "@wolbachia/i18n";
import { OutboxWriteError } from "../../outbox/outbox-repository.ts";
import { CatalogChangedError, PendingDraftError } from "./ports.ts";
import { ImmutableCaptureError } from "./draft-buffer.ts";
import { ShiftBlockedError } from "./shift-authorization.ts";
import { CameraError } from "../../attachments/photo-acquisition.ts";
import { EvidenceError } from "../../attachments/types.ts";
const CAMERA_KEYS = {
  camera_permission_denied: "mobile.camera.permissionDenied",
  camera_permission_blocked: "mobile.camera.permissionBlocked",
  camera_unavailable: "mobile.ovitrap.photoUnavailable",
  camera_result_invalid: "mobile.camera.resultInvalid",
  camera_busy: "mobile.camera.busy",
  camera_unlock_required: "mobile.camera.unlockRequired",
} as const;
const EVIDENCE_KEYS: Readonly<Partial<Record<string, MessageKey>>> = {
  stale_context: "mobile.ovitrap.staleView",
  owner_unproven: "mobile.camera.ownerRequired",
  owner_conflict: "mobile.camera.ownerRequired",
  file_type: "mobile.camera.fileType",
  file_size: "mobile.camera.fileSize",
};
function acquisitionErrorKey(error: unknown): MessageKey | null {
  if (error instanceof ConcurrentCaptureError) return "mobile.ovitrap.concurrentEdit";
  if (error instanceof CameraError) return CAMERA_KEYS[error.code];
  if (error instanceof EvidenceError)
    return EVIDENCE_KEYS[error.code] ?? "mobile.camera.fileFailed";
  return null;
}
export function actionErrorKey(error: unknown): MessageKey {
  const acquisition = acquisitionErrorKey(error);
  if (acquisition) return acquisition;
  if (error instanceof StaleCaptureError) return "mobile.ovitrap.staleView";
  if (error instanceof ShiftBlockedError) return "mobile.ovitrap.shiftBlocked";
  if (error instanceof ImmutableCaptureError) return "mobile.ovitrap.immutableEdit";
  if (error instanceof PendingDraftError) return "mobile.ovitrap.pendingDraft";
  if (error instanceof CatalogChangedError) return "mobile.ovitrap.catalogChanged";
  return error instanceof OutboxWriteError
    ? "mobile.storage.saveFailed"
    : "mobile.storage.actionFailed";
}
