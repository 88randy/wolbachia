import type { discrepancies as Spanish } from "../es-MX/discrepancies.ts";
export const discrepancies = {
  "discrepancies.page.title": "Discrepancies",
  "discrepancies.page.denied":
    "You do not have permission or scope to read discrepancies. Request access from an administrator.",
  "discrepancies.page.readError": "The discrepancy could not be loaded. Try again.",
  "discrepancies.field.code": "Number",
  "discrepancies.field.search": "Search discrepancies",
  "discrepancies.field.transfer": "Transfer",
  "discrepancies.field.status": "Status",
  "discrepancies.field.createdAt": "Recorded",
  "discrepancies.status.open": "Open",
  "discrepancies.status.closed": "Closed",
  "discrepancies.kind.missing": "Missing",
  "discrepancies.kind.identifiedExtra": "Identified extra",
  "discrepancies.kind.unidentifiedExtra": "Unidentified extra",
  "discrepancies.holds.explanation":
    "Only this discrepancy's holds are shown. Closing it preserves other records' holds; the server confirms availability.",
  "discrepancies.holds.active": "Pending hold",
  "discrepancies.holds.released": "Hold resolved by this discrepancy",
  "discrepancies.actions.back": "Back to discrepancies",
  "discrepancies.history.title": "Signed manifests and history",
  "discrepancies.history.hash": "Original manifest hash",
  "discrepancies.history.bulk": "By lot",
  "discrepancies.history.evidence": "Verified evidence",
  "discrepancies.history.received": "Received",
  "discrepancies.event.prepared": "Prepared",
  "discrepancies.event.dispatch": "Signed dispatch",
  "discrepancies.event.receive": "Signed receipt",
  "discrepancies.event.resolution": "Resolution",
  "discrepancies.close.title": "Resolve discrepancy",
  "discrepancies.close.reason": "Resolution reason",
  "discrepancies.close.reasonHint": "Describe the resolution. Minimum length: {min} characters.",
  "discrepancies.close.outcome": "How this line was resolved",
  "discrepancies.close.signature": "New receiving signature",
  "discrepancies.close.photo": "Recovered or returned material photo",
  "discrepancies.close.requirements":
    "Choose a disposition for every line and explain the reason. Recovery or return requires verified signature and photo evidence, recorded by someone with receive and close permissions.",
  "discrepancies.close.correctionPermission":
    "An extra requires a real corrective receipt. Ask someone with transfer access to record and link the correction.",
  "discrepancies.close.offline":
    "Offline. Your input is retained; reconnect and refresh before resolving.",
  "discrepancies.close.confirmTitle": "Confirm discrepancy resolution",
  "discrepancies.close.consequence":
    "Resolution is final. It disposes only its own holds; it preserves the signed manifest and other holds. Acknowledging missing material adds no stock.",
  "discrepancies.close.action": "Review and close discrepancy",
  "discrepancies.close.confirm": "Confirm resolution",
  "discrepancies.close.saved": "Resolution recorded on the server",
  "discrepancies.close.uncertain":
    "The response was not confirmed. The exact resolution is retained; check its status or retry the same request.",
  "discrepancies.close.failed":
    "The resolution needs review. Your input is retained; refresh the current state or try again.",
  "discrepancies.close.retry": "Retry the same resolution",
  "discrepancies.close.review": "Refresh and review current state",
  "discrepancies.outcome.choose": "Choose a resolution",
  "discrepancies.outcome.ackMissing": "Acknowledge missing material without adding stock",
  "discrepancies.outcome.recoverDest": "Receive recovered material at destination",
  "discrepancies.outcome.returnOrigin": "Receive returned material at origin",
  "discrepancies.outcome.referenceSignedCorrection": "Link a signed corrective receipt",
  "discrepancies.correction.code": "Corrective transfer code",
  "discrepancies.correction.find": "Find corrective transfer",
  "discrepancies.correction.receipt": "Signed corrective receipt",
  "discrepancies.correction.unavailable":
    "The transfer or its signed receipt is unavailable. Check the code and try again.",
  "discrepancies.correction.requirements":
    "The server checks the same destination, material and available received correction quantity. Linking it creates no additional credit.",
} satisfies Record<keyof typeof Spanish, string>;
