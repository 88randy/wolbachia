import type { Schemas } from "@wolbachia/api-client";
import type { SqlStatement } from "../../db/sql.ts";
import { courierSection, projectionStatement } from "../ovitrap-lifecycle/projection-record.ts";
import {
  readDate,
  readRecord,
  readUuid,
  readString,
  nullable,
  readBoolean,
  readEnvelope,
  requireResourceIdentity,
} from "../ovitrap-lifecycle/contract-readers.ts";

export interface SupplySource {
  readonly id: string;
  readonly shiftId: string | null;
  readonly originId: string;
  readonly date: string;
  readonly revision: number;
  readonly frame: Schemas["SupplyFrameLine"][];
  readonly receipts: Schemas["SupplyReceiptBundle"][];
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Invalid supply collection.");
  return value as unknown[];
}
function revision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new Error("Invalid supply revision.");
  return value;
}
function quantity(value: unknown): string {
  const result = readString(value);
  if (!/^-?\d+(?:\.\d{1,6})?$/.test(result)) throw new Error("Invalid supply quantity.");
  return result;
}
function frameLine(value: unknown): Schemas["SupplyFrameLine"] {
  const row = readRecord(value);
  return {
    assignment_line_id: readUuid(row.assignment_line_id),
    plan_revision: revision(row.plan_revision),
    planned: quantity(row.planned),
    credited: nullable(quantity)(row.credited),
    used: quantity(row.used),
    returned: quantity(row.returned),
    shrinkage: quantity(row.shrinkage),
    difference: nullable(quantity)(row.difference),
    delivery_variance: nullable(quantity)(row.delivery_variance),
  };
}
function receipt(value: unknown): Schemas["SupplyReceiptBundle"] {
  const row = readRecord(value);
  return {
    id: readUuid(row.id),
    event_id: readUuid(row.event_id),
    source_event_id: readUuid(row.source_event_id),
    release_id: readUuid(row.release_id),
    signature_upload_id: readUuid(row.signature_upload_id),
    voided: readBoolean(row.voided),
    lines: array(row.lines).map((value) => {
      const line = readRecord(value);
      return {
        id: readUuid(line.id),
        release_line_id: readUuid(line.release_line_id),
        quantity: quantity(line.quantity),
      };
    }),
  };
}
/** Decode the consumed subset of the generated SupplyBundle, keeping null custody distinct. */
export function readSupplySource(value: unknown): SupplySource {
  const row = readRecord(value);
  const reconciliation = row.reconciliation === null ? null : readRecord(row.reconciliation);
  const frame = reconciliation?.frame == null ? null : readRecord(reconciliation.frame);
  return {
    id: readUuid(row.id),
    date: readDate(row.date),
    shiftId: nullable(readUuid)(row.shift_id),
    originId: readUuid(row.origin_id),
    revision: reconciliation === null ? 0 : revision(reconciliation.revision),
    frame: frame === null ? [] : array(frame.lines).map(frameLine),
    receipts: array(row.receipts).map(receipt),
  };
}
export function supplyBundleStatements(body: unknown): readonly SqlStatement[] {
  return courierSection(body, "supplies")
    .map(readSupplySource)
    .map((source) =>
      projectionStatement({
        kind: "supply_assignment",
        id: source.id,
        version: "bootstrap",
        sequence: 0,
        body: source,
      }),
    );
}
export function supplyChangeStatements(body: unknown): readonly SqlStatement[] {
  return courierSection(body, "supplies").map((value) => {
    const envelope = readEnvelope(value, ["supply_assignment"]);
    const source = readSupplySource(envelope.data);
    requireResourceIdentity(envelope.resource_id, source.id);
    return projectionStatement({
      kind: "supply_assignment",
      id: source.id,
      version: envelope.resource_version,
      sequence: envelope.sequence,
      body: source,
    });
  });
}
