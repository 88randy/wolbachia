import { FilterDateRange } from "./FilterDateRange";
import { FilterLookup } from "./FilterLookup";
import { FilterPanelText } from "./FilterPanelText";
import { FilterSelect } from "./FilterSelect";
import type { FilterLayout } from "./filter-layout";
import { IncludeVoidedToggle } from "./IncludeVoidedToggle";
import { QuickFilter } from "./QuickFilter";
import type { TableController } from "./table-types";

/** The controls inside "Filtros": dropdowns, text boxes, the date range and the voided toggle. */
export function FilterPanel({
  controller,
  layout,
}: {
  controller: TableController;
  layout: FilterLayout;
}) {
  const { state } = controller;
  return (
    <>
      {layout.quick && (
        <div className="md:hidden">
          <QuickFilter
            filter={layout.quick}
            value={state.filters[layout.quick.key]}
            onChange={(next) => {
              if (layout.quick) controller.setFilter(layout.quick.key, next);
            }}
          />
        </div>
      )}
      {layout.panel.map((filter) => {
        const onChange = (next: string | undefined) => {
          controller.setFilter(filter.key, next);
        };
        const value = state.filters[filter.key];
        if (filter.kind === "text" && filter.input === "lookup" && filter.lookup)
          return (
            <FilterLookup
              key={filter.key}
              filter={{ ...filter, lookup: filter.lookup }}
              value={value}
              onChange={onChange}
            />
          );
        return filter.kind === "select" ? (
          <FilterSelect key={filter.key} filter={filter} value={value} onChange={onChange} />
        ) : (
          <FilterPanelText key={filter.key} filter={filter} value={value} onChange={onChange} />
        );
      })}
      {layout.dateRange && (
        <FilterDateRange
          from={layout.dateRange.from}
          to={layout.dateRange.to}
          controller={controller}
        />
      )}
      {controller.config.supportsVoided && (
        <IncludeVoidedToggle isOn={state.includeVoided} onChange={controller.setIncludeVoided} />
      )}
    </>
  );
}
