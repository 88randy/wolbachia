import type { Schemas } from "@wolbachia/api-client";
import {
  CourierContractError,
  choice,
  nullable,
  readInstant,
  readRecord,
  readString,
  readSubjects,
  readUuid,
} from "./contract-readers.ts";

const SUPPLY_SOURCES = [
  "plan",
  "release",
  "cancel",
  "receipt",
  "reconcile",
  "return",
  "justify",
  "bag_disposal",
] as const;
export const SUPPLY_HISTORY_KINDS = SUPPLY_SOURCES.map((source) => `supply_${source}` as const);

/** Validate canonical custody provenance without materializing stock or capture authority. */
export function readSupplyHistoryEntry(value: unknown): Schemas["SupplyHistoryEntry"] {
  const row = readRecord(value);
  const entry = {
    id: readUuid(row.id),
    kind: choice(SUPPLY_HISTORY_KINDS)(row.kind),
    source_kind: choice(SUPPLY_SOURCES)(row.source_kind),
    assignment_id: nullable(readUuid)(row.assignment_id),
    bag_id: nullable(readUuid)(row.bag_id),
    actor_id: readUuid(row.actor_id),
    at: readInstant(row.at),
    subjects: readSubjects(row.subjects),
    source_event_id: nullable(readUuid)(row.source_event_id),
    source_status: nullable(choice(["accepted", "in_review", "rejected"] as const))(
      row.source_status,
    ),
    source_code: nullable(readString)(row.source_code),
    voided_at: nullable(readInstant)(row.voided_at),
  };
  requireSupplyIdentity(entry);
  return entry;
}

function requireSupplyIdentity(entry: Schemas["SupplyHistoryEntry"]): void {
  if (entry.kind !== `supply_${entry.source_kind}`) throw new CourierContractError();
  if (entry.kind === "supply_bag_disposal") {
    if (entry.bag_id === null || entry.assignment_id !== null) throw new CourierContractError();
  } else if (entry.assignment_id === null || entry.bag_id !== null)
    throw new CourierContractError();
  requireSupplySource(entry);
}

function requireSupplySource(entry: Schemas["SupplyHistoryEntry"]): void {
  const sourceRequired = ["receipt", "reconcile", "bag_disposal"].includes(entry.source_kind);
  if (sourceRequired) {
    if (
      entry.source_event_id === null ||
      entry.source_status === null ||
      entry.source_code === null
    )
      throw new CourierContractError();
  } else if (
    entry.source_event_id !== null ||
    entry.source_status !== null ||
    entry.source_code !== null ||
    entry.voided_at !== null
  )
    throw new CourierContractError();
}
