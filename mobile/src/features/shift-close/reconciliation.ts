import type { FieldEventEnvelope } from "../../outbox/outbox-event.ts";
import type { CloseDraft, ReconcileDraft } from "./domain.ts";

function returnRows(draft: ReconcileDraft) {
  return draft.returns
    .filter((line) => line.returned !== "" && Number(line.returned) !== 0)
    .map((line) => {
      if (!/^\d+(?:\.\d{1,6})?$/.test(line.returned)) throw new Error("Invalid return quantity.");
      const receipt = draft.source.receipts.find(
        (receipt) =>
          !receipt.voided &&
          receipt.source_event_id === line.receiptSourceEventId &&
          receipt.lines.some((item) => item.id === line.receiptLineId),
      );
      if (!receipt) throw new Error("Original receipt source is required.");
      return {
        receipt_line_id: line.receiptLineId,
        receipt_source_event_id: line.receiptSourceEventId,
        destination_id: draft.source.originId,
        quantity: line.returned,
      };
    });
}
function shrinkageRows(draft: ReconcileDraft) {
  return (draft.shrinkage ?? [])
    .filter((line) => line.quantity !== "" && Number(line.quantity) !== 0)
    .map((line) => {
      if (
        !/^\d+(?:\.\d{1,6})?$/.test(line.quantity) ||
        line.reason.trim().length < 10 ||
        line.reason.trim().length > 1000 ||
        !line.reasonCode ||
        !draft.photos?.length
      )
        throw new Error("Shrinkage requires a quantity, catalog reason and adopted photo.");
      const receipt = draft.source.receipts.find(
        (receipt) =>
          !receipt.voided &&
          receipt.source_event_id === line.receiptSourceEventId &&
          receipt.lines.some((item) => item.id === line.receiptLineId),
      );
      if (!receipt) throw new Error("Original receipt source is required.");
      return {
        receipt_line_id: line.receiptLineId,
        receipt_source_event_id: line.receiptSourceEventId,
        quantity: line.quantity,
        reason_code: line.reasonCode,
        reason: line.reason.trim(),
        evidence_ids: draft.photos.map((photo) => photo.id),
      };
    });
}
/** Existing B10 deltas only. Empty reconciliation is invalid and must not be manufactured. */
export function reconciliationEvents(
  draft: CloseDraft,
  closing: FieldEventEnvelope,
): FieldEventEnvelope[] {
  return draft.supplies.flatMap((supply, index) => {
    const returned = returnRows(supply);
    const shrinkage = shrinkageRows(supply);
    if (!returned.length && !shrinkage.length) return [];
    return [
      {
        ...closing,
        id: supply.eventId,
        type: "supplies.reconcile",
        device_time: new Date(
          Date.parse(closing.device_time) - draft.supplies.length + index,
        ).toISOString(),
        payload: {
          command_id: supply.eventId,
          assignment_id: supply.source.id,
          expected_revision: supply.source.revision,
          used: [],
          returned,
          shrinkage,
        },
      },
    ];
  });
}
