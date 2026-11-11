/** English messages of the `mobile` area: exactly the keys of `../es-MX/mobile.ts`. */
import type { mobile as source } from "../es-MX/mobile.ts";

export const mobile: Record<keyof typeof source, string> = {
  "mobile.sample.title": "Wolbachia sample",
  "mobile.sample.subtitle": "Collection and lab delivery",
  "mobile.sample.loading": "Loading your saved samples…",
  "mobile.sample.refresh": "Refresh capture data",
  "mobile.sample.source": "Choose the sample source",
  "mobile.sample.sourceReading": "Ovitrap reading",
  "mobile.sample.sourceLot": "Lot",
  "mobile.sample.sourceRelease": "Release",
  "mobile.sample.noSources":
    "No sources are available in your downloaded copy. Refresh or contact your supervisor.",
  "mobile.sample.origin": "Where does the sample come from?",
  "mobile.sample.noOrigins": "No configured origins are available. Contact your administrator.",
  "mobile.sample.method": "Verified method",
  "mobile.sample.noMethods": "No verified methods are available. Contact your administrator.",
  "mobile.sample.selected": "Selected",
  "mobile.sample.identity": "Sample identifier",
  "mobile.sample.unavailable": "Unavailable",
  "mobile.sample.code": "Sample code",
  "mobile.sample.codeHint":
    "Enter the container code, up to 50 characters. The office checks that it is unique.",
  "mobile.sample.codeRequired": "Enter a code of up to 50 characters.",
  "mobile.sample.otherText": "Specify the other origin",
  "mobile.sample.otherHint": "Describe the sample origin, up to 1000 characters.",
  "mobile.sample.otherRequired": "Describe the other origin before saving.",
  "mobile.sample.gps": "Location accuracy (m)",
  "mobile.sample.acquireGps": "Get location",
  "mobile.sample.photo": "Photo evidence",
  "mobile.sample.photoUnknown": "Choose an origin to see its photo requirement.",
  "mobile.sample.photoUnavailable":
    "We could not open the camera. Your fields are retained; try again.",
  "mobile.sample.photoRequired": "This origin requires a photo.",
  "mobile.sample.photoOptional": "A photo is optional for this origin.",
  "mobile.sample.photoPreview": "Private sample photo",
  "mobile.sample.takePhoto": "Take photo",
  "mobile.sample.undoPhoto": "Undo last photo",
  "mobile.sample.savedCaptures": "Samples saved on this phone",
  "mobile.sample.draftStatus": "Draft on this phone",
  "mobile.sample.deliveryPending": "Lab delivery unconfirmed",
  "mobile.sample.beginHint":
    "Choose a real source from your downloaded copy. A QR identifier alone does not confirm its origin or authorization.",
  "mobile.sample.begin": "Prepare sample",
  "mobile.sample.save": "Save sample",
  "mobile.sample.saveHint":
    "Data is saved on this phone and sent when connected. Saving does not confirm lab reception.",
  "mobile.sample.pendingEdits":
    "Saving your latest changes. If this does not finish, your fields stay available; use Retry.",
  "mobile.sample.working": "Working…",
  "mobile.sample.blockedHint":
    "Complete the missing fields. If downloaded requirements are missing, refresh or contact your supervisor. They cannot be bypassed.",
  "mobile.sample.phoneSaved": "Sample saved on this phone. Sending is still pending.",
  "mobile.sample.serverReceived": "The office received the sample record.",
  "mobile.sample.inReview":
    "The record is in review. This does not confirm an operational sample or lab reception.",
  "mobile.sample.rejected":
    "The office rejected the record. Your data and photos are retained; check the inbox and contact your supervisor.",
  "mobile.sample.evidencePending": "Private evidence is still awaiting verification.",
  "mobile.sample.reviewApplied":
    "An applied review was observed. The original sending status is retained.",
  "mobile.sample.reviewDiscarded":
    "A review discard was observed. The original capture is retained.",
  "mobile.sample.reviewObserved": "A later review decision is available. Check the inbox.",
  "mobile.sample.inbox": "View inbox",
  "mobile.sample.backToDay": "Back to day",
  "mobile.sample.deliver": "Deliver the container to the lab when closing your shift.",
  "mobile.sample.receiptUnknown":
    "No confirmed reception is present in the downloaded data. The reminder is retained.",
  "mobile.sample.received": "A lab reception is confirmed for this exact sample and record.",
  "mobile.sample.noResultAssumption":
    "Reception is not a result. A missing, invalid or disputed result does not mean negative.",
  "mobile.sample.storageError":
    "We could not save your changes. Your fields are retained; use Retry.",
  "mobile.sample.scopeUnavailable":
    "Your access or context changed. Unlock and refresh to continue.",
  "mobile.sample.shiftRequired": "You need an open shift to collect a sample.",
  "mobile.sample.configurationUnavailable":
    "Original or current origin and method requirements are missing. Refresh or contact your administrator.",
  "mobile.sample.sourceUnavailable":
    "The original source is no longer available or does not match this capture. Contact your supervisor.",
  "mobile.sample.originRequired": "Choose an available origin.",
  "mobile.sample.methodRequired": "Choose an available verified method version.",
  "mobile.sample.gpsRequired": "Get a location before saving.",
  "mobile.sample.evidenceRequired": "Add the photo required by the origin before saving.",
  "mobile.sample.staleDraft":
    "This draft has changed. Restore its current state before continuing.",
  "mobile.release.title": "Record release",
  "mobile.release.blockedTitle": "Release blocked",
  "mobile.release.subtitle": "Requirements in the downloaded copy",
  "mobile.release.loading": "Reading the requirements saved on the phone…",
  "mobile.release.chooseTask": "Choose the release task",
  "mobile.release.chooseDevice": "Choose the release device",
  "mobile.release.emptyTask":
    "No tasks are available in your downloaded copy. Contact your supervisor.",
  "mobile.release.emptyDevice":
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
    "An applied review was recorded for this declaration. The original office response is retained.",
  "mobile.release.reviewDiscarded":
    "The review discarded this declaration. Evidence and the original response are retained.",
  "mobile.release.reviewObserved":
    "A review is linked to this declaration. Check its outcome in the inbox.",
  "mobile.release.prerequisites": "Release requirements",
  "mobile.release.gatePermit": "Valid permit",
  "mobile.release.gateZone": "Official authorized zone",
  "mobile.release.gateLot": "Available lot and stock",
  "mobile.release.gateTraining": "Current training",
  "mobile.release.gateSchedule": "Authorized schedule",
  "mobile.release.gateGps": "Location with sufficient accuracy",
  "mobile.release.gateDevice": "Active release device",
  "mobile.release.gateConfiguration": "Available capture configuration",
  "mobile.release.pass": "Checked",
  "mobile.release.fail": "Requirement not met",
  "mobile.release.unavailable": "Unavailable; release blocked",
  "mobile.release.contactSupervisor": "Ask your supervisor to review this requirement.",
  "mobile.release.contactAdmin": "Ask the administrator to review the configuration.",
  "mobile.release.contactCourier": "Obtain an accurate location in a safe place and check again.",
  "mobile.release.noBypass":
    "Do not release while a requirement is missing. This screen has no bypass.",
  "mobile.release.cachedOnly":
    "This check uses the downloaded copy. The office validates again during sync.",
  "mobile.release.deviceId": "Release device",
  "mobile.release.taskId": "Scheduled task",
  "mobile.release.permitId": "Permit",
  "mobile.release.lotId": "Source lot",
  "mobile.release.referenceUnavailable": "No verified information",
  "mobile.release.detailQuantityInvalid":
    "Enter a quantity above zero, with up to 14 whole digits and 6 decimal places.",
  "mobile.release.detailStockUnavailable":
    "The quantity exceeds available received stock, including amounts reserved by other records on the phone.",
  "mobile.release.detailLotBlocked":
    "The lot or its transit policy is blocked. Do not release; contact your supervisor.",
  "mobile.release.detailLotExpired":
    "The lot is not valid for this capture. Do not release; contact your supervisor.",
  "mobile.release.detailDeviceBlocked":
    "The device is inactive or retired. Do not use it to release; tell your supervisor.",
  "mobile.release.detailScheduleBlocked":
    "The task was already used or its schedule, permit or owner changed. Do not release with this capture.",
  "mobile.release.detailEvidenceRequired":
    "Take the evidence photo required for this release before saving.",
  "mobile.release.detailPinsChanged":
    "An original safety, equipment or stock reference changed. Keep the capture and contact your supervisor.",
  "mobile.release.detailTrainingPinInvalid":
    "The declared training is not valid in both checks. Do not release; contact your supervisor.",
  "mobile.release.detailPermitUnavailable":
    "The official permit is missing from the downloaded copy.",
  "mobile.release.detailPermitBlocked":
    "The permit is blocked or suspended. Do not release; contact your supervisor.",
  "mobile.release.detailPermitExpired":
    "The permit is not valid for this capture. Do not release; contact your supervisor.",
  "mobile.release.detailZoneUnavailable":
    "The permit's official geometry is unavailable for checking this location.",
  "mobile.release.detailZoneOutside":
    "The location is outside the official authorized zone. Do not release here.",
  "mobile.release.detailGpsUnavailable":
    "A valid, accurate location is missing. Obtain the location in a safe place.",
  "mobile.release.detailGpsAccuracy":
    "Location accuracy does not meet the configured limit. Obtain the location again.",
  "mobile.release.detailTrainingUnavailable":
    "Your training could not be verified for this release.",
  "mobile.release.detailTrainingBlocked":
    "The downloaded training does not allow this release. Ask your supervisor to review it.",
  "mobile.release.detailScheduleUnavailable":
    "An authorized task bound to this permit could not be verified.",
  "mobile.release.detailLotUnavailable":
    "Lot safety and received stock could not be verified for this release.",
  "mobile.release.detailDeviceUnavailable":
    "The device and its source lot could not be verified in the downloaded copy.",
  "mobile.release.detailConfigurationUnavailable":
    "Verified configuration is missing for recording this release.",
  "mobile.release.detailScopeUnavailable":
    "The downloaded copy does not authorize this capture. Keep the record and contact your supervisor.",
  "mobile.release.detailContractUnavailable":
    "Safety information that the office must download is missing. Do not release; contact your supervisor.",
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
  "mobile.release.phoneSaved": "Saved on the phone. There is no office receipt yet.",
  "mobile.release.serverReceived":
    "The office received the record. Check its review outcome separately.",
  "mobile.release.inReview":
    "The office received the record for review. This does not confirm an authorized release.",
  "mobile.release.criticalRejected":
    "The office rejected the release for safety. Evidence is retained; tell your supervisor. This screen has no approval override.",
  "mobile.release.evidencePending":
    "Photos are still waiting for upload or verification. The record remains saved on the phone.",
  "mobile.release.openInbox": "View receipt and outcome in the inbox",
  "mobile.release.saveHint":
    "Saving retains the record on the phone; it does not confirm office authorization.",
  "mobile.release.working": "Processing on the phone…",
  "mobile.release.save": "Save release record",
  "mobile.release.reportDevice": "Report damaged device",
  "mobile.release.reportSupervisor": "Report to supervisor",
  "mobile.release.backToDay": "Back to day view",
  "mobile.scanner.title": "Scan code",
  "mobile.scanner.hint": "Point at the program QR code.",
  "mobile.scanner.start": "Use camera",
  "mobile.scanner.manual": "Enter code",
  "mobile.scanner.code": "Code printed below the QR",
  "mobile.scanner.lookup": "Find code",
  "mobile.scanner.torchOn": "Turn torch on",
  "mobile.scanner.torchOff": "Turn torch off",
  "mobile.scanner.denied":
    "The app cannot use the camera. Enable it in phone Settings › Permissions › Camera, or enter the code.",
  "mobile.scanner.settings": "Open phone settings",
  "mobile.scanner.cameraFailed":
    "We could not open the camera. Try again or enter the printed code.",
  "mobile.scanner.damaged":
    "If the code cannot be read, clean the label, turn on the torch or enter the printed code.",
  "mobile.scanner.retry": "Scan again",
  "mobile.scanner.resume": "Continue capture saved on the phone",
  "mobile.scanner.loading": "Looking in the downloaded copy…",
  "mobile.scanner.report": "Report damage or expiry",
  "mobile.scanner.invalid":
    "We could not recognize this code. Find the program label or enter the printed code.",
  "mobile.scanner.version":
    "This code version is not supported. Enter the printed code or contact your supervisor.",
  "mobile.scanner.kind":
    "This code type does not match this capture. Scan the requested label or enter its code.",
  "mobile.scanner.unavailable":
    "This record is unavailable in your downloaded copy. Scan another code or contact your supervisor.",
  "mobile.scanner.retired":
    "This ovitrap is retired. Scan another label or tell your supervisor if you found it in the field.",
  "mobile.scanner.duplicate":
    "This code has already been read. Continue the capture or scan again; no additional record was added.",
  "mobile.scanner.storage":
    "We could not save the change on the phone. Keep your capture and try again.",
  "mobile.scanner.supplyTitle": "Supply detail",
  "mobile.scanner.lot": "Lot identifier",
  "mobile.scanner.quantity": "Expected quantity in the downloaded plan",
  "mobile.scanner.unit": "Unit version identifier",
  "mobile.scanner.assignment": "Source assignment",
  "mobile.scanner.date": "Assignment date",
  "mobile.scanner.revision": "Downloaded plan revision",
  "mobile.scanner.sourceLine": "Source line",
  "mobile.scanner.missingMetadata":
    "The downloaded copy has no supply or unit names, printed lot code or expiry. This is a planned quantity; it does not confirm receipt or stock. Check the label or contact your supervisor.",
  "mobile.shiftClose.refreshSupplies": "Refresh downloaded receipts",
  "mobile.shiftClose.sourceFrame":
    "Downloaded confirmed balance; additional declarations are shown below.",

  "mobile.shiftClose.title": "Close shift",
  "mobile.shiftClose.closedTitle": "Shift closed",
  "mobile.shiftClose.phoneClosed": "Closed on the phone",
  "mobile.shiftClose.serverReceived": "Office received the closing records",
  "mobile.shiftClose.inReview": "Office received a record for review",
  "mobile.shiftClose.rejected":
    "A record was rejected. Check the inbox; the shift remains closed on the phone.",
  "mobile.shiftClose.pending": "Pending points",
  "mobile.shiftClose.noPending": "No pending points in the downloaded copy.",
  "mobile.shiftClose.goNow": "Go to day view",
  "mobile.shiftClose.leavePending": "Close without completing this point",
  "mobile.shiftClose.leftPending": "Confirmed: point remains pending",
  "mobile.shiftClose.planned": "Warehouse allocation",
  "mobile.shiftClose.equation": "Received ? used ? returned ? shrinkage",
  "mobile.shiftClose.difference": "Difference",
  "mobile.shiftClose.unknown": "No confirmed value",
  "mobile.shiftClose.supplies": "Supply reconciliation",
  "mobile.shiftClose.differenceAllowed":
    "Differences remain for review and do not prevent closure. A return is a declaration; the warehouse confirms receipt.",
  "mobile.shiftClose.suppliesUnavailable":
    "No downloaded receipt is linked to this shift. Balances and reconciliation remain unconfirmed; you can close.",
  "mobile.shiftClose.returnQuantity": "Additional return quantity",
  "mobile.shiftClose.returnDestination": "Return to the original warehouse",
  "mobile.shiftClose.odometer": "Closing odometer (km)",
  "mobile.shiftClose.note": "Closing note (optional)",
  "mobile.shiftClose.lowOdometer":
    "Odometer is below the opening reading. It will be retained for review; you can close on the phone.",
  "mobile.shiftClose.confirmTitle": "Close this shift?",
  "mobile.shiftClose.confirmHint":
    "This phone will save the closure and stop capture and location collection for this shift. Pending points will not be completed.",
  "mobile.shiftClose.close": "Close shift on the phone",
  "mobile.shiftClose.continue": "Review and confirm closure",
  "mobile.shiftClose.retryHint":
    "Pending records retry when the session and connection return. Keep the app installed. Check the inbox for pending attachments and rejections.",
  "mobile.shiftClose.reviewHistory": "Review history",
  "mobile.shiftClose.notReviewed": "No downloaded supervisor decision.",
  "mobile.shiftClose.observed": "Observed by supervisor",
  "mobile.shiftClose.approved": "Current approval",
  "mobile.shiftClose.staleApproval": "Earlier approval; new review required",
  "mobile.shiftClose.noShift": "No local shift to close. Return home.",
  "mobile.shiftClose.saveFailed":
    "The change was not saved. Your input is retained. Check pending points, quantities and reasons, then retry; if it continues, check storage with your supervisor.",
  "mobile.shiftClose.shrinkageQuantity": "Additional shrinkage quantity",
  "mobile.shiftClose.reason": "Shrinkage reason (10 to 1000 characters)",
  "mobile.shiftClose.photo": "Take shrinkage photo",
  "mobile.shiftClose.photoRequired": "Shrinkage requires a photo and a list reason.",
  "mobile.shiftClose.photoSaved": "Photo saved on phone; delivery pending",
  "mobile.shiftOpen.closed": "This shift is closed on the phone. Open its summary.",

  "mobile.unlock.greetingNeutral": "Hello",
  "mobile.shiftOpen.severeSaved":
    "You cannot depart with this motorcycle because of a severe fault. Contact your supervisor to arrange fleet clearance.",
  "mobile.shiftOpen.receivedRejected": "Received by office · Opening rejected",
  "mobile.shiftOpen.receivedInReview": "Received by office · In review",
  "mobile.preview.title": "Style preview",
  "mobile.preview.sample": "Sample",
  "mobile.preview.intro":
    "Interface examples without real data. They do not save changes or send records.",
  "mobile.preview.themeHint": "Follow the phone or choose an appearance.",
  "mobile.preview.textScaleHint": "To review 130% text, use the phone text-size setting.",
  "mobile.preview.system": "System",
  "mobile.preview.light": "Light",
  "mobile.preview.dark": "Dark",
  "mobile.preview.toggleTheme": "Change appearance",
  "mobile.preview.primary": "Finish review",
  "mobile.preview.data": "Sample data",
  "mobile.preview.progress": "Points checked · daily target",
  "mobile.preview.received": "Received",
  "mobile.preview.onPhone": "On the phone",
  "mobile.preview.problem": "Needs attention",
  "mobile.preview.review": "In review",
  "mobile.preview.inactive": "Inactive",
  "mobile.preview.fields": "Capture",
  "mobile.preview.code": "Sample code",
  "mobile.preview.disabled": "Action unavailable",
  "mobile.preview.disabledHint":
    "Example: configuration is missing. Your supervisor can enable this action.",
  "mobile.preview.loading": "Loading on the phone",
  "mobile.preview.empty": "No records yet",
  "mobile.preview.partial": "The rest stays available",
  "mobile.preview.error": "This example could not update. Retry; what you entered is still here.",
  "mobile.preview.retryResult": "Example retry completed. No office was contacted.",
  "mobile.lifecycle.replace": "Replace ovitrap",
  "mobile.lifecycle.relocate": "Propose relocation",
  "mobile.lifecycle.remove": "Remove ovitrap",
  "mobile.lifecycle.fixedCode":
    "The point code stays fixed. Replacement uses a new physical identity.",
  "mobile.lifecycle.source": "Source ovitrap",
  "mobile.lifecycle.replacement": "New physical identity",
  "mobile.lifecycle.proposalOnly":
    "This saves a proposal. The authorized point location stays unchanged until a synced decision.",
  "mobile.lifecycle.proposedLocation": "Proposed location (longitude, latitude)",
  "mobile.lifecycle.closedWeeks": "Consecutive closed-house weeks (downloaded rule):",
  "mobile.lifecycle.confirmedCount": "Known incidents (downloaded rule):",
  "mobile.lifecycle.noIncidentHistory":
    "No local incident history; that suggestion is unavailable.",
  "mobile.lifecycle.inspectHistory":
    "Review the history before proposing. The suggestion is advisory.",
  "mobile.lifecycle.gpsRequired": "GPS is missing. Try again; a location is required to save.",
  "mobile.lifecycle.gpsCaptured": "GPS captured on the phone",
  "mobile.lifecycle.captureGps": "Capture GPS location",
  "mobile.lifecycle.recovery": "Did you recover the ovitrap? Choose an option.",
  "mobile.lifecycle.recovered": "Recovered: bringing it back",
  "mobile.lifecycle.unrecovered": "Unrecovered: could not find it",
  "mobile.lifecycle.unconfirmed": "Recovery unconfirmed",
  "mobile.lifecycle.recoveryNotice":
    "Recovery remains unresolved. Unconfirmed is retained on the phone and reported as unrecovered to the office.",
  "mobile.lifecycle.reason": "Reason from the downloaded list",
  "mobile.lifecycle.chooseReason": "Choose reason",
  "mobile.lifecycle.other": "Other: describe the reason (1000 characters maximum)",
  "mobile.lifecycle.incidentNotice":
    "The office links the finding to an incident when it applies the capture. The phone does not create an incident.",
  "mobile.lifecycle.photoRequired": "Add at least one photo for this capture before saving.",
  "mobile.lifecycle.capturePhoto": "Add evidence photo",
  "mobile.lifecycle.discardPhoto": "Remove draft photo",
  "mobile.lifecycle.photoDiscarded": "Photo removed from the draft. You can undo this.",
  "mobile.lifecycle.undo": "Undo",
  "mobile.lifecycle.reviewAcknowledge":
    "I understand that GPS, distance or outdated rules require office review.",
  "mobile.lifecycle.download": "Download lifecycle lists and rules",
  "mobile.lifecycle.adopt": "Review and use downloaded lists and rules",
  "mobile.lifecycle.begin": "Start capture for this point",
  "mobile.lifecycle.loading": "Loading local draft?",
  "mobile.lifecycle.empty":
    "Start a capture for the selected ovitrap. Download missing configuration first.",
  "mobile.lifecycle.confirmRemove": "Review and confirm removal",
  "mobile.lifecycle.removeConsequence":
    "The point will no longer have this ovitrap. Corrections append a reasoned void; evidence is retained.",
  "mobile.lifecycle.save": "Save on the phone",
  "mobile.lifecycle.incomplete":
    "Capture incomplete: check reason, Other, GPS, photo and recovery. The draft is retained.",
  "mobile.lifecycle.proposed": "Proposed",
  "mobile.lifecycle.approved": "Approved",
  "mobile.lifecycle.rejected": "Rejected",
  "mobile.lifecycle.reviewAccepted": "Office result: accepted. Supervisor review: unconfirmed.",
  "mobile.lifecycle.reviewRejected":
    "Office result: rejected. Keep the evidence and contact your supervisor.",
  "mobile.lifecycle.decisionPending": "Supervisor decision: awaiting sync",
  "mobile.lifecycle.nextTask": "Task received through sync",
  "mobile.lifecycle.noTask": "No synced task; no early local assignment.",
  "mobile.lifecycle.history": "Lifecycle and correction history",
  "mobile.lifecycle.voided": "Void recorded; original retained",
  "mobile.lifecycle.correctionReason":
    "Correction reason (10 visible characters to 1000 characters)",
  "mobile.lifecycle.correct": "Void with reason and retain evidence",
  "mobile.lifecycle.scopeBlocked":
    "This point is outside your downloaded scope. The draft is retained; contact your supervisor.",
  "mobile.lifecycle.noCamera": "Camera unavailable. Keep the draft and retry on an enabled device.",
  "mobile.lifecycle.noReasons": "The reason list is missing. Download it before continuing.",

  "mobile.ovitrap.pendingDraft":
    "Another capture draft is pending. Resume it before switching ovitraps.",
  // M-08: P13, P14 and P21
  "mobile.ovitrap.open": "Place or check ovitraps",
  "mobile.ovitrap.place": "Place ovitrap",
  "mobile.ovitrap.check": "Check ovitrap",
  "mobile.ovitrap.next": "Continue",
  "mobile.ovitrap.save": "Save on phone",
  "mobile.ovitrap.point": "Choose a point from your assignment",
  "mobile.ovitrap.finding": "How did you find it?",
  "mobile.ovitrap.paddle": "Is the egg paddle present?",
  "mobile.ovitrap.eggs": "Does it have eggs?",
  "mobile.ovitrap.yes": "Yes",
  "mobile.ovitrap.no": "No",
  "mobile.ovitrap.conditions": "Site conditions",
  "mobile.ovitrap.temperature": "Temperature (°C, optional)",
  "mobile.ovitrap.humidity": "Humidity (%, optional)",
  "mobile.ovitrap.paddleType": "Egg paddle type",
  "mobile.ovitrap.other": "Describe what you found (required for Other)",
  "mobile.ovitrap.bag": "Human bag code",
  "mobile.ovitrap.scanBag": "Scan bag",
  "mobile.ovitrap.bagHint":
    "One bag per reading. Write the point code and date; fold inwards. The lab counts the eggs.",
  "mobile.ovitrap.lagged": "Mark as lagged",
  "mobile.ovitrap.laggedHint":
    "A lagged paddle still goes to the lab and remains countable. The office determines its exclusion from indices.",
  "mobile.ovitrap.prepare": "Prepare and reinstate",
  "mobile.ovitrap.clean": "I washed and scrubbed the container",
  "mobile.ovitrap.water": "Clean water to three quarters, without chlorine or larvicide",
  "mobile.ovitrap.liner": "Egg paddle covers the entire inside",
  "mobile.ovitrap.shade": "In shade, among plants",
  "mobile.ovitrap.height": "Up to 1.5 m high",
  "mobile.ovitrap.containers": "Away from other water containers",
  "mobile.ovitrap.safe": "Out of reach of children and animals",
  "mobile.ovitrap.marked": "I marked the facade with OV and the point code",
  "mobile.ovitrap.newPaddle": "New egg paddle",
  "mobile.ovitrap.reuse": "Approved reused egg paddle",
  "mobile.ovitrap.reuseUnavailable":
    "Reuse requires downloaded eligibility. A third reuse is never offered.",
  "mobile.ovitrap.supplies": "Supply UUID references, separated by commas",
  "mobile.ovitrap.photo": "Add photo evidence",
  "mobile.camera.takeTitle": "Take the photo",
  "mobile.camera.takeHint": "Aim and tap the big button.",
  "mobile.camera.reviewTitle": "Does the photo look good?",
  "mobile.camera.reviewHint": "If it looks good, use it. If not, take it again.",
  "mobile.camera.previewLabel": "Photo you just took",
  "mobile.camera.viewfinderLabel": "Camera view",
  "mobile.camera.shoot": "Take photo",
  "mobile.camera.waiting": "Waiting for the camera to open.",
  "mobile.camera.use": "Use this photo",
  "mobile.camera.retake": "Take it again",
  "mobile.camera.cancel": "Cancel",
  "mobile.camera.failed": "The photo could not be taken. Try again.",
  "mobile.camera.undo": "Remove this photo from the draft",
  "mobile.ovitrap.concurrentEdit":
    "The draft changed while saving. Your edits are still pending; try saving them again.",
  "mobile.camera.ownerRequired":
    "Sign in again to confirm the account before taking a photo. Your draft is still on this phone.",
  "mobile.camera.fileType":
    "The photo format is unsupported. Take another photo in JPEG or PNG; your draft is still on this phone.",
  "mobile.camera.fileSize":
    "The photo has an invalid size. Adjust the camera resolution and take it again; your draft is still on this phone.",
  "mobile.camera.permissionDenied":
    "No photo was added. Allow camera access and try again; your draft is still on this phone.",
  "mobile.camera.permissionBlocked":
    "Camera access is blocked. Enable it in the app settings or ask for help; your draft is still on this phone.",
  "mobile.camera.resultInvalid":
    "The camera did not return a valid photo. Try again; your draft is still on this phone.",
  "mobile.camera.busy": "A capture is in progress. Return from the camera and try again.",
  "mobile.camera.unlockRequired":
    "Unlock the app and take the photo again. Your draft is still on this phone.",
  "mobile.camera.fileFailed":
    "The photo could not be saved on this phone. Check available storage and take it again; your draft is still on this phone.",
  "mobile.ovitrap.photoUnavailable":
    "The camera could not open. Allow the camera and try again; your draft is still on this phone.",
  "mobile.ovitrap.refresh": "Download lists and rules",
  "mobile.ovitrap.adopt": "Review and use downloaded versions",
  "mobile.ovitrap.catalogChanged":
    "A newer list is available. Your answers and historical labels are retained; review before changing versions.",
  "mobile.ovitrap.confirm": "Review before saving",
  "mobile.ovitrap.phoneSaved": "Saved on phone",
  "mobile.ovitrap.serverPending": "Office receipt: pending",
  "mobile.ovitrap.serverReceived": "Received by office",
  "mobile.ovitrap.reviewPending": "Review: pending; ask your supervisor for help",
  "mobile.ovitrap.reviewUnknown": "Supervisor review: not confirmed",
  "mobile.ovitrap.repeat":
    "This ovitrap already has a reading this week. You can void it with a reason and record a new reading. Original evidence is retained.",
  "mobile.ovitrap.correct": "Void with reason and record new",
  "mobile.ovitrap.reason": "Reason: 10 visible characters to 1000 characters",
  "mobile.ovitrap.reasonCode": "List reason",
  "mobile.ovitrap.newBag": "Use a new bag code: previous codes remain reserved.",
  "mobile.ovitrap.scan": "Scan ovitrap",
  "mobile.ovitrap.manual": "Enter code manually",
  "mobile.ovitrap.manualHint":
    "Manual capture is flagged. Use the physical ovitrap UUID or the human bag code.",
  "mobile.ovitrap.code": "Code",
  "mobile.ovitrap.lookup": "Use code",
  "mobile.ovitrap.invalid": "This code is not valid for this operation",
  "mobile.ovitrap.invalidHint":
    "Find the correct program label and retry, or enter the code manually.",
  "mobile.ovitrap.retry": "Scan again",
  "mobile.ovitrap.scannerUnavailable":
    "The scanner is not available in this build. Enter the code manually.",
  "mobile.ovitrap.gps":
    "Location is missing or accuracy does not meet downloaded rules. Retry GPS or save for review if policy allows.",
  "mobile.ovitrap.stale":
    "Rules changed or expired. Download current rules or keep the capture for review if policy allows.",
  "mobile.ovitrap.distance":
    "You are far from the point under downloaded rules. Move closer or keep the capture for review.",
  "mobile.ovitrap.location":
    "This ovitrap point is unknown on the phone. The office will review location and scope; compliance is not confirmed.",
  "mobile.ovitrap.acknowledge": "I understand this capture needs office review",
  "mobile.ovitrap.retryGps": "Retry GPS",
  "mobile.ovitrap.shiftBlocked":
    "This shift does not allow capture or saving. Review the opening with your supervisor; the draft is retained.",
  "mobile.ovitrap.staleWeekContext":
    "Current organization week and time zone settings are missing. Update the context before saving; the draft is retained.",
  "mobile.ovitrap.staleView":
    "The capture you are viewing changed. This action was not applied. Refresh the view and try again.",
  "mobile.ovitrap.immutableEdit":
    "The late edit was not saved and has been discarded. Start a new capture or use a correction.",
  "mobile.ovitrap.gateShift": "Open a shift before saving. The draft is retained.",
  "mobile.ovitrap.gateAssignment":
    "An assignment with explicit scope and epi week is missing. Download it before saving.",
  "mobile.ovitrap.gateCatalog": "The list is missing. Download it before saving.",
  "mobile.ovitrap.gateRules": "Usable rules are missing. Download them before saving.",
  "mobile.ovitrap.gatePoint": "Choose an allowed point and verify supply references.",
  "mobile.ovitrap.gateFinding": "Choose a finding from the saved list.",
  "mobile.ovitrap.gatePaddle": "Confirm egg paddle presence and type.",
  "mobile.ovitrap.gateEggs": "Confirm Yes or No: does it have eggs?",
  "mobile.ovitrap.gateBag": "Enter the human bag code.",
  "mobile.ovitrap.gateConditions":
    "Check temperature and humidity. Humidity must be between 0 and 100%.",
  "mobile.ovitrap.gateOther": "Other requires a description of up to 1000 characters.",
  "mobile.ovitrap.gatePrepare": "Complete preparation before saving.",
  "mobile.ovitrap.gateEvidence":
    "This list requires photo evidence. Keep the draft and ask for help.",
  "mobile.ovitrap.gateReuse": "This paddle is not approved for reuse. Choose a new one.",
  "mobile.ovitrap.gateReason":
    "Choose a reason and write at least 10 visible characters, up to 1000.",
  "mobile.ovitrap.gateReview":
    "Review GPS and rule notices. Save for review only when downloaded policy permits.",
  "mobile.ovitrap.resume": "Resume draft",
  "mobile.ovitrap.nextTarget": "Next point",
  "mobile.ovitrap.edit": "Review answers again",
  "mobile.ovitrap.permission":
    "Ask your supervisor to replace, relocate or remove this ovitrap. Keep this reading.",
  // M-06: P9-P10 day list and offline map
  "mobile.day.loading": "Loading saved points…",
  "mobile.day.updating": "Updating…",
  "mobile.day.readFailed": "Could not read saved points. Try reading them again.",
  "mobile.day.mapFailed": "We could not open the saved map. Try again or use the list.",
  "mobile.day.actionFailed":
    "Could not complete the local action. Retry; your records remain saved.",
  "mobile.day.backHome": "Back to home",
  "mobile.day.showDetails": "Show error details",
  "mobile.day.hideDetails": "Hide error details",
  "mobile.day.errorCode": "Code: {code}",

  "mobile.day.historyEntry": "{date} · {summary}",
  "mobile.day.title": "My day",
  "mobile.day.open": "View today's points",
  "mobile.day.list": "List",
  "mobile.day.map": "Map",
  "mobile.day.progress": "{completed} of {total} tasks completed",
  "mobile.day.pending": "Pending · High risk first",
  "mobile.day.closedSection": "Closed houses to revisit today",
  "mobile.day.completedSection": "Completed tasks",
  "mobile.day.empty": "No saved assigned points. Refresh the list when connected.",
  "mobile.day.ready": "All tasks completed. Return home to close your shift when available.",
  "mobile.day.refresh": "Refresh list",
  "mobile.day.refreshFailed": "Could not refresh. Use your saved points and try again.",
  "mobile.day.unreadable": "Rows that could not be read: {count}. Refresh or ask your supervisor.",
  "mobile.day.keptNotice":
    "Assignments changed. Kept these points with pending work: {codes}. Ask your supervisor.",
  "mobile.day.kept": "Kept: pending work",
  "mobile.day.highRisk": "High risk",
  "mobile.day.pendingStatus": "Pending today",
  "mobile.day.doneStatus": "Complete",
  "mobile.day.closedStatus": "Closed house · revisit",
  "mobile.day.relocateStatus": "To relocate",
  "mobile.day.unknownStatus": "Status unconfirmed",
  "mobile.day.phoneSaved": "Saved on phone",
  "mobile.day.serverReceived": "Office received · review is separate",
  "mobile.day.receiptRejected": "Capture rejected. See the pending inbox for details.",
  "mobile.day.captureInReview": "Capture under office review",
  "mobile.day.reviewUnconfirmed": "Office review unconfirmed",
  "mobile.day.place": "Place",
  "mobile.day.check": "Check",
  "mobile.day.replace": "Replace",
  "mobile.day.relocate": "Relocate",
  "mobile.day.remove": "Remove",
  "mobile.day.block": "Block {code}",
  "mobile.day.distance": "{distance} m",
  "mobile.day.navigate": "How to get there",
  "mobile.day.go": "Go",
  "mobile.day.history": "Recent history",
  "mobile.day.historyEmpty": "No saved history.",
  "mobile.day.historyUnknown": "Visit details unavailable",
  "mobile.day.historyOk": "OK · egg paddle delivered",
  "mobile.day.historyDry": "No water · reinstalled",
  "mobile.day.reference": "Reference: {reference}",
  "mobile.day.noReference": "No saved reference.",
  "mobile.day.scanHint": "To record, scan the ovitrap QR when the scanner is available.",
  "mobile.day.backList": "View point list",
  "mobile.day.closeDetail": "Close point details",
  "mobile.day.accessRevoked": "Downloaded points are no longer available. Refresh your day.",
  "mobile.day.noLocation": "No location for this point yet. You can still use the list.",
  "mobile.day.noMap": "No saved map",
  "mobile.day.noMapHint":
    "There is no saved map on the phone. Connect to the internet and try again, or use the list of points.",
  "mobile.day.retryMap": "Try the map again",
  "mobile.day.outsideCoverage": "Outside the saved map area",
  "mobile.day.attribution": "© OpenStreetMap contributors",
  "mobile.day.mapLabel": "Offline map of assigned points",
  "mobile.day.locationDenied": "Location permission denied. You can keep using the list.",
  "mobile.day.locationUnavailable": "Location unavailable. You can keep using the list.",
  "mobile.day.locationSearching": "Looking for your location…",
  "mobile.day.locationStale": "Stale location · {seconds} s ago. Distances are hidden.",
  "mobile.day.locationFix": "Location · {seconds} s ago · accuracy ±{accuracy} m",
  "mobile.day.locationUnknownAccuracy": "Location · {seconds} s ago · accuracy unavailable",
  "mobile.day.locationWeak": "Approximate location · {seconds} s ago · accuracy ±{accuracy} m",
  "mobile.day.launched": "Navigator opened. This point stays selected when you return.",
  "mobile.day.noHandler":
    "No navigation app available. Use the coordinates and reference; the list remains available.",
  "mobile.day.denied":
    "Could not open the navigator. Ask the administrator to check access. Use the coordinates and reference.",
  "mobile.day.invalidCoordinates": "Coordinates are invalid. Use the list and ask your supervisor.",
  "mobile.day.coordinates": "Coordinates: {coordinates}",
  // M-04: P3-P7 shift opening
  "mobile.shiftOpen.catalogChanged":
    "The list changed. Review the items and confirm the new version. If a captured fault is no longer listed, ask your supervisor for help; the evidence is retained.",
  "mobile.shiftOpen.confirmCatalog": "Confirm list and review again",
  "mobile.shiftOpen.start": "Open shift",
  "mobile.shiftOpen.resume": "Resume opening",
  "mobile.shiftOpen.noShift": "No open shift",
  "mobile.shiftOpen.opened": "Shift saved on this phone",
  "mobile.shiftOpen.noAssignment":
    "Zone assignments are not available in this build yet. You can prepare your shift.",
  "mobile.shiftOpen.inbox": "View uploads",
  "mobile.shiftOpen.motorcycleTitle": "Step 1 of 4 · Your motorcycle",
  "mobile.shiftOpen.motorcycleHint":
    "Enter and confirm the motorcycle code. At sync, the office checks whether it exists, is blocked or is in use.",
  "mobile.shiftOpen.motorcycleCode": "Motorcycle code",
  "mobile.shiftOpen.continue": "Continue",
  "mobile.shiftOpen.checklistTitle": "Step 2 of 4 · Check your motorcycle",
  "mobile.shiftOpen.unconfigured":
    "The safety checklist is not configured. Download the list or ask your supervisor to configure it. You cannot depart.",
  "mobile.shiftOpen.catalogUnavailable":
    "The list could not be updated. The last saved copy is retained. Check your session and connection, then retry.",
  "mobile.shiftOpen.refreshCatalog": "Update safety list",
  "mobile.shiftOpen.ok": "OK",
  "mobile.shiftOpen.minor": "Minor fault",
  "mobile.shiftOpen.severeResult": "Severe fault",
  "mobile.shiftOpen.note": "Note (optional)",
  "mobile.shiftOpen.requiredNote": "Required note",
  "mobile.shiftOpen.odometerTitle": "Step 3 of 4 · Opening odometer",
  "mobile.shiftOpen.photoHint":
    "The odometer photo is optional unless the list requires evidence. Saved photos stay on this phone.",
  "mobile.shiftOpen.capturePhoto": "Take photo",
  "mobile.shiftOpen.photoUnavailable":
    "The camera could not open. Allow the camera and try again; your input is still on this phone.",
  "mobile.shiftOpen.photoCount": "Photos saved on this phone:",
  "mobile.shiftOpen.odometerKm": "Odometer km (whole number)",
  "mobile.shiftOpen.lastOdometer": "Last odometer known to this phone:",
  "mobile.shiftOpen.unknownOdometer": "No local reference; the office will check at sync.",
  "mobile.shiftOpen.odometerWarning":
    "This is below the last known reading. Check it; you can continue without losing it. The office may flag it for review.",
  "mobile.shiftOpen.mapsTitle": "Step 4 of 4 · Prepare map",
  "mobile.shiftOpen.mapReady":
    "Map saved on the phone. You can continue if the motorcycle check is complete.",
  "mobile.shiftOpen.mapUnavailable":
    "The map is not available yet. Connect to the internet and try again.",
  "mobile.shiftOpen.mapPreparing": "Saving the map on the phone. You cannot depart yet.",
  "mobile.shiftOpen.mapFailed":
    "Map preparation failed. Progress is retained. Check your connection and retry.",
  "mobile.shiftOpen.mapIncomplete":
    "The saved map is missing parts. Save it again before departing.",
  "mobile.shiftOpen.mapProgress": "Preparation progress (%):",
  "mobile.shiftOpen.recordSevere": "Save severe fault · Do not depart",
  "mobile.shiftOpen.severe":
    "You cannot depart with this motorcycle. Save the severe fault and contact your supervisor to arrange fleet clearance. Saving does not confirm office receipt.",
  "mobile.shiftOpen.editChecklist": "Return to motorcycle selection and checklist",
  "mobile.shiftOpen.motorcycle":
    "Confirm the motorcycle code. If the phone says it is blocked, ask your supervisor for help.",
  "mobile.shiftOpen.checklist": "Answer every safety item before continuing.",
  "mobile.shiftOpen.noteGate": "Describe the severe fault or Other before saving.",
  "mobile.shiftOpen.photo":
    "The list requires a photo. Capture it before departure; this build has no camera support.",
  "mobile.shiftOpen.odometer": "Enter kilometers as a whole number. Your input is retained.",
  "mobile.shiftOpen.map":
    "The map still needs to be saved on the phone. Connect to the internet and try again.",
  "mobile.shiftOpen.rejected":
    "The office rejected the opening. Check Uploads for the outcome and contact your supervisor before departure.",
  "mobile.shiftOpen.phoneSaved": "Saved on phone · Awaiting office receipt",
  "mobile.shiftOpen.serverReceived": "Received by office · Check the outcome",
  "mobile.shiftOpen.reviewPending": "Subsequent review: no confirmed resolution in this build.",
  "mobile.shiftOpen.correctAndRetry": "Correct and try again",
  "mobile.shiftOpen.retrySave": "Retry saving input",

  // Boot
  "mobile.boot.loading": "Getting the app ready",
  "mobile.boot.storageFailed":
    "The phone's storage could not be opened. Close and reopen the app; if it keeps happening, contact support.",
  "mobile.storage.saveFailed":
    "It could not be saved on the phone. Free up space and try again; nothing was sent.",

  "mobile.storage.actionFailed":
    "The phone storage could not be updated. Free up space and try again; your records are still saved.",

  // Navigation
  "mobile.nav.back": "Back",
  "mobile.nav.settings": "Settings",

  // Home (placeholder until the epics bring the real screens)
  "mobile.home.title": "Home",
  "mobile.home.placeholder": "Your shift will be here. This version only prepares sending records.",
  "mobile.home.serverMissing":
    "The connection is not set up. Ask your supervisor; your records stay on the phone.",

  // Top-bar sync chip
  "mobile.chip.allSent": "All sent",
  "mobile.chip.toUpload": "{count} to upload",
  "mobile.chip.noSignal": "No signal · {count} to upload",
  "mobile.chip.noSignalEmpty": "No signal",
  "mobile.chip.error": "Error: review",
  "mobile.chip.hint": "Opens the outbox",

  // Sync inbox (P28)
  "mobile.inbox.title": "Outbox",
  "mobile.inbox.lastConnection": "Last connection: {time}",
  "mobile.inbox.neverConnected": "No connection with the office yet",
  "mobile.inbox.problems": "Needs attention",
  "mobile.inbox.onPhone": "On the phone · {count}",
  "mobile.inbox.sent": "Sent · {count}",
  "mobile.inbox.tryNow": "Try now",
  "mobile.inbox.evidencePending":
    "Pending photo references: {count}. This does not confirm event delivery.",
  "mobile.inbox.evidenceError":
    "Some photo references are incomplete. Use Try now; if the file is unavailable, contact your coordinator.",
  "mobile.inbox.empty": "No records yet. What you capture will show up here.",
  "mobile.inbox.groupTitle": "{count} · {label}",
  "mobile.inbox.timeRange": "{from} to {to}",
  "mobile.inbox.offline":
    "No signal. Your records are saved and will be sent when the connection comes back.",
  "mobile.inbox.rejectionQuota":
    "The daily limit for records needing review was reached. Your records are still saved and will be sent after the office's waiting period.",
  "mobile.inbox.waitingRetry": "We couldn't reach the office. The app will try again by itself.",
  "mobile.inbox.parkedHint":
    "This record could not be sent as it is. Tap “Try now”; if it happens again, tell your supervisor.",

  // Why sending is paused
  "mobile.blocked.needsLogin":
    "Your session ended. Sign in so your records can be sent; nothing was lost.",
  "mobile.blocked.clockWrong":
    "The phone's date and time are not right. Fix them in the phone settings and your records will be sent by themselves.",
  "mobile.blocked.noServer":
    "The office address is not set. Set it in Settings so your records are sent; nothing was lost.",
  "mobile.blocked.forbidden":
    "Your account can't send records right now. Tell your supervisor; your records are saved.",

  // Status badges (sent, rejected and in review reuse `sync.inbox.*Title`)
  "mobile.status.pending": "To upload",
  "mobile.status.sending": "Sending",
  "mobile.status.error": "Could not send",

  // Record types (the `type` of an event)
  "mobile.eventType.recordVoid": "Voids",
  "mobile.eventType.shiftOpen": "Shift openings",
  "mobile.eventType.shiftClose": "Shift closings",
  "mobile.eventType.locationPing": "Locations",
  "mobile.eventType.suppliesReceive": "Supply receipts",
  "mobile.eventType.suppliesReconcile": "Supply reconciliations",
  "mobile.eventType.ovitrapPlace": "Ovitraps placed",
  "mobile.eventType.ovitrapCheck": "Ovitraps checked",
  "mobile.eventType.ovitrapReplace": "Ovitraps replaced",
  "mobile.eventType.ovitrapRelocate": "Ovitraps relocated",
  "mobile.eventType.ovitrapRemove": "Ovitraps removed",
  "mobile.eventType.releaseRecord": "Releases",
  "mobile.eventType.sampleCollect": "Samples",
  "mobile.eventType.fuelLoad": "Fuel loads",
  "mobile.eventType.incidentReport": "Incidents",
  "mobile.eventType.emergencyAccident": "Emergencies",
  "mobile.eventType.communityActivity": "Community activities",
  "mobile.eventType.unknown": "Other records",

  // Settings
  "mobile.settings.title": "Settings",
  "mobile.settings.darkMode": "Dark mode",
  "mobile.settings.darkModeHint": "For night or indoors",
  "mobile.settings.language": "Language",
  "mobile.settings.languageEs": "Español (México)",
  "mobile.settings.languageEn": "English",
  "mobile.settings.server": "Connection",
  "mobile.settings.serverHint": "Address from your supervisor, for example https://api.example.com",
  "mobile.settings.serverSave": "Save address",
  "mobile.settings.serverReset": "Use the build's",
  "mobile.settings.serverIdentityBound":
    "The office is part of this phone's identity and cannot be changed here. Call your supervisor.",
  "mobile.settings.serverSaved": "Address saved",
  "mobile.settings.serverInvalid":
    "The address is not valid. Write it in full, without a path, for example https://api.example.com",
  "mobile.settings.serverCleartext":
    "Use https. Only development builds allow plain http on private networks, for example http://192.168.1.20:8000.",

  // Test tools (development builds only)
  "mobile.dev.title": "Test tools (development builds only)",
  "mobile.dev.deviceId": "This phone's ID",
  "mobile.dev.addEvent": "Add a test record",
  // P1/P2 authentication and local unlock
  "mobile.login.title": "Sign in to your account",
  "mobile.login.username": "Username",
  "mobile.login.password": "Password",
  "mobile.login.showPassword": "Show",
  "mobile.login.hidePassword": "Hide",
  "mobile.login.forgotPassword": "Forgot your password?",
  "mobile.login.callSupervisor": "Call your supervisor. They can change it from the office.",
  "mobile.login.understood": "Understood",
  "mobile.login.enter": "Sign in",
  "mobile.login.waitingSignal": "Sign in · waiting for signal",
  "mobile.login.noSignal": "You need a signal the first time. After that you can unlock offline.",
  "mobile.login.wrongCredentials": "The username or password does not match. Check and try again.",
  "mobile.login.sessionEnded": "Your session was closed for security. Sign in again.",
  "mobile.login.deviceRevoked": "This phone was deactivated. Call your supervisor.",
  "mobile.login.cleanupFailed":
    "The phone could not prepare sign-in. Try again; your captured records remain saved.",
  "mobile.login.genericError": "We could not sign you in. Try again or call your supervisor.",
  "mobile.login.throttled": "Too many attempts. Wait {minutes} min and try again.",
  "mobile.login.throttledUnknown": "Too many attempts. Wait a moment and try again.",
  "mobile.login.clockSkew": "The phone's time does not match.",
  "mobile.login.differentUser":
    "This phone has records from another account. Call your supervisor before changing users.",
  "mobile.login.onlineRequired":
    "For security, sign in again with a signal. Your work is still saved on the phone.",
  "mobile.login.serverMissing":
    "The connection is not set up. Tap Set up connection or ask your supervisor.",
  "mobile.login.serverSettings": "Set up connection",
  "mobile.login.version": "Version {version}",
  "mobile.unlock.greeting": "Hello, {name}",
  "mobile.unlock.enterPin": "Enter your PIN",
  "mobile.unlock.wrongPin": "Incorrect PIN. You have {count} attempts left.",
  "mobile.unlock.passwordTitle": "Enter your password",
  "mobile.unlock.passwordRequired":
    "The limit of {count} PIN attempts was reached. For security, enter your full password.",
  "mobile.unlock.savedWork": "Your work is still saved on the phone.",
  "mobile.unlock.wrongSecret": "It does not match. Check and try again.",
  "mobile.unlock.biometric": "Use fingerprint",
  "mobile.unlock.biometricPrompt": "Unlock with your fingerprint",
  "mobile.unlock.cancel": "Cancel",
  "mobile.unlock.erase": "Erase",
  "mobile.unlock.createTitle": "Create your PIN",
  "mobile.unlock.createPin": "Enter a 4-digit PIN.",
  "mobile.unlock.confirmPin": "Confirm your PIN.",
  "mobile.unlock.trivialPin": "Choose 4 digits that are not identical or consecutive.",
  "mobile.unlock.pinMismatch": "The PINs do not match. Create your PIN again.",
  "mobile.unlock.pinProgress": "Digits entered: {count} of 4.",
  "mobile.unlock.idleWarning": "Locking in 1 minute.",
  "mobile.unlock.keepWorking": "Keep working",
  "mobile.unlock.resumeSetup": "Enter your password to finish creating your PIN.",
  "mobile.unlock.wrongPinLast": "Incorrect PIN. You have 1 attempt left.",
  "mobile.lifecycle.advisoryUnavailable":
    "Advisory unavailable for this instant and these rules. Capture can continue.",
  "mobile.lifecycle.advisoryFuture":
    "The capture instant is still in the office’s future. Retry later.",
  "mobile.lifecycle.advisoryAt":
    "Facts observed through {at}. Late facts or voids can change this observation.",
  "mobile.lifecycle.advisoryCounts": "Closed-house weeks: {weeks}. Point incidents: {incidents}.",
  "mobile.lifecycle.advisorySuggested":
    "Rules suggest considering relocation. Saving only creates a proposal.",
  "mobile.lifecycle.advisoryNotSuggested":
    "The available observation does not reach the advisory thresholds.",
  "mobile.lifecycle.legacyAdvisory":
    "Only partial local history is available; it does not establish the point incident total.",
  "mobile.lifecycle.decisionReasonUnknown": "Historical reason unavailable.",
  "mobile.lifecycle.decisionTimeUnknown": "Historical decision time unavailable.",
  "mobile.lifecycle.sourceVoided":
    "The source was voided: {at}. Proposal and evidence are retained.",
  "mobile.lifecycle.legacyDecision":
    "Earlier local record retained for audit; it does not prove office review.",
  "mobile.lifecycle.taskReferenceOnly":
    "Scheduled reference; it is not yet a current task assigned to you.",
  "mobile.lifecycle.taskAssigned": "Current task assigned to you and not completed.",
  "mobile.lifecycle.openTask": "View assigned task",
  "mobile.lifecycle.ingestAccepted": "Original ingestion result: accepted.",
  "mobile.lifecycle.ingestRejected": "Original ingestion result: rejected.",
  "mobile.lifecycle.ingestReview": "Original ingestion result: in review.",
  "mobile.lifecycle.reviewedTitle": "Later office decision",
  "mobile.lifecycle.effectApplied": "Effect applied after review.",
  "mobile.lifecycle.effectAdopted": "Earlier effect acknowledged; original provenance retained.",
  "mobile.lifecycle.effectDiscarded": "Work discarded by decision; its history is retained.",
  "mobile.lifecycle.effectIncident": "Incident opened; this does not accept the original capture.",
  "mobile.lifecycle.effectApproved": "Shift reviewed; it grants no new capture permission.",
  "mobile.lifecycle.effectObserved": "Shift observation recorded.",
  "mobile.lifecycle.approvalNotCurrent": "This validation is no longer the current approval.",
  "mobile.lifecycle.nonterminalDecision": "Informational decision; review can continue.",
  "mobile.lifecycle.limitsUnavailable":
    "Choose a downloaded reason with known limits before correcting.",
  "mobile.lifecycle.reasonLimits":
    "Minimum visible characters for this option: {min}. Note limit: {max} characters.",
  "mobile.lifecycle.epochClosed":
    "The quadrant is closed. New captures cannot be saved in this frame.",
  "mobile.lifecycle.epochUnknown":
    "A verifiable current frame is unavailable. Refresh; the draft is retained.",
  "mobile.lifecycle.recoveryBlocked":
    "The draft is retained, but ownership is unproven for this session. Sign in with the original account or contact support.",
  "mobile.lifecycle.remoteProposal":
    "Downloaded office proposal; it is not an editable local capture.",
  "mobile.supplyReceipt.title": "Receive supplies",
  "mobile.supplyReceipt.subtitle": "Sign only for what you physically received",
  "mobile.supplyReceipt.start": "Review this delivery",
  "mobile.supplyReceipt.resume": "Open saved receipt",
  "mobile.supplyReceipt.assignment": "Assignment",
  "mobile.supplyReceipt.release": "Warehouse release",
  "mobile.supplyReceipt.lot": "Lot",
  "mobile.supplyReceipt.piece": "Piece",
  "mobile.supplyReceipt.unit": "Declared unit",
  "mobile.supplyReceipt.expected": "Expected quantity",
  "mobile.supplyReceipt.actual": "Received quantity",
  "mobile.supplyReceipt.declaredUnits":
    "Use the unit declared in this delivery. Do not convert boxes to pieces. Codes and unit names are not available yet; check the identifiers with the warehouse.",
  "mobile.supplyReceipt.noAssignments":
    "No assigned deliveries are available in the downloaded copy. Refresh or return to your shift.",
  "mobile.supplyReceipt.unavailable":
    "A current authorized copy of your deliveries is unavailable. Refresh online or contact your supervisor. Your receipts are retained.",
  "mobile.supplyReceipt.refresh": "Refresh deliveries",
  "mobile.supplyReceipt.working": "Saving on the phone…",
  "mobile.supplyReceipt.save": "Save signed receipt on the phone",
  "mobile.supplyReceipt.saved":
    "Signed receipt saved on the phone. This does not yet confirm office receipt.",
  "mobile.supplyReceipt.serverReceived":
    "Initial acknowledgement: the office received the receipt. Check any supervisor review separately.",
  "mobile.supplyReceipt.review":
    "Initial acknowledgement: the office received the receipt for review. What you signed is retained; this acknowledgement alone does not confirm credited inventory.",
  "mobile.supplyReceipt.rejected":
    "The office did not apply the receipt. Your capture and signature are retained; check the inbox or contact your supervisor.",
  "mobile.supplyReceipt.pendingSignature":
    "The signature is saved on the phone and its file is still waiting to upload. Check or retry in the inbox.",
  "mobile.supplyReceipt.inbox": "Open sync inbox",
  "mobile.supplyReceipt.scanLabel": "Lot QR code",
  "mobile.supplyReceipt.scanHint":
    "You can also paste the complete QR content or enter the lot UUID. A label code without confirmed identification is not added.",
  "mobile.supplyReceipt.scan": "Validate lot QR",
  "mobile.supplyReceipt.manual": "Validate lot UUID manually",
  "mobile.supplyReceipt.duplicate": "This code is already recorded. Another piece was not added.",
  "mobile.supplyReceipt.added":
    "Code recognized. Review the quantity in its declared unit before signing.",
  "mobile.supplyReceipt.invalid":
    "We could not validate this code for your delivery. Nothing was added. Check the identifier with the warehouse or your supervisor.",
  "mobile.supplyReceipt.discrepancy": "Explain any difference",
  "mobile.supplyReceipt.missing": "Missing material",
  "mobile.supplyReceipt.damaged": "Arrived damaged",
  "mobile.supplyReceipt.other": "Other (specify)",
  "mobile.supplyReceipt.discrepancyText": "Explanation of the difference",
  "mobile.supplyReceipt.discrepancyHint":
    "Sign the actual quantities. The office retains the difference for review; do not change quantities to make them match.",
  "mobile.supplyReceipt.photo": "Photograph the damage",
  "mobile.supplyReceipt.photoSaved":
    "Damage photo retained only on the phone. It cannot be submitted with this receipt yet; contact your supervisor.",
  "mobile.supplyReceipt.signatureTitle": "Receipt signature",
  "mobile.supplyReceipt.signatureHint":
    "Sign here with your finger or photograph your handwritten signature. The signature covers the quantities and differences shown above.",
  "mobile.supplyReceipt.signatureCapture": "Keep this signature",
  "mobile.supplyReceipt.signaturePhoto": "Photograph my handwritten signature",
  "mobile.supplyReceipt.signatureSaved": "Signature retained on the phone",
  "mobile.supplyReceipt.undo": "Undo last stroke",
  "mobile.supplyReceipt.clear": "Start signature again",
  "mobile.supplyReceipt.signatureRequired":
    "Your signature is missing. Sign with your finger or photograph your handwritten signature before saving.",
  "mobile.supplyReceipt.quantityInvalid":
    "Check quantities in their declared unit. A piece accepts only zero or one; other quantities accept up to six decimals within the delivery.",
  "mobile.supplyReceipt.discrepancyRequired":
    "Declare the reason for the difference before signing the receipt.",
  "mobile.supplyReceipt.otherRequired": "Write an explanation for Other before saving.",
  "mobile.supplyReceipt.evidenceRequired":
    "A damage photo is missing. Take it before signing; the rest of your capture is retained.",
  "mobile.supplyReceipt.staleDraft":
    "The capture changed while you were working. Review the retained receipt and try again.",
  "mobile.supplyReceipt.shiftRequired":
    "Open an authorized shift before receiving supplies. Your draft is retained.",
  "mobile.supplyReceipt.configurationRequired":
    "Downloaded lists or rules are missing. Refresh online before signing.",
  "mobile.supplyReceipt.startScanner": "Scan QR with camera",
  "mobile.supplyReceipt.scannerTitle": "Scan a lot in this delivery",
  "mobile.supplyReceipt.scannerHint":
    "Point at the lot QR code. The reader closes after each read; check the quantity before signing.",
  "mobile.supplyReceipt.stopScanner": "Close reader and return to receipt",
  "mobile.supplyReceipt.scannerPermission":
    "Camera permission is unavailable. Enable it in Settings or enter the identifier manually.",
  "mobile.supplyReceipt.scannerRetry":
    "Unlock the phone and reopen the reader from this receipt. Manual identifier entry remains available.",
  "mobile.supplyReceipt.scannerUnavailable":
    "We could not open the camera. Retry or enter the identifier manually.",
  "mobile.supplyReceipt.reviewedAccepted": "Later review: receipt accepted by the supervisor.",
  "mobile.supplyReceipt.reviewedVoided":
    "Later review: receipt voided by the supervisor. The signed capture is retained.",
  "mobile.supplyReceipt.incidentOpen":
    "Later review: an incident was opened. This does not accept or void the receipt.",
  "mobile.fuel.title": "Add fuel",
  "mobile.fuel.subtitle": "Offline capture · current shift motorcycle",
  "mobile.fuel.motorcycle": "Motorcycle",
  "mobile.fuel.motorcycleFixed":
    "This motorcycle belongs to your open shift and cannot be changed here.",
  "mobile.fuel.litres": "Litres (L)",
  "mobile.fuel.amount": "Amount (MXN)",
  "mobile.fuel.odometer": "Current odometer (km)",
  "mobile.fuel.fullRefill": "Did you fill the tank?",
  "mobile.fuel.fullRefillYes": "Yes · full tank",
  "mobile.fuel.fullRefillNo": "No · partial fill",
  "mobile.fuel.receipt": "Receipt photo",
  "mobile.fuel.receiptPreview": "Private preview of this fuel receipt",
  "mobile.fuel.receiptCheck":
    "Check that the numbers are readable. If blurry, retake the photo with more light and hold still; your quantities are retained.",
  "mobile.fuel.receiptSaved": "The original receipt photo is retained with this load.",
  "mobile.fuel.noReceiptSaved":
    "This load was saved without a receipt photo; its receipt remains pending.",
  "mobile.fuel.noReceipt":
    "No receipt photo. Retry the camera or save the load with its receipt pending.",
  "mobile.fuel.takePhoto": "Take receipt photo",
  "mobile.fuel.retake": "Retake receipt photo",
  "mobile.fuel.previewUnavailable":
    "We could not show the preview. Its reference is retained; check the photo before saving or take it again.",
  "mobile.fuel.photoUnavailable":
    "We could not open the camera. Retry; your quantities and previous photo are retained.",
  "mobile.fuel.insufficient":
    "Insufficient efficiency data: consecutive full fills with a known distance are required. You can save the load and close your shift.",
  "mobile.fuel.unconfigured":
    "Efficiency limits for this interval have not been downloaded. You can save; the office will review the load when received.",
  "mobile.fuel.decreased":
    "The odometer is below the previous reading. Check the number; you can keep it and save the load.",
  "mobile.fuel.efficiencyOk": "Comparable-interval efficiency is within the advisory limits.",
  "mobile.fuel.efficiencyReview":
    "Efficiency is outside the advisory range. Check litres and odometer; you can save as entered and close your shift.",
  "mobile.fuel.saved": "Saved on the phone · awaiting office receipt.",
  "mobile.fuel.serverReceived": "Fuel load received at the office.",
  "mobile.fuel.reviewPending":
    "Received at the office · awaiting review. Your quantities are retained.",
  "mobile.fuel.rejected":
    "The office rejected this load. The capture is retained; check the inbox reason and contact your supervisor.",
  "mobile.fuel.receiptPending":
    "Receipt upload or verification pending; this is not a review of the fuel load.",
  "mobile.fuel.receiptVerified":
    "Receipt photo verified by the office; this is not a review of the fuel load.",
  "mobile.fuel.reviewedAccepted": "Later review: fuel load accepted by the supervisor.",
  "mobile.fuel.reviewedVoided": "Later review: fuel load voided. The original capture is retained.",
  "mobile.fuel.incidentOpen":
    "Later review: an incident was opened; the fuel load is neither accepted nor voided.",
  "mobile.fuel.litresInvalid":
    "Enter litres greater than zero with up to three decimal places and no thousands separators.",
  "mobile.fuel.amountInvalid":
    "Enter an amount greater than zero with up to two decimal places and no thousands separators.",
  "mobile.fuel.odometerInvalid":
    "Enter whole kilometres from 0 to 999999 without thousands separators.",
  "mobile.fuel.unavailable":
    "Your shift or downloaded context does not authorize this capture. Check your shift and retry; the draft is retained.",
  "mobile.fuel.shiftRequired":
    "Open an authorized shift before adding fuel. Your draft is retained.",
  "mobile.fuel.staleDraft":
    "The capture changed while you were working. Review the retained draft and retry.",
  "mobile.fuel.draftSaved": "Draft on this phone · check the values before saving the load.",
  "mobile.fuel.draftPending": "Changes still need saving on the phone. Retry before leaving.",
  "mobile.fuel.empty": "There is no fuel entry yet. Start one for your current shift motorcycle.",
  "mobile.fuel.begin": "Start fuel entry",
  "mobile.fuel.beginAnother": "Capture another load",
  "mobile.fuel.save": "Save fuel load",
  "mobile.fuel.working": "Saving on the phone…",
  "mobile.fuel.saveHint": "Save retains the load on this phone. Upload and review happen later.",
  "mobile.fuel.inbox": "See what I sent",
  "mobile.incidents.title": "Report a problem",
  "mobile.incidents.subtitle": "Local capture and conversation with your team",
  "mobile.incidents.emergency": "Emergency",
  "mobile.incidents.emergencyHint":
    "Get to safety. Saving does not confirm anyone received an alert.",
  "mobile.incidents.report": "Incident",
  "mobile.incidents.accident": "Accident",
  "mobile.incidents.unavailable":
    "Capture is unavailable with the current context. Drafts are retained; unlock the app or refresh your shift.",
  "mobile.incidents.shiftRequired":
    "Open or review your shift to report. The work-contact call does not require saving a report.",
  "mobile.incidents.staleDraft":
    "The capture changed while you worked. Previous content is retained; reopen it before retrying.",
  "mobile.incidents.typeRequired": "Choose an incident type.",
  "mobile.incidents.descriptionRequired": "Describe what happened to save the incident.",
  "mobile.incidents.descriptionLong": "Shorten the description to 4000 characters and save again.",
  "mobile.incidents.evidenceLimit":
    "A capture supports up to 100 photos. Retain the rest on the phone.",
  "mobile.incidents.photoUnavailable":
    "The camera could not open. The capture is retained; retry when safe.",
  "mobile.incidents.saved": "Saved on the phone: waiting to upload.",
  "mobile.incidents.serverReceived": "Received at the office.",
  "mobile.incidents.reviewPending":
    "Received at the office: review required. The original capture is retained.",
  "mobile.incidents.rejected":
    "The office did not accept the report. It remains on the phone; review the reason in the inbox.",
  "mobile.incidents.evidencePending":
    "Photos await verification. The capture remains saved; use the inbox to retry upload.",
  "mobile.incidents.noDeliveryPromise":
    "Receiving a report does not confirm your supervisor read it or help is on its way.",
  "mobile.incidents.description": "Description of what happened",
  "mobile.incidents.optionalDescription": "Optional accident details",
  "mobile.incidents.searchTypes": "Search incident types",
  "mobile.incidents.noTypeMatches": "No matching types. Change your search.",
  "mobile.incidents.noTypes":
    "No downloaded types are available. Refresh types online or ask an administrator to review configuration.",
  "mobile.incidents.chooseType": "Choose type",
  "mobile.incidents.type": "Incident type",
  "mobile.incidents.otherHint": "Other requires an explanation in the description.",
  "mobile.incidents.evidence": "Evidence photos",
  "mobile.incidents.evidenceMinimum": "Configured minimum photos for this type:",
  "mobile.incidents.evidenceMissing":
    "Required evidence is missing. You can retain the report; the office may send it for review.",
  "mobile.incidents.uploadUnavailable":
    "Your current context does not allow photo attachments. Keep the details and ask your supervisor for support.",
  "mobile.incidents.takePhoto": "Add photo",
  "mobile.incidents.photoPreview": "Incident evidence preview",
  "mobile.incidents.previewUnavailable":
    "This photo could not be displayed. The file is retained; review the capture before saving.",
  "mobile.incidents.originalTime": "Original capture time (UTC)",
  "mobile.incidents.gpsCaptured": "The available location was saved with the capture.",
  "mobile.incidents.noGps": "No location was available. No location was inferred for this report.",
  "mobile.incidents.mine": "My incidents and comments",
  "mobile.incidents.pageHint":
    "Only your reports available on the downloaded page. Refresh online for replies; this list may be incomplete.",
  "mobile.incidents.repliesUnavailable":
    "Team comments are retrieved online. Replying from mobile is not available yet.",
  "mobile.incidents.noIncidents": "You have not reported anything today.",
  "mobile.incidents.readUnavailable":
    "The current context does not allow reading this conversation. Drafts remain saved.",
  "mobile.incidents.readFailed":
    "Refresh could not complete. The capture and still-authorized phone content are retained. Retry online.",
  "mobile.incidents.refreshing": "Refreshing types and comments...",
  "mobile.incidents.refresh": "Refresh types, contact and comments",
  "mobile.incidents.onPhone": "Captures retained on this phone",
  "mobile.incidents.draftPending":
    "Some text is waiting to save. Retry before closing the capture.",
  "mobile.incidents.draftSaved": "Draft saved on the phone. Save the report to queue its upload.",
  "mobile.incidents.empty":
    "Start a report to choose its type, describe what happened and attach evidence.",
  "mobile.incidents.accidentHint":
    "You can save an accident without photos or details. No signal never confirms alert delivery.",
  "mobile.incidents.saveHint":
    "Save retains the report on this phone. Upload and review happen later.",
  "mobile.incidents.working": "Saving on the phone...",
  "mobile.incidents.save": "Save report on the phone",
  "mobile.incidents.begin": "Start report",
  "mobile.incidents.beginAccident": "Capture accident",
  "mobile.incidents.safeClose": "Continue to shift closure",
  "mobile.incidents.callWorkContact": "Call configured work contact",
  "mobile.incidents.dialerOpened":
    "The phone dialer opened. This confirms neither a call nor receipt of an alert; device and network availability apply.",
  "mobile.incidents.dialerUnavailable":
    "The call could not open. Use the device phone app and seek help when safe. The report is retained.",
  "mobile.incidents.contactMissing":
    "No validated work phone is available. No emergency number is configured for this app.",
  "mobile.incidents.callFallback":
    "If you need immediate help, use the device phone app and an emergency contact you know. Calls depend on the device and network.",
  "mobile.history.title": "My history",
  "mobile.history.search": "Search code or reference",
  "mobile.history.partial":
    "Partial local copy: saved, received and reviewed records have separate states.",
  "mobile.history.failed":
    "Could not refresh. Your captures are retained; retry with a connection.",
  "mobile.history.refresh": "Refresh history",
  "mobile.history.allShifts": "Back to shifts",
  "mobile.history.noMatches": "No matches in this copy. Change the search or refresh online.",
  "mobile.history.unavailable":
    "History unavailable. Refresh online or ask your supervisor to check access.",
  "mobile.history.unknownTime": "Date unavailable",
  "mobile.history.shift": "Shift",
  "mobile.history.openShift": "View events and observations",
  "mobile.history.reviewed": "Reviewed",
  "mobile.history.voided": "Voided",
  "mobile.history.observed": "Observed",
  "mobile.history.received": "Received by office",
  "mobile.history.serverFact": "Office observation",
  "mobile.history.author": "Author (name or reference)",
  "mobile.history.unavailableValue": "Unavailable",
  "mobile.history.reference": "Original reference",
  "mobile.history.reason": "Reason or observation",
  "mobile.history.voids": "Corrects reference",
  "mobile.settings.textSize": "Text size",
  "mobile.settings.textSystem": "Same as phone",
  "mobile.settings.textLarge": "Additional 30 % larger text",
  "mobile.settings.saveFailed":
    "Could not save your preference. The previous selection is retained; choose again to retry.",
  "mobile.settings.readFailed":
    "Could not read local state. Retry; you can lock access without deleting your captures.",
  "mobile.settings.version": "Running app version",
  "mobile.settings.updaterUnavailable": "We could not check for an update. Contact support.",
  "mobile.settings.support": "Organization support contact",
  "mobile.settings.supportUnavailable": "No contact configured. Ask your supervisor for help.",
  "mobile.settings.pendingWork": "Work retained on this phone",
  "mobile.settings.events": "Records awaiting receipt",
  "mobile.settings.files": "Files awaiting verification or binding",
  "mobile.settings.drafts": "Drafts not yet saved as records",
  "mobile.settings.lockHint":
    "Closing access locks this phone. Drafts, files and uploads are retained; unlock with your PIN to continue. The office session keeps its original lifetime.",
  "mobile.settings.viewUploads": "View uploads and observations",
  "mobile.settings.lockAccess": "Close local access and retain work",

  // Speed lock and global states (M-16)
  "mobile.global.levelBlocking": "Blocked",
  "mobile.global.levelWarning": "Warning",
  "mobile.global.levelInfo": "Information",
  "mobile.global.causeSpeedLock": "You are moving too fast.",
  "mobile.global.causeSessionEnded": "Your session ended; your drafts and uploads are still saved.",
  "mobile.global.causeStorageFull": "The phone is almost out of space; saving is not safe.",
  "mobile.global.causeStorageLow": "The phone is running low on space.",
  "mobile.global.causeUpdateRequired": "A required app update is available.",
  "mobile.global.causeUpdateAvailable": "A new app version is available.",
  "mobile.global.causeClockSkew":
    "The phone clock does not match the office; your records will go to review.",
  "mobile.global.causeGpsOff": "Location is turned off.",
  "mobile.global.causeGpsDenied": "The app has no location permission.",
  "mobile.global.causeGpsSearching": "Looking for your location…",
  "mobile.global.causeGpsUnreliable": "Looking for your location…",
  "mobile.global.causeBatteryLow": "Low battery.",
  "mobile.global.causeNoSignal":
    "No signal: nothing is lost, everything uploads when there is network.",
  "mobile.global.nextStopMoving":
    "Stop somewhere safe; after a few seconds you return to the same step.",
  "mobile.global.nextSignIn": "Sign in to continue where you left off.",
  "mobile.global.nextFreeSpace": "Free up space on the phone and try again.",
  "mobile.global.nextInstallWhenSignal": "You keep working; it installs when there is signal.",
  "mobile.global.nextInstallWhenClosing": "Install it when you close the shift.",
  "mobile.global.nextKeepWorkingReview":
    "You can continue; today's records will be in review, no blame.",
  "mobile.global.nextEnableLocation": "Turn on location in the phone settings.",
  "mobile.global.fixEnableLocation": "Turn on",
  "mobile.global.fixAllowLocation": "Allow",
  "mobile.global.fixAllowCamera": "Allow",
  "mobile.global.fixOpenSettings": "Settings",
  "mobile.global.fixFreeSpace": "Free up",
  "mobile.global.fixNetwork": "Settings",
  "mobile.global.nextWaitForFix": "If it takes long, go somewhere open.",
  "mobile.global.nextChargeOrSaveBattery": "Charge the phone or lower the brightness.",
  "mobile.global.nextKeepWorkingSaved": "Keep working; what is saved on the phone is not lost.",
  "mobile.global.more": "{count} more notices",
  "mobile.speedLock.title": "Stop to keep capturing",
  "mobile.speedLock.body":
    "Once you stop for a few seconds you return to the same step. Nothing captured is lost.",
  "mobile.speedLock.speed": "Current speed: {speed} km/h",
  "mobile.speedLock.limit": "Configured limit: {limit} km/h",
  "mobile.speedLock.emergencyOnly": "Only the emergency call is available while you are moving.",
  "mobile.map.label": "Map of your points and zones",
  "mobile.map.loading": "Getting the map ready...",
  "mobile.map.unavailable": "The map is not available right now",
  "mobile.map.unavailableHint": "Connect once to save it on the phone.",
  "mobile.map.retry": "Try again",
  "mobile.map.attribution": "© OpenStreetMap contributors",
  "mobile.map.zone": "{name}",
};
