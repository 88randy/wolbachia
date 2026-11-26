import { FilterBar } from "../data-table/FilterBar";
import type { TableController } from "../data-table/table-types";

interface Props {
  controller: TableController;
  quickCounts?: Readonly<Record<string, number>> | undefined;
}

/** The center comes from the shell center filter, so it is not offered again here. */
export function FleetFilters({ controller, quickCounts }: Props) {
  const filters = controller.config.filters.filter((filter) => filter.key !== "center");
  return (
    <FilterBar
      controller={{ ...controller, config: { ...controller.config, filters } }}
      quickCounts={quickCounts}
    />
  );
}
