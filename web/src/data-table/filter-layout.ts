import type { FilterDefinition, SelectFilter, TableQueryConfig, TextFilter } from "./table-types";

/** Where each declared filter goes in the one FilterBar standard. */
export interface FilterLayout {
  /** The live search box on the left of the toolbar. */
  search: TextFilter | undefined;
  /** Quick filter tabs (the first `presentation: "segmented"` select). */
  quick: SelectFilter | undefined;
  /** Dropdowns and secondary text boxes inside the "Filtros" popover. */
  panel: readonly FilterDefinition[];
  /** One calendar range picker inside "Filtros". */
  dateRange: { from: TextFilter; to: TextFilter } | undefined;
}

/** UUID-sized text filters without a picker are ids: URL-only, never typed (36 = UUID length). */
const ID_LENGTH = 36;

/** The effective place of a text filter, with the defaults applied. */
export function inputOf(filter: TextFilter): NonNullable<TextFilter["input"]> | undefined {
  if (filter.input) return filter.input;
  if (filter.key === "search") return "search";
  return filter.maxLength === ID_LENGTH ? "hidden" : undefined;
}

/** Splits the filters of a list into toolbar search, quick tabs, panel controls and date range. */
export function filterLayoutOf(config: TableQueryConfig): FilterLayout {
  const texts = config.filters.filter((filter): filter is TextFilter => filter.kind === "text");
  const search =
    texts.find((filter) => inputOf(filter) === "search") ??
    texts.find((filter) => inputOf(filter) === undefined);
  const quick = config.filters.find(
    (filter): filter is SelectFilter =>
      filter.kind === "select" && filter.presentation === "segmented",
  );
  const from = texts.find((filter) => filter.input === "date-from");
  const to = texts.find((filter) => filter.input === "date-to");
  const panel = config.filters.filter((filter) => {
    if (filter === search || filter === quick) return false;
    if (filter.kind === "select") return true;
    const input = inputOf(filter);
    return input === undefined || input === "text" || (input === "lookup" && !!filter.lookup);
  });
  return { search, quick, panel, dateRange: from && to ? { from, to } : undefined };
}
