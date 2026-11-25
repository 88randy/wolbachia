import { useTranslation } from "react-i18next";
import { FilterChip } from "../data-table/FilterChip";
import { useFormatCalendarRange } from "../format/use-formatters";
import { useEntityLabel } from "../lookups/use-entity-label";
import type { AnnotationExport } from "./annotation-export-query";

export function AnnotationExportFilters({ row }: { row: AnnotationExport }) {
  const { t } = useTranslation();
  const formatRange = useFormatCalendarRange();
  const author = useEntityLabel("user", row.author);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <FilterChip
        name={t("annotationExport.list.period")}
        value={formatRange(row.date_from, row.date_to)}
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
