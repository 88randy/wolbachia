import type { MessageKey } from "@wolbachia/i18n";
import type { Schemas } from "@wolbachia/api-client";
import type { OutboxEvent } from "../../outbox/outbox-event.ts";

export interface PendingPoint {
  readonly taskId: string;
  readonly pointCode: string;
}
export interface SupplyReturnDraft {
  readonly receiptLineId: string;
  readonly receiptSourceEventId: string;
  readonly returned: string;
}
export interface ReconcileDraft {
  readonly eventId: string;
  readonly source: import("./supplies.ts").SupplySource;
  readonly returns: readonly SupplyReturnDraft[];
  readonly shrinkage?: readonly {
    readonly receiptLineId: string;
    readonly receiptSourceEventId: string;
    readonly quantity: string;
    readonly reasonCode: string;
    readonly reason: string;
  }[];
  readonly photos?: readonly { readonly id: string; readonly fileRef: string }[];
}
export interface CloseDraft {
  readonly shiftId: string;
  readonly ownerKey: string;
  readonly closeEventId: string;
  readonly supplies: readonly ReconcileDraft[];
  readonly odometer: string;
  readonly note: string;
  readonly pending: readonly PendingPoint[];
  readonly dispositions: Readonly<Record<string, "leave_pending">>;
  readonly locallyClosedAt: string | null;
}
export type ClosePatch = Pick<
  Partial<CloseDraft>,
  "odometer" | "note" | "dispositions" | "supplies"
>;
const SCALE = 1_000_000n;
function quantity(value: string): bigint {
  if (!/^-?\d+(?:\.\d{1,6})?$/.test(value)) throw new Error("Invalid supply quantity.");
  const [whole = "0", fraction = ""] = value.replace("-", "").split(".");
  const units = BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, "0"));
  return value.startsWith("-") ? -units : units;
}
/** B10 uses received custody, not a planned allocation, as the reconciliation source. */
export function supplyDifference(
  line: Pick<Schemas["SupplyFrameLine"], "credited" | "used" | "returned" | "shrinkage">,
): string | null {
  if (line.credited === null) return null;
  const difference =
    quantity(line.credited) -
    quantity(line.used) -
    quantity(line.returned) -
    quantity(line.shrinkage);
  const absolute = difference < 0n ? -difference : difference;
  const fraction = String(absolute % SCALE)
    .padStart(6, "0")
    .replace(/0+$/, "");
  return `${difference < 0n ? "-" : ""}${String(absolute / SCALE)}${fraction ? `.${fraction}` : ""}`;
}
/** Complete receipt requires every closing source; a failed or unreceived source stays explicit. */
export function closeDeliveryKey(events: readonly OutboxEvent[]): MessageKey {
  if (events.some((event) => event.status === "rejected")) return "mobile.shiftClose.rejected";
  if (
    events.some((event) => ["pending", "sending", "error"].includes(event.status)) ||
    !events.length
  )
    return "mobile.shiftClose.phoneClosed";
  if (events.some((event) => event.status === "in_review")) return "mobile.shiftClose.inReview";
  return "mobile.shiftClose.serverReceived";
}
export function validateClose(draft: CloseDraft, pending: readonly PendingPoint[]): void {
  if (!/^\d+$/.test(draft.odometer) || !Number.isSafeInteger(Number(draft.odometer)))
    throw new Error("A whole nonnegative odometer reading is required.");
  if (pending.some((point) => draft.dispositions[point.taskId] !== "leave_pending"))
    throw new Error("Every pending point requires explicit disposition.");
}

/** Whole-form updates cannot replace captured source proof or erase a concurrently adopted photo. */
export function applyClosePatch(draft: CloseDraft, patch: ClosePatch): CloseDraft {
  if (!patch.supplies) return { ...draft, ...patch };
  if (patch.supplies.length !== draft.supplies.length)
    throw new Error("Supply source set changed.");
  const supplies = draft.supplies.map((source) => {
    const edited = patch.supplies?.find((row) => row.eventId === source.eventId);
    if (!edited || JSON.stringify(edited.source) !== JSON.stringify(source.source))
      throw new Error("Original supply source changed.");
    return { ...edited, photos: source.photos };
  });
  return { ...draft, ...patch, supplies };
}
