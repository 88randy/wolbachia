import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import { CENTER_LOOKUP } from "../../lookups/lookup-sources";
import type { TableQueryConfig, TableState } from "../../data-table/table-types";
import { orgScopedQueryOptions } from "../../session/org-scoped-query";
import type { SessionIdentity } from "../../session/org-scoped-query";
import { ENTOMOLOGY_READ, OPERATIONS_READ } from "../permissions";

export type Comparison = Schemas["Comparison"];
export type ComparisonRow = Comparison["rows"][number];

export const INDICATORS = ["positive_index", "coverage", "eggs_per_ovitrap"] as const;
export type Indicator = (typeof INDICATORS)[number];
export const GROUPS = ["quadrant", "center"] as const;
export type Group = (typeof GROUPS)[number];

/** Which dashboard permission opens each indicator (the backend checks the same pairing). */
export const INDICATOR_PERMISSION: Readonly<Record<Indicator, string>> = {
  positive_index: ENTOMOLOGY_READ,
  eggs_per_ovitrap: ENTOMOLOGY_READ,
  coverage: OPERATIONS_READ,
};

/* eslint-disable max-lines-per-function -- one declarative filter list. */
/** The comparison table state: only the indicators the user may read are offered. */
export function comparisonTable(allowed: readonly Indicator[]): TableQueryConfig {
  return {
    paging: "page",
    pageSize: 100,
    sortableIds: [],
    supportsVoided: false,
    filters: [
      {
        kind: "select",
        key: "indicator",
        labelKey: "comparison.filter.indicator",
        defaultValue: allowed[0] ?? "positive_index",
        options: allowed.map((value) => ({
          value,
          labelKey: `comparison.indicator.${value}` as const,
        })),
      },
      {
        kind: "select",
        key: "group_by",
        labelKey: "comparison.filter.groupBy",
        presentation: "segmented",
        defaultValue: "quadrant",
        options: GROUPS.map((value) => ({ value, labelKey: `comparison.group.${value}` as const })),
      },
      {
        kind: "text",
        key: "center",
        labelKey: "comparison.filter.center",
        maxLength: 36,
        input: "lookup",
        lookup: CENTER_LOOKUP,
      },
      {
        kind: "text",
        key: "date_from",
        labelKey: "comparison.filter.dates",
        maxLength: 10,
        input: "date-from",
        dateFormat: "date",
      },
      {
        kind: "text",
        key: "date_to",
        labelKey: "comparison.filter.dates",
        maxLength: 10,
        input: "date-to",
        dateFormat: "date",
      },
    ],
  };
}

export interface ComparisonRequest {
  indicator: Indicator;
  group: Group;
  center: string | undefined;
  dateFrom: string | undefined;
  dateTo: string | undefined;
}

/** Reads the validated table state into a request; unknown values fall back to the defaults. */
export function requestOf(state: TableState, allowed: readonly Indicator[]): ComparisonRequest {
  const wanted = INDICATORS.find((value) => value === state.filters["indicator"]);
  const indicator = wanted !== undefined && allowed.includes(wanted) ? wanted : allowed[0];
  return {
    indicator: indicator ?? "positive_index",
    group: GROUPS.find((value) => value === state.filters["group_by"]) ?? "quadrant",
    center: state.filters["center"],
    dateFrom: state.filters["date_from"],
    dateTo: state.filters["date_to"],
  };
}

export function comparisonOptions(
  client: ApiClient,
  identity: SessionIdentity,
  request: ComparisonRequest,
) {
  const query = {
    indicator: request.indicator,
    group_by: request.group,
    ...(request.center === undefined ? {} : { center: request.center }),
    ...(request.dateFrom === undefined ? {} : { date_from: request.dateFrom }),
    ...(request.dateTo === undefined ? {} : { date_to: request.dateTo }),
  };
  return orgScopedQueryOptions(identity, {
    key: ["analytics", "comparison", query],
    queryFn: async ({ signal }) =>
      unwrap(await client.GET("/api/v1/analytics/comparison/", { params: { query }, signal })),
  });
}
