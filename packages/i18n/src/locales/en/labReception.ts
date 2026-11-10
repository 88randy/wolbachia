/** English messages for W34 laboratory bag reception. */
import type { labReception as source } from "../es-MX/labReception.ts";

export const labReception: Record<keyof typeof source, string> = {
  "labReception.page.title": "Bag reception",
  "labReception.page.subtitle": "Scan each bag and confirm its arrival at the laboratory.",
  "labReception.page.scope":
    "Organization-wide reception. Use the sampling point and epi week to narrow the lists; the selected center does not filter this view.",
  "labReception.scan.label": "Bag code",
  "labReception.scan.readingId": "Reading identifier (UUID)",
  "labReception.scan.noPaddleHint":
    "Use the identifier of a field reading that recorded no egg paddle. It cannot enter the count queue.",
  "labReception.scan.hint":
    "Use the scanner or enter the code and press Enter. Focus returns here after each result.",
  "labReception.scan.submit": "Receive bag",
  "labReception.scan.busy": "Recording reception…",
  "labReception.scan.queued": "Scans waiting",
  "labReception.scan.invalid": "Enter a valid bag code before continuing.",
  "labReception.scan.received": "Bag received. You can scan the next one.",
  "labReception.scan.noPaddle":
    "Reading received without an egg paddle. It was not added to the count queue.",
  "labReception.scan.alreadyReceived":
    "This bag was already received. No additional receipt was created.",
  "labReception.scan.unknown": "No available bag was found with that code. Check the label.",
  "labReception.scan.noReading": "The bag has no effective field reading. Review the discrepancy.",
  "labReception.scan.missing": "The missing bag was recorded. Review the discrepancy.",
  "labReception.scan.configurationPending":
    "The discrepancy was recorded, but its incident is awaiting configuration. Ask an administrator to review the reception policy.",
  "labReception.scan.conflict": "The bag state changed. Refresh its details before continuing.",
  "labReception.scan.inProgress":
    "Another operation is using this bag. Review its state before trying again.",
  "labReception.scan.uncertain":
    "We could not confirm the result. Review receptions before recording this bag again.",
  "labReception.scan.review": "Review current state",
  "labReception.scan.reviewHint":
    "Refresh the lists and review the result. Waiting scans resume afterward; the uncertain operation will not be sent again.",
  "labReception.table.received": "Recorded receptions",
  "labReception.table.expected": "Expected bags",
  "labReception.table.discrepancies": "Reception discrepancies",
  "labReception.table.bag": "Bag",
  "labReception.table.reading": "Reading",
  "labReception.table.block": "Block",
  "labReception.table.point": "Sampling point code",
  "labReception.table.date": "Date",
  "labReception.table.collector": "Collector",
  "labReception.table.paddlePresent": "Egg paddle present?",
  "labReception.table.hasEggs": "Has eggs?",
  "labReception.table.status": "State",
  "labReception.table.actions": "Actions",
  "labReception.table.noPaddle": "No egg paddle",
  "labReception.table.yes": "Yes",
  "labReception.table.no": "No",
  "labReception.table.unknown": "Unavailable",
  "labReception.summary.expected": "Awaiting reception",
  "labReception.summary.received": "Received",
  "labReception.summary.hint":
    "Totals are independent queries using the stated filters. They do not represent a closed delivery.",
  "labReception.filters.week": "Epi week",
  "labReception.filters.point": "Sampling point",
  "labReception.filters.code": "Exact bag code",
  "labReception.filters.status": "Laboratory state",
  "labReception.filters.kind": "Reception type",
  "labReception.action.markMissing": "Mark missing",
  "labReception.action.reason": "Reason for missing bag",
  "labReception.action.confirmMissing": "Record missing bag",
  "labReception.action.missingHint":
    "This records an audited missing-bag observation and may open an incident. Enter the reason.",
  "labReception.action.receiveNoPaddle": "Receive reading without egg paddle",
  "labReception.action.openIncident": "Open incident",
  "labReception.action.countQueue": "Go to count queue",
  "labReception.action.refresh": "Refresh reception",
  "labReception.status.expected": "Awaiting reception",
  "labReception.status.missing": "Missing",
  "labReception.status.noEffectiveReading": "No effective reading",
  "labReception.status.pendingCount": "Pending count",
  "labReception.status.counted": "Counted",
  "labReception.status.awaitingIndependentQa": "Awaiting independent review",
  "labReception.status.rejected": "Rejected",
  "labReception.status.voided": "Voided",
  "labReception.status.received": "Received",
  "labReception.status.configurationPending": "Configuration pending",
  "labReception.metadata.unavailable": "Details are unavailable with your current access.",
  "labReception.metadata.limited":
    "Available identifiers are shown. Location and collector details require their own authorization.",
  "labReception.incident.title": "Reception incident",
};
