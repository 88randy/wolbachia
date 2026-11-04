/**
 * English catalog. It must define exactly the keys of `es-MX.ts`:
 * a missing or extra key fails `tsc`.
 */
import type { MessageKey } from "./es-MX.ts";

export const en: Record<MessageKey, string> = {
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

  // API errors: the API returns `code` + `params`, never text
  "errors.api.generic": "We couldn't complete the action. Please try again.",
  "errors.api.network": "We can't reach the server. Check your signal and try again.",
  "errors.api.validation": "Some data is not valid. Review the highlighted fields and fix them.",
  "errors.api.notFound": "We couldn't find what you're looking for. Go back and try again.",
  "errors.api.permissionDenied":
    "You don't have permission to do this. Ask your supervisor for access.",
  "errors.api.blocked": "This action is blocked for now. Who can unblock it: {role}.",
  "errors.api.sessionRevoked": "Your session ended. Sign in again to continue.",
  "errors.api.rateLimited": "Too many requests in a row. Wait a moment and try again.",
  "errors.api.serverError":
    "Something went wrong on our side. Try again in a few minutes; if it keeps happening, contact support.",

  // Web shell: brand, skip link, sidebar, top bar
  "shell.brand.name": "Wolbachia",
  "shell.brand.mark": "CQ",
  "shell.a11y.skipToContent": "Skip to content",
  "shell.nav.label": "Main navigation",
  "shell.sidebar.collapse": "Collapse menu",
  "shell.topBar.searchLabel": "Search",
  "shell.topBar.searchPlaceholder": "Search or scan",
  "shell.topBar.notificationsSoon": "Not available yet.",
  "shell.topBar.notifications": "Notifications",
  "shell.language.toEnglish": "ES: change language to English",
  "shell.language.toSpanish": "EN: change language to Spanish",

  // Web shell: sidebar groups and areas (one entry per area of web/README.md)
  "shell.group.operation": "Operation",
  "shell.group.resources": "Resources",
  "shell.group.analysis": "Analysis and administration",
  "shell.nav.home": "Home",
  "shell.nav.incidents": "Incidents",
  "shell.nav.operations": "Supervision",
  "shell.nav.quadrants": "Quadrants and sampling",
  "shell.nav.releases": "Releases",
  "shell.nav.community": "Community",
  "shell.nav.inventory": "Inventory",
  "shell.nav.fleet": "Fleet",
  "shell.nav.lab": "Laboratory",
  "shell.nav.people": "People",
  "shell.nav.dashboards": "Dashboards",
  "shell.nav.regulatory": "Regulatory",
  "shell.nav.settings": "Settings",

  // Web global states
  "states.placeholder.body": "This section is still under construction.",
  "states.loading.label": "Loading content",
  "states.notFound.title": "We couldn't find this page",
  "states.notFound.body":
    "The address doesn't exist or is no longer available. Go back to the home page and try again.",
  "states.error.title": "Something went wrong on this screen",
  "states.error.body":
    "You can try again or go back to the home page. If it keeps happening, tell support.",
  "states.noPermission.title": "You don't have access to this section",
  "states.noPermission.area": "Section",
  "states.noPermission.body":
    "Your current profile doesn't allow opening it. Ask your organization's administrator for access.",
  "states.config.title": "The app is not ready",
  "states.config.missingApiUrl":
    "The server address is not configured or is not valid. Tell technical support so they can fix it.",
  "states.offline.banner":
    "No connection. What you see may be out of date; it will refresh when the network is back.",

  // Web sign-in (W1), password reset, organization choice and session expiry (#28)
  "auth.login.title": "Sign in",
  "auth.login.username": "Username",
  "auth.login.password": "Password",
  "auth.login.showPassword": "Show password",
  "auth.login.submit": "Sign in",
  "auth.login.submitting": "Signing in…",
  "auth.login.forgot": "I forgot my password",
  "auth.login.noSignUp": "Accounts are created by your organization's administrator.",
  "auth.login.usernameRequired": "Enter your username.",
  "auth.login.passwordRequired": "Enter your password.",
  "auth.login.invalidCredentials": "The username or password doesn't match.",
  "auth.login.invalidCredentialsHint": "Check them and try again.",
  "auth.login.noMembership":
    "Your account has no active access to an organization. Contact your administrator.",
  "auth.login.passwordChanged": "Your password was updated. Sign in with the new one.",
  "auth.login.program": "Wolbachia program",
  "auth.login.headline": "Entomological operations and surveillance platform",
  "auth.login.tagline":
    "This is where the office prepares, controls and analyzes what happens in the field.",
  "auth.login.standards": "NOM-032-SSA2-2014 · CENAPRECE Guides 2024",
  "auth.lockout.message": "Too many attempts. Wait {minutes} min and try again.",
  "auth.lockout.noWait": "Too many attempts. Wait a few minutes and try again.",
  "auth.lockout.hint":
    "If you forgot your password, you can reset it from the link below or ask your administrator for help.",
  "auth.forgot.title": "Reset your password",
  "auth.forgot.body":
    "Enter your account's email and we will send you a link to choose a new password.",
  "auth.forgot.email": "Email address",
  "auth.forgot.emailInvalid": "Enter a valid email, for example name@company.com.",
  "auth.forgot.submit": "Send link",
  "auth.forgot.sentTitle": "Check your email",
  "auth.forgot.sent":
    "If that email is registered, we sent you a link to reset your password. It can take a few minutes; check your spam folder too.",
  "auth.forgot.backToLogin": "Back to sign in",
  "auth.reset.title": "Choose a new password",
  "auth.reset.newPassword": "New password",
  "auth.reset.confirmPassword": "Confirm the password",
  "auth.reset.hint": "Use a long password that is not easy to guess.",
  "auth.reset.submit": "Save password",
  "auth.reset.required": "Enter a password.",
  "auth.reset.mismatch": "The passwords don't match.",
  "auth.reset.passwordTooShort": "The password is too short. Use a longer one.",
  "auth.reset.passwordTooCommon": "That password is too common. Choose another one.",
  "auth.reset.passwordEntirelyNumeric": "The password can't be only numbers.",
  "auth.reset.passwordTooSimilar":
    "The password is too similar to your details. Choose another one.",
  "auth.reset.invalidLinkTitle": "This link no longer works",
  "auth.reset.invalidLinkBody":
    "The link expired, was already used or is not valid. Request a new one to continue.",
  "auth.reset.requestNew": "Request a new link",
  "auth.organization.title": "Choose your organization",
  "auth.organization.body":
    "Your account belongs to several organizations. Choose which one you want to work with now.",
  "auth.organization.legend": "Available organizations",
  "auth.organization.submit": "Continue",
  "auth.session.title": "Your session ended",
  "auth.session.body":
    "For security we ended your session. Enter your password to continue; what you had not saved is kept.",
  "auth.session.submit": "Continue",
  "auth.session.signOut": "Sign out",

  // Web user menu (top bar)
  "shell.userMenu.button": "User menu",
  "shell.userMenu.organization": "Organization",
  "shell.userMenu.profiles": "Profiles",
  "shell.userMenu.noProfile": "No profile assigned",
  "shell.userMenu.changeOrganization": "Change organization",
  "shell.userMenu.signOut": "Sign out",

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
