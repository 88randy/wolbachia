/* eslint-disable max-lines-per-function -- presentational JSX of a screen; splitting it into one-use fragments would hurt readability. */
import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import type { TableQueryConfig, TableState } from "../data-table/table-types";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import type { SessionIdentity } from "../session/org-scoped-query";
import { decodeRange, endOfDayInstant, startOfDayInstant } from "./toolbar/date-range";

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

const text = (key: string, maxLength: number) =>
  ({ kind: "text", key, labelKey: "regulatory.common.search", maxLength }) as const;

export const TRANSFER_TABLE = cursorTable([
  text("search", 80),
  { kind: "text", key: "status", labelKey: "regulatory.transfers.statusLabel", maxLength: 12 },
]);
export const ARCO_TABLE = cursorTable([
  text("search", 80),
  { kind: "text", key: "status", labelKey: "regulatory.arco.statusLabel", maxLength: 12 },
  { kind: "text", key: "request_type", labelKey: "regulatory.arco.typeLabel", maxLength: 14 },
]);
export const ACCESS_TABLE = cursorTable([
  { kind: "text", key: "action", labelKey: "regulatory.access.actionLabel", maxLength: 24 },
  { kind: "text", key: "result", labelKey: "regulatory.access.resultLabel", maxLength: 16 },
  { kind: "text", key: "dates", labelKey: "regulatory.common.dates", maxLength: 21 },
]);
export const RECEIPT_TABLE = cursorTable([
  { kind: "text", key: "dates", labelKey: "regulatory.common.dates", maxLength: 21 },
]);

function cursorParams(state: TableState) {
  return state.cursor === null ? {} : { cursor: state.cursor };
}

function dateParams(state: TableState) {
  const { from, to } = decodeRange(state.filters["dates"]);
  const after = from === undefined ? undefined : startOfDayInstant(from);
  const before = endOfDayInstant(to ?? from ?? "");
  return {
    ...(after === undefined ? {} : { created_after: after }),
    ...(from === undefined || before === undefined ? {} : { created_before: before }),
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
        await client.GET("/api/v1/quadrants/", {
          params: { query: { center: centerId, page_size: 100 } },
          signal,
        }),
      ),
  });
}
