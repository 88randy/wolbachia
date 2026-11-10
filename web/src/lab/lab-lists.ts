import { unwrap } from "@wolbachia/api-client";
import type { Schemas } from "@wolbachia/api-client";
import { toFilterParams } from "../data-table/table-state";
import type { TableQueryConfig, TableState } from "../data-table/table-types";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import type { LabScope } from "./lab-query";

export type RecountRow = Schemas["RecountQueue"];
export type PaddleRow = Schemas["Paddle"];
export type ShipmentRow = Schemas["ShipmentProjection"];
export type SampleRow = Schemas["SampleSnapshot"];
export type MaterialRow = Schemas["MaterialRequestProjection"];

const LIST_PAGE_SIZE = 25;

function config(
  filters: TableQueryConfig["filters"],
  options: Partial<TableQueryConfig> = {},
): TableQueryConfig {
  return {
    paging: "page",
    pageSize: LIST_PAGE_SIZE,
    sortableIds: [],
    supportsVoided: false,
    filters,
    ...options,
  };
}

export const RECOUNT_TABLE = config([
  { kind: "text", key: "code", labelKey: "lab.recounts.filter", maxLength: 50 },
]);
export const PADDLE_TABLE = config(
  [{ kind: "text", key: "code", labelKey: "lab.paddles.filter", maxLength: 50 }],
  { sortableIds: ["code", "created_at"] },
);
export const SHIPMENT_TABLE = config(
  [{ kind: "text", key: "code", labelKey: "lab.shipments.filter", maxLength: 50 }],
  { supportsVoided: true },
);
export const SAMPLE_TABLE = config(
  [
    { kind: "text", key: "code", labelKey: "lab.results.filter", maxLength: 50 },
    {
      kind: "select",
      key: "pending_result",
      labelKey: "lab.col.result",
      options: [{ value: "true", labelKey: "lab.results.pendingOnly" }],
    },
  ],
  { supportsVoided: true },
);
export const MATERIAL_TABLE = config(
  [{ kind: "text", key: "code", labelKey: "lab.materials.filter", maxLength: 50 }],
  { supportsVoided: true },
);

function listQuery(scope: LabScope, state: TableState) {
  return {
    ...toFilterParams(state),
    ...(scope.identity.activeCenter ? { center: scope.identity.activeCenter } : {}),
    page: state.page,
    page_size: LIST_PAGE_SIZE,
  };
}

export function recountOptions(scope: LabScope, state: TableState) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["lab", "recounts", state],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/recounts/", {
          params: { query: listQuery(scope, state) },
          signal,
        }),
      ),
  });
}
export function paddleOptions(scope: LabScope, state: TableState) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["lab", "paddles", state],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/egg-paddles/", {
          params: { query: listQuery(scope, state) },
          signal,
        }),
      ),
  });
}
export function shipmentOptions(scope: LabScope, state: TableState) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["lab", "shipments", state],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/uieb-shipments/", {
          params: { query: listQuery(scope, state) },
          signal,
        }),
      ),
  });
}
export function sampleOptions(scope: LabScope, state: TableState) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["lab", "samples", state],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/wolbachia-samples/", {
          params: { query: listQuery(scope, state) },
          signal,
        }),
      ),
  });
}
export function materialOptions(scope: LabScope, state: TableState) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["lab", "materials", state],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/material-requests/", {
          params: { query: listQuery(scope, state) },
          signal,
        }),
      ),
  });
}

/** Cheap counts for the lab home: only the total of a one-row page. */
export function pendingCountOptions(scope: LabScope, kind: "receive" | "count" | "results") {
  return orgScopedQueryOptions(scope.identity, {
    key: ["lab", "pending", kind],
    queryFn: async ({ signal }) => {
      const center = scope.identity.activeCenter ? { center: scope.identity.activeCenter } : {};
      if (kind === "results")
        return unwrap(
          await scope.client.GET("/api/v1/wolbachia-samples/", {
            params: { query: { ...center, pending_result: true, page: 1, page_size: 1 } },
            signal,
          }),
        ).count;
      return unwrap(
        await scope.client.GET("/api/v1/bags/", {
          params: {
            query: {
              lab_status: kind === "receive" ? "expected" : "pending_count",
              page: 1,
              page_size: 1,
            },
          },
          signal,
        }),
      ).count;
    },
  });
}
