/** English messages of the `mobile` area: exactly the keys of `../es-MX/mobile.ts`. */
import type { mobile as source } from "../es-MX/mobile.ts";

export const mobile: Record<keyof typeof source, string> = {
  "mobile.shiftClose.refreshSupplies": "Refresh downloaded receipts",
  "mobile.shiftClose.sourceFrame": "Downloaded confirmed balance; additional declarations are shown below.",

  "mobile.shiftClose.title": "Close shift",
  "mobile.shiftClose.closedTitle": "Shift closed",
  "mobile.shiftClose.phoneClosed": "Closed on the phone",
  "mobile.shiftClose.serverReceived": "Server received the closing records",
  "mobile.shiftClose.inReview": "Server received a record for review",
  "mobile.shiftClose.rejected": "A record was rejected. Check the inbox; the shift remains closed on the phone.",
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
  "mobile.shiftClose.differenceAllowed": "Differences remain for review and do not prevent closure. A return is a declaration; the warehouse confirms receipt.",
  "mobile.shiftClose.suppliesUnavailable": "No downloaded receipt is linked to this shift. Balances and reconciliation remain unconfirmed; you can close.",
  "mobile.shiftClose.returnQuantity": "Additional return quantity",
  "mobile.shiftClose.returnDestination": "Return to the original warehouse",
  "mobile.shiftClose.odometer": "Closing odometer (km)",
  "mobile.shiftClose.note": "Closing note (optional)",
  "mobile.shiftClose.lowOdometer": "Odometer is below the opening reading. It will be retained for review; you can close on the phone.",
  "mobile.shiftClose.confirmTitle": "Close this shift?",
  "mobile.shiftClose.confirmHint": "This phone will save the closure and stop capture and location collection for this shift. Pending points will not be completed.",
  "mobile.shiftClose.close": "Close shift on the phone",
  "mobile.shiftClose.continue": "Review and confirm closure",
  "mobile.shiftClose.retryHint": "Pending records retry when the session and connection return. Keep the app installed. Check the inbox for pending attachments and rejections.",
  "mobile.shiftClose.reviewHistory": "Review history",
  "mobile.shiftClose.notReviewed": "No downloaded supervisor decision.",
  "mobile.shiftClose.observed": "Observed by supervisor",
  "mobile.shiftClose.approved": "Current approval",
  "mobile.shiftClose.staleApproval": "Earlier approval; new review required",
  "mobile.shiftClose.noShift": "No local shift to close. Return home.",
  "mobile.shiftClose.saveFailed": "The change was not saved. Your input is retained. Check pending points, quantities and reasons, then retry; if it continues, check storage with your supervisor.",
  "mobile.shiftClose.shrinkageQuantity": "Additional shrinkage quantity",
  "mobile.shiftClose.reason": "Shrinkage reason (10 to 1000 characters)",
  "mobile.shiftClose.photo": "Take shrinkage photo",
  "mobile.shiftClose.photoRequired": "Shrinkage requires a photo and a catalog reason.",
  "mobile.shiftClose.photoSaved": "Photo saved on phone; delivery pending",
  "mobile.shiftOpen.closed": "This shift is closed on the phone. Open its summary.",

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
    "Recovery remains unresolved. Unconfirmed is retained on the phone and reported as unrecovered to the server.",
  "mobile.lifecycle.reason": "Reason from the downloaded catalog",
  "mobile.lifecycle.chooseReason": "Choose reason",
  "mobile.lifecycle.other": "Other: describe the reason (1000 characters maximum)",
  "mobile.lifecycle.incidentNotice":
    "The server links the finding to an incident when it applies the capture. The phone does not create an incident.",
  "mobile.lifecycle.photoRequired": "Add at least one photo for this capture before saving.",
  "mobile.lifecycle.capturePhoto": "Add evidence photo",
  "mobile.lifecycle.discardPhoto": "Remove draft photo",
  "mobile.lifecycle.photoDiscarded": "Photo removed from the draft. You can undo this.",
  "mobile.lifecycle.undo": "Undo",
  "mobile.lifecycle.reviewAcknowledge":
    "I understand that GPS, distance or outdated rules require server review.",
  "mobile.lifecycle.download": "Download lifecycle catalogs and rules",
  "mobile.lifecycle.adopt": "Review and use downloaded catalogs and rules",
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
  "mobile.lifecycle.reviewAccepted": "Server result: accepted. Supervisor review: unconfirmed.",
  "mobile.lifecycle.reviewRejected":
    "Server result: rejected. Keep the evidence and contact your supervisor.",
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
  "mobile.lifecycle.noReasons": "The reason catalog is missing. Download it before continuing.",

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
    "A lagged paddle still goes to the lab and remains countable. The server determines its exclusion from indices.",
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
    "The evidence camera is unavailable in this build. Keep the draft and ask for help if the catalog requires a photo.",
  "mobile.ovitrap.refresh": "Download catalogs and rules",
  "mobile.ovitrap.adopt": "Review and use downloaded versions",
  "mobile.ovitrap.catalogChanged":
    "A newer catalog is available. Your answers and historical labels are retained; review before changing versions.",
  "mobile.ovitrap.confirm": "Review before saving",
  "mobile.ovitrap.phoneSaved": "Saved on phone",
  "mobile.ovitrap.serverPending": "Server receipt: pending",
  "mobile.ovitrap.serverReceived": "Received by server",
  "mobile.ovitrap.reviewPending": "Review: pending; ask your supervisor for help",
  "mobile.ovitrap.reviewUnknown": "Supervisor review: not confirmed",
  "mobile.ovitrap.repeat":
    "This ovitrap already has a reading this week. You can void it with a reason and record a new reading. Original evidence is retained.",
  "mobile.ovitrap.correct": "Void with reason and record new",
  "mobile.ovitrap.reason": "Reason: 10 visible characters to 1000 characters",
  "mobile.ovitrap.reasonCode": "Catalog reason",
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
    "This ovitrap point is unknown on the phone. The server will review location and scope; compliance is not confirmed.",
  "mobile.ovitrap.acknowledge": "I understand this capture needs server review",
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
  "mobile.ovitrap.gateCatalog": "The catalog is missing. Download it before saving.",
  "mobile.ovitrap.gateRules": "Usable rules are missing. Download them before saving.",
  "mobile.ovitrap.gatePoint": "Choose an allowed point and verify supply references.",
  "mobile.ovitrap.gateFinding": "Choose a finding from the saved catalog.",
  "mobile.ovitrap.gatePaddle": "Confirm egg paddle presence and type.",
  "mobile.ovitrap.gateEggs": "Confirm Yes or No: does it have eggs?",
  "mobile.ovitrap.gateBag": "Enter the human bag code.",
  "mobile.ovitrap.gateConditions":
    "Check temperature and humidity. Humidity must be between 0 and 100%.",
  "mobile.ovitrap.gateOther": "Other requires a description of up to 1000 characters.",
  "mobile.ovitrap.gatePrepare": "Complete preparation before saving.",
  "mobile.ovitrap.gateEvidence":
    "This catalog requires photo evidence. Keep the draft and ask for help.",
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
  "mobile.day.mapFailed": "Could not verify the saved map. Retry or use the list.",
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
  "mobile.day.serverReceived": "Server received · review is separate",
  "mobile.day.receiptRejected": "Capture rejected. See the pending inbox for details.",
  "mobile.day.captureInReview": "Capture under server review",
  "mobile.day.reviewUnconfirmed": "Server review unconfirmed",
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
    "No verified map file is available. Retry verification or use the point list.",
  "mobile.day.retryMap": "Reverify map",
  "mobile.day.outsideCoverage": "Outside downloaded coverage",
  "mobile.day.attribution": "© OpenStreetMap contributors",
  "mobile.day.mapLabel": "Offline map of assigned points",
  "mobile.day.locationDenied": "Location permission denied. You can keep using the list.",
  "mobile.day.locationUnavailable": "Location unavailable. You can keep using the list.",
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
    "The catalog changed. Review the items and confirm the new version. If a captured fault is no longer listed, ask your supervisor for help; the evidence is retained.",
  "mobile.shiftOpen.confirmCatalog": "Confirm catalog and review again",
  "mobile.shiftOpen.start": "Open shift",
  "mobile.shiftOpen.resume": "Resume opening",
  "mobile.shiftOpen.noShift": "No open shift",
  "mobile.shiftOpen.opened": "Shift saved on this phone",
  "mobile.shiftOpen.noAssignment":
    "Zone assignments are not available in this build yet. You can prepare your shift.",
  "mobile.shiftOpen.inbox": "View uploads",
  "mobile.shiftOpen.motorcycleTitle": "Step 1 of 4 · Your motorcycle",
  "mobile.shiftOpen.motorcycleHint":
    "Enter and confirm the motorcycle code. At sync, the server checks whether it exists, is blocked or is in use.",
  "mobile.shiftOpen.motorcycleCode": "Motorcycle code",
  "mobile.shiftOpen.continue": "Continue",
  "mobile.shiftOpen.checklistTitle": "Step 2 of 4 · Check your motorcycle",
  "mobile.shiftOpen.unconfigured":
    "The safety checklist is not configured. Download the catalog or ask your supervisor to configure it. You cannot depart.",
  "mobile.shiftOpen.catalogUnavailable":
    "The catalog could not be updated. The last saved copy is retained. Check your session and connection, then retry.",
  "mobile.shiftOpen.refreshCatalog": "Update safety catalog",
  "mobile.shiftOpen.ok": "OK",
  "mobile.shiftOpen.minor": "Minor fault",
  "mobile.shiftOpen.severeResult": "Severe fault",
  "mobile.shiftOpen.note": "Note (optional)",
  "mobile.shiftOpen.requiredNote": "Required note",
  "mobile.shiftOpen.odometerTitle": "Step 3 of 4 · Opening odometer",
  "mobile.shiftOpen.photoHint":
    "The odometer photo is optional unless the catalog requires evidence. Saved photos stay on this phone.",
  "mobile.shiftOpen.capturePhoto": "Take photo",
  "mobile.shiftOpen.photoUnavailable":
    "The camera is not available in this build. Your input is retained; if a photo is required, departure stays blocked.",
  "mobile.shiftOpen.photoCount": "Photos saved on this phone:",
  "mobile.shiftOpen.odometerKm": "Odometer km (whole number)",
  "mobile.shiftOpen.lastOdometer": "Last odometer known to this phone:",
  "mobile.shiftOpen.unknownOdometer": "No local reference; the server will check at sync.",
  "mobile.shiftOpen.odometerWarning":
    "This is below the last known reading. Check it; you can continue without losing it. The server may flag it for review.",
  "mobile.shiftOpen.mapsTitle": "Step 4 of 4 · Prepare map",
  "mobile.shiftOpen.mapReady":
    "Map verified with coverage. You may continue once the motorcycle checklist is complete.",
  "mobile.shiftOpen.mapUnavailable":
    "The map is not ready. This build has no map manifest. You cannot depart; retry when it is available.",
  "mobile.shiftOpen.mapPreparing":
    "Preparing map. Departure stays blocked until files and coverage are verified.",
  "mobile.shiftOpen.mapFailed":
    "Map preparation failed. Progress is retained. Check your connection and retry.",
  "mobile.shiftOpen.mapIncomplete":
    "Verified files or coverage are missing. Prepare the map again before departure.",
  "mobile.shiftOpen.mapProgress": "Preparation progress (%):",
  "mobile.shiftOpen.recordSevere": "Save severe fault · Do not depart",
  "mobile.shiftOpen.severe":
    "You cannot depart with this motorcycle. Save the severe fault and contact your supervisor to arrange fleet clearance. Saving does not confirm server receipt.",
  "mobile.shiftOpen.editChecklist": "Return to motorcycle selection and checklist",
  "mobile.shiftOpen.motorcycle":
    "Confirm the motorcycle code. If the local copy shows a block, ask your supervisor for help.",
  "mobile.shiftOpen.checklist": "Answer every safety item before continuing.",
  "mobile.shiftOpen.noteGate": "Describe the severe fault or Other before saving.",
  "mobile.shiftOpen.photo":
    "The catalog requires a photo. Capture it before departure; this build has no camera support.",
  "mobile.shiftOpen.odometer": "Enter kilometers as a whole number. Your input is retained.",
  "mobile.shiftOpen.map":
    "Departure requires verified map files and full coverage. Retry preparation.",
  "mobile.shiftOpen.rejected":
    "The server rejected the opening. Check Uploads for the outcome and contact your supervisor before departure.",
  "mobile.shiftOpen.phoneSaved": "Saved on phone · Awaiting server receipt",
  "mobile.shiftOpen.serverReceived": "Received by server · Check the outcome",
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
    "The server address is not set. Set it in Settings so your records can be sent.",

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
  "mobile.inbox.neverConnected": "No connection with the server yet",
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
    "The daily limit for records needing review was reached. Your records are still saved and will be sent after the server's waiting period.",
  "mobile.inbox.waitingRetry": "We couldn't reach the server. The app will try again by itself.",
  "mobile.inbox.parkedHint":
    "This record could not be sent as it is. Tap “Try now”; if it happens again, tell your supervisor.",

  // Why sending is paused
  "mobile.blocked.needsLogin":
    "Your session ended. Sign in so your records can be sent; nothing was lost.",
  "mobile.blocked.clockWrong":
    "The phone's date and time are not right. Fix them in the phone settings and your records will be sent by themselves.",
  "mobile.blocked.noServer":
    "The server address is not set. Set it in Settings so your records are sent; nothing was lost.",
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
  "mobile.settings.server": "Server",
  "mobile.settings.serverHint": "API address, for example https://api.example.com",
  "mobile.settings.serverSave": "Save address",
  "mobile.settings.serverReset": "Use the build's",
  "mobile.settings.serverIdentityBound":
    "The server is part of this phone's identity and cannot be changed here. Call your supervisor.",
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
  "mobile.login.logo": "[Codequim logo]",
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
    "The server is not configured. Open server settings or call your supervisor.",
  "mobile.login.serverSettings": "Configure server",
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
    "The capture instant is still in the server’s future. Retry later.",
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
    "Earlier local record retained for audit; it does not prove server review.",
  "mobile.lifecycle.taskReferenceOnly":
    "Scheduled reference; it is not yet a current task assigned to you.",
  "mobile.lifecycle.taskAssigned": "Current task assigned to you and not completed.",
  "mobile.lifecycle.openTask": "View assigned task",
  "mobile.lifecycle.ingestAccepted": "Original ingestion result: accepted.",
  "mobile.lifecycle.ingestRejected": "Original ingestion result: rejected.",
  "mobile.lifecycle.ingestReview": "Original ingestion result: in review.",
  "mobile.lifecycle.reviewedTitle": "Later server decision",
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
    "Downloaded server proposal; it is not an editable local capture.",
};
