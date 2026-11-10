import { ApiError, unwrap } from "@wolbachia/api-client";
import type { Schemas } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import { toFilterParams } from "../../data-table/table-state";
import type { TableQueryConfig, TableState } from "../../data-table/table-types";
import { orgScopedQueryOptions } from "../../session/org-scoped-query";
import type { LabScope } from "../lab-query";

export type PcrRow = Schemas["PcrBatchRow"];
export type PcrDetail = Schemas["PcrBatchDetail"];
export type PcrSample = Schemas["PcrSampleEntry"];
export type PcrStatus = Schemas["PcrBatchStatusEnum"];
export type PcrTarget = Schemas["PcrTargetEnum"];
export type PcrOutcome = Schemas["PcrOutcomeEnum"];
export type ExternalLab = Schemas["ExternalLab"];
export type PcrPreview = Schemas["PcrPreview"];
export type PcrResultRow = Schemas["PcrResultRowRequest"];

export const PCR_READ = "pcr.read";
export const PCR_MANAGE = "pcr.manage";
export const PCR_TARGETS: readonly PcrTarget[] = ["wolbachia", "dengue"];
export const PCR_STATUSES: readonly PcrStatus[] = [
  "preparing",
  "ready_to_ship",
  "shipped",
  "received_by_lab",
  "results_received",
  "closed",
  "voided",
];
export const SEROTYPES = ["DENV-1", "DENV-2", "DENV-3", "DENV-4"] as const;
const PAGE_SIZE = 25;

export const PCR_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: PAGE_SIZE,
  sortableIds: [],
  supportsVoided: true,
  filters: [
    { kind: "text", key: "search", labelKey: "pcr.list.search", maxLength: 100 },
    {
      kind: "select",
      key: "status",
      labelKey: "pcr.filter.status",
      presentation: "segmented",
      options: PCR_STATUSES.filter((status) => status !== "voided").map((status) => ({
        value: status,
        labelKey: `pcr.status.${status}` as MessageKey,
      })),
    },
    {
      kind: "text",
      key: "shipped_from",
      labelKey: "pcr.filter.shippedFrom",
      maxLength: 10,
      input: "date-from",
      dateFormat: "date",
    },
    {
      kind: "text",
      key: "shipped_to",
      labelKey: "pcr.filter.shippedTo",
      maxLength: 10,
      input: "date-to",
      dateFormat: "date",
    },
  ],
};

export const LAB_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: PAGE_SIZE,
  sortableIds: [],
  supportsVoided: false,
  filters: [],
};

export function pcrListOptions(scope: LabScope, state: TableState) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["pcr", "list", state],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/pcr-batches/", {
          params: {
            query: {
              ...(toFilterParams(state) as Record<string, string>),
              ...(state.includeVoided ? { include_voided: true } : {}),
              page: state.page,
              page_size: PAGE_SIZE,
            },
          },
          signal,
        }),
      ),
  });
}

export function pcrDetailOptions(scope: LabScope, code: string) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["pcr", "detail", code],
    queryFn: async ({ signal }) => {
      const page = unwrap(
        await scope.client.GET("/api/v1/pcr-batches/", {
          params: { query: { code, include_voided: true } },
          signal,
        }),
      );
      const row = page.results[0];
      if (!row) return null;
      return unwrap(
        await scope.client.GET("/api/v1/pcr-batches/{id}/", {
          params: { path: { id: row.id } },
          signal,
        }),
      );
    },
  });
}

export function pcrSummaryOptions(scope: LabScope) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["pcr", "summary"],
    queryFn: async ({ signal }) =>
      unwrap(await scope.client.GET("/api/v1/pcr-batches/summary/", { signal })),
  });
}

export function labsOptions(scope: LabScope, page = 1, activeOnly = false) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["pcr", "labs", page, activeOnly],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/external-labs/", {
          params: {
            query: { page, page_size: activeOnly ? 100 : PAGE_SIZE, ...(activeOnly ? { active: true } : {}) },
          },
          signal,
        }),
      ),
  });
}

export interface EligibleFilters {
  quadrant?: string;
  epiWeek?: string;
  search?: string;
  page: number;
}

export function eligibleOptions(scope: LabScope, filters: EligibleFilters) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["pcr", "eligible", filters],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/pcr-batches/eligible-samples/", {
          params: {
            query: {
              page: filters.page,
              page_size: 50,
              ...(filters.quadrant ? { quadrant: filters.quadrant } : {}),
              ...(filters.epiWeek ? { epi_week: filters.epiWeek } : {}),
              ...(filters.search ? { search: filters.search } : {}),
            },
          },
          signal,
        }),
      ),
  });
}

/** i18n key of an API failure of a PCR command; never shows the server's text. */
export function pcrErrorKey(caught: unknown): MessageKey {
  if (!(caught instanceof ApiError)) return "pcr.error.generic";
  const fieldCode = Object.values(caught.envelope?.fields ?? {})[0]?.[0]?.code;
  const known = [caught.code, fieldCode].find(
    (code) => code !== undefined && `pcr.error.${code}` in PCR_ERROR_KEYS,
  );
  return known ? (`pcr.error.${known}` as MessageKey) : "pcr.error.generic";
}

const PCR_ERROR_KEYS: Record<string, true> = Object.fromEntries(
  [
    "pcr_transition_invalid",
    "pcr_results_incomplete",
    "pcr_sample_unavailable",
    "pcr_lab_unavailable",
    "pcr_lab_name_taken",
    "pcr_undo_blocked",
    "pcr_nothing_to_undo",
    "pcr_batch_void_blocked",
    "pcr_batch_voided",
    "pcr_batch_closed",
    "pcr_result_locked",
    "pcr_results_invalid",
    "pcr_results_not_expected",
    "pcr_report_not_expected",
    "pcr_file_not_ready",
    "pcr_file_type_invalid",
    "pcr_file_already_used",
    "pcr_date_in_future",
    "void_reason_too_short",
  ].map((code) => [`pcr.error.${code}`, true]),
);

export function saveBlob(blob: Blob, fileName: string) {
  const address = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = address;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(address);
}
