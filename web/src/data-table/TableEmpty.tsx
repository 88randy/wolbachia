import { useTranslation } from "react-i18next";
import { EmptyState } from "../ui/EmptyState";
interface TableEmptyProps {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}
export function TableEmpty({ hasActiveFilters, onClearFilters }: TableEmptyProps) {
  const { t } = useTranslation();
  return (
    <EmptyState
      kind={hasActiveFilters ? "noResults" : "noData"}
      message={t(hasActiveFilters ? "table.empty.filteredTitle" : "table.empty.title")}
      actionLabel={hasActiveFilters ? t("table.filters.clear") : undefined}
      onAction={hasActiveFilters ? onClearFilters : undefined}
    />
  );
}
