import {
  readCatalog,
  readRules,
  readCatalogItems,
  readParameter,
} from "../ovitrap-check/snapshots.ts";
import type { LifecycleCatalog, LifecycleRules } from "./types.ts";
import { UUID_PATTERN } from "../ovitrap-check/domain.ts";
export function readLifecycleCatalog(value: unknown): LifecycleCatalog {
  const base = readCatalog(value);
  if (
    typeof value !== "object" ||
    value === null ||
    !("catalogs" in value) ||
    !Array.isArray(value.catalogs)
  )
    throw new Error("Invalid lifecycle catalogs.");
  return {
    version: base.version,
    voidReasons: base.voidReasons,
    replace: readCatalogItems(value.catalogs, "replacement-reason"),
    relocate: readCatalogItems(value.catalogs, "relocation-reason"),
    remove: readCatalogItems(value.catalogs, "removal-reason"),
  };
}
function threshold(parameters: readonly unknown[], key: string, maximum: number): number | null {
  const value = readParameter(parameters, key);
  return value !== null && Number.isInteger(value) && value >= 1 && value <= maximum ? value : null;
}
function proofFields(row: Record<string, unknown>) {
  if (typeof row.version_id !== "string" || !UUID_PATTERN.test(row.version_id)) return null;
  if (
    typeof row.effective_from !== "string" ||
    !/([zZ]|[+-]\d{2}:\d{2})$/.test(row.effective_from) ||
    !Number.isFinite(Date.parse(row.effective_from))
  )
    return null;
  if (typeof row.value !== "number" || !Number.isFinite(row.value)) return null;
  return { version_id: row.version_id, effective_from: row.effective_from, value: row.value };
}
function parameterProof(parameters: readonly unknown[], key: string) {
  const matches = parameters.filter(
    (item) => typeof item === "object" && item !== null && "key" in item && item.key === key,
  );
  const row = matches[0];
  if (matches.length !== 1 || typeof row !== "object" || row === null) return null;
  return proofFields(row as Record<string, unknown>);
}
export function readLifecycleRules(value: unknown): LifecycleRules {
  const base = readRules(value);
  if (
    typeof value !== "object" ||
    value === null ||
    !("parameters" in value) ||
    !Array.isArray(value.parameters)
  )
    throw new Error("Invalid lifecycle rules.");
  return {
    ...base,
    closedHouseWeeks: threshold(value.parameters, "closed_house_weeks_to_relocate", 8),
    incidents: threshold(value.parameters, "incidents_to_relocate", 10),
    relocationParameters: {
      closedHouseWeeks: parameterProof(value.parameters, "closed_house_weeks_to_relocate"),
      incidents: parameterProof(value.parameters, "incidents_to_relocate"),
    },
  };
}
