import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../../format/use-format-date-time";
import type { DataTableColumn } from "../../data-table/table-types";
import type { ReviewRow } from "./review-query";
import { reviewKindKey } from "./review-labels";
import { reviewEventKey } from "./review-event-label";
import { useCouriers } from "../../scheduling/use-directories";

export function useReviewColumns(): DataTableColumn<ReviewRow>[] {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const courierName = useCouriers([]).nameOf;
  return [
    { id: "code", headerKey: "reviews.workspace.causeColumn", cell: (row) => row.code },
    {
      id: "event_type",
      headerKey: "reviews.workspace.event",
      cell: (row) => t(reviewEventKey(row.event_type)),
    },
    {
      id: "kind",
      headerKey: "reviews.workspace.ingestColumn",
      cell: (row) => t(reviewKindKey(row.kind)),
    },
    {
      id: "courier",
      headerKey: "reviews.workspace.courierName",
      cell: (row) => courierName(row.courier),
    },
    {
      id: "created_at",
      headerKey: "reviews.workspace.received",
      cell: (row) => format(row.created_at),
    },
  ];
}
