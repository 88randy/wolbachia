import { useNavigate, useSearch } from "@tanstack/react-router";
import { buildTableController } from "../data-table/table-controller";
import { applyPatch } from "../data-table/table-state";
import type { SearchPatch } from "../data-table/table-types";
import { CATALOG_TABLE } from "./catalog-table";
import { catalogSearchPatch, readCatalogTableState } from "./catalog-table-state";
/** Availability migration and the nested catalog picker retain independent URL state. */
export function useCatalogTable() {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const go = (patch: SearchPatch) => {
    void navigate({
      to: ".",
      search: (previous) => applyPatch(previous, catalogSearchPatch(patch, search)),
    });
  };
  const controller = buildTableController(CATALOG_TABLE, readCatalogTableState(search), go);
  const { filters, sort, isSortExplicit } = controller.state;
  return {
    controller,
    canReorder:
      !filters["search"] &&
      filters["is_active"] !== "false" &&
      (!isSortExplicit || (sort?.id === "sort" && sort.direction === "asc")),
    viewKey: JSON.stringify(controller.state),
  };
}
