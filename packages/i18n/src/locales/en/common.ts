/** English messages of the `common` area: exactly the keys of `../es-MX/common.ts`. */
import type { common as source } from "../es-MX/common.ts";

export const common: Record<keyof typeof source, string> = {
  // Common actions
  "common.actions.save": "Save",
  "common.actions.cancel": "Cancel",
  "common.actions.retry": "Try again",
  "common.actions.close": "Close",
  "common.actions.goHome": "Go to home",
  "common.actions.void": "Void",

  // Common fields
  "common.fields.voidReason": "Reason for voiding",
  "common.fields.otherSpecify": "Other (specify)",
};
