import { unwrap } from "@wolbachia/api-client";
import type { Schemas } from "@wolbachia/api-client";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import type { TableQueryConfig } from "../data-table/table-types";
import type { LabScope } from "./lab-query";
import { exportPollInterval } from "./annotation-export-domain";

export type AnnotationExport = Schemas["EggAnnotationExport"];
export type AnnotationExportRequest = Schemas["EggAnnotationExportCreateRequest"];
export const EXPORT_PAGE_SIZE = 25;
export const EXPORT_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: EXPORT_PAGE_SIZE,
  filters: [],
  sortableIds: [],
  defaultOrdering: "-created_at",
  supportsVoided: false,
};

/** Only the current server page determines whether polling continues. */
export function annotationExportsOptions(scope: LabScope, page: number) {
  const options = orgScopedQueryOptions(scope.identity, {
    key: ["lab", "annotation-exports", page],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/lab/egg-annotation-exports/", {
          params: { query: { page, page_size: EXPORT_PAGE_SIZE } },
          signal,
        }),
      ),
  });
  return {
    ...options,
    refetchInterval: (query: { state: { data?: { results: AnnotationExport[] } } }) =>
      exportPollInterval(query.state.data?.results),
  };
}
