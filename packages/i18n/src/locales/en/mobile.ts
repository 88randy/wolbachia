/** English messages of the `mobile` area: exactly the keys of `../es-MX/mobile.ts`. */
import type { mobile as source } from "../es-MX/mobile.ts";

export const mobile: Record<keyof typeof source, string> = {
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
};
