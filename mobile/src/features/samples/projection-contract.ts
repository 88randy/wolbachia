import {
  CourierContractError,
  choice,
  nullable,
  readBoolean,
  readInstant,
  readNonempty,
  readPositiveInteger,
  readRecord,
  readUuid,
  requireFields,
} from "../ovitrap-lifecycle/contract-readers.ts";
import type { SampleMethod, SampleReceipt, SampleSnapshot, SampleSource } from "./types.ts";

function distinct(values: readonly string[]): void {
  if (new Set(values.map((value) => value.toLowerCase())).size !== values.length)
    throw new CourierContractError();
}
function readMethod(value: unknown): SampleMethod {
  const row = readRecord(value);
  requireFields(row, {
    id: readUuid,
    method_id: readUuid,
    label: readNonempty,
    revision: readPositiveInteger,
    created_at: readInstant,
    effective_from: readInstant,
    content_hash: readNonempty,
    supports_wolbachia: readBoolean,
  });
  const verification = readRecord(row.verification);
  requireFields(verification, {
    id: readUuid,
    revision: readPositiveInteger,
    decision: choice(["verify"]),
    content_hash: readNonempty,
    created_at: readInstant,
  });
  return row as unknown as SampleMethod;
}
const SOURCE_FIELDS = {
  kind: choice(["reading", "lot", "release"]),
  id: readUuid,
  label: readNonempty,
  center_id: readUuid,
  quadrant_id: nullable(readUuid),
  author_id: nullable(readUuid),
  event_id: nullable(readUuid),
  device_time: nullable(readInstant),
  created_at: readInstant,
  effective: readBoolean,
  lot_version_id: nullable(readUuid),
  lot_version_revision: nullable(readPositiveInteger),
  lot_version_created_at: nullable(readInstant),
};
const EVENT_FIELDS = ["author_id", "event_id", "device_time"] as const;
const LOT_FIELDS = ["lot_version_id", "lot_version_revision", "lot_version_created_at"] as const;
function hasAll(row: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => Boolean(row[key]));
}
function hasNone(row: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => row[key] === null);
}
function readSource(value: unknown): SampleSource {
  const row = readRecord(value);
  requireFields(row, SOURCE_FIELDS);
  const isLot = row.kind === "lot";
  const isConsistent = isLot
    ? hasAll(row, LOT_FIELDS) && hasNone(row, EVENT_FIELDS)
    : hasAll(row, EVENT_FIELDS) && hasNone(row, LOT_FIELDS);
  if (!isConsistent) throw new CourierContractError();
  return row as unknown as SampleSource;
}
function readReceipt(value: unknown): SampleReceipt {
  const row = readRecord(value);
  requireFields(row, { sample_id: readUuid, event_id: readUuid, received_at: readInstant });
  return row as unknown as SampleReceipt;
}
/** Only actual complete DTOs become local authority; malformed nested facts invalidate P20. */
export function readSampleSnapshot(value: unknown): SampleSnapshot {
  const row = readRecord(value);
  requireFields(row, {
    organization_id: readUuid,
    user_id: readUuid,
    version: readNonempty,
    as_of: readInstant,
    valid_until: nullable(readInstant),
  });
  if (
    row.schema_version !== 1 ||
    !Array.isArray(row.methods) ||
    !Array.isArray(row.sources) ||
    !Array.isArray(row.receipts)
  )
    throw new CourierContractError();
  const methods = row.methods.map(readMethod),
    sources = row.sources.map(readSource),
    receipts = row.receipts.map(readReceipt);
  distinct(methods.map(({ id }) => id));
  distinct(sources.map(({ kind, id }) => `${kind}:${id}`));
  distinct(receipts.map(({ sample_id }) => sample_id));
  return { ...row, methods, sources, receipts } as unknown as SampleSnapshot;
}
