import { readTableState } from "../data-table/table-state";
import { CENTER_TABLE } from "./center-filter";
import { useSearch } from "@tanstack/react-router";
/** Record code lookups share the URL-owned center filter with list queries. */
export function useUrlCenter(): string | undefined {
  const search = useSearch({ strict: false });
  return readTableState(search, CENTER_TABLE).state.filters["center"];
}
