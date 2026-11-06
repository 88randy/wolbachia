import {
  readCatalog,
  readRules,
  readCatalogItems,
  readParameter,
} from "../ovitrap-check/snapshots.ts";
import type { LifecycleCatalog, LifecycleRules } from "./types.ts";
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
  };
}
