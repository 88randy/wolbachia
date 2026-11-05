import type { MessageKey } from "@wolbachia/i18n";
import { OutboxWriteError } from "../../outbox/outbox-repository.ts";
import { CatalogChangedError, PendingDraftError } from "./ports.ts";
import { ImmutableCaptureError } from "./draft-buffer.ts";
import { ShiftBlockedError } from "./shift-authorization.ts";
export function actionErrorKey(error: unknown): MessageKey {
  if (error instanceof ShiftBlockedError) return "mobile.ovitrap.shiftBlocked";
  if (error instanceof ImmutableCaptureError) return "mobile.ovitrap.immutableEdit";
  if (error instanceof PendingDraftError) return "mobile.ovitrap.pendingDraft";
  if (error instanceof CatalogChangedError) return "mobile.ovitrap.catalogChanged";
  return error instanceof OutboxWriteError
    ? "mobile.storage.saveFailed"
    : "mobile.storage.actionFailed";
}
