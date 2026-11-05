import { useNavigate, useSearch } from "@tanstack/react-router";
import { buildTableController } from "../data-table/table-controller";
import { applyPatch, readTableState } from "../data-table/table-state";
import type { SearchPatch, TableQueryConfig } from "../data-table/table-types";

const TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: 200,
  filters: [],
  sortableIds: [],
  supportsVoided: false,
};

/** Same flat URL reader/writer as IncludeVoidedToggle, named for configuration availability. */
export function useCatalogTable() {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const { include_deactivated: includeDeactivated, ...tableSearch } = search;
  const parsed = readTableState(tableSearch, TABLE);
  if (
    includeDeactivated !== undefined &&
    includeDeactivated !== "true" &&
    includeDeactivated !== "false"
  )
    parsed.ignored = [...parsed.ignored, "include_deactivated"];
  const go = (patch: SearchPatch) => {
    void navigate({ to: ".", search: (previous) => applyPatch(previous, patch) });
  };
  const controller = buildTableController(TABLE, parsed, go);
  return {
    controller,
    isIncludingDeactivated: includeDeactivated === "true",
    setInclude: (include: boolean) => {
      go({ include_deactivated: include ? "true" : undefined });
    },
  };
}
