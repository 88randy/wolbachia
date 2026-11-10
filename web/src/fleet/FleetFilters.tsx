import type { TableController } from "../data-table/table-types";
import { FilterBar } from "../data-table/FilterBar";

/**
 * The shared filter bar, minus the reference-id filters: neither a person nor a center directory
 * exists for them, and the active center already scopes every fleet read.
 */
export function FleetFilters({ controller }: { controller: TableController }) {
  const controls = {
    ...controller,
    config: {
      ...controller.config,
      filters: controller.config.filters.filter(
        (filter) => !["courier", "center"].includes(filter.key),
      ),
    },
  };
  return <FilterBar controller={controls} />;
}
