import type { shift as source } from "../es-MX/shift.ts";
export const shift: Record<keyof typeof source, string> = {
  "shift.page.title": "Validate shifts",
  "shift.page.detail": "Review shift",
  "shift.page.listHint":
    "Open a shift to review its close and record a decision. Use the Status filter to show closed shifts only.",
  "shift.page.summary": "Shift summary",
  "shift.page.timeline": "Available timeline",
  "shift.page.history": "Validation history",
  "shift.field.reference": "Shift reference",
  "shift.field.code": "Shift",
  "shift.field.courier": "Courier reference",
  "shift.field.motorcycle": "Motorcycle",
  "shift.field.lifecycle": "Status",
  "shift.field.opened": "Opening (phone time)",
  "shift.field.closed": "Closing (phone time)",
  "shift.field.odometerOpen": "Opening odometer (km)",
  "shift.field.odometerClose": "Closing odometer (km)",
  "shift.field.reason": "Reason (required)",
  "shift.field.reasonHint":
    "Use at least {min} visible characters and at most {max} characters in total. The reason remains in history.",
  "shift.field.author": "Author reference",
  "shift.field.revision": "Revision",
  "shift.field.unavailable": "Unavailable",
  "shift.status.open": "Open",
  "shift.status.closed": "Closed",
  "shift.status.pending": "Pending validation",
  "shift.status.approved": "Approved",
  "shift.status.observed": "Observed",
  "shift.status.outdated": "Approval outdated",
  "shift.action.approve": "Approve shift",
  "shift.action.observe": "Send observation",
  "shift.action.refresh": "Refresh shift",
  "shift.action.approveHint":
    "Approve the whole shift and record your reason. The decision remains in history and preserves the original captures.",
  "shift.action.observeHint":
    "Record an observation of the whole shift with a reason for the courier. Original captures are preserved.",
  "shift.gap.summary":
    "The summary of points, readings, egg paddle presence and Yes/No eggs, incidents, distance and flags with thresholds and versions is not available yet. Review field information before deciding.",
  "shift.gap.track":
    "GPS track unavailable. The shift provides no coordinates or visit events to display a map. This list contains only the available opening and closing.",
  "shift.gap.points":
    "Point history (W4) is not available in this application yet. Saved shift decisions are shown here.",
  "shift.history.empty":
    "This shift has no decisions yet. Review the available information before validating.",
  "shift.history.saved": "Decision saved. Updating shift history.",
  "shift.blocker.open":
    "The shift is still open. The courier must close it on their phone before supervision can validate it.",
  "shift.blocker.source":
    "The opening or closing captures are not effective. Supervision must resolve their review before approval.",
  "shift.blocker.review":
    "Some captures await review. Supervision must resolve them before approval.",
  "shift.blocker.motorcycle":
    "The motorcycle has a safety hold. Authorized personnel must resolve it before approval.",
  "shift.blocker.incident":
    "An incident maintains a safety hold. Authorized personnel must resolve it before approval.",
  "shift.blocker.scope":
    "The complete shift scope could not be verified. Administration must review permissions and supervision must refresh the shift.",
  "shift.blocker.unknown":
    "The server reports a shift blocker. Supervision must review pending work before approval.",
  "shift.blocker.refresh":
    "Refresh and review the shift before sending a decision. Supervision needs a current read without errors.",
  "shift.error.tooShort": "Enter a reason meeting the indicated minimum length.",
  "shift.error.tooLong": "The reason exceeds the indicated maximum length.",
  "shift.error.invalidCharacters": "Remove control characters from the reason and try again.",
  "shift.error.invalid": "The reason was not accepted. Check it and try again.",
  "shift.error.conflict":
    "The shift changed. Your reason is preserved. Close this dialog, refresh and review history before opening the action again.",
  "shift.error.uncertain":
    "We could not confirm the decision. Your reason is preserved. Close this dialog and refresh history before deciding whether to send it again.",
  "shift.error.denied":
    "You no longer have access to this action. Close this dialog and refresh the shift; contact administration if you need permissions.",
  "shift.error.session":
    "The session changed. Sign in and review the shift before sending your decision again.",
};
