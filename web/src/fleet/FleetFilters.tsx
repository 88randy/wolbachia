import { FilterBar } from "../data-table/FilterBar";
import type { TableController } from "../data-table/table-types";

/** The center comes from the shell's center filter, so it is not offered again here. */
export function FleetFilters({ controller }: { controller: TableController }) {
  const filters = controller.config.filters.filter((filter) => filter.key !== "center");
  return <FilterBar controller={{ ...controller, config: { ...controller.config, filters } }} />;
}
