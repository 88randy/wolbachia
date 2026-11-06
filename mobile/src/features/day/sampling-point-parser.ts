import type { Schemas } from "@wolbachia/api-client";
import { isCoordinates, isRecord } from "./assignment-parser.ts";
export type SamplingPoint = Schemas["SamplingPointBundle"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
function identity(
  value: Record<string, unknown>,
): Pick<SamplingPoint, "id" | "block_id" | "quadrant_id"> | null {
  if (!isUuid(value.id) || !isUuid(value.block_id) || !isUuid(value.quadrant_id)) return null;
  return { id: value.id, block_id: value.block_id, quadrant_id: value.quadrant_id };
}
function fields(
  value: Record<string, unknown>,
): Pick<SamplingPoint, "code" | "is_retired" | "version"> | null {
  if (typeof value.code !== "string" || !value.code.trim() || typeof value.is_retired !== "boolean")
    return null;
  if (
    typeof value.version !== "number" ||
    !Number.isSafeInteger(value.version) ||
    value.version < 1
  )
    return null;
  return { code: value.code, is_retired: value.is_retired, version: value.version };
}
function coordinates(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2 || !isCoordinates(value[1], value[0]))
    return null;
  return [Number(value[0]), value[1]];
}
/** Existing #196 schema: malformed rows never provide a location. */
export function parseSamplingPoint(value: unknown): SamplingPoint | null {
  if (!isRecord(value)) return null;
  const ids = identity(value);
  const metadata = fields(value);
  const location = coordinates(value.location);
  return ids === null || metadata === null || location === null
    ? null
    : { ...ids, ...metadata, location };
}
/** A duplicate UUID is ambiguous even if one row is otherwise valid; keep it unavailable. */
export function parseSamplingPoints(rows: readonly unknown[]): readonly SamplingPoint[] {
  const points = new Map<string, SamplingPoint | null>();
  for (const row of rows) {
    if (!isRecord(row) || typeof row.id !== "string") continue;
    points.set(row.id, points.has(row.id) ? null : parseSamplingPoint(row));
  }
  return [...points.values()].filter((point): point is SamplingPoint => point !== null);
}
