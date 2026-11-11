import { ApiError, unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import { toFilterParams } from "../../../data-table/table-state";
import type { TableQueryConfig, TableState } from "../../../data-table/table-types";
import { orgScopedQueryOptions } from "../../../session/org-scoped-query";
import type { SessionIdentity } from "../../../session/org-scoped-query";

export type CenterRow = Schemas["CenterAdmin"];
export type ReadinessRow = Schemas["CenterReadinessRow"];
export type Readiness = Schemas["CenterReadiness"];
export type MoveResult = Schemas["CenterMoveResult"];

export const CENTER_CREATE = "center.create";
export const CENTER_UPDATE = "center.update";
export const CENTER_DEACTIVATE = "center.deactivate";
export const CENTERS_PATH = "/settings/organization/centers";
const PAGE_SIZE = 25;
const PICKER_PAGE = 200;

export interface CentersScope {
  client: ApiClient;
  identity: SessionIdentity;
}

export const CENTERS_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: PAGE_SIZE,
  sortableIds: ["name", "code", "updated_at"],
  supportsVoided: false,
  filters: [
    { kind: "text", key: "search", labelKey: "centersAdmin.filter.search", maxLength: 100 },
    {
      kind: "select",
      key: "include_inactive",
      labelKey: "centersAdmin.filter.includeInactive",
      options: [{ value: "true", labelKey: "centersAdmin.filter.includeInactive" }],
    },
  ],
};

export function centersListOptions(scope: CentersScope, state: TableState) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["centers", "admin", state],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/centers/", {
          params: {
            query: {
              ...(toFilterParams(state) as Record<string, string>),
              page: state.page,
              page_size: PAGE_SIZE,
            },
          },
          signal,
        }),
      ),
  });
}

/** One center by its human code, including an inactive one; `null` when it is not visible. */
export function centerDetailOptions(scope: CentersScope, code: string) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["centers", "admin", "detail", code],
    queryFn: async ({ signal }) => {
      const page = unwrap(
        await scope.client.GET("/api/v1/centers/", {
          params: { query: { code, include_inactive: true } },
          signal,
        }),
      );
      return page.results[0] ?? null;
    },
  });
}

export function readinessOptions(scope: CentersScope, id: string) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["centers", "admin", "readiness", id],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/centers/{id}/readiness/", {
          params: { path: { id } },
          signal,
        }),
      ),
  });
}

/** Active centers other than `exclude`, for the destination pickers of the close flow. */
export function otherCentersOptions(scope: CentersScope, exclude: string) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["centers", "admin", "others", exclude],
    queryFn: async ({ signal }) => {
      const page = unwrap(
        await scope.client.GET("/api/v1/centers/", {
          params: { query: { page_size: PICKER_PAGE } },
          signal,
        }),
      );
      return page.results.filter((center) => center.id !== exclude);
    },
  });
}

/** Warehouses outside `exclude` (the center being closed) that match `search`. */
export function warehousesOptions(scope: CentersScope, exclude: string, search: string) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["centers", "admin", "warehouses", exclude, search],
    queryFn: async ({ signal }) => {
      const page = unwrap(
        await scope.client.GET("/api/v1/locations/", {
          params: {
            query: { kind: "warehouse", page_size: PICKER_PAGE, ...(search ? { search } : {}) },
          },
          signal,
        }),
      );
      return page.results.filter((location) => location.center !== exclude);
    },
  });
}

/** The machine code of an API error (field error first), for the `centersAdmin.error.*` keys. */
export function errorCodeOf(caught: unknown): string {
  if (!(caught instanceof ApiError)) return "generic";
  const fields = caught.envelope?.fields ?? {};
  const first = Object.values(fields)[0]?.[0]?.code;
  return first ?? caught.code;
}

/** The field of a `400` field error (`name`, `code`), else `undefined`. */
export function errorFieldOf(caught: unknown): string | undefined {
  if (!(caught instanceof ApiError)) return undefined;
  return Object.keys(caught.envelope?.fields ?? {})[0];
}

const ERROR_KEYS: Readonly<Record<string, MessageKey>> = {
  center_code_taken: "centersAdmin.error.centerCodeTaken",
  invalid_code: "centersAdmin.error.invalidCode",
  required: "centersAdmin.error.required",
  blank: "centersAdmin.error.required",
  center_scope_limited: "centersAdmin.error.centerScopeLimited",
  center_state_conflict: "centersAdmin.error.centerStateConflict",
};

export function errorKeyOf(caught: unknown): MessageKey {
  return ERROR_KEYS[errorCodeOf(caught)] ?? "centersAdmin.error.generic";
}

const REASON_KEYS: Readonly<Record<string, MessageKey>> = {
  motorcycles: "centersAdmin.reason.motorcycles",
  open_shifts: "centersAdmin.reason.openShifts",
  stock: "centersAdmin.reason.stock",
  active_quadrants: "centersAdmin.reason.activeQuadrants",
  not_found: "centersAdmin.reason.notFound",
  permission_denied: "centersAdmin.reason.permissionDenied",
  transfer_command_conflict: "centersAdmin.reason.transferCommandConflict",
  transfer_storage_unavailable: "centersAdmin.reason.transferStorageUnavailable",
};

/** The blockers of a refused deactivation (`409 center_has_active_work`), else none. */
export function blockersOf(caught: unknown): Schemas["BlockedBy"][] {
  if (!(caught instanceof ApiError) || caught.code !== "center_has_active_work") return [];
  return caught.envelope?.blocked_by ?? [];
}

export function reasonKeyOf(reason: string | undefined): MessageKey {
  return (reason && REASON_KEYS[reason]) || "centersAdmin.reason.other";
}

type RowKey = ReadinessRow["key"];

/** Title, one-line help and action label of each checklist row. */
export const ROW_KEYS: Readonly<
  Record<RowKey, { title: MessageKey; help: MessageKey; action: MessageKey }>
> = {
  open_shifts: {
    title: "centersAdmin.closeRow.openShifts",
    help: "centersAdmin.closeRow.openShiftsHelp",
    action: "centersAdmin.closeRow.openShiftsAction",
  },
  stock: {
    title: "centersAdmin.closeRow.stock",
    help: "centersAdmin.closeRow.stockHelp",
    action: "centersAdmin.closeRow.stockAction",
  },
  motorcycles: {
    title: "centersAdmin.closeRow.motorcycles",
    help: "centersAdmin.closeRow.motorcyclesHelp",
    action: "centersAdmin.closeRow.motorcyclesAction",
  },
  active_quadrants: {
    title: "centersAdmin.closeRow.activeQuadrants",
    help: "centersAdmin.closeRow.activeQuadrantsHelp",
    action: "centersAdmin.closeRow.activeQuadrantsAction",
  },
  people_only_here: {
    title: "centersAdmin.closeRow.peopleOnlyHere",
    help: "centersAdmin.closeRow.peopleOnlyHereHelp",
    action: "centersAdmin.closeRow.peopleOnlyHereAction",
  },
};

export const RESULT_KEYS: Readonly<Record<MoveResult["status"], MessageKey>> = {
  moved: "centersAdmin.result.moved",
  prepared: "centersAdmin.result.prepared",
  already_prepared: "centersAdmin.result.alreadyPrepared",
  failed: "centersAdmin.result.failed",
};
