import type { AssignedTask, MapManifest, ProjectionChange } from "./types.ts";
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function isCoordinates(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}
function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
export function readVersion(value: unknown): string | null {
  if (isText(value)) return value;
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? String(value)
    : null;
}
function readHistory(value: unknown): AssignedTask["history"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: unknown) =>
    isRecord(entry) &&
    isText(entry.date) &&
    Number.isFinite(Date.parse(entry.date)) &&
    isText(entry.summary_code)
      ? [{ date: entry.date, summary_code: entry.summary_code }]
      : [],
  );
}
/** Allocation metadata is deliberately excluded from task rendering and unreadable counts. */
export function isQuadrantAssignment(value: unknown): boolean {
  return isRecord(value) && value.kind === "quadrant_assignment";
}
function hasAssignmentFields(value: Record<string, unknown>): boolean {
  return (
    value.kind === "task" &&
    ["id", "code", "point", "quadrant_id", "courier"].every((key) => isText(value[key])) &&
    (value.action === "place" || value.action === "check")
  );
}
/** Optional enrichment never fabricates coordinates or rejects an otherwise valid scheduling task. */
export function hasCoordinates<T extends { readonly lat?: number; readonly lng?: number }>(
  point: T,
): point is T & { readonly lat: number; readonly lng: number } {
  return isCoordinates(point.lat, point.lng);
}
function pointDetails(value: Record<string, unknown>) {
  return {
    ...(isCoordinates(value.lat, value.lng) ? { lat: value.lat, lng: Number(value.lng) } : {}),
    ...(isText(value.block_code) ? { block_code: value.block_code } : {}),
    ...(isText(value.ovitrap_id) ? { ovitrap_id: value.ovitrap_id } : {}),
    ...(isText(value.reference) ? { reference: value.reference } : {}),
    history: readHistory(value.history),
  };
}
function isDateOnly(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function isManifestChecksum(value: unknown): value is string {
  return typeof value === "string" && (value === "" || /^[a-fA-F0-9]{64}$/.test(value));
}
/** One scheduling boundary: code/revision/category/point map to the local task vocabulary. */
export function parseAssignment(value: unknown): AssignedTask | null {
  if (!isRecord(value) || !hasAssignmentFields(value)) return null;
  if ("is_completed" in value && typeof value.is_completed !== "boolean") return null;
  const version = readVersion(value.revision);
  if (version === null || !isDateOnly(value.date)) return null;
  return {
    id: String(value.id),
    point_code: String(value.code),
    point_id: String(value.point),
    courier: String(value.courier),
    action: value.action as AssignedTask["action"],
    date: value.date,
    risk: value.category === "high" ? "high" : "normal",
    version,
    quadrant_id: String(value.quadrant_id),
    ...(typeof value.is_completed === "boolean" ? { isCompleted: value.is_completed } : {}),
    ...pointDetails(value),
  };
}
/** Empty version/checksum and zero size are reported unavailable states, not malformed rows. */
export function parseManifest(value: unknown): MapManifest | null {
  if (!isRecord(value)) return null;
  const version = value.version === "" ? "" : readVersion(value.version);
  if (!isText(value.asset_id) || !isText(value.quadrant_id) || version === null) return null;
  if (!isManifestChecksum(value.sha256)) return null;
  if (!isNonnegativeInteger(value.size_bytes) || typeof value.licensed !== "boolean") return null;
  return {
    asset_id: value.asset_id,
    quadrant_id: value.quadrant_id,
    version,
    sha256: value.sha256.toLowerCase(),
    size_bytes: value.size_bytes,
    licensed: value.licensed,
  };
}
/** Availability is independent of structural parsing; an unavailable asset must replace cached coverage. */
export function isManifestAvailable(manifest: MapManifest): boolean {
  return (
    manifest.licensed &&
    manifest.version.trim().length > 0 &&
    manifest.sha256.length > 0 &&
    manifest.size_bytes > 0
  );
}
export function parseChanges(value: unknown): readonly ProjectionChange[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("Malformed projection changes.");
  return value
    .map((entry: unknown): ProjectionChange => {
      if (
        !isRecord(entry) ||
        !Number.isSafeInteger(entry.sequence) ||
        Number(entry.sequence) < 0 ||
        !isText(entry.resource_id) ||
        !isText(entry.resource_type)
      )
        throw new Error("Malformed projection change.");
      const version = readVersion(entry.resource_version);
      if (version === null || (entry.action !== "upsert" && entry.action !== "remove"))
        throw new Error("Malformed change version or action.");
      return {
        sequence: Number(entry.sequence),
        action: entry.action,
        resource_type: entry.resource_type,
        resource_id: entry.resource_id,
        resource_version: version,
        data: entry.data,
      };
    })
    .sort((left, right) => left.sequence - right.sequence);
}
