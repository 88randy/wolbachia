import type { ChecklistCatalog, ChecklistItem, MotorcycleOption } from "./domain.ts";
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
  ) {
    throw new Error("Malformed safety checklist item.");
  }
  return {
    code: value.code,
    label_es: value.label_es,
    label_en: value.label_en,
    is_other: value.is_other,
    requires_photo: value.requires_photo,
  };
}
function readItems(
  catalogs: readonly unknown[],
  slug = "motorcycle-check-item",
): readonly ChecklistItem[] {
  const checklist = catalogs.find((entry) => isRecord(entry) && entry.slug === slug);
  if (checklist === undefined) return [];
  if (!isRecord(checklist) || !Array.isArray(checklist.items))
    throw new Error("Malformed safety checklist.");
  return checklist.items.map(readItem);
}
function blockedCodes(motorcycles: unknown): readonly string[] {
  if (motorcycles === undefined) return [];
  if (!Array.isArray(motorcycles)) throw new Error("Malformed motorcycle snapshot.");
  return motorcycles.flatMap((value: unknown) => {
    if (!isRecord(value) || typeof value.code !== "string" || typeof value.is_blocked !== "boolean")
      throw new Error("Malformed motorcycle snapshot item.");
    return value.is_blocked ? [value.code] : [];
  });
}
function motorcycleOptions(motorcycles: unknown): readonly MotorcycleOption[] {
  if (!Array.isArray(motorcycles)) return [];
  return motorcycles.flatMap((value: unknown) =>
    isRecord(value) && typeof value.code === "string"
      ? [
          {
            code: value.code,
            plate: typeof value.plate === "string" ? value.plate : "",
            isBlocked: value.is_blocked === true,
          },
        ]
      : [],
  );
}

/** Runtime shape follows docs/sync.md and backend CatalogSnapshotViewSet: an object, despite the generated list annotation. */
export function readCatalogSnapshot(value: unknown): ChecklistCatalog {
  if (
    !isRecord(value) ||
    typeof value.version !== "string" ||
    !value.version ||
    !Array.isArray(value.catalogs)
  )
    throw new Error("Malformed catalog snapshot.");
  return {
    version: value.version,
    items: readItems(value.catalogs),
    blockedMotorcycles: blockedCodes(value.motorcycles),
    motorcycles: motorcycleOptions(value.motorcycles),
    sampleOrigins: readItems(value.catalogs, "sample-origin"),
  };
}
export function readRulesSnapshot(value: unknown): {
  readonly version: string;
  readonly parameters: readonly unknown[];
} {
  if (!isRecord(value) || typeof value.version !== "string" || !Array.isArray(value.parameters))
    throw new Error("Malformed rules snapshot.");
  return { version: value.version, parameters: value.parameters };
}

/** Rule `departure_requires_offline_map` (0/1). Missing, malformed or 0 means "recommended, not required". */
export function readRequiresOfflineMap(rules: unknown): boolean {
  if (!isRecord(rules) || !Array.isArray(rules.parameters)) return false;
  const rule = rules.parameters.find(
    (entry: unknown) => isRecord(entry) && entry.key === "departure_requires_offline_map",
  ) as Record<string, unknown> | undefined;
  return rule?.value === 1;
}
