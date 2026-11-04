import { useTranslation } from "react-i18next";
import buttons from "../styles/button.module.css";
import { classNames } from "../styles/class-names";
import styles from "./data-table.module.css";

interface TableEmptyProps {
  /** Filters are on: the empty answer may just mean "nothing matches". */
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export function TableEmpty({ hasActiveFilters, onClearFilters }: TableEmptyProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.state}>
      <p className={styles.stateTitle}>
        {t(hasActiveFilters ? "table.empty.filteredTitle" : "table.empty.title")}
      </p>
      {hasActiveFilters && (
        <>
          <p className={styles.stateBody}>{t("table.empty.filteredBody")}</p>
          <button
            type="button"
            className={classNames(buttons.button, buttons.secondary)}
            onClick={onClearFilters}
          >
            {t("table.filters.clear")}
          </button>
        </>
      )}
    </div>
  );
}
