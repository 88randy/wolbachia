/* eslint-disable max-lines-per-function -- declarative table columns and their presentational cells. */
import { useTranslation } from "react-i18next";
import type { DataTableColumn } from "../data-table/table-types";
import { useFormatDateTime } from "../format/use-format-date-time";
import { useFormatNumber } from "../format/use-formatters";
import { StatusPill } from "../ui/StatusPill";
import type { Tone } from "../ui/tone";
import { AnnotationExportDownload } from "./AnnotationExportDownload";
import { AnnotationExportFilters } from "./AnnotationExportFilters";
import type { AnnotationExport } from "./annotation-export-query";
import type { LabScope } from "./lab-query";

const STATUS_TONE = {
  queued: "neutral",
  running: "info",
  ready: "success",
  failed: "critical",
} as const satisfies Record<AnnotationExport["status"], Tone>;

export function useAnnotationExportColumns(scope: LabScope): DataTableColumn<AnnotationExport>[] {
  const { t } = useTranslation();
  const formatDateTime = useFormatDateTime();
  const formatNumber = useFormatNumber();
  return [
    {
      id: "created_at",
      headerKey: "annotationExport.list.created",
      cell: (row) => <time dateTime={row.created_at}>{formatDateTime(row.created_at)}</time>,
    },
    {
      id: "format",
      headerKey: "annotationExport.form.format",
      cell: (row) => t(`annotationExport.format.${row.format}`),
    },
    {
      id: "filters",
      headerKey: "annotationExport.list.filters",
      cell: (row) => <AnnotationExportFilters row={row} />,
    },
    ...(
      [
        ["image_count", "imageCount"],
        ["box_count", "boxCount"],
        ["point_count", "pointCount"],
      ] as const
    ).map(([id, label]) => ({
      id,
      headerKey: `annotationExport.list.${label}` as const,
      align: "end" as const,
      cell: (row: AnnotationExport) => formatNumber(row[id]),
    })),
    {
      id: "status",
      headerKey: "annotationExport.list.status",
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <StatusPill tone={STATUS_TONE[row.status]}>
            {t(`annotationExport.status.${row.status}`)}
          </StatusPill>
          {row.status === "failed" && (
            <span className="text-xs text-ink-2">{t("annotationExport.error.task")}</span>
          )}
        </div>
      ),
    },
    {
      id: "download",
      headerKey: "annotationExport.list.download",
      cell: (row) => <AnnotationExportDownload row={row} scope={scope} />,
    },
  ];
}
