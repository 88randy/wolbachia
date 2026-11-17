import type { MessageKey } from "@wolbachia/i18n";

import { OutboxWriteError } from "./outbox-repository.ts";

/**
 * The message for a failed local save. "Free up space" is shown only when the phone really is
 * full; any other failure says what it is, or that it was unexpected, and never blames storage.
 */
export function writeErrorKey(error: unknown): MessageKey {
  if (error instanceof OutboxWriteError) {
    if (error.reason === "storage_full") return "mobile.storage.saveFailed";
    if (error.reason === "shift_closed") return "mobile.storage.shiftClosed";
  }
  return "mobile.storage.unexpected";
}
