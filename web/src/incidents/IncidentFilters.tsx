import { IncidentStateFilter } from "./IncidentStateFilter";
import { useTranslation } from "react-i18next";
import { FilterControls } from "../data-table/FilterControls";
import { FilterChips } from "../data-table/FilterChips";
import { IgnoredNotice } from "../data-table/IgnoredNotice";
import type { TableController } from "../data-table/table-types";
import type { IncidentScope } from "./incidents-query";
import { IncidentTypeFilter } from "./IncidentTypeFilter";
import { IncidentContextFilter } from "./IncidentContextFilter";
import { incidentFilterControls, incidentFilterChips } from "./incident-filter-controllers";
import filterStyles from "../data-table/filter-bar.module.css";
interface IncidentFiltersProps {
  scope: IncidentScope;
  controller: TableController;
}
export function IncidentFilters({ scope, controller }: IncidentFiltersProps) {
  const { t } = useTranslation();
  const controls = incidentFilterControls(controller);
  const chips = incidentFilterChips(controller, t("incidents.workspace.selectedContext"));
  return (
    <section className={filterStyles.bar} aria-label={t("table.filters.label")}>
      <IgnoredNotice names={controller.ignored} onDismiss={controller.dropIgnored} />
      <div className={filterStyles.row}>
        <IncidentStateFilter controller={controller} />
        <FilterControls controller={controls} />
        <IncidentTypeFilter scope={scope} controller={controller} />
        <IncidentContextFilter scope={scope} controller={controller} />
      </div>
      <FilterChips controller={chips} />
    </section>
  );
}
