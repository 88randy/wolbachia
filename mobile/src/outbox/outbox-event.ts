import type { Schemas } from "@wolbachia/api-client";

import type { SqlRow } from "../db/sql.ts";
import { readInteger, readOptionalText, readText } from "../db/sql.ts";
import { isOutboxStatus } from "./outbox-status.ts";
import type { OutboxStatus } from "./outbox-status.ts";

/**
 * The `FieldEvent` envelope exactly as `docs/sync.md` defines it. It comes from the generated API
 * types, so the app cannot drift from the contract. Feature screens (#8, #9, #10, #11) build one
 * per capture and hand it to the sync engine.
 */
export type FieldEventEnvelope = Schemas["SyncEventRequest"];

/** What the server answered for one event (`results[]` of the sync response). */
export interface EventResult {
  readonly code: string;
  readonly params: Readonly<Record<string, unknown>>;
}

/** An event in the outbox: the envelope plus the local columns. */
export interface OutboxEvent {
  readonly seq: number;
  readonly envelope: FieldEventEnvelope;
  readonly status: OutboxStatus;
  readonly attempts: number;
  readonly lastError: string | null;
  readonly result: EventResult | null;
}

/** An event that needs a person's attention, as the inbox lists it. */
export interface ProblemItem {
  readonly id: string;
  readonly type: string;
  readonly status: OutboxStatus;
  readonly deviceTime: string;
  readonly attempts: number;
  readonly lastError: string | null;
  readonly result: EventResult | null;
}

/** Events of one type and status, summarized (the inbox groups by type). */
export interface TypeGroup {
  readonly type: string;
  readonly status: OutboxStatus;
  readonly total: number;
  readonly firstDeviceTime: string;
  readonly lastDeviceTime: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parses a JSON column that must hold an object (payload, params). */
export function parseJsonObject(text: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed)) throw new Error("Expected a JSON object.");
  return parsed;
}

function readGps(text: string | null): FieldEventEnvelope["gps"] {
  if (text === null) return null;
  const gps = parseJsonObject(text);
  const { lat, lng, accuracy_m: accuracyM } = gps;
  if (typeof lat !== "number" || typeof lng !== "number" || typeof accuracyM !== "number") {
    throw new Error("Stored GPS fix is malformed.");
  }
  return { lat, lng, accuracy_m: accuracyM };
}

export function readStatus(row: SqlRow): OutboxStatus {
  const status = readText(row, "local_status");
  if (!isOutboxStatus(status)) throw new Error(`Unknown outbox status: ${status}`);
  return status;
}

export function readResult(row: SqlRow): EventResult | null {
  const code = readOptionalText(row, "result_code");
  if (code === null) return null;
  const params = readOptionalText(row, "result_params");
  return { code, params: params === null ? {} : parseJsonObject(params) };
}

function readEnvelope(row: SqlRow): FieldEventEnvelope {
  return {
    id: readText(row, "id"),
    type: readText(row, "type"),
    schema_version: readInteger(row, "schema_version"),
    device_time: readText(row, "device_time"),
    payload: parseJsonObject(readText(row, "payload")),
    shift_id: readOptionalText(row, "shift_id"),
    gps: readGps(readOptionalText(row, "gps")),
    rules_version: readText(row, "rules_version"),
    catalog_version: readText(row, "catalog_version"),
    manual_capture: readInteger(row, "manual_capture") === 1,
    voids_event_id: readOptionalText(row, "voids_event_id"),
  };
}

export function toOutboxEvent(row: SqlRow): OutboxEvent {
  return {
    seq: readInteger(row, "seq"),
    envelope: readEnvelope(row),
    status: readStatus(row),
    attempts: readInteger(row, "attempts"),
    lastError: readOptionalText(row, "last_error"),
    result: readResult(row),
  };
}

export function toProblemItem(row: SqlRow): ProblemItem {
  return {
    id: readText(row, "id"),
    type: readText(row, "type"),
    status: readStatus(row),
    deviceTime: readText(row, "device_time"),
    attempts: readInteger(row, "attempts"),
    lastError: readOptionalText(row, "last_error"),
    result: readResult(row),
  };
}

export function toTypeGroup(row: SqlRow): TypeGroup {
  return {
    type: readText(row, "type"),
    status: readStatus(row),
    total: readInteger(row, "total"),
    firstDeviceTime: readText(row, "first_time"),
    lastDeviceTime: readText(row, "last_time"),
  };
}
