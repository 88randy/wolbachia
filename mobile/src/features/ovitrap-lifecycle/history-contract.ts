import type { Schemas } from "@wolbachia/api-client";
import {
  CourierContractError,
  choice,
  nullable,
  readBoolean,
  readCoordinates,
  readDate,
  readEnvelope,
  readInstant,
  readNonempty,
  readPositiveInteger,
  readRecord,
  readString,
  readSubjects,
  readUuid,
  requireFields,
  requireResourceIdentity,
} from "./contract-readers.ts";

const HISTORY_KINDS = [
  "review_decision",
  "shift_validation",
  "relocation_proposal",
  "transfer_custody",
] as const;
const REVIEW_FIELDS = {
  id: readUuid,
  review_item_id: nullable(readUuid),
  source_event_id: nullable(readUuid),
  shift_id: nullable(readUuid),
  decision_kind: choice(["accept", "void", "open_incident", "approve", "observe"]),
  revision: readPositiveInteger,
  is_terminal: nullable(readBoolean),
  decision_state: choice(["pending", "accepted", "voided", "approved", "observed"]),
  reason: readString,
  decided_by: readUuid,
  decided_at: readInstant,
  subjects: readSubjects,
  source_status: nullable(choice(["accepted", "in_review", "rejected"])),
  source_code: nullable(readString),
  effect_state: choice([
    "applied_review",
    "adopted_legacy",
    "discarded",
    "incident_open",
    "approved",
    "observed",
  ]),
  incident_id: nullable(readUuid),
  declared_void_target_uuid: nullable(readUuid),
  approval_current: nullable(readBoolean),
};
function readRelocationDecision(value: unknown): Schemas["RelocationHistoryDecision"] {
  const row = readRecord(value);
  requireFields(row, {
    id: readUuid,
    decision: choice(["approved", "rejected"]),
    reason: nullable(readString),
    decided_at: nullable(readInstant),
    published_point_version: nullable(readUuid),
  });
  return { ...row } as Schemas["RelocationHistoryDecision"];
}
function readTask(value: unknown): Schemas["RelocationHistoryTask"] {
  const row = readRecord(value);
  return { id: readUuid(row.id), code: readNonempty(row.code), due_date: readDate(row.due_date) };
}
function readRelocation(row: Record<string, unknown>): Schemas["RelocationHistoryEntry"] {
  requireFields(row, {
    id: readUuid,
    proposal_event_id: readUuid,
    point_id: readUuid,
    point_code: readNonempty,
    status: choice(["pending", "approved", "rejected"]),
    source_voided_at: nullable(readInstant),
  });
  return {
    ...row,
    proposed_location: readCoordinates(row.proposed_location),
    decision: nullable(readRelocationDecision)(row.decision),
    next_day_task: row.next_day_task === undefined ? null : nullable(readTask)(row.next_day_task),
    subjects: readSubjects(row.subjects),
  } as Schemas["RelocationHistoryEntry"];
}
function readTransfer(row: Record<string, unknown>): Schemas["TransferHistoryEntry"] {
  requireFields(row, {
    id: readUuid,
    transfer_id: readUuid,
    transfer_code: readNonempty,
    phase: choice(["dispatch", "receive"]),
    revision: readPositiveInteger,
    manifest_hash: readNonempty,
    source_event_id: readUuid,
    source_status: choice(["accepted", "in_review", "rejected"]),
    source_code: readString,
    voided_at: nullable(readInstant),
  });
  return { ...row, subjects: readSubjects(row.subjects) } as Schemas["TransferHistoryEntry"];
}
/** Shared history schema3 retains each real domain branch without inventing review fields. */
export function readHistoryEntry(value: unknown): Schemas["CourierHistoryEntry"] {
  const row = readRecord(value);
  const kind = choice(HISTORY_KINDS)(row.kind);
  if (kind === "relocation_proposal") return readRelocation(row);
  if (kind === "transfer_custody") return readTransfer(row);
  requireFields(row, REVIEW_FIELDS);
  return { ...row, subjects: readSubjects(row.subjects) } as Schemas["ReviewHistoryEntry"];
}
/** Unknown discriminants cannot be silently dropped while the caller settles its cursor. */
export function readHistoryChange(value: unknown): Schemas["HistoryChange"] {
  const change = readEnvelope(
    value,
    HISTORY_KINDS.map((kind) => `history.${kind}`),
  );
  const body = readRecord(change.data);
  if (typeof body.kind !== "string" || change.resource_type !== `history.${body.kind}`)
    throw new CourierContractError("envelope");
  requireResourceIdentity(change.resource_id, readUuid(body.id));
  const data = readHistoryEntry(body);
  if (change.resource_type !== `history.${data.kind}`) throw new CourierContractError("envelope");
  requireResourceIdentity(change.resource_id, data.id);
  return { ...change, data };
}
