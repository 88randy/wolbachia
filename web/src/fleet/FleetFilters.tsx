import { useTranslation } from "react-i18next";
import type { TableController } from "../data-table/table-types";
import { FilterControls } from "../data-table/FilterControls";
import { FilterChips } from "../data-table/FilterChips";
import { IgnoredNotice } from "../data-table/IgnoredNotice";
import { IncludeVoidedToggle } from "../data-table/IncludeVoidedToggle";
import styles from "../data-table/filter-bar.module.css";
/** Real reference IDs remain chips; neither a person nor a center directory is invented. */
export function FleetFilters({ controller }: { controller: TableController }) {
  const { t } = useTranslation();
  const controls = {
    ...controller,
    config: {
      ...controller.config,
      filters: controller.config.filters.filter(
        (filter) => !["courier", "center"].includes(filter.key),
      ),
    },
  };
  return (
    <section className={styles.bar} aria-label={t("table.filters.label")}>
      <IgnoredNotice names={controller.ignored} onDismiss={controller.dropIgnored} />
      <div className={styles.row}>
        <FilterControls controller={controls} />
        {controller.config.supportsVoided && (
          <IncludeVoidedToggle
            isOn={controller.state.includeVoided}
            onChange={controller.setIncludeVoided}
          />
        )}
      </div>
      <FilterChips controller={controller} />
    </section>
  );
}
