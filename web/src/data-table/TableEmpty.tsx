import { useTranslation } from "react-i18next";
import { Inbox } from "lucide-react";
import { EmptyState } from "../ui/EmptyState";
import styles from "./data-table.module.css";
interface TableEmptyProps {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}
export function TableEmpty({ hasActiveFilters, onClearFilters }: TableEmptyProps) {
  const { t } = useTranslation();
  if (hasActiveFilters)
    return (
      <EmptyState
        kind="noResults"
        message={t("table.empty.filteredTitle")}
        actionLabel={t("table.filters.clear")}
        onAction={onClearFilters}
      />
    );
  return (
    <div className={styles.state}>
      <Inbox strokeWidth={1.5} aria-hidden="true" />
      <p className={styles.stateTitle}>{t("table.empty.title")}</p>
    </div>
  );
}
