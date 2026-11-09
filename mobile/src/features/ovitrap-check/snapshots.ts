import type { ChecklistItem } from "../shift-open/domain.ts";
import type { Catalog, Rules } from "./types.ts";
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function readItem(value: unknown): ChecklistItem {
  if (
    !isRecord(value) ||
    typeof value.code !== "string" ||
    typeof value.label_es !== "string" ||
    typeof value.label_en !== "string" ||
    typeof value.is_other !== "boolean" ||
    typeof value.requires_photo !== "boolean"
  )
    throw new Error("Malformed ovitrap catalog item.");
  return {
    code: value.code,
    label_es: value.label_es,
    label_en: value.label_en,
    is_other: value.is_other,
    requires_photo: value.requires_photo,
  };
}
export function readCatalogItems(
  catalogs: readonly unknown[],
  slug: string,
): readonly ChecklistItem[] {
  const catalog = catalogs.find((entry) => isRecord(entry) && entry.slug === slug);
  if (!isRecord(catalog) || !Array.isArray(catalog.items)) return [];
  return catalog.items.map(readItem);
}
export function readCatalog(value: unknown): Catalog {
  if (
    !isRecord(value) ||
    typeof value.version !== "string" ||
    !value.version ||
    !Array.isArray(value.catalogs)
  )
    throw new Error("Malformed ovitrap catalog.");
  return {
    version: value.version,
    findings: readCatalogItems(value.catalogs, "ovitrap-finding"),
    paddleTypes: readCatalogItems(value.catalogs, "paddle-type"),
    voidReasons: readCatalogItems(value.catalogs, "void-reason"),
  };
}
export function readParameter(parameters: readonly unknown[], key: string): number | null {
  const entry = parameters.find((item) => isRecord(item) && item.key === key);
  return isRecord(entry) && typeof entry.value === "number" && Number.isFinite(entry.value)
    ? entry.value
    : null;
}
function hasValidBounds(accuracy: number | null, distance: number | null): boolean {
  if (accuracy === null || distance === null) return false;
  return accuracy >= 1 && accuracy <= 200 && distance >= 10 && distance <= 200;
}
function nextChangeAt(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    throw new Error("Malformed rule validity.");
  return value;
}
/** The B-14 server contract reviews unusable GPS; absent thresholds never establish compliance. */
export function readRules(value: unknown): Rules {
  if (
    !isRecord(value) ||
    typeof value.version !== "string" ||
    !value.version ||
    !Array.isArray(value.parameters)
  )
    throw new Error("Malformed ovitrap rules.");
  const accuracy = readParameter(value.parameters, "max_gps_accuracy_m");
  const distance = readParameter(value.parameters, "max_distance_to_point_m");
  return {
    version: value.version,
    nextChangeAt: nextChangeAt(value.next_change_at),
    maxAccuracyM: accuracy ?? 50,
    maxDistanceM: distance ?? 50,
    maxPaddleReuses: readParameter(value.parameters, "max_paddle_reuses") ?? 2,
    isConfigured: hasValidBounds(accuracy, distance),
    gpsPolicy: "review",
    stalePolicy: "review",
  };
}
