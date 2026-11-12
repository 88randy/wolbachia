import type { MessageKey } from "@wolbachia/i18n";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { InfoHint } from "../ui/InfoHint";
import { ExportButton } from "./ExportButton";
import { FilterChips } from "./FilterChips";
import { filterLayoutOf } from "./filter-layout";
import { FilterPanel } from "./FilterPanel";
import { FilterPopover } from "./FilterPopover";
import { FilterSearch } from "./FilterSearch";
import { IgnoredNotice } from "./IgnoredNotice";
import { QuickFilter } from "./QuickFilter";
import type { TableController } from "./table-types";

export interface FilterBarProps {
  controller: TableController;
  labelKey?: MessageKey;
  /** `/api/v1/<resource>/export/`; the button shows only when it is given. */
  exportPath?: string;
  /** The primary page action (and secondary ones), right aligned in the toolbar. */
  actions?: ReactNode;
  /** Counts per option value of the quick filter ("" = all). */
  quickCounts?: Readonly<Record<string, number>>;
  /** Screen-owned pickers (lookups with their own data) shown inside "Filtros". */
  extraFilters?: ReactNode;
}

/** More tabs than this do not fit beside the search: they take their own row under it. */
const WIDE_QUICK_OPTIONS = 4;

function panelCount(controller: TableController, keys: readonly string[]): number {
  const active = keys.filter((key) => key in controller.state.filters).length;
  return active + (controller.state.includeVoided ? 1 : 0);
}

/**
 * The one list toolbar: live search, "Filtros" popover (dropdowns, date range, toggles),
 * quick status tabs, then the page action and the export on the right. Active filters show as
 * chips below. Everything reads and writes the URL through `controller`, so views stay shareable.
 * Sorting is done on the column headers, never here.
 */
export function FilterBar(props: FilterBarProps) {
  const { controller, exportPath, actions, quickCounts, extraFilters } = props;
  const labelKey = props.labelKey ?? "table.filters.label";
  const { t } = useTranslation();
  const { config, state } = controller;
  const layout = useMemo(() => filterLayoutOf(config), [config]);
  const panelKeys = [
    ...layout.panel.map((filter) => filter.key),
    ...(layout.dateRange ? [layout.dateRange.from.key, layout.dateRange.to.key] : []),
  ];
  const hasPanel =
    panelKeys.length > 0 ||
    config.supportsVoided ||
    layout.quick !== undefined ||
    extraFilters !== undefined;
  return (
    <section className="flex min-w-0 flex-col gap-2" aria-label={t(labelKey)}>
      <IgnoredNotice names={controller.ignored} onDismiss={controller.dropIgnored} />
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        {layout.search && (
          <FilterSearch
            filter={layout.search}
            value={state.filters[layout.search.key]}
            onChange={(next) => {
              if (layout.search) controller.setFilter(layout.search.key, next);
            }}
          />
        )}
        {hasPanel && (
          <FilterPopover activeCount={panelCount(controller, panelKeys)}>
            <FilterPanel controller={controller} layout={layout} />
            {extraFilters}
          </FilterPopover>
        )}
        {layout.quick && (
          <QuickFilter
            className={cn(
              "hidden md:inline-flex",
              layout.quick.options.length > WIDE_QUICK_OPTIONS && "order-last basis-full",
            )}
            filter={layout.quick}
            value={state.filters[layout.quick.key]}
            counts={quickCounts}
            onChange={(next) => {
              if (layout.quick) controller.setFilter(layout.quick.key, next);
            }}
          />
        )}
        {config.limitationsKey && <InfoHint text={t(config.limitationsKey)} />}
        <div className="ml-auto flex flex-wrap items-center gap-2 empty:hidden">
          {actions}
          {exportPath !== undefined && <ExportButton exportPath={exportPath} state={state} />}
        </div>
      </div>
      <FilterChips controller={controller} />
    </section>
  );
}
