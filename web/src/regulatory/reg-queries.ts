/* eslint-disable max-lines-per-function -- presentational JSX of a screen; splitting it into one-use fragments would hurt readability. */
import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import type { TableQueryConfig, TableState } from "../data-table/table-types";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import type { SessionIdentity } from "../session/org-scoped-query";
import type { MessageKey } from "@wolbachia/i18n";

export interface RegScope {
  client: ApiClient;
  identity: SessionIdentity;
}

export type TransferRow = Schemas["TransferAuthorization"];
export type ArcoRow = Schemas["ArcoRequest"];
export type AccessRow = Schemas["AccessLog"];
export type ExportReceiptRow = Schemas["ExportLog"];
export type PortalSettings = Schemas["PortalSettings"];

const PAGE_SIZE = 25;

/** Cursor lists: the server owns the order, so no column sorts and there is no ordering key. */
function cursorTable(filters: TableQueryConfig["filters"]): TableQueryConfig {
  return {
    paging: "cursor",
    pageSize: PAGE_SIZE,
    sortableIds: [],
    supportsVoided: false,
    filters,
  };
}

const search = (labelKey: MessageKey) =>
  ({ kind: "text", key: "search", labelKey, maxLength: 80, input: "search" }) as const;

const dateRange = [
  {
    kind: "text",
    key: "created_after",
    labelKey: "regulatory.common.dates",
    maxLength: 40,
    input: "date-from",
    dateFormat: "datetime",
  },
  {
    kind: "text",
    key: "created_before",
    labelKey: "regulatory.common.dates",
    maxLength: 40,
    input: "date-to",
    dateFormat: "datetime",
  },
] as const;

export const TRANSFER_TABLE = cursorTable([
  search("regulatory.transfers.searchLabel"),
  {
    kind: "select",
    key: "status",
    labelKey: "regulatory.transfers.statusLabel",
    presentation: "segmented",
    options: [
      { value: "active", labelKey: "regulatory.transfers.status.active" },
      { value: "scheduled", labelKey: "regulatory.transfers.status.scheduled" },
      { value: "expired", labelKey: "regulatory.transfers.status.expired" },
      { value: "revoked", labelKey: "regulatory.transfers.status.revoked" },
    ],
  },
]);
export const ARCO_TABLE = cursorTable([
  search("regulatory.arco.searchLabel"),
  {
    kind: "select",
    key: "status",
    labelKey: "regulatory.arco.statusLabel",
    presentation: "segmented",
    options: [
      { value: "received", labelKey: "regulatory.arco.status.received" },
      { value: "in_progress", labelKey: "regulatory.arco.status.in_progress" },
      { value: "resolved", labelKey: "regulatory.arco.status.resolved" },
      { value: "rejected", labelKey: "regulatory.arco.status.rejected" },
    ],
  },
  {
    kind: "select",
    key: "request_type",
    labelKey: "regulatory.arco.typeLabel",
    options: [
      { value: "access", labelKey: "regulatory.arco.type.access" },
      { value: "rectification", labelKey: "regulatory.arco.type.rectification" },
      { value: "cancellation", labelKey: "regulatory.arco.type.cancellation" },
      { value: "opposition", labelKey: "regulatory.arco.type.opposition" },
    ],
  },
]);
export const ACCESS_TABLE = cursorTable([
  {
    kind: "select",
    key: "action",
    labelKey: "regulatory.access.actionLabel",
    options: [
      { value: "user.create", labelKey: "regulatory.access.action.user.create" },
      { value: "user.update", labelKey: "regulatory.access.action.user.update" },
      { value: "user.deactivate", labelKey: "regulatory.access.action.user.deactivate" },
      { value: "user.reveal_rfc", labelKey: "regulatory.access.action.user.reveal_rfc" },
      { value: "user.rotate_rfc", labelKey: "regulatory.access.action.user.rotate_rfc" },
    ],
  },
  {
    kind: "select",
    key: "result",
    labelKey: "regulatory.access.resultLabel",
    options: [
      { value: "success", labelKey: "regulatory.access.result.success" },
      { value: "rfc_rejected", labelKey: "regulatory.access.result.rfc_rejected" },
    ],
  },
  ...dateRange,
]);
export const RECEIPT_TABLE = cursorTable([...dateRange]);

function cursorParams(state: TableState) {
  return state.cursor === null ? {} : { cursor: state.cursor };
}

function dateParams(state: TableState) {
  const after = state.filters["created_after"];
  const before = state.filters["created_before"];
  return {
    ...(after === undefined ? {} : { created_after: after }),
    ...(before === undefined ? {} : { created_before: before }),
  };
}

function present<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  return allowed.find((candidate) => candidate === value);
}

export function transferOptions({ client, identity }: RegScope, state: TableState) {
  const status = present(state.filters["status"], ["active", "scheduled", "expired", "revoked"]);
  return orgScopedQueryOptions(identity, {
    key: ["regulatory", "transfers", state],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/data-transfers/", {
          params: {
            query: { ...cursorParams(state), search: state.filters["search"], status },
          },
          signal,
        }),
      ),
  });
}

export function arcoOptions({ client, identity }: RegScope, state: TableState) {
  const status = present(state.filters["status"], [
    "received",
    "in_progress",
    "resolved",
    "rejected",
  ]);
  const requestType = present(state.filters["request_type"], [
    "access",
    "rectification",
    "cancellation",
    "opposition",
  ]);
  return orgScopedQueryOptions(identity, {
    key: ["regulatory", "arco", state],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/arco-requests/", {
          params: {
            query: {
              ...cursorParams(state),
              search: state.filters["search"],
              status,
              request_type: requestType,
            },
          },
          signal,
        }),
      ),
  });
}

export function accessOptions({ client, identity }: RegScope, state: TableState) {
  const action = present(state.filters["action"], [
    "user.create",
    "user.update",
    "user.deactivate",
    "user.reveal_rfc",
    "user.rotate_rfc",
  ]);
  const result = present(state.filters["result"], ["success", "rfc_rejected"]);
  return orgScopedQueryOptions(identity, {
    key: ["regulatory", "access", state],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/access-log/", {
          params: { query: { ...cursorParams(state), ...dateParams(state), action, result } },
          signal,
        }),
      ),
  });
}

/** Receipts of the official exports; the range filters on the day they were downloaded. */
export function receiptOptions({ client, identity }: RegScope, state: TableState) {
  return orgScopedQueryOptions(identity, {
    key: ["regulatory", "receipts", state],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/export-log/", {
          params: { query: { ...cursorParams(state), ...dateParams(state) } },
          signal,
        }),
      ),
  });
}

export function portalSettingsOptions({ client, identity }: RegScope) {
  return orgScopedQueryOptions(identity, {
    key: ["regulatory", "portal-settings"],
    // The endpoint answers ONE object, but the generated schema types a `list` action as an array.
    queryFn: async ({ signal }) =>
      unwrap(await client.GET("/api/v1/portal-settings/", { signal })) as unknown as PortalSettings,
  });
}

export function centersOptions({ client, identity }: RegScope) {
  return orgScopedQueryOptions(identity, {
    key: ["regulatory", "centers"],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/centers/", { params: { query: { page_size: 100 } }, signal }),
      ),
  });
}

export function quadrantsOfCenterOptions({ client, identity }: RegScope, centerId: string) {
  return orgScopedQueryOptions(identity, {
    key: ["regulatory", "quadrants", centerId],
    queryFn: async ({ signal }) =>
      unwrap(
        await client.GET("/api/v1/lookups/quadrants/", {
          params: { query: { center: centerId, page_size: 100 } },
          signal,
        }),
      ),
  });
}
