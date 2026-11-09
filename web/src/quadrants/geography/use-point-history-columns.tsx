import type { Schemas } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { geographyColumn } from "./geography-column";
export function usePointHistoryColumns() {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const column = geographyColumn<Schemas["PointVersion"]>;
  return [
    {
      ...column("version", "geography.field.revision", (row) => row.version),
      align: "end" as const,
    },
    column("location", "geography.field.location", (row) => row.location.join(",")),
    column("effective_from", "geography.field.effective", (row) => format(row.effective_from)),
    column(
      "created_by",
      "geography.field.author",
      (row) => row.created_by ?? t("geography.status.unknown"),
    ),
    column("is_retired", "geography.field.status", (row) =>
      t(row.is_retired ? "geography.status.retired" : "geography.status.active"),
    ),
  ];
}
