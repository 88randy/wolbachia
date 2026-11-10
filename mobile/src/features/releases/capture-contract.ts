import type { Schemas } from "@wolbachia/api-client";
import {
  CourierContractError,
  choice,
  nullable,
  readBoolean,
  readDate,
  readInstant,
  readNonempty,
  readPositiveInteger,
  readRecord,
  readUuid,
} from "../ovitrap-lifecycle/contract-readers.ts";

function rows<Result>(value: unknown, read: (row: unknown) => Result): Result[] {
  if (!Array.isArray(value)) throw new CourierContractError();
  return (value as unknown[]).map(read);
}
function decimal(value: unknown): string {
  const text = readNonempty(value);
  if (!/^\d{1,14}(?:\.\d{1,6})?$/.test(text)) throw new CourierContractError();
  return text;
}
function custody(value: unknown): Schemas["ReleaseCaptureCustody"] {
  const row = readRecord(value);
  return {
    receipt_line_id: readUuid(row.receipt_line_id),
    receipt_source_event_id: readUuid(row.receipt_source_event_id),
    assignment_id: readUuid(row.assignment_id),
    assignment_date: readDate(row.assignment_date),
    shift_id: nullable(readUuid)(row.shift_id),
    unit_version_id: readUuid(row.unit_version_id),
    piece_id: nullable(readUuid)(row.piece_id),
    available_quantity: decimal(row.available_quantity),
    received_at: readInstant(row.received_at),
    source_lot_version_id: readUuid(row.source_lot_version_id),
    current_lot_version_id: readUuid(row.current_lot_version_id),
    source_expires_at: nullable(readInstant)(row.source_expires_at),
    current_expires_at: nullable(readInstant)(row.current_expires_at),
    transit_policy_id: nullable(readUuid)(row.transit_policy_id),
    transit_mode: nullable(readNonempty)(row.transit_mode),
    proof_roles: rows(row.proof_roles, readNonempty),
    requires_evidence: readBoolean(row.requires_evidence),
    blocked_by: rows(row.blocked_by, readNonempty),
    accounted_release_event_ids: rows(row.accounted_release_event_ids, readUuid),
  };
}
function device(value: unknown): Schemas["ReleaseCaptureDevice"] {
  const row = readRecord(value);
  return {
    id: readUuid(row.id),
    code: readNonempty(row.code),
    status: choice(["active", "inactive", "retired"])(row.status),
    revision: readPositiveInteger(row.revision),
    created_at: readInstant(row.created_at),
    source_lot_id: readUuid(row.source_lot_id),
    source_lot_version_id: readUuid(row.source_lot_version_id),
    custody: rows(row.custody, custody),
  };
}
function task(value: unknown): Schemas["ReleaseCaptureTask"] {
  const row = readRecord(value);
  return {
    id: readUuid(row.id),
    point_id: readUuid(row.point_id),
    permit_id: readUuid(row.permit_id),
    permit_version_id: readUuid(row.permit_version_id),
    courier_id: readUuid(row.courier_id),
    due_date: readDate(row.due_date),
    owner_revision: readPositiveInteger(row.owner_revision),
    is_completed: readBoolean(row.is_completed),
    created_at: readInstant(row.created_at),
    binding_created_at: readInstant(row.binding_created_at),
    owner_created_at: readInstant(row.owner_created_at),
  };
}
/** Typed read-only B20 facts; malformed or legacy capture data cannot grant a capture route. */
export function readReleaseCapture(value: unknown): Schemas["ReleaseCaptureBundle"] | null {
  if (value === undefined || value === null) return null;
  const row = readRecord(value);
  const result = {
    as_of: readInstant(row.as_of),
    version: readNonempty(row.version),
    devices: rows(row.devices, device),
    tasks: rows(row.tasks, task),
  };
  for (const collection of [result.devices, result.tasks])
    if (new Set(collection.map(({ id }) => id)).size !== collection.length)
      throw new CourierContractError();
  return result;
}
