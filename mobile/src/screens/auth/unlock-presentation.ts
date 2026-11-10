import type { MessageKey } from "@wolbachia/i18n";

import type { AuthSnapshot } from "../../auth/auth-controller.ts";

export function pinPrompt(phase: AuthSnapshot["phase"], hasConfirmation: boolean): MessageKey {
  if (phase !== "createPin") return "mobile.unlock.enterPin";
  return hasConfirmation ? "mobile.unlock.confirmPin" : "mobile.unlock.createPin";
}

export function pinErrorKey(remaining: number): MessageKey {
  return remaining === 1 ? "mobile.unlock.wrongPinLast" : "mobile.unlock.wrongPin";
}

/** Heading for the current unlock step. */
export function unlockTitle(snapshot: {
  readonly phase: AuthSnapshot["phase"];
  readonly isPasswordRequired: boolean;
  readonly profile: { readonly firstName: string } | null;
}): MessageKey {
  if (snapshot.isPasswordRequired && snapshot.phase !== "createPin")
    return "mobile.unlock.passwordTitle";
  if (snapshot.phase === "createPin") return "mobile.unlock.createTitle";
  return snapshot.profile?.firstName.trim()
    ? "mobile.unlock.greeting"
    : "mobile.unlock.greetingNeutral";
}
