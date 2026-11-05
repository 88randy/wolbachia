import type { Schemas } from "@wolbachia/api-client";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableText(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function hasResultFields(value: JsonObject): boolean {
  return typeof value.code === "string" && isObject(value.params);
}

function isEventResult(value: unknown): boolean {
  if (!isObject(value)) return false;
  const validStatus =
    typeof value.status === "string" &&
    ["accepted", "rejected", "in_review"].includes(value.status);
  return typeof value.id === "string" && validStatus && hasResultFields(value);
}

function isReview(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.event_id === "string" &&
    typeof value.created_at === "string" &&
    (value.kind === "rejected" || value.kind === "in_review") &&
    hasResultFields(value)
  );
}

function isChanges(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    isNullableText(value.cursor) &&
    isNullableText(value.catalog_version) &&
    isNullableText(value.rules_version) &&
    typeof value.has_more === "boolean" &&
    Array.isArray(value.reviews) &&
    value.reviews.every(isReview)
  );
}

/** Runtime boundary for a 200 sync answer. Generated types cannot validate network JSON. */
export function isSyncResponse(value: unknown): value is Schemas["SyncResponse"] {
  if (!isObject(value)) return false;
  return (
    typeof value.server_time === "string" &&
    Array.isArray(value.results) &&
    value.results.every(isEventResult) &&
    isChanges(value.changes)
  );
}
