import { useTranslation } from "react-i18next";
import { FilterChip } from "../data-table/FilterChip";
import { useFormatCalendarDate } from "../format/use-formatters";
import { useEntityLabel } from "../lookups/use-entity-label";
import type { AnnotationExport } from "./annotation-export-query";

export function AnnotationExportFilters({ row }: { row: AnnotationExport }) {
  const { t } = useTranslation();
  const formatDay = useFormatCalendarDate();
  const author = useEntityLabel("user", row.author);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <FilterChip
        name={t("annotationExport.list.period")}
        value={`${formatDay(row.date_from)} – ${formatDay(row.date_to)}`}
      />
      {row.author && (
        <FilterChip
          name={t("annotationExport.form.author")}
          value={author?.label ?? t("ui.states.noValue")}
        />
      )}
      {row.include_voided && (
        <FilterChip name={t("annotationExport.form.includeVoided")} value="" />
      )}
    </div>
  );
}
