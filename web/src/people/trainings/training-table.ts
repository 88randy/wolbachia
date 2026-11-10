import type { TableQueryConfig, TableState } from "../../data-table/table-types";
import { TRAINING_PAGE_SIZE } from "./training-query";
import type { TrainingQuery } from "./training-query";
import type { CertificateQuery } from "./training-query";
import type { PersonContext } from "./person-context";
export const TRAINING_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: TRAINING_PAGE_SIZE,
  supportsVoided: false,
  defaultOrdering: "code",
  sortableIds: ["code", "name"],
  filters: [{ kind: "text", key: "code", labelKey: "trainings.field.code", maxLength: 120 }],
};
export const VERSION_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: TRAINING_PAGE_SIZE,
  supportsVoided: false,
  sortableIds: [],
  filters: [],
};
export const CERTIFICATE_TABLE: TableQueryConfig = {
  paging: "page",
  pageSize: TRAINING_PAGE_SIZE,
  supportsVoided: false,
  sortableIds: ["created_at"],
  defaultOrdering: "-created_at",
  filters: [],
};
export function trainingTableQuery(state: TableState): TrainingQuery {
  return {
    page: state.page,
    page_size: TRAINING_PAGE_SIZE,
    code: state.filters["code"],
    ordering: state.sort
      ? `${state.sort.direction === "desc" ? "-" : ""}${state.sort.id}`
      : undefined,
  };
}
export function certificateTableQuery(state: TableState, context: PersonContext): CertificateQuery {
  return {
    center: context.center,
    quadrant: context.quadrant || undefined,
    page: state.page,
    page_size: TRAINING_PAGE_SIZE,
    ordering: state.sort
      ? `${state.sort.direction === "desc" ? "-" : ""}${state.sort.id}`
      : undefined,
  };
}
