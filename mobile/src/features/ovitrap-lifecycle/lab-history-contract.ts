import type { Schemas } from "@wolbachia/api-client";
import {
  CourierContractError,
  choice,
  nullable,
  readBoolean,
  readInstant,
  readRecord,
  readString,
  readSubjects,
  readUuid,
} from "./contract-readers.ts";

type LabHistoryEntry = Schemas["LabHistoryEntry"];
export const LAB_HISTORY_KINDS = [
  "lab_receipt",
  "lab_discrepancy",
  "lab_count",
  "lab_rejection",
  "lab_void",
] as const;
const QA_STATES = ["not_requested", "awaiting_independent_qa", "superseded"] as const;
const DECIMAL_9_6 = /^-?\d{1,3}(?:\.\d{1,6})?$/;
const MAX_PERCENT = 100;

function readCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new CourierContractError();
  return value;
}
function readPercent(value: unknown): string {
  const text = readString(value);
  const number = Number(text);
  if (!DECIMAL_9_6.test(text) || !Number.isFinite(number) || number < 0 || number > MAX_PERCENT)
    throw new CourierContractError();
  return text;
}
function readFields(row: Record<string, unknown>): LabHistoryEntry {
  return {
    id: readUuid(row.id),
    kind: choice(LAB_HISTORY_KINDS)(row.kind),
    reading_id: readUuid(row.reading_id),
    bag_id: nullable(readUuid)(row.bag_id),
    source_event_id: readUuid(row.source_event_id),
    recorded_at: readInstant(row.recorded_at),
    author_id: readUuid(row.author_id),
    source_device_time: readInstant(row.source_device_time),
    source_server_received_at: readInstant(row.source_server_received_at),
    subjects: readSubjects(row.subjects),
    count_id: nullable(readUuid)(row.count_id),
    rejection_id: nullable(readUuid)(row.rejection_id),
    value: nullable(readCount)(row.value),
    viability_percent: nullable(readPercent)(row.viability_percent),
    qa_state: choice(QA_STATES)(row.qa_state),
    voided: readBoolean(row.voided),
    incident_id: nullable(readUuid)(row.incident_id),
    configuration_pending: readBoolean(row.configuration_pending),
    method_version_id: nullable(readUuid)(row.method_version_id),
    reason: nullable(readString)(row.reason),
  };
}
function requireShape(condition: boolean): void {
  if (!condition) throw new CourierContractError();
}
function allNull(values: readonly unknown[]): boolean {
  return values.every((value) => value === null);
}
function readReceipt(row: LabHistoryEntry): void {
  requireShape(
    allNull([
      row.count_id,
      row.rejection_id,
      row.value,
      row.viability_percent,
      row.method_version_id,
      row.incident_id,
      row.reason,
    ]),
  );
  requireShape(row.qa_state === "not_requested" && !row.voided && !row.configuration_pending);
}
function readDiscrepancy(row: LabHistoryEntry): void {
  requireShape(
    allNull([
      row.count_id,
      row.rejection_id,
      row.value,
      row.viability_percent,
      row.method_version_id,
    ]),
  );
  requireShape(row.reason !== null && row.qa_state === "not_requested" && !row.voided);
  requireShape(row.configuration_pending === (row.incident_id === null));
}
function readCountFact(row: LabHistoryEntry): void {
  requireShape(row.count_id?.toLowerCase() === row.id.toLowerCase());
  requireShape(row.rejection_id === null && row.value !== null);
  requireShape(allNull([row.incident_id, row.reason]) && !row.configuration_pending);
  requireShape(row.viability_percent === null || row.method_version_id !== null);
}
function readRejection(row: LabHistoryEntry): void {
  requireShape(row.rejection_id?.toLowerCase() === row.id.toLowerCase());
  requireShape(allNull([row.count_id, row.value, row.viability_percent, row.incident_id]));
  requireShape(row.method_version_id !== null && row.reason !== null);
  requireShape(row.qa_state === "not_requested" && !row.configuration_pending);
}
function readVoid(row: LabHistoryEntry): void {
  requireShape((row.count_id === null) !== (row.rejection_id === null));
  requireShape(allNull([row.value, row.viability_percent, row.method_version_id, row.incident_id]));
  requireShape(row.voided && row.reason !== null);
  requireShape(row.qa_state === "not_requested" && !row.configuration_pending);
}
const FACT_READERS: Record<LabHistoryEntry["kind"], (row: LabHistoryEntry) => void> = {
  lab_receipt: readReceipt,
  lab_discrepancy: readDiscrepancy,
  lab_count: readCountFact,
  lab_rejection: readRejection,
  lab_void: readVoid,
};
/** Validate all saved Lab facts before a consumer may deliberately exclude them. */
export function readLabHistoryEntry(value: unknown): LabHistoryEntry {
  const entry = readFields(readRecord(value));
  requireShape(entry.kind === "lab_receipt" || entry.bag_id !== null);
  FACT_READERS[entry.kind](entry);
  return entry;
}
