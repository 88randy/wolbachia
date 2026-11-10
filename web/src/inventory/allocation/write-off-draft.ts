import type { Schemas } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import { quantityUnits } from "../transfers/transfer-quantities";
import type { IntentDraft } from "./allocation-intent";

export type Lot = Schemas["Lot"];
export type Bag = Schemas["Bag"];
export type WriteOffTarget =
  { kind: "lot"; lot: Lot; locationId: string; quantity: string } | { kind: "bag"; bag: Bag };
export interface WriteOffFields {
  target: WriteOffTarget | null;
  reasonCode: string;
  reason: string;
  /** Calendar date of the organization (YYYY-MM-DD). */
  date: string;
  /** Upload id of a server-verified RPBI handling receipt, or empty. */
  rpbiUploadId: string;
  ownerId: string;
}
export interface BlockerContext {
  /** Whether the selected reason is the catalog "other" item, which requires the free text. */
  isOtherReason: boolean;
  minReasonLength: number;
}

/** Whole-Bag disposal is always biological; a Lot depends on its supply version. */
export function isBiological(target: WriteOffTarget | null) {
  return target?.kind === "bag" || target?.lot.supply_version.is_biological === true;
}

function targetBlockers(target: WriteOffTarget | null): MessageKey[] {
  if (!target) return ["allocation.writeOff.blockerTarget"];
  if (target.kind === "bag") return [];
  const units = quantityUnits(target.quantity);
  return [
    ...(target.lot.supply_version.identity_kind === "piece"
      ? (["allocation.writeOff.blockerPiece"] as const)
      : []),
    ...(target.locationId ? [] : (["allocation.writeOff.blockerLocation"] as const)),
    ...(units === null || units === 0n ? (["allocation.writeOff.blockerQuantity"] as const) : []),
  ];
}

function reasonBlockers(fields: WriteOffFields, context: BlockerContext): MessageKey[] {
  const isShortText =
    context.isOtherReason && fields.reason.trim().length < context.minReasonLength;
  return [
    ...(fields.reasonCode ? [] : (["allocation.writeOff.blockerReason"] as const)),
    ...(isShortText ? (["allocation.writeOff.blockerReasonText"] as const) : []),
  ];
}

/** Why the form cannot be submitted, as message keys; an empty list means it can. */
export function writeOffBlockers(fields: WriteOffFields, context: BlockerContext): MessageKey[] {
  const isMissingRpbi = isBiological(fields.target) && !fields.rpbiUploadId;
  return [
    ...targetBlockers(fields.target),
    ...reasonBlockers(fields, context),
    ...(/^\d{4}-\d{2}-\d{2}$/.test(fields.date)
      ? []
      : (["allocation.writeOff.blockerDate"] as const)),
    ...(isMissingRpbi ? (["allocation.writeOff.blockerRpbi"] as const) : []),
  ];
}

function common(fields: WriteOffFields) {
  return {
    command_id: crypto.randomUUID(),
    reason_code: fields.reasonCode,
    reason: fields.reason.trim(),
    owner_id: fields.ownerId,
    date: fields.date,
    evidence: fields.rpbiUploadId
      ? [{ role: "rpbi" as const, upload_id: fields.rpbiUploadId }]
      : [],
  };
}

/** The expected revision comes from the record the user saw, so a stale form conflicts (409). */
export function buildWriteOffDraft(fields: WriteOffFields): IntentDraft | null {
  const target = fields.target;
  if (!target) return null;
  if (target.kind === "bag") {
    return {
      target: { kind: "write_off" },
      body: {
        kind: "bag_disposal",
        bag_id: target.bag.id,
        expected_revision: target.bag.lab?.revision ?? 0,
        ...common(fields),
      },
    };
  }
  return {
    target: { kind: "write_off" },
    body: {
      kind: "lot_write_off",
      lot_id: target.lot.id,
      location_id: target.locationId,
      unit_version_id: target.lot.supply_version_id,
      piece_id: null,
      quantity: target.quantity,
      expected_revision: target.lot.revision,
      ...common(fields),
    },
  };
}
