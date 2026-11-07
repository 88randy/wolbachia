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
  "sync.result.lateWorkAfterQuadrantClose":
    "This capture predates the quadrant closure. A supervisor must verify its historical authority before applying it.",
  "sync.result.capturedAfterQuadrantClose":
    "This capture was made after the quadrant closed. It cannot authorize new work there. Contact your supervisor.",
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
  "sync.result.voidReasonCodeUnknown":
    "This reason is no longer available. Refresh the catalogs and choose another reason.",
  "sync.result.voidReasonCodeDeactivated":
    "This reason changed since the last update. A supervisor will review the void; the original record remains intact.",
  "sync.result.alreadyVoided": "This record was already voided. You have nothing else to do.",
  "sync.result.clockSkew":
    "Your phone's clock looks wrong, so a supervisor will review this record. Check the date and time on your phone.",
  "sync.result.finalUploadAfterRevoke":
    "Your session had already ended when this record was sent, so a supervisor will review it. Sign in again if you need to keep working.",
  "sync.result.shiftAlreadyOpen":
    "You already have an open shift, so a new one was not started. Continue with the open shift or close it first.",
  "sync.result.motorcycleInUse":
    "This motorcycle is already in an open shift. Choose another one or tell your supervisor.",
  "sync.result.capturedAfterShiftClose":
    "This record was captured after the shift was closed. It was saved and a supervisor will review it. You don't need to do anything.",
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
  "sync.result.fuelMotorcycleMismatch":
    "The fuel load names a different motorcycle. Ask your supervisor to review it.",
  "sync.result.fuelEfficiencyReview":
    "The fuel load was saved for an efficiency review. You can close your shift and tell your supervisor.",
  "sync.result.fuelEventNotVoidable":
    "This fuel load needs an authorized correction. Ask your supervisor for help.",
  "sync.result.ovitrapPointInaccessible":
    "This point is unavailable in your scope. Contact your supervisor.",
  "sync.result.ovitrapInaccessible":
    "This ovitrap is unavailable in your scope. Contact your supervisor.",
  "sync.result.ovitrapIdentityUsed":
    "This identity has already been used. Contact your supervisor before correcting it.",
  "sync.result.ovitrapPointOccupied":
    "This point already has an active ovitrap. Contact your supervisor.",
  "sync.result.ovitrapReadingExists":
    "This week already has an active reading. Void the previous reading before correcting it.",
  "sync.result.ovitrapBagCodeUsed":
    "This bag code has already been used. Check the code with your supervisor.",
  "sync.result.ovitrapCatalogItemUnknown":
    "This choice is absent from the downloaded catalog. Contact your supervisor.",
  "sync.result.ovitrapCatalogItemDeactivated":
    "This choice was deactivated. Your supervisor will review the capture.",
  "sync.result.ovitrapCatalogVersionUnavailable":
    "The catalog used could not be recovered. Your supervisor will review the capture.",
  "sync.result.ovitrapGpsUnusable":
    "The location is not accurate enough. Your supervisor will review the capture.",
  "sync.result.ovitrapRulesUnavailable":
    "Valid rules are missing for this capture. Your supervisor will review it.",
  "sync.result.ovitrapPointVersionUnavailable":
    "No point location was in force for this capture. Your supervisor will review it.",
  "sync.result.ovitrapTooFar":
    "The capture is beyond the allowed distance. Your supervisor will review it.",
  "sync.result.ovitrapSpeedAnomaly":
    "The movement needs review. Your supervisor will review the capture.",
  "sync.result.ovitrapVoidBlocked":
    "This placement has linked readings. Contact your supervisor to correct them.",
  "sync.result.ovitrapStaleIdentity":
    "The physical identity changed. Your supervisor will review the capture and retain its evidence.",
  "sync.result.ovitrapEvidenceRequired":
    "Photo evidence is missing. Your supervisor will review the capture; keep pending files.",
  "sync.result.incidentConfigurationUnavailable":
    "The incident type or accountable owner needs configuration. Your supervisor will review the capture.",
  "sync.result.incidentScopeUnavailable":
    "The incident has no verified work scope. Keep its evidence for supervisor review.",
  "sync.result.incidentInaccessible":
    "The incident reference is unavailable in your authorized work scope.",
  "sync.result.incidentEvidenceRequired":
    "Verified incident evidence is missing. Keep pending files; this capture needs review.",
  "sync.result.causalParentPending":
    "An earlier record needs validation. Your supervisor must review the retained capture.",
  "sync.result.motorcycleSafetyHold":
    "The motorcycle has a safety hold. The capture was kept for review.",
  "sync.result.transferInaccessible": "The transfer is unavailable in your authorized work scope.",
  "sync.result.transferStateConflict":
    "The transfer needs its earlier records reviewed. Keep the capture and signature.",
  "sync.result.transferEvidenceRequired":
    "Verified transfer evidence is missing. Keep the signature and pending files.",
  "sync.result.transferSafetyBlocked":
    "Current conditions prevent applying the transfer. The capture was kept for review.",
  "sync.result.transferVoidBlocked":
    "The transfer has effects or dependent records. Contact your supervisor to correct it.",
};
