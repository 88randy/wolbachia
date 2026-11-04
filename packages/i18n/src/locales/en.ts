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
  "states.config.title": "The app is not ready",
  "states.config.missingApiUrl":
    "The server address is not configured or is not valid. Tell technical support so they can fix it.",
  "states.offline.banner":
    "No connection. What you see may be out of date; it will refresh when the network is back.",

  // Result of sending a record to the server (phone inbox)
  "sync.inbox.acceptedTitle": "Sent",
  "sync.inbox.acceptedHint": "The server received this record. You have nothing else to do.",
  "sync.inbox.rejectedTitle": "Not accepted",
  "sync.inbox.rejectedHint":
    "The server couldn't accept this record. Ask your supervisor to review it.",
  "sync.inbox.inReviewTitle": "In review",
  "sync.inbox.inReviewHint":
    "A supervisor will review this record. You don't need to do anything meanwhile.",
};
