import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../../format/use-format-date-time";
import type { DataTableColumn } from "../../data-table/table-types";
import type { ReviewRow } from "./review-query";
import { reviewKindKey } from "./review-labels";

export function useReviewColumns(): DataTableColumn<ReviewRow>[] {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  return [
    { id: "code", headerKey: "reviews.workspace.causeColumn", cell: (row) => row.code },
    { id: "event_type", headerKey: "reviews.workspace.event", cell: (row) => row.event_type },
    {
      id: "kind",
      headerKey: "reviews.workspace.ingestColumn",
      cell: (row) => t(reviewKindKey(row.kind)),
    },
    { id: "courier", headerKey: "reviews.workspace.courier", cell: (row) => row.courier },
    {
      id: "created_at",
      headerKey: "reviews.workspace.received",
      cell: (row) => format(row.created_at),
    },
  ];
}
