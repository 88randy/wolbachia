import { useTranslation } from "react-i18next";
import buttons from "../styles/button.module.css";
import { classNames } from "../styles/class-names";
import { FilterChipList } from "./FilterChipList";
import styles from "./filter-bar.module.css";
import type { TableController } from "./table-types";

/**
 * One removable chip per active filter, and "Clear filters". The active filters are always
 * written out (never implicit).
 */
export function FilterChips({ controller }: { controller: TableController }) {
  const { t } = useTranslation();
  const { config, state } = controller;
  const active = config.filters.filter((filter) => filter.key in state.filters);
  if (active.length === 0) return null;
  return (
    <div className={styles.chips}>
      <FilterChipList controller={controller} active={active} />
      <button
        type="button"
        className={classNames(buttons.button, buttons.secondary)}
        onClick={controller.clearFilters}
      >
        {t("table.filters.clear")}
      </button>
    </div>
  );
}
