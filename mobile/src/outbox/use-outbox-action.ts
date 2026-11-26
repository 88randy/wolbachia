import type { MessageKey } from "@wolbachia/i18n";
import { useState } from "react";

import { OutboxWriteError } from "./outbox-repository.ts";
import { writeErrorKey } from "./write-error-key.ts";

/** Completes a UI action with localized feedback; a rejected write never escapes a void handler. */
export async function performOutboxAction(action: () => Promise<void>): Promise<MessageKey | null> {
  try {
    await action();
    return null;
  } catch (error) {
    console.warn("outbox.action_failed", error instanceof Error ? error.name : "unknown");
    return error instanceof OutboxWriteError ? writeErrorKey(error) : "mobile.storage.actionFailed";
  }
}

/** Runs a local outbox action and exposes a message the screen can announce. */
export function useOutboxAction(action: () => Promise<void>) {
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  return {
    errorKey,
    run: () => {
      setErrorKey(null);
      void performOutboxAction(action).then(setErrorKey);
    },
  };
}
