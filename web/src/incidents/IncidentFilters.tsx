import { FilterBar } from "../data-table/FilterBar";
import type { TableController } from "../data-table/table-types";
import type { IncidentScope } from "./incidents-query";
import { IncidentContextFilter } from "./IncidentContextFilter";
import { IncidentTypeFilter } from "./IncidentTypeFilter";

interface IncidentFiltersProps {
  scope: IncidentScope;
  controller: TableController;
}

/** State tabs, search-free toolbar, and the type and context pickers inside "Filtros". */
export function IncidentFilters({ scope, controller }: IncidentFiltersProps) {
  return (
    <FilterBar
      controller={controller}
      extraFilters={
        <>
          <IncidentTypeFilter scope={scope} controller={controller} />
          <IncidentContextFilter scope={scope} controller={controller} />
        </>
      }
    />
  );
}
