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
  expired: "neutral",
} as const satisfies Record<AnnotationExport["status"], Tone>;

export function useAnnotationExportColumns(scope: LabScope): DataTableColumn<AnnotationExport>[] {
  const { t } = useTranslation();
  const formatDateTime = useFormatDateTime();
  const formatNumber = useFormatNumber();
  return [
    {
      id: "created_at",
      headerKey: "annotationExport.list.export",
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{t(`annotationExport.format.${row.format}`)}</span>
          <time className="whitespace-nowrap text-xs text-ink-2" dateTime={row.created_at}>
            {formatDateTime(row.created_at)}
          </time>
        </div>
      ),
    },
    {
      id: "filters",
      headerKey: "annotationExport.list.filters",
      cell: (row) => <AnnotationExportFilters row={row} />,
    },
    {
      id: "content",
      headerKey: "annotationExport.list.content",
      cell: (row) => (
        <dl className="grid grid-cols-[auto_auto] gap-x-2 text-xs">
          {(
            [
              ["image_count", "imageCount"],
              ["box_count", "boxCount"],
              ["point_count", "pointCount"],
            ] as const
          ).map(([id, label]) => (
            <div key={id} className="contents">
              <dt className="text-ink-2">{t(`annotationExport.list.${label}`)}</dt>
              <dd className="text-end tabular-nums">{formatNumber(row[id])}</dd>
            </div>
          ))}
        </dl>
      ),
    },
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
