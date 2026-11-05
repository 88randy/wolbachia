import type { MessageKey } from "@wolbachia/i18n";

import type { AuthSnapshot } from "../../auth/auth-controller.ts";

export function pinPrompt(phase: AuthSnapshot["phase"], hasConfirmation: boolean): MessageKey {
  if (phase !== "createPin") return "mobile.unlock.enterPin";
  return hasConfirmation ? "mobile.unlock.confirmPin" : "mobile.unlock.createPin";
}

export function pinErrorKey(remaining: number): MessageKey {
  return remaining === 1 ? "mobile.unlock.wrongPinLast" : "mobile.unlock.wrongPin";
}
