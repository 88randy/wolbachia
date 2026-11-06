import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo } from "react";
import { buildTableController } from "./table-controller";
import { applyPatch, readTableState } from "./table-state";
import type { SearchPatch, TableController, TableQueryConfig } from "./table-types";
import { scopedTableSearch, scopedTablePatch } from "./table-url-scope";
import type { TableUrlScope } from "./table-url-scope";
const DEFAULT_SCOPE: TableUrlScope = {};

/**
 * Table state in the address bar (issue #29): `?status=open&ordering=-created_at&page=2`.
 * Every change pushes a history entry, so the back button restores the previous view, and any
 * change of filters or order starts again from the first page. `config` must be a constant
 * (declared outside the component): the state is recomputed only when the URL changes.
 *
 * The URL is user input, so it is validated on every read; whatever the table does not know is
 * ignored and reported in `ignored`.
 */
export function useTableUrlState(
  config: TableQueryConfig,
  scope: TableUrlScope = DEFAULT_SCOPE,
): TableController {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const parsed = useMemo(
    () => readTableState(scopedTableSearch(search, scope), config),
    [search, config, scope],
  );
  const go = (patch: SearchPatch): void => {
    void navigate({
      to: ".",
      search: (previous) => applyPatch(previous, scopedTablePatch(patch, scope.prefix)),
    });
  };
  return buildTableController(config, parsed, go);
}
