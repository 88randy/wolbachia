import type { Schemas } from "@wolbachia/api-client";
import {
  CourierContractError,
  nullable,
  readBoolean,
  readDate,
  readNonempty,
  readPositiveInteger,
  readRecord,
  readUuid,
} from "../ovitrap-lifecycle/contract-readers.ts";
import type { SupplyAssignment } from "./projection-types.ts";

/** Decimal(20,6) is retained as text; no IEEE754 stock arithmetic is involved. */
export function readSupplyQuantity(value: unknown, signed = false): string {
  if (
    typeof value !== "string" ||
    !/^-?\d{1,14}(?:\.\d{1,6})?$/.test(value) ||
    (!signed && value.startsWith("-"))
  )
    throw new CourierContractError();
  return value;
}
function rows<Result>(value: unknown, read: (row: unknown) => Result): Result[] {
  if (!Array.isArray(value)) throw new CourierContractError();
  return (value as unknown[]).map(read);
}
function distinct(rows: readonly { readonly id: string }[]): void {
  if (new Set(rows.map(({ id }) => id.toLowerCase())).size !== rows.length)
    throw new CourierContractError();
}
function line(value: unknown): Schemas["AssignmentLine"] {
  const row = readRecord(value);
  return {
    id: readUuid(row.id),
    lot_id: readUuid(row.lot_id),
    piece_id: nullable(readUuid)(row.piece_id),
    unit_version_id: readUuid(row.unit_version_id),
    quantity: readSupplyQuantity(row.quantity),
  };
}
function assignment(value: unknown): Schemas["SupplyAssignmentRead"] {
  const row = readRecord(value),
    lines = rows(row.lines, line);
  distinct(lines);
  return {
    id: readUuid(row.id),
    courier_id: readUuid(row.courier_id),
    origin_id: readUuid(row.origin_id),
    date: readDate(row.date),
    shift_id: nullable(readUuid)(row.shift_id),
    revision: readPositiveInteger(row.revision),
    version_id: readUuid(row.version_id),
    planning_proof: readRecord(row.planning_proof),
    lines,
  };
}
function releasedLine(value: unknown): Schemas["SupplyReleasedLine"] {
  const row = readRecord(value);
  return {
    id: readUuid(row.id),
    assignment_line_id: readUuid(row.assignment_line_id),
    quantity: readSupplyQuantity(row.quantity),
    transit_policy_id: nullable(readUuid)(row.transit_policy_id),
  };
}
function release(value: unknown): Schemas["SupplyReleaseBundle"] {
  const row = readRecord(value),
    lines = rows(row.lines, releasedLine);
  distinct(lines);
  if (new Set(lines.map(({ assignment_line_id }) => assignment_line_id)).size !== lines.length)
    throw new CourierContractError();
  return {
    id: readUuid(row.id),
    plan_revision: readPositiveInteger(row.plan_revision),
    manifest_hash: readNonempty(row.manifest_hash),
    lines,
  };
}
function actualLine(value: unknown): Schemas["ActualSupplyLine"] {
  const row = readRecord(value);
  return {
    id: readUuid(row.id),
    release_line_id: readUuid(row.release_line_id),
    quantity: readSupplyQuantity(row.quantity),
  };
}
function receipt(value: unknown): Schemas["SupplyReceiptBundle"] {
  const row = readRecord(value),
    lines = rows(row.lines, actualLine);
  distinct(lines);
  if (new Set(lines.map(({ release_line_id }) => release_line_id)).size !== lines.length)
    throw new CourierContractError();
  return {
    id: readUuid(row.id),
    event_id: readUuid(row.event_id),
    source_event_id: readUuid(row.source_event_id),
    release_id: readUuid(row.release_id),
    signature_upload_id: readUuid(row.signature_upload_id),
    voided: readBoolean(row.voided),
    lines,
  };
}
function frameLine(value: unknown): Schemas["SupplyFrameLine"] {
  const row = readRecord(value);
  return {
    assignment_line_id: readUuid(row.assignment_line_id),
    plan_revision: readPositiveInteger(row.plan_revision),
    planned: readSupplyQuantity(row.planned),
    credited: nullable(readSupplyQuantity)(row.credited),
    used: readSupplyQuantity(row.used),
    returned: readSupplyQuantity(row.returned),
    shrinkage: readSupplyQuantity(row.shrinkage),
    difference: nullable((value) => readSupplyQuantity(value, true))(row.difference),
    delivery_variance: nullable((value) => readSupplyQuantity(value, true))(row.delivery_variance),
  };
}
function frame(value: unknown): Schemas["SupplyFrame"] {
  const row = readRecord(value);
  return { assignment_id: readUuid(row.assignment_id), lines: rows(row.lines, frameLine) };
}
function reconciliation(value: unknown): Schemas["SupplyReconciliation"] {
  const row = readRecord(value);
  if (!Number.isSafeInteger(row.revision) || Number(row.revision) < 0)
    throw new CourierContractError();
  return {
    id: readUuid(row.id),
    assignment: assignment(row.assignment),
    revision: Number(row.revision),
    frame_id: nullable(readUuid)(row.frame_id),
    frame: nullable(frame)(row.frame),
    discrepancy_id: nullable(readUuid)(row.discrepancy_id),
    justification_ids: rows(row.justification_ids, readUuid),
  };
}
function requireReferences(result: SupplyAssignment): void {
  if (result.reconciliation !== null && result.reconciliation.assignment.id !== result.id)
    throw new CourierContractError();
  for (const released of result.releases) {
    if (
      released.plan_revision === result.revision &&
      released.lines.some((row) => !result.lines.some(({ id }) => id === row.assignment_line_id))
    )
      throw new CourierContractError();
  }
  for (const actual of result.receipts) {
    const released = result.releases.find(({ id }) => id === actual.release_id);
    if (
      !released ||
      actual.lines.some((row) => !released.lines.some(({ id }) => id === row.release_line_id))
    )
      throw new CourierContractError();
  }
}
/** Decode the delivered generated B10 shape; absent labels/kinds never acquire invented values. */
export function readSupplyAssignment(value: unknown): SupplyAssignment {
  const row = readRecord(value);
  const result = {
    ...assignment(row),
    organization_id: readUuid(row.organization_id),
    center_id: readUuid(row.center_id),
    quadrant_id: nullable(readUuid)(row.quadrant_id),
    reconciliation: nullable(reconciliation)(row.reconciliation),
    releases: rows(row.releases, release),
    receipts: rows(row.receipts, receipt),
  };
  distinct(result.releases);
  distinct(result.receipts);
  requireReferences(result);
  return result;
}
