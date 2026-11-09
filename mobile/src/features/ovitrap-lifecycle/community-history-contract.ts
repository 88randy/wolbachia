import type { Schemas } from "@wolbachia/api-client";
import {
  CourierContractError,
  choice,
  readBoolean,
  readDate,
  readInstant,
  readNonempty,
  readPositiveInteger,
  readRecord,
  readString,
  readSubjects,
  readUuid,
} from "./contract-readers.ts";

function readAttendance(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new CourierContractError();
  return value;
}

function readType(value: unknown): Schemas["CommunityTypeSnapshot"] {
  const row = readRecord(value);
  return {
    ...(row.id === undefined ? {} : { id: readUuid(row.id) }),
    code: readNonempty(row.code),
    label_es: readNonempty(row.label_es),
    label_en: readString(row.label_en),
    is_other: readBoolean(row.is_other),
    requires_photo: readBoolean(row.requires_photo),
  };
}

/** Aggregate history is validated, never adopted as a lifecycle draft or permission. */
export function readCommunityHistoryEntry(value: unknown): Schemas["CommunityHistoryEntry"] {
  const row = readRecord(value);
  const entry = {
    id: readUuid(row.id),
    kind: choice(["community_activity"])(row.kind),
    activity_id: readUuid(row.activity_id),
    event_id: readUuid(row.event_id),
    command_id: readUuid(row.command_id),
    code: readNonempty(row.code),
    revision: readPositiveInteger(row.revision),
    type_id: readUuid(row.type_id),
    type_snapshot: readType(row.type_snapshot),
    zone_id: readUuid(row.zone_id),
    zone_version_id: readUuid(row.zone_version_id),
    activity_date: readDate(row.activity_date),
    attendance: readAttendance(row.attendance),
    is_voided: readBoolean(row.is_voided),
    source_event_id: readUuid(row.source_event_id),
    source_device_time: readInstant(row.source_device_time),
    source_server_received_at: readInstant(row.source_server_received_at),
    subjects: readSubjects(row.subjects),
  };
  requireCommunityIdentity(entry);
  return entry;
}

function requireCommunityIdentity(entry: Schemas["CommunityHistoryEntry"]): void {
  if (
    entry.id.toLowerCase() !== entry.activity_id.toLowerCase() ||
    entry.source_event_id.toLowerCase() !== entry.activity_id.toLowerCase() ||
    (entry.revision === 1 && entry.command_id.toLowerCase() !== entry.activity_id.toLowerCase()) ||
    entry.revision > 2 ||
    entry.is_voided !== (entry.revision === 2)
  )
    throw new CourierContractError();
  if (
    entry.type_snapshot.id !== undefined &&
    entry.type_snapshot.id.toLowerCase() !== entry.type_id.toLowerCase()
  )
    throw new CourierContractError();
}
