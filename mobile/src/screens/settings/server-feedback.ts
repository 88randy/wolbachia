import type { MessageKey } from "@wolbachia/i18n";

import type { ApiBaseUrlProblem } from "../../config/api-base-url.ts";

export type ServerFeedback = "saved" | "storageFailed" | ApiBaseUrlProblem;

const KEYS: Readonly<Record<ServerFeedback, MessageKey>> = {
  saved: "mobile.settings.serverSaved",
  storageFailed: "mobile.storage.actionFailed",
  empty: "mobile.settings.serverInvalid",
  invalid: "mobile.settings.serverInvalid",
  cleartextNotAllowed: "mobile.settings.serverCleartext",
};

/** The message for the result of saving the server address. */
export function feedbackKey(feedback: ServerFeedback): MessageKey {
  return KEYS[feedback];
}
