import { useTranslation } from "react-i18next";
import { Select } from "../forms/Select";
import type { TableController } from "../data-table/table-types";
import type { IncidentScope } from "./incidents-query";
import { IncidentOptionStatus } from "./IncidentOptionStatus";
import { incidentContextChoices } from "./incident-context-choices";
import { useIncidentContextFilter } from "./use-incident-context-filter";
import { IncidentContextSearch } from "./IncidentContextSearch";
interface ContextFilterProps {
  scope: IncidentScope;
  controller: TableController;
}
export function IncidentContextFilter({ scope, controller }: ContextFilterProps) {
  const { t } = useTranslation();
  const context = useIncidentContextFilter(scope, controller);
  const options = incidentContextChoices(
    context.query.data?.results ?? [],
    context.value,
    t("incidents.workspace.selectedContext"),
  );
  return (
    <div>
      <IncidentContextSearch search={context.search} onSearch={context.searchFor} />
      <Select
        id="incident-context-filter"
        label={t("incidents.workspace.context")}
        value={context.value}
        options={[{ value: "", label: t("incidents.workspace.sessionContext") }, ...options]}
        disabled={context.query.isFetching}
        onChange={(event) => {
          context.select(event.target.value);
        }}
      />
      <IncidentOptionStatus page={context.page} onPage={context.setPage} query={context.query} />
    </div>
  );
}
