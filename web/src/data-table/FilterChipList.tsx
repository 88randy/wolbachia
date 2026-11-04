import { useTranslation } from "react-i18next";
import { FilterChip } from "./FilterChip";
import styles from "./filter-bar.module.css";
import type { FilterDefinition, TableController } from "./table-types";

interface FilterChipListProps {
  controller: TableController;
  active: readonly FilterDefinition[];
}

/** The chips as a list, so a screen reader says how many filters are on. */
export function FilterChipList({ controller, active }: FilterChipListProps) {
  const { t } = useTranslation();
  return (
    <ul className={styles.chipList} aria-label={t("table.filters.active")}>
      {active.map((filter) => (
        <li key={filter.key}>
          <FilterChip
            filter={filter}
            value={controller.state.filters[filter.key] ?? ""}
            onRemove={() => {
              controller.setFilter(filter.key, undefined);
            }}
          />
        </li>
      ))}
    </ul>
  );
}
