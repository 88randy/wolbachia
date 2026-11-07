import type { Schemas } from "@wolbachia/api-client";
import { isCoordinates, isRecord } from "../day/assignment-parser.ts";
import { UUID_PATTERN } from "../ovitrap-check/domain.ts";

export class CourierContractError extends Error {
  readonly boundary: "body" | "envelope";
  constructor(boundary: "body" | "envelope" = "body") {
    super(`Invalid courier ${boundary} contract.`);
    this.name = "CourierContractError";
    this.boundary = boundary;
  }
}
export function readRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new CourierContractError();
  return value;
}
export function readString(value: unknown): string {
  if (typeof value !== "string") throw new CourierContractError();
  return value;
}
export function readNonempty(value: unknown): string {
  const text = readString(value);
  if (!text.trim()) throw new CourierContractError();
  return text;
}
export function readUuid(value: unknown): string {
  const uuid = readString(value);
  if (!UUID_PATTERN.test(uuid)) throw new CourierContractError();
  return uuid;
}
export function readBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new CourierContractError();
  return value;
}
export function readPositiveInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1)
    throw new CourierContractError();
  return value;
}
export function nullable<Result>(reader: (value: unknown) => Result) {
  return (value: unknown): Result | null => (value === null ? null : reader(value));
}
export function choice<Choice extends string>(values: readonly Choice[]) {
  return (value: unknown): Choice => {
    if (typeof value !== "string" || !values.includes(value as Choice))
      throw new CourierContractError();
    return value as Choice;
  };
}
export function readDate(value: unknown): string {
  const date = readString(value);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    throw new CourierContractError();
  return date;
}
export function readInstant(value: unknown): string {
  const instant = readString(value);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(instant) ||
    !Number.isFinite(Date.parse(instant))
  )
    throw new CourierContractError();
  readDate(instant.slice(0, 10));
  return instant;
}
export function readCoordinates(value: unknown): number[] {
  if (!Array.isArray(value) || value.length !== 2) throw new CourierContractError();
  const [longitude, latitude] = value as unknown[];
  if (typeof longitude !== "number" || !isCoordinates(latitude, longitude))
    throw new CourierContractError();
  return [longitude, latitude];
}
export function readSubjects(value: unknown): Schemas["HistorySubject"][] {
  if (!Array.isArray(value) || value.length === 0) throw new CourierContractError();
  return value.map((entry: unknown) => {
    const row = readRecord(entry);
    return {
      center_id: nullable(readUuid)(row.center_id),
      quadrant_id: nullable(readUuid)(row.quadrant_id),
    };
  });
}
export function requireFields(
  row: Record<string, unknown>,
  readers: Record<string, (value: unknown) => unknown>,
): void {
  for (const [key, read] of Object.entries(readers)) read(row[key]);
}
function envelope(value: unknown, resourceTypes: readonly string[]) {
  const row = readRecord(value);
  const resourceType = choice(resourceTypes)(row.resource_type);
  if (row.action !== "upsert") throw new CourierContractError();
  return {
    sequence: readPositiveInteger(row.sequence),
    action: "upsert" as const,
    resource_type: resourceType,
    resource_id: readUuid(row.resource_id),
    resource_version: readNonempty(row.resource_version),
    data: row.data,
  };
}
/** Envelope errors reject the page; a validated identity lets its owner invalidate a bad body. */
export function readEnvelope(value: unknown, resourceTypes: readonly string[]) {
  try {
    return envelope(value, resourceTypes);
  } catch (error) {
    if (error instanceof CourierContractError) throw new CourierContractError("envelope");
    throw error;
  }
}
export function requireResourceIdentity(envelopeId: string, bodyId: string): void {
  if (envelopeId.toLowerCase() !== bodyId.toLowerCase()) throw new CourierContractError("envelope");
}
