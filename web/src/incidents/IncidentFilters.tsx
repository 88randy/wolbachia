import { IncidentStateFilter } from "./IncidentStateFilter";
import { useTranslation } from "react-i18next";
import { FilterControls } from "../data-table/FilterControls";
import { FilterChips } from "../data-table/FilterChips";
import { IgnoredNotice } from "../data-table/IgnoredNotice";
import type { TableController } from "../data-table/table-types";
import type { IncidentScope } from "./incidents-query";
import { IncidentTypeFilter } from "./IncidentTypeFilter";
import { IncidentContextFilter } from "./IncidentContextFilter";
import filterStyles from "../data-table/filter-bar.module.css";
const REFERENCES = ["type", "center", "quadrant"];
export function IncidentFilters({ scope, controller }: { scope: IncidentScope; controller: TableController }) {
 const { t } = useTranslation();
 const controls = { ...controller, config: { ...controller.config, filters: controller.config.filters.filter(filter => !REFERENCES.includes(filter.key) && filter.key !== "state") } };
 const chips = { ...controller, state: { ...controller.state, filters: Object.fromEntries(Object.entries(controller.state.filters).map(([key,value]) => [key, REFERENCES.includes(key) ? t("incidents.workspace.selectedContext") : value])) } };
 return <section className={filterStyles.bar} aria-label={t("table.filters.label")}>
 <IgnoredNotice names={controller.ignored} onDismiss={controller.dropIgnored} />
 <div className={filterStyles.row}>
 <IncidentStateFilter controller={controller} />
 <FilterControls controller={controls} />
 <IncidentTypeFilter scope={scope} controller={controller} />
 <IncidentContextFilter scope={scope} controller={controller} />
 </div>
 <FilterChips controller={chips} />
 </section>;
}
