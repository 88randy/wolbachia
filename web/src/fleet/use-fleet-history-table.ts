import { useNavigate, useSearch } from "@tanstack/react-router";
import { readTableState, applyPatch } from "../data-table/table-state";
import { buildTableController } from "../data-table/table-controller";
import type { SearchPatch } from "../data-table/table-types";
import { HISTORY_TABLES, HISTORY_PREFIX } from "./fleet-history-table";
import type { HistoryTab } from "./fleet-history-table";

/** Each history owns only its prefix; another tab or the parent list keeps its exact URL state. */
export function useFleetHistoryTable(tab: HistoryTab) {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const prefix = HISTORY_PREFIX[tab];
  const local = Object.fromEntries(
    Object.entries(search)
      .filter(([key]) => key.startsWith(prefix) && key !== `${prefix}source`)
      .map(([key, value]) => [key.slice(prefix.length), value]),
  );
  const parsed = readTableState(local, HISTORY_TABLES[tab]);
  const go = (patch: SearchPatch) => {
    const namespaced = Object.fromEntries(
      Object.entries(patch).map(([key, value]) => [prefix + key, value]),
    );
    void navigate({ to: ".", search: (previous) => applyPatch(previous, namespaced) });
  };
  return {
    controller: buildTableController(HISTORY_TABLES[tab], parsed, go),
    source: search[`${prefix}source`],
  };
}
