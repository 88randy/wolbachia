import type { closure as Spanish } from "../es-MX/closure.ts";
export const closure = {
  "closure.crumb": "Closure",
  "closure.page.title": "Close quadrant {code}",
  "closure.page.purpose": "Review every blocker before closing the current quadrant version.",
  "closure.readiness.title": "Closure readiness",
  "closure.blocker.title": "Outstanding blockers",
  "closure.readiness.ready": "No blockers remain. You can review and confirm closure.",
  "closure.readiness.blocked":
    "Each blocker must be resolved by someone with the indicated permission. Refresh after resolution.",
  "closure.blocker.unblocker": "The supervisor in charge of this item can resolve it.",
  "closure.blocker.reference": "Reference: {reference}",
  "closure.readiness.version": "Version: {version} · revision {revision}",
  "closure.actions.refresh": "Refresh readiness",
  "closure.actions.close": "Close quadrant",
  "closure.actions.confirm": "Confirm closure",
  "closure.confirm.title": "Close this quadrant version",
  "closure.confirm.consequence":
    "Closure is final for this version. It prevents new tasks in this version and does not delete or modify historical records.",
  "closure.write.conflict":
    "Readiness changed. Evidence was refreshed; review every blocker and explicitly confirm again.",
  "closure.write.changed":
    "Evidence changed after you opened confirmation. Refresh and review closure again.",
  "closure.readiness.closed": "This quadrant version is already closed.",
  "closure.receipt.reference": "Recorded closure: {reference}",
  "closure.receipt.audit": "Recorded by {author} · {time}",
  "closure.receipt.unknownAuthor": "Author unavailable",
  "closure.write.offline":
    "Offline. Keep your review and refresh after reconnecting before closing.",
  "closure.write.failure":
    "Closure could not be confirmed. Refresh readiness and review the result before trying again.",
  "closure.blocker.unknown": "Outstanding blocker: {reason}",
  "closure.blocker.removalUnconfirmed": "Removal not confirmed",
  "closure.blocker.removalUnrecovered": "Ovitrap not recovered",
  "closure.blocker.relocationPending": "Relocation awaiting decision",
  "closure.blocker.removalReviewPending": "Removal awaiting review",
  "closure.blocker.relocationReviewPending": "Relocation awaiting review",
  "closure.blocker.incidentQuadrantClosure": "Incident blocking closure",
  "closure.receipt.recorded": "Closure recorded.",
} as const satisfies Record<keyof typeof Spanish, string>;
