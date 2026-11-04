import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo } from "react";
import { buildTableController } from "./table-controller";
import { applyPatch, readTableState } from "./table-state";
import type { SearchPatch, TableController, TableQueryConfig } from "./table-types";

/**
 * Table state in the address bar (issue #29): `?status=open&ordering=-created_at&page=2`.
 * Every change pushes a history entry, so the back button restores the previous view, and any
 * change of filters or order starts again from the first page. `config` must be a constant
 * (declared outside the component): the state is recomputed only when the URL changes.
 *
 * The URL is user input, so it is validated on every read; whatever the table does not know is
 * ignored and reported in `ignored`.
 */
export function useTableUrlState(config: TableQueryConfig): TableController {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const parsed = useMemo(() => readTableState(search, config), [search, config]);
  const go = (patch: SearchPatch): void => {
    void navigate({ to: ".", search: (previous) => applyPatch(previous, patch) });
  };
  return buildTableController(config, parsed, go);
}
