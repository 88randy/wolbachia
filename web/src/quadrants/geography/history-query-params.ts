import type { operations } from "@wolbachia/api-client";
import type { TableState } from "../../data-table/table-types";
import { listParams, PAGE_SIZE } from "./geography-table";
type RevisionQuery = NonNullable<operations["quadrants_versions_list"]["parameters"]["query"]>;
type PointQuery = NonNullable<operations["sampling_points_versions_list"]["parameters"]["query"]>;
type HistoryState = number | TableState;
const REVISION_ORDER = [
  "revision",
  "effective_from",
  "created_at",
  "created_by",
  "-revision",
  "-effective_from",
  "-created_at",
  "-created_by",
] as const satisfies readonly NonNullable<RevisionQuery["ordering"]>[];
const POINT_ORDER = [
  "version",
  "effective_from",
  "created_at",
  "created_by",
  "is_retired",
  "-version",
  "-effective_from",
  "-created_at",
  "-created_by",
  "-is_retired",
] as const satisfies readonly NonNullable<PointQuery["ordering"]>[];
function filterOf(state: HistoryState, key: string) {
  return typeof state === "number" ? undefined : state.filters[key];
}
function commonParams(state: HistoryState) {
  return {
    page: typeof state === "number" ? state : state.page,
    page_size: PAGE_SIZE,
    created_by: filterOf(state, "created_by"),
    effective_from_from: filterOf(state, "effective_from_from"),
    effective_from_before: filterOf(state, "effective_from_before"),
  };
}
function orderingOf<T extends string>(state: HistoryState, allowed: readonly T[]): T | undefined {
  const ordering = typeof state === "number" ? undefined : listParams(state).ordering;
  return allowed.find((choice) => choice === ordering);
}
/** The generated endpoint enums define the outgoing allowlists; no parent list fields are spread. */
export function revisionHistoryParams(state: HistoryState): RevisionQuery {
  const revision = filterOf(state, "revision");
  return {
    ...commonParams(state),
    revision: revision ? Number(revision) : undefined,
    ordering: orderingOf(state, REVISION_ORDER),
  };
}
export function pointHistoryParams(state: HistoryState): PointQuery {
  const version = filterOf(state, "version");
  const retired = filterOf(state, "is_retired");
  return {
    ...commonParams(state),
    version: version ? Number(version) : undefined,
    is_retired: retired === "true" || retired === "false" ? retired : undefined,
    ordering: orderingOf(state, POINT_ORDER),
  };
}
