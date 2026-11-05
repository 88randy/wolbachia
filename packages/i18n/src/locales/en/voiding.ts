/** English messages of the `voiding` area: exactly the keys of `../es-MX/voiding.ts`. */
import type { voiding as source } from "../es-MX/voiding.ts";

export const voiding: Record<keyof typeof source, string> = {
  // Void dialog. `{record}` is the code or name of the record, e.g. "OV-010".
  "voiding.dialog.title": "Void {record}",
  "voiding.dialog.hint":
    "Nothing is deleted: it stays struck through in the history with your reason.",
  "voiding.dialog.reasonLabel": "Void reason (required)",
  "voiding.dialog.details": "Details",
  "voiding.dialog.placeholder": "Select a reason",
  "voiding.dialog.loading": "Loading reasons…",
  "voiding.dialog.retry": "Retry",
  "voiding.dialog.required": "required",
  "voiding.dialog.minHelp": "Write at least {min} characters so the reason is useful later.",
  "voiding.dialog.counterBelow": "{count} of {min} minimum characters",
  "voiding.dialog.counterOk": "{count} of {max} characters at most",
  "voiding.dialog.confirm": "Void",
  "voiding.dialog.busy": "Voiding…",

  // What went wrong. Generic failures use `errors.api.*`.
  "voiding.error.chooseReason": "Choose a reason.",
  "voiding.error.catalogUnavailable": "We could not load available reasons. Retry to continue.",
  "voiding.error.title": "We could not void it",
  "voiding.error.codeUnknown":
    "This reason is no longer available. Choose another reason from the updated list.",
  "voiding.error.requiredForOther": "Enter a reason when choosing Other (specify).",
  "voiding.error.tooShort": "The reason needs at least {min} characters. Tell us a bit more.",
  "voiding.error.invalidCharacters":
    "The reason has characters that cannot be saved (control or text-direction characters). Remove them and try again.",
  "voiding.error.alreadyVoided": "Someone already voided this record. Refresh the page to see it.",
  "voiding.error.blocked":
    "This record can no longer be voided in its current state. Refresh the page to see what changed.",
};
