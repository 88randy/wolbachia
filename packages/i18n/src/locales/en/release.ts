import type { release as source } from "../es-MX/release.ts";

export const release: Record<keyof typeof source, string> = {
  "mobile.eventType.releaseRecord": "Release",
  "mobile.release.title": "Record release",
  "mobile.release.blockedTitle": "Release blocked",
  "mobile.release.subtitle": "Requirements in the downloaded copy",
  "mobile.release.loading": "Reading the requirements saved on the phone…",
  "mobile.release.choose.task": "Choose the release task",
  "mobile.release.choose.device": "Choose the release device",
  "mobile.release.empty.task":
    "No tasks are available in your downloaded copy. Contact your supervisor.",
  "mobile.release.empty.device":
    "No devices are available for this selection. Contact your supervisor.",
  "mobile.release.selectionHint":
    "Options come from your downloaded copy. The record retains the original task, device and versions.",
  "mobile.release.selectedChoice": "Selected",
  "mobile.release.begin": "Prepare this capture",
  "mobile.release.restart": "Start a new draft with updated requirements",
  "mobile.release.restartHint":
    "The original draft and its evidence are retained. The new draft copies only the quantity; it needs its own location, photos and checks. This does not approve the previous capture.",
  "mobile.release.beginHint":
    "Choose the task and device to open or recover their capture on the phone. Requirements are checked again before saving.",
  "mobile.release.draftPending":
    "Saving the latest changes on the phone. If they do not finish, keep your input and use Retry.",
  "mobile.release.staleDraft":
    "This capture changed or lost authorization. Keep your input and read the downloaded copy again.",
  "mobile.release.shiftRequired":
    "You need an open shift on this phone. Return to the home screen to check it.",
  "mobile.release.safetyBlocked":
    "A safety requirement is missing. Check the marked rows; there is no bypass.",
  "mobile.release.photoUnavailable":
    "We could not obtain the photo. Your input is retained; check camera permission and try again.",
  "mobile.release.reviewApplied":
    "An applied review was recorded for this declaration. The original server response is retained.",
  "mobile.release.reviewDiscarded":
    "The review discarded this declaration. Evidence and the original response are retained.",
  "mobile.release.reviewObserved":
    "A review is linked to this declaration. Check its outcome in the inbox.",
  "mobile.release.prerequisites": "Release requirements",
  "mobile.release.gate.permit": "Valid permit",
  "mobile.release.gate.zone": "Official authorized zone",
  "mobile.release.gate.lot": "Available lot and stock",
  "mobile.release.gate.training": "Current training",
  "mobile.release.gate.schedule": "Authorized schedule",
  "mobile.release.gate.gps": "Location with sufficient accuracy",
  "mobile.release.gate.device": "Active release device",
  "mobile.release.gate.configuration": "Available capture configuration",
  "mobile.release.pass": "Checked",
  "mobile.release.fail": "Requirement not met",
  "mobile.release.unavailable": "Unavailable; release blocked",
  "mobile.release.contact.supervisor": "Ask your supervisor to review this requirement.",
  "mobile.release.contact.admin": "Ask the administrator to review the configuration.",
  "mobile.release.contact.courier": "Obtain an accurate location in a safe place and check again.",
  "mobile.release.noBypass":
    "Do not release while a requirement is missing. This screen has no bypass.",
  "mobile.release.cachedOnly":
    "This check uses the downloaded copy. The server validates again during sync.",
  "mobile.release.deviceId": "Release device",
  "mobile.release.taskId": "Scheduled task",
  "mobile.release.permitId": "Permit",
  "mobile.release.lotId": "Source lot",
  "mobile.release.referenceUnavailable": "No verified information",
  "mobile.release.detail.quantityInvalid":
    "Enter a quantity above zero, with up to 14 whole digits and 6 decimal places.",
  "mobile.release.detail.stockUnavailable":
    "The quantity exceeds available received stock, including amounts reserved by other records on the phone.",
  "mobile.release.detail.lotBlocked":
    "The lot or its transit policy is blocked. Do not release; contact your supervisor.",
  "mobile.release.detail.lotExpired":
    "The lot is not valid for this capture. Do not release; contact your supervisor.",
  "mobile.release.detail.deviceBlocked":
    "The device is inactive or retired. Do not use it to release; tell your supervisor.",
  "mobile.release.detail.scheduleBlocked":
    "The task was already used or its schedule, permit or owner changed. Do not release with this capture.",
  "mobile.release.detail.evidenceRequired":
    "Take the evidence photo required for this release before saving.",
  "mobile.release.detail.pinsChanged":
    "An original safety, equipment or stock reference changed. Keep the capture and contact your supervisor.",
  "mobile.release.detail.trainingPinInvalid":
    "The declared training is not valid in both checks. Do not release; contact your supervisor.",
  "mobile.release.detail.permitUnavailable":
    "The official permit is missing from the downloaded copy.",
  "mobile.release.detail.permitBlocked":
    "The permit is blocked or suspended. Do not release; contact your supervisor.",
  "mobile.release.detail.permitExpired":
    "The permit is not valid for this capture. Do not release; contact your supervisor.",
  "mobile.release.detail.zoneUnavailable":
    "The permit's official geometry is unavailable for checking this location.",
  "mobile.release.detail.zoneOutside":
    "The location is outside the official authorized zone. Do not release here.",
  "mobile.release.detail.gpsUnavailable":
    "A valid, accurate location is missing. Obtain the location in a safe place.",
  "mobile.release.detail.gpsAccuracy":
    "Location accuracy does not meet the configured limit. Obtain the location again.",
  "mobile.release.detail.trainingUnavailable":
    "Your training could not be verified for this release.",
  "mobile.release.detail.trainingBlocked":
    "The downloaded training does not allow this release. Ask your supervisor to review it.",
  "mobile.release.detail.scheduleUnavailable":
    "An authorized task bound to this permit could not be verified.",
  "mobile.release.detail.lotUnavailable":
    "Lot safety and received stock could not be verified for this release.",
  "mobile.release.detail.deviceUnavailable":
    "The device and its source lot could not be verified in the downloaded copy.",
  "mobile.release.detail.configurationUnavailable":
    "Verified configuration is missing for recording this release.",
  "mobile.release.detail.scopeUnavailable":
    "The downloaded copy does not authorize this capture. Keep the record and contact your supervisor.",
  "mobile.release.detail.contractUnavailable":
    "Safety information that the server must download is missing. Do not release; contact your supervisor.",
  "mobile.release.quantity": "Estimated quantity",
  "mobile.release.quantityHint":
    "Enter the observed quantity. Planned quantities do not confirm stock or authorization.",
  "mobile.release.gpsAccuracy": "Location accuracy, in metres",
  "mobile.release.acquireGps": "Obtain location",
  "mobile.release.evidence": "Evidence photos",
  "mobile.release.evidenceRequired":
    "The configuration requires photographic evidence before saving.",
  "mobile.release.evidenceOptional": "The configuration allows saving without a photo.",
  "mobile.release.evidenceUnknown":
    "The evidence requirement could not be verified. Do not release; contact your supervisor.",
  "mobile.release.photoPreview": "Release photo preview",
  "mobile.release.capturePhoto": "Take photo",
  "mobile.release.undoPhoto": "Undo last photo",
  "mobile.release.phoneSaved": "Saved on the phone. There is no server receipt yet.",
  "mobile.release.serverReceived":
    "The server received the record. Check its review outcome separately.",
  "mobile.release.inReview":
    "The server received the record for review. This does not confirm an authorized release.",
  "mobile.release.criticalRejected":
    "The server rejected the release for safety. Evidence is retained; tell your supervisor. This screen has no approval override.",
  "mobile.release.evidencePending":
    "Photos are still waiting for upload or verification. The record remains saved on the phone.",
  "mobile.release.openInbox": "View receipt and outcome in the inbox",
  "mobile.release.saveHint":
    "Saving retains the record on the phone; it does not confirm server authorization.",
  "mobile.release.working": "Processing on the phone…",
  "mobile.release.save": "Save release record",
  "mobile.release.reportDevice": "Report damaged device",
  "mobile.release.reportSupervisor": "Report to supervisor",
  "mobile.release.backToDay": "Back to day view",
};
