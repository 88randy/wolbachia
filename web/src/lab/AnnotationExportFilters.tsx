import { useTranslation } from "react-i18next";
import { FilterChip } from "../data-table/FilterChip";
import { useFormatCalendarDate } from "../format/use-formatters";
import { EntityName } from "../lookups/EntityName";
import type { AnnotationExport } from "./annotation-export-query";

export function AnnotationExportFilters({ row }: { row: AnnotationExport }) {
  const { t } = useTranslation();
  const formatDay = useFormatCalendarDate();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <FilterChip
        name={t("annotationExport.list.period")}
        value={`${formatDay(row.date_from)} – ${formatDay(row.date_to)}`}
      />
      {row.author && (
        <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs">
          <span>{t("annotationExport.form.author")}: </span>
          <EntityName kind="user" id={row.author} />
        </span>
      )}
      {row.include_voided && (
        <FilterChip name={t("annotationExport.form.includeVoided")} value="" />
      )}
    </div>
  );
}
