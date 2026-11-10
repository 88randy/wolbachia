import type { TableController } from "../data-table/table-types";
const REFERENCES = ["type", "center", "quadrant"];
export function incidentFilterControls(controller: TableController): TableController {
  return {
    ...controller,
    config: {
      ...controller.config,
      filters: controller.config.filters.filter(
        (filter) => !REFERENCES.includes(filter.key) && filter.key !== "state",
      ),
    },
  };
}
export function incidentFilterChips(
  controller: TableController,
  selectedContext: string,
): TableController {
  return {
    ...controller,
    state: {
      ...controller.state,
      filters: Object.fromEntries(
        Object.entries(controller.state.filters).map(([key, value]) => [
          key,
          REFERENCES.includes(key) ? selectedContext : value,
        ]),
      ),
    },
  };
}
