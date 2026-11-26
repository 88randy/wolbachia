import {
  nextOrdering,
  patchForClearFilters,
  patchForCursor,
  patchForFilter,
  patchForIgnored,
  patchForIncludeVoided,
  patchForPage,
  patchForSort,
} from "./table-state";
import type {
  ParsedTableState,
  SearchPatch,
  TableController,
  TableQueryConfig,
  TableState,
} from "./table-types";

type Go = (patch: SearchPatch) => void;
type PagingActions = Pick<TableController, "goToPage" | "goToCursor">;

function pagingActions(go: Go): PagingActions {
  return {
    goToPage: (page) => {
      go(patchForPage(page));
    },
    goToCursor: (cursor) => {
      go(patchForCursor(cursor));
    },
  };
}

function orderingActions(go: Go, state: TableState, defaultOrdering: string | undefined) {
  return {
    toggleSort: (columnId: string) => {
      go(patchForSort(nextOrdering(state.sort, columnId, defaultOrdering)));
    },
    setOrdering: (ordering: string | undefined) => {
      go(patchForSort(ordering));
    },
  };
}

/**
 * The state read from the URL plus one action per thing the user can change. Every action is a
 * patch of the address (`go`), so what the table shows is always what the URL says.
 */
export function buildTableController(
  config: TableQueryConfig,
  { state, ignored }: ParsedTableState,
  go: Go,
): TableController {
  return {
    ...pagingActions(go),
    ...orderingActions(go, state, config.defaultOrdering),
    config,
    state,
    ignored,
    hasActiveFilters: Object.keys(state.filters).length > 0,
    setFilter: (key, value) => {
      go(patchForFilter(key, value));
    },
    setFilters: (patch) => {
      go({ ...patchForFilter("page", undefined), ...patch });
    },
    clearFilters: () => {
      go(patchForClearFilters(config));
    },
    setIncludeVoided: (include) => {
      go(patchForIncludeVoided(include));
    },
    dropIgnored: () => {
      go(patchForIgnored(ignored));
    },
  };
}
