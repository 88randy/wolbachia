import type { discrepancies as Spanish } from "../es-MX/discrepancies.ts";
export const discrepancies = {
  "discrepancies.page.title": "Differences",
  "discrepancies.page.denied":
    "You do not have permission or scope to read discrepancies. Request access from an administrator.",
  "discrepancies.page.readError": "The discrepancy could not be loaded. Try again.",
  "discrepancies.field.code": "Number",
  "discrepancies.field.search": "Search differences",
  "discrepancies.field.transfer": "Shipment",
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
  "discrepancies.actions.back": "Back to differences",
  "discrepancies.history.title": "Signed manifests and history",
  "discrepancies.history.hash": "Original manifest hash",
  "discrepancies.history.bulk": "By lot",
  "discrepancies.history.evidence": "Verified evidence",
  "discrepancies.history.received": "Received",
  "discrepancies.event.prepared": "Prepared",
  "discrepancies.event.dispatch": "Signed dispatch",
  "discrepancies.event.receive": "Signed receipt",
  "discrepancies.event.resolution": "Resolution",
  "discrepancies.close.title": "Resolve the difference",
  "discrepancies.close.reason": "Resolution reason",
  "discrepancies.close.reasonHint": "Describe the resolution. Minimum length: {min} characters.",
  "discrepancies.close.outcome": "How was it resolved?",
  "discrepancies.close.signature": "Signature of who receives what was found",
  "discrepancies.close.photo": "Photo of what was found or returned",
  "discrepancies.close.requirements":
    "To record recovered or returned material you need a signature and a photo. Writing off as lost only needs the reason.",
  "discrepancies.close.correctionPermission":
    "An extra requires a real corrective receipt. Ask someone with transfer access to record and link the correction.",
  "discrepancies.close.offline":
    "Offline. Your input is retained; reconnect and refresh before resolving.",
  "discrepancies.close.confirmTitle": "Resolve the difference",
  "discrepancies.close.consequence":
    "Once resolved it cannot be changed. Writing off as lost adds nothing to the stock.",
  "discrepancies.close.action": "Resolve",
  "discrepancies.close.confirm": "Yes, resolve",
  "discrepancies.close.saved": "Resolution recorded",
  "discrepancies.close.uncertain":
    "The response was not confirmed. The exact resolution is retained; check its status or retry the same request.",
  "discrepancies.close.failed":
    "The resolution needs review. Your input is retained; refresh the current state or try again.",
  "discrepancies.close.retry": "Retry the same resolution",
  "discrepancies.close.review": "Refresh and review current state",
  "discrepancies.outcome.choose": "What happened to this?",
  "discrepancies.outcome.ackMissing": "Write off as lost",
  "discrepancies.outcome.recoverDest": "Record what was found at the destination",
  "discrepancies.outcome.returnOrigin": "Record what went back to the origin",
  "discrepancies.outcome.referenceSignedCorrection": "A signed reception already corrects it",
  "discrepancies.correction.code": "Corrective transfer code",
  "discrepancies.correction.find": "Find corrective transfer",
  "discrepancies.correction.receipt": "Signed corrective receipt",
  "discrepancies.correction.unavailable":
    "The transfer or its signed receipt is unavailable. Check the code and try again.",
  "discrepancies.correction.requirements":
    "The server checks the same destination, material and available received correction quantity. Linking it creates no additional credit.",
  "discrepancies.history.piece": "Piece",
  "discrepancies.record.subtitle": "From shipment {transfer}",
} satisfies Record<keyof typeof Spanish, string>;
