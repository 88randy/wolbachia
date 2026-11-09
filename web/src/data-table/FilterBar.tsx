import { useTranslation } from "react-i18next";
import { InlineNotice } from "../ui/InlineNotice";
import { ExportButton } from "./ExportButton";
import { FilterChips } from "./FilterChips";
import { FilterControls } from "./FilterControls";
import { IgnoredNotice } from "./IgnoredNotice";
import { IncludeVoidedToggle } from "./IncludeVoidedToggle";
import styles from "./filter-bar.module.css";
import { SortSelect } from "./SortSelect";
import type { TableController, TableQueryConfig } from "./table-types";
import type { MessageKey } from "@wolbachia/i18n";

interface FilterBarProps {
  controller: TableController;
  labelKey?: MessageKey;
  /** `/api/v1/<resource>/export/`; the button shows only when it is given. */
  exportPath?: string;
}

function hasFilterControls(config: TableQueryConfig, exportPath: string | undefined) {
  return (
    config.filters.length > 0 ||
    config.supportsVoided ||
    exportPath !== undefined ||
    Boolean(config.sortOptions?.length)
  );
}

/**
 * Filters of a list (#29): the inputs the screen declared, the "Include voided" toggle when the
 * endpoint supports it, the export button, the chips of the active filters with "Clear filters",
 * and the notice for URL parameters that were ignored. All of it reads and writes the address.
 * A list with none of those (W62 has no filters) gets no empty "Filters" region.
 */
export function FilterBar({
  controller,
  exportPath,
  labelKey = "table.filters.label",
}: FilterBarProps) {
  const { t } = useTranslation();
  const { config, state } = controller;
  const hasControls = hasFilterControls(config, exportPath);
  if (!hasControls && !config.limitationsKey && controller.ignored.length === 0) return null;
  return (
    <section className={styles.bar} aria-label={t(labelKey)}>
      <IgnoredNotice names={controller.ignored} onDismiss={controller.dropIgnored} />
      <div className={styles.row}>
        <FilterControls controller={controller} />
        {Boolean(config.sortOptions?.length) && <SortSelect controller={controller} />}
        {config.supportsVoided && (
          <IncludeVoidedToggle isOn={state.includeVoided} onChange={controller.setIncludeVoided} />
        )}
        {exportPath !== undefined && <ExportButton exportPath={exportPath} state={state} />}
      </div>
      <FilterChips controller={controller} />
      {config.limitationsKey && <InlineNotice tone="info">{t(config.limitationsKey)}</InlineNotice>}
    </section>
  );
}
