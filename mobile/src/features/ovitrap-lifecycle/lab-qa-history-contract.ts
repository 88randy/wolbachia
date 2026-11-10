import type { Schemas } from "@wolbachia/api-client";
import {
  CourierContractError,
  choice,
  nullable,
  readInstant,
  readRecord,
  readSubjects,
  readUuid,
  requireFields,
} from "./contract-readers.ts";

export const LAB_QA_HISTORY_KINDS = [
  "lab_recount",
  "lab_adjudication",
  "lab_paddle_reuse",
] as const;
type LabQAHistoryEntry = Schemas["LabQAHistoryEntry"];
const IDENTITY_FIELD = {
  lab_recount: "attempt_id",
  lab_adjudication: "resolution_id",
  lab_paddle_reuse: "reuse_id",
} as const;

function readCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new CourierContractError();
  return value;
}
function requireFactShape(entry: LabQAHistoryEntry): void {
  const field = IDENTITY_FIELD[entry.kind];
  const invalidIdentity = Object.values(IDENTITY_FIELD).some((candidate) =>
    candidate === field
      ? entry[candidate]?.toLowerCase() !== entry.id.toLowerCase()
      : entry[candidate] !== null,
  );
  const isReuse = entry.kind === "lab_paddle_reuse";
  if (
    invalidIdentity ||
    (entry.request_id === null) !== isReuse ||
    (entry.value === null) !== isReuse ||
    (entry.method_version_id === null) !== (entry.kind === "lab_adjudication")
  )
    throw new CourierContractError();
}
const QA_FIELDS = {
  id: readUuid,
  kind: choice(LAB_QA_HISTORY_KINDS),
  bag_id: readUuid,
  reading_id: readUuid,
  source_event_id: readUuid,
  source_device_time: readInstant,
  source_server_received_at: readInstant,
  recorded_at: readInstant,
  author_id: readUuid,
  count_id: readUuid,
  request_id: nullable(readUuid),
  attempt_id: nullable(readUuid),
  resolution_id: nullable(readUuid),
  reuse_id: nullable(readUuid),
  value: nullable(readCount),
  method_version_id: nullable(readUuid),
  subjects: readSubjects,
};
/** Decode the genuine typed QA facts without synthesizing review or capture authority. */
export function readLabQAHistoryEntry(value: unknown): LabQAHistoryEntry {
  const row = readRecord(value);
  requireFields(row, QA_FIELDS);
  const entry = { ...row, subjects: readSubjects(row.subjects) } as LabQAHistoryEntry;
  requireFactShape(entry);
  return entry;
}
