import type { Schemas } from "@wolbachia/api-client";
import { UUID_PATTERN } from "../ovitrap-check/domain.ts";
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid courier projection.");
  return value as Record<string, unknown>;
}
function reference(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value))
    throw new Error("Invalid projection UUID.");
  return value;
}
export function readOvitrap(value: unknown): Schemas["OvitrapBundle"] {
  const trap = record(value);
  if (
    reference(trap.id) !== reference(trap.client_uuid) ||
    typeof trap.version !== "string" ||
    typeof trap.placement_voided !== "boolean" ||
    (trap.is_retired !== undefined && typeof trap.is_retired !== "boolean")
  )
    throw new Error("Invalid courier physical identity.");
  reference(trap.sampling_point_id);
  return trap as Schemas["OvitrapBundle"];
}
export function readPoint(value: unknown): Schemas["SamplingPointBundle"] {
  const point = record(value);
  reference(point.id);
  const location = point.location;
  if (
    !Array.isArray(location) ||
    location.length !== 2 ||
    !location.every(
      (coordinate: unknown) => typeof coordinate === "number" && Number.isFinite(coordinate),
    )
  )
    throw new Error("Invalid courier coordinates.");
  const [longitude, latitude] = location as number[];
  if (
    longitude === undefined ||
    latitude === undefined ||
    Math.abs(longitude) > 180 ||
    Math.abs(latitude) > 90 ||
    typeof point.code !== "string" ||
    typeof point.is_retired !== "boolean"
  )
    throw new Error("Invalid courier point.");
  return point as Schemas["SamplingPointBundle"];
}
export function readChange(value: unknown, kind: string) {
  const change = record(value);
  if (
    change.action !== "upsert" ||
    change.resource_type !== kind ||
    !Number.isSafeInteger(change.sequence) ||
    typeof change.sequence !== "number" ||
    change.sequence < 1 ||
    typeof change.resource_version !== "string"
  )
    throw new Error("Invalid courier change envelope.");
  return {
    id: reference(change.resource_id),
    version: change.resource_version,
    sequence: change.sequence,
    body: change.data,
  };
}
