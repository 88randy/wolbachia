import type { TableQueryConfig, TableState } from "../../data-table/table-types";
import { RELOCATION_PAGE_SIZE } from "./relocations-query";
import type { RelocationQuery } from "./relocations-query";
export const RELOCATION_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: RELOCATION_PAGE_SIZE,
  supportsVoided: true,
  defaultOrdering: "-created_at",
  sortableIds: ["created_at", "event__device_time", "ovitrap__sampling_point__code"],
  filters: [
    {
      kind: "select",
      key: "status",
      labelKey: "relocations.workspace.status",
      options: [
        { value: "pending", labelKey: "relocations.workspace.pending" },
        { value: "approved", labelKey: "relocations.workspace.approved" },
        { value: "rejected", labelKey: "relocations.workspace.rejected" },
        { value: "all", labelKey: "relocations.workspace.all" },
      ],
    },
  ],
};
/** Only declared generated query fields leave the validated URL controller. */
export function relocationTableQuery(state: TableState): RelocationQuery {
  const status = state.filters["status"];
  return {
    page: state.page,
    page_size: RELOCATION_PAGE_SIZE,
    status: status === "all" ? undefined : ((status ?? "pending") as RelocationQuery["status"]),
    code: state.filters["code"],
    point: state.filters["point"],
    ovitrap: state.filters["ovitrap"],
    include_voided: state.includeVoided,
    ordering: state.sort
      ? `${state.sort.direction === "desc" ? "-" : ""}${state.sort.id}`
      : undefined,
  };
}
