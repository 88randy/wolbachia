import type { Schemas } from "@wolbachia/api-client";

/** Validate the cached/network boundary using generated schema names, without duplicating API types. */
export function isRulesSnapshot(value: unknown): value is Schemas["RulesSnapshot"] {
  if (typeof value !== "object" || value === null) return false;
  if (!("version" in value) || typeof value.version !== "string") return false;
  if (
    !("next_change_at" in value) ||
    !(value.next_change_at === null || typeof value.next_change_at === "string")
  )
    return false;
  return (
    "parameters" in value && Array.isArray(value.parameters) && value.parameters.every(isParameter)
  );
}

function isParameter(value: unknown): value is Schemas["SnapshotParameter"] {
  if (typeof value !== "object" || value === null) return false;
  return (
    "key" in value &&
    typeof value.key === "string" &&
    "value" in value &&
    (value.value === null || typeof value.value === "number")
  );
}
