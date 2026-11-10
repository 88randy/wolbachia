import type { transfers as spanish } from "../es-MX/transfers.ts";
export const transfers: Record<keyof typeof spanish, string> = {
  "transfers.field.from": "Created since",
  "transfers.field.before": "Created before",
  "transfers.write.review": "Review current state and edit the draft",
  "transfers.page.title": "Transfers",
  "transfers.page.preparedOnly": "This view lets you dispatch and receive prepared transfers.",
  "transfers.page.denied":
    "Your scope does not include this inventory. Ask an administrator for access.",
  "transfers.page.readError":
    "The transfer could not be loaded. Retry to review its current state.",
  "transfers.field.code": "Transfer",
  "transfers.field.route": "Route",
  "transfers.field.origin": "Origin location",
  "transfers.field.destination": "Destination location",
  "transfers.state.prepared": "Prepared",
  "transfers.state.dispatched": "In transit",
  "transfers.state.received": "Received",
  "transfers.state.discrepancy": "Discrepancy",
  "transfers.state.resolved": "Resolved",
  "transfers.event.prepared": "Preparation",
  "transfers.event.dispatch": "Signed dispatch",
  "transfers.event.receive": "Signed receipt",
  "transfers.event.resolution": "Resolution",
  "transfers.history.title": "Original manifest and history",
  "transfers.history.revision": "Revision {revision}",
  "transfers.history.evidence": "Evidence {role}",
  "transfers.signature.sender": "Sender signature",
  "transfers.signature.receiver": "Receiver signature",
  "transfers.action.dispatch": "Sign and dispatch",
  "transfers.action.receive": "Sign receipt",
  "transfers.action.discrepancies": "View discrepancies",
  "transfers.scan.label": "Scan manifest identity",
  "transfers.scan.hint":
    "Use the line, piece or lot identity in the manifest. Unknown codes remain uncredited extras.",
  "transfers.scan.quantity": "Scanned quantity",
  "transfers.scan.add": "Record scan",
  "transfers.scan.ready": "Ready to scan",
  "transfers.scan.accepted": "Scan recorded in the draft. Sign the receipt to commit it.",
  "transfers.scan.duplicate": "Duplicate piece: already scanned. It was not counted again.",
  "transfers.scan.extra":
    "Unidentified extra. It remains uncredited and opens a discrepancy when signed.",
  "transfers.scan.invalid":
    "Check the quantity: it must be positive and within the expected amount. Each piece is counted once.",
  "transfers.scan.ambiguous": "The lot has several lines. Scan the exact line or piece identity.",
  "transfers.line.count": "Expected: {expected} · scanned: {received}",
  "transfers.line.photo": "Missing item photo: {id}",
  "transfers.write.dispatchRule":
    "Verify the signature before dispatch. The server checks stock, expiry and destination; an administrator or warehouse must resolve blockers.",
  "transfers.write.receiveRule":
    "Each missing line needs a verified photo separate from the signature. Signing commits actual quantities and discrepancies; resolution releases only their own holds.",
  "transfers.write.committed": "Saved",
  "transfers.write.retry": "Retry the same submission",
  "transfers.write.retained":
    "The original submission was retained. Retrying uses the same identity and quantities without a second movement. Review the current state and blockers before another operation.",
  "transfers.write.failed":
    "The submission was not confirmed. Retry the same submission or review history and blockers with the warehouse.",
  "transfers.write.wait": "The system is busy. Wait a moment before trying again.",
};
