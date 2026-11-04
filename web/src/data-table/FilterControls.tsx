import { FilterSelect } from "./FilterSelect";
import { FilterText } from "./FilterText";
import type { TableController } from "./table-types";

/** The input of every filter the list declares. */
export function FilterControls({ controller }: { controller: TableController }) {
  return controller.config.filters.map((filter) => {
    const value = controller.state.filters[filter.key];
    const onChange = (next: string | undefined) => {
      controller.setFilter(filter.key, next);
    };
    return filter.kind === "select" ? (
      <FilterSelect key={filter.key} filter={filter} value={value} onChange={onChange} />
    ) : (
      <FilterText key={filter.key} filter={filter} value={value} onChange={onChange} />
    );
  });
}
