/** English messages of the `sync` area: exactly the keys of `../es-MX/sync.ts`. */
import type { sync as source } from "../es-MX/sync.ts";

export const sync: Record<keyof typeof source, string> = {
  // Result of sending a record to the server (phone inbox)
  "sync.inbox.acceptedTitle": "Sent",
  "sync.inbox.acceptedHint": "The server received this record. You have nothing else to do.",
  "sync.inbox.rejectedTitle": "Not accepted",
  "sync.inbox.rejectedHint":
    "The server couldn't accept this record. Ask your supervisor to review it.",
  "sync.inbox.inReviewTitle": "In review",
  "sync.inbox.inReviewHint":
    "A supervisor will review this record. You don't need to do anything meanwhile.",

  // Per-event and per-batch codes of the sync answer (the API returns codes, never text)
  "sync.result.unsupportedEventType":
    "The server doesn't recognize this type of record. Update the app and try again; if it keeps happening, tell your supervisor.",
  "sync.result.unsupportedSchemaVersion":
    "This record uses a format the server doesn't recognize. Update the app to be able to send it.",
  "sync.result.invalidPayload":
    "Some data in this record is not valid. Review it; if you can't fix it, tell your supervisor.",
  "sync.result.eventPayloadTooLarge": "This record is too large to send. Tell your supervisor.",
  "sync.result.eventIdConflict":
    "This record clashes with another one that already exists on the server. Tell your supervisor and don't capture it again.",
  "sync.result.voidTargetNotFound":
    "The record you wanted to void doesn't exist on the server. Tell your supervisor.",
  "sync.result.voidTargetNotOwned":
    "Only the person who captured a record can void it. Ask your supervisor to correct it.",
  "sync.result.alreadyVoided": "This record was already voided. You have nothing else to do.",
  "sync.result.clockSkew":
    "Your phone's clock looks wrong, so a supervisor will review this record. Check the date and time on your phone.",
  "sync.result.finalUploadAfterRevoke":
    "Your session had already ended when this record was sent, so a supervisor will review it. Sign in again if you need to keep working.",
  "sync.result.shiftAlreadyOpen":
    "You already have an open shift, so a new one was not started. Continue with the open shift or close it first.",
  "sync.result.motorcycleUnknown":
    "The server doesn't know this motorcycle. Check the code and try again; if it keeps happening, tell your supervisor.",
  "sync.result.motorcycleBlocked":
    "This motorcycle can't be used right now. Choose another one or tell your supervisor.",
  "sync.result.odometerOutOfRange":
    "The odometer reading is not possible. Check the number on the dashboard and enter it again.",
  "sync.result.shiftNotOpen":
    "This shift is not open on the server. Tell your supervisor if you still need to work.",
  "sync.result.shiftEventNotVoidable":
    "A shift can't be voided from the phone. Ask your supervisor to correct it.",
  "sync.result.odometerDecreased":
    "The odometer reading is lower than the previous one, so a supervisor will review it. You don't need to do anything meanwhile.",
  "sync.result.severeCheck":
    "A serious fault was reported, so the motorcycle is blocked and a supervisor will review it.",
  "sync.batch.deviceMismatch": "This session doesn't belong to this phone. Sign in again.",
  "sync.batch.payloadTooLarge":
    "The upload was too large, so the app will send it in parts. You don't need to do anything.",
  "sync.batch.invalidCursor":
    "We couldn't refresh your inbox, so the app will load it in full again. You don't need to do anything.",
  "sync.batch.syncInProgress":
    "Information from your account is already being sent from another phone. The app will try again in a few seconds.",
};
