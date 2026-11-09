import { readTableState } from "../data-table/table-state";
import { scopedTableSearch } from "../data-table/table-url-scope";
import type { SearchPatch } from "../data-table/table-types";
import { CATALOG_TABLE } from "./catalog-table";
type RawSearch = Readonly<Record<string, unknown>>;

function availabilityOf(search: RawSearch) {
  const value = search["is_active"];
  return typeof value === "string"
    ? value
    : search["include_deactivated"] === "true"
      ? "all"
      : "true";
}

/** `all` belongs to the URL only: the server receives no availability parameter for that state. */
export function readCatalogTableState(search: RawSearch) {
  const { include_deactivated: legacy, ...items } = search;
  const table = scopedTableSearch(items, { ignoredPrefixes: ["catalog_"] });
  const availability = availabilityOf(search);
  const parsed = readTableState(
    { ...table, is_active: availability === "all" ? undefined : availability },
    CATALOG_TABLE,
  );
  if (!["all", "true", "false"].includes(availability))
    parsed.state = { ...parsed.state, filters: { ...parsed.state.filters, is_active: "true" } };
  if (legacy !== undefined && legacy !== "true" && legacy !== "false")
    parsed.ignored = [...parsed.ignored, "include_deactivated"];
  return parsed;
}

/** Clearing a chip means All; absent legacy URLs keep the previous Active default. */
export function catalogSearchPatch(patch: SearchPatch, search: RawSearch): SearchPatch {
  const next: Record<string, string | undefined> = { ...patch, include_deactivated: undefined };
  if (Object.hasOwn(patch, "is_active")) next["is_active"] = patch["is_active"] ?? "all";
  else if (search["include_deactivated"] !== undefined && search["is_active"] === undefined)
    next["is_active"] = availabilityOf(search);
  return next;
}
